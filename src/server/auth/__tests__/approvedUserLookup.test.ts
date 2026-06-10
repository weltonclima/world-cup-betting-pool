import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getFirestoreMock } = vi.hoisted(() => ({ getFirestoreMock: vi.fn() }));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

import { getApprovedUserRole } from "@/server/auth/approvedUserLookup";

/**
 * Lookup de autorização do login biométrico (TASK-07): resolve `status` +
 * `role` do doc `users/{uid}` para decidir emissão do custom token. Sem sessão
 * (login), então NÃO usa `requireApprovedUser`. `role` alimenta o claim do
 * custom token (M1).
 */

function makeUserDoc(data: Record<string, unknown> | null) {
  const docGet = vi
    .fn()
    .mockResolvedValue(
      data ? { exists: true, data: () => data } : { exists: false },
    );
  const docMock = vi.fn(() => ({ get: docGet }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  getFirestoreMock.mockReturnValue({ collection: collectionMock });
  return { docMock, collectionMock };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("getApprovedUserRole", () => {
  it("usuário approved com role admin → { approved:true, role:'admin' }", async () => {
    const { collectionMock, docMock } = makeUserDoc({
      status: "approved",
      role: "admin",
    });
    const res = await getApprovedUserRole("uid-1");
    expect(collectionMock).toHaveBeenCalledWith("users");
    expect(docMock).toHaveBeenCalledWith("uid-1");
    expect(res).toEqual({ approved: true, role: "admin" });
  });

  it("approved sem role → role default 'user' (M1)", async () => {
    makeUserDoc({ status: "approved" });
    expect(await getApprovedUserRole("uid-1")).toEqual({
      approved: true,
      role: "user",
    });
  });

  it("status pending → approved:false (mantém role para decisão a montante)", async () => {
    makeUserDoc({ status: "pending", role: "user" });
    const res = await getApprovedUserRole("uid-1");
    expect(res?.approved).toBe(false);
  });

  it("doc inexistente → null", async () => {
    makeUserDoc(null);
    expect(await getApprovedUserRole("missing")).toBeNull();
  });
});
