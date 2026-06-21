/**
 * Testes dos helpers server-side de tokens FCM (web-push-pwa TASK-03).
 *
 * `getUserTokens(uid)` lista tokens válidos do usuário (parse tolerante: descarta
 * docs fora do schema). `pruneTokens(tokens)` apaga em lote os tokens dados;
 * lista vazia = no-op; best-effort (nunca lança).
 *
 * Mocks: server-only, getAdminFirestore. Schema REAL.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { getFirestoreMock } = vi.hoisted(() => ({ getFirestoreMock: vi.fn() }));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { getUserTokens, pruneTokens } from "@/server/notifications/tokens";

function tokenDoc(over: Record<string, unknown> = {}) {
  return {
    data: () => ({
      token: "t-1",
      userId: "uid-1",
      userAgent: "ua",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      ...over,
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getUserTokens", () => {
  it("retorna os tokens do usuário", async () => {
    const whereMock = vi.fn().mockReturnValue({
      get: async () => ({ docs: [tokenDoc({ token: "t-1" }), tokenDoc({ token: "t-2" })] }),
    });
    getFirestoreMock.mockReturnValue({ collection: () => ({ where: whereMock }) });

    const tokens = await getUserTokens("uid-1");
    expect(tokens).toEqual(["t-1", "t-2"]);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
  });

  it("descarta docs fora do schema (legado/órfão)", async () => {
    getFirestoreMock.mockReturnValue({
      collection: () => ({
        where: () => ({
          get: async () => ({
            docs: [tokenDoc({ token: "ok" }), { data: () => ({ broken: true }) }],
          }),
        }),
      }),
    });
    const tokens = await getUserTokens("uid-1");
    expect(tokens).toEqual(["ok"]);
  });

  it("lista vazia quando o usuário não tem tokens", async () => {
    getFirestoreMock.mockReturnValue({
      collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }),
    });
    expect(await getUserTokens("uid-1")).toEqual([]);
  });
});

describe("pruneTokens", () => {
  it("apaga em lote os tokens dados", async () => {
    const deleteMock = vi.fn();
    const commitMock = vi.fn(async () => {});
    const docMock = vi.fn((token: string) => ({ id: token }));
    getFirestoreMock.mockReturnValue({
      collection: () => ({ doc: docMock }),
      batch: () => ({ delete: deleteMock, commit: commitMock }),
    });

    await pruneTokens(["t-1", "t-2"]);
    expect(docMock).toHaveBeenCalledTimes(2);
    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(commitMock).toHaveBeenCalledTimes(1);
  });

  it("no-op quando a lista é vazia (sem commit)", async () => {
    const commitMock = vi.fn(async () => {});
    getFirestoreMock.mockReturnValue({
      collection: () => ({ doc: vi.fn() }),
      batch: () => ({ delete: vi.fn(), commit: commitMock }),
    });
    await pruneTokens([]);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("best-effort: não lança se o commit falhar", async () => {
    getFirestoreMock.mockReturnValue({
      collection: () => ({ doc: (t: string) => ({ id: t }) }),
      batch: () => ({
        delete: vi.fn(),
        commit: async () => {
          throw new Error("firestore down");
        },
      }),
    });
    await expect(pruneTokens(["t-1"])).resolves.toBeUndefined();
  });
});
