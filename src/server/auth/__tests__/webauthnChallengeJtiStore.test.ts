import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getFirestoreMock } = vi.hoisted(() => ({ getFirestoreMock: vi.fn() }));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

import { consumeJti } from "@/server/auth/webauthnChallengeJtiStore";

/**
 * Store de `jti` consumidos do challenge (HR-01, TASK-07). Single-use server-side:
 * `create()` atômico → primeira chamada grava (true), replay colide
 * ALREADY_EXISTS (code 6) → false. Compartilhado por registro e login.
 */

function makeFs({ createError = null as { code?: number } | null } = {}) {
  const createMock = createError
    ? vi.fn().mockRejectedValue(createError)
    : vi.fn().mockResolvedValue(undefined);
  const docMock = vi.fn(() => ({ create: createMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  getFirestoreMock.mockReturnValue({ collection: collectionMock });
  return { createMock, docMock, collectionMock };
}

const EXPIRES = "2026-06-09T12:05:00.000Z";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("consumeJti", () => {
  it("primeiro consumo grava o jti (doc id = jti) e retorna true", async () => {
    const { createMock, docMock, collectionMock } = makeFs();
    const ok = await consumeJti("jti-1", EXPIRES);
    expect(ok).toBe(true);
    expect(collectionMock).toHaveBeenCalledWith("webauthn_challenge_jti");
    expect(docMock).toHaveBeenCalledWith("jti-1");
    expect(createMock).toHaveBeenCalledTimes(1);
    // Persiste expiresAt para a TTL policy limpar.
    expect(createMock.mock.calls[0]![0]).toMatchObject({ expiresAt: EXPIRES });
  });

  it("replay (ALREADY_EXISTS) → false, sem relançar", async () => {
    makeFs({ createError: { code: 6 } });
    expect(await consumeJti("jti-1", EXPIRES)).toBe(false);
  });

  it("outros erros do Firestore propagam (não mascarados como replay)", async () => {
    makeFs({ createError: { code: 13 } });
    await expect(consumeJti("jti-1", EXPIRES)).rejects.toBeTruthy();
  });
});
