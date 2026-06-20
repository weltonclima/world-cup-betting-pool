import { getDoc, getDocs } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNotification,
  getPreferences,
  listNotifications,
} from "@/services/notifications";

// --- Mocks de Firestore (sem rede/emulador) ---
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __tag: "collection" })),
  doc: vi.fn(() => ({ __tag: "doc" })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(() => ({ __tag: "limit" })),
  orderBy: vi.fn(() => ({ __tag: "orderBy" })),
  query: vi.fn(() => ({ __tag: "query" })),
  where: vi.fn(() => ({ __tag: "where" })),
}));

vi.mock("@/firebase", () => ({
  firestore: { __tag: "firestore" },
}));

const getDocMock = vi.mocked(getDoc);
const getDocsMock = vi.mocked(getDocs);

function snapExists(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

function snapMissing() {
  return {
    exists: () => false,
    data: () => undefined,
  } as unknown as Awaited<ReturnType<typeof getDoc>>;
}

function querySnap(items: Record<string, unknown>[]) {
  return {
    docs: items.map((data) => ({ data: () => data })),
  } as unknown as Awaited<ReturnType<typeof getDocs>>;
}

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    userId: "u1",
    type: "system",
    title: "Cadastro aprovado",
    message: "Bem-vindo!",
    isRead: false,
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPreferences (tolerância a doc legado)", () => {
  it("doc ausente → default de 3 categorias", async () => {
    getDocMock.mockResolvedValueOnce(snapMissing());

    const result = await getPreferences("u1");

    expect(result).toEqual({
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
    });
  });

  it("doc válido → retorna preferências do usuário", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists({
        userId: "u1",
        system: false,
        games: true,
        ranking: false,
      }),
    );

    const result = await getPreferences("u1");

    expect(result).toMatchObject({ system: false, games: true, ranking: false });
  });

  it("doc legado com campo `pool` extra (.strict falharia) → cai no default", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists({
        userId: "u1",
        system: true,
        games: true,
        ranking: true,
        pool: true, // campo removido em PRD-15
      }),
    );

    const result = await getPreferences("u1");

    expect(result).toEqual({
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
    });
    expect(result).not.toHaveProperty("pool");
  });

  it("doc legado com `pool` + opt-outs reais → preserva opt-outs (não reseta p/ on)", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists({
        userId: "u1",
        system: false,
        games: false,
        ranking: true,
        pool: true, // campo legado, ignorado
      }),
    );

    const result = await getPreferences("u1");

    expect(result).toEqual({
      userId: "u1",
      system: false,
      games: false,
      ranking: true,
    });
  });
});

describe("listNotifications (descarte de item inválido)", () => {
  it("descarta doc legado `type: pool` e preserva os válidos", async () => {
    getDocsMock.mockResolvedValueOnce(
      querySnap([
        makeNotification({ id: "n1", type: "games" }),
        makeNotification({ id: "n2", type: "pool" }), // inválido pós-PRD-15
        makeNotification({ id: "n3", type: "ranking" }),
      ]),
    );

    const result = await listNotifications("u1");

    expect(result.map((n) => n.id)).toEqual(["n1", "n3"]);
  });

  it("lista vazia retorna []", async () => {
    getDocsMock.mockResolvedValueOnce(querySnap([]));

    const result = await listNotifications("u1");

    expect(result).toEqual([]);
  });
});

describe("getNotification (tolerância a doc legado)", () => {
  it("doc inexistente → null", async () => {
    getDocMock.mockResolvedValueOnce(snapMissing());

    expect(await getNotification("n1")).toBeNull();
  });

  it("doc válido → retorna a notificação", async () => {
    getDocMock.mockResolvedValueOnce(snapExists(makeNotification()));

    const result = await getNotification("n1");

    expect(result).toMatchObject({ id: "n1", type: "system" });
  });

  it("doc legado `type: pool` → trata como ausente (null), não quebra", async () => {
    getDocMock.mockResolvedValueOnce(
      snapExists(makeNotification({ type: "pool" })),
    );

    expect(await getNotification("n1")).toBeNull();
  });
});
