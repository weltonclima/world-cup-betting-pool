/**
 * Testes de `hydrateRankingEntries` — resolução AO VIVO dos campos de exibição
 * (avatarUrl/nickname/name) das entries de ranking a partir de `users/{uid}`.
 *
 * Fix do bug "ranking mostra foto antiga": o snapshot gravado pelo recalc fica
 * defasado quando o usuário troca foto/apelido sem disparar recalc. Estes testes
 * fixam: sobrescrita pelo valor vivo, remoção de avatar, fallback para o snapshot
 * quando o user sumiu / campo ausente, leitura em lote e atalho de lista vazia.
 */

import { describe, expect, it, vi } from "vitest";

import type { RankingEntry } from "@/types";

vi.mock("server-only", () => ({}));

import { hydrateRankingEntries } from "@/server/rankings/hydrateEntries";

/** Snapshot estilo firebase-admin (id/exists/data). */
function userSnap(id: string, data: Record<string, unknown> | null) {
  return { id, exists: data !== null, data: () => data ?? undefined };
}

/**
 * Firestore mock: `collection("users").doc(uid)` devolve uma ref carregando o uid;
 * `getAll(...refs)` resolve os snaps pré-configurados por uid.
 */
function mockDb(snapsByUid: Record<string, Record<string, unknown> | null>) {
  const getAll = vi.fn(async (...refs: Array<{ uid: string }>) =>
    refs.map((r) => userSnap(r.uid, snapsByUid[r.uid] ?? null)),
  );
  const db = {
    collection: vi.fn(() => ({ doc: (uid: string) => ({ uid }) })),
    getAll,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { db, getAll };
}

const entry = (over: Partial<RankingEntry> & { uid: string }): RankingEntry => ({
  uid: over.uid,
  nickname: over.nickname ?? "snap-nick",
  name: over.name ?? "Snap Name",
  position: over.position ?? 1,
  points: over.points ?? 10,
  ...(over.avatarUrl !== undefined ? { avatarUrl: over.avatarUrl } : {}),
});

describe("hydrateRankingEntries", () => {
  it("lista vazia → retorna [] sem tocar o Firestore", async () => {
    const { db, getAll } = mockDb({});
    const out = await hydrateRankingEntries(db, []);
    expect(out).toEqual([]);
    expect(getAll).not.toHaveBeenCalled();
  });

  it("sobrescreve avatar/nickname/name com os valores VIVOS", async () => {
    const { db } = mockDb({
      u1: { avatarUrl: "data:image/jpeg;base64,NEW", nickname: "novo", name: "Nome Novo" },
    });
    const [out] = await hydrateRankingEntries(db, [
      entry({ uid: "u1", avatarUrl: "data:image/jpeg;base64,OLD", nickname: "velho", name: "Nome Velho" }),
    ]);
    expect(out!.avatarUrl).toBe("data:image/jpeg;base64,NEW");
    expect(out!.nickname).toBe("novo");
    expect(out!.name).toBe("Nome Novo");
  });

  it("avatar removido no perfil (user sem avatarUrl) → remove avatarUrl da entry", async () => {
    const { db } = mockDb({ u1: { nickname: "ana", name: "Ana" } });
    const [out] = await hydrateRankingEntries(db, [
      entry({ uid: "u1", avatarUrl: "data:image/jpeg;base64,OLD" }),
    ]);
    expect(out).not.toHaveProperty("avatarUrl");
  });

  it("user ausente → mantém o snapshot gravado", async () => {
    const { db } = mockDb({ u1: null });
    const snapshot = entry({ uid: "u1", avatarUrl: "data:image/jpeg;base64,OLD", nickname: "velho" });
    const [out] = await hydrateRankingEntries(db, [snapshot]);
    expect(out!.avatarUrl).toBe("data:image/jpeg;base64,OLD");
    expect(out!.nickname).toBe("velho");
  });

  it("nickname vazio / name ausente no doc vivo → preserva o snapshot (não apaga)", async () => {
    const { db } = mockDb({ u1: { nickname: "", avatarUrl: "data:image/jpeg;base64,NEW" } });
    const [out] = await hydrateRankingEntries(db, [
      entry({ uid: "u1", nickname: "snap-nick", name: "Snap Name" }),
    ]);
    expect(out!.nickname).toBe("snap-nick"); // "" (length 0) não sobrescreve
    expect(out!.name).toBe("Snap Name"); // ausente no doc vivo → mantém snapshot
    expect(out!.avatarUrl).toBe("data:image/jpeg;base64,NEW"); // avatar vivo ainda aplica
  });

  it("getAll falha → degrada pro snapshot (não propaga, ranking não cai)", async () => {
    const db = {
      collection: vi.fn(() => ({ doc: (uid: string) => ({ uid }) })),
      getAll: vi.fn(async () => {
        throw new Error("firestore down");
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const snapshot = entry({ uid: "u1", avatarUrl: "data:image/jpeg;base64,OLD", nickname: "velho" });
    const out = await hydrateRankingEntries(db, [snapshot]);
    expect(out[0]!.avatarUrl).toBe("data:image/jpeg;base64,OLD");
    expect(out[0]!.nickname).toBe("velho");
    errSpy.mockRestore();
  });

  it("lê todos os uids em UM lote (getAll)", async () => {
    const { db, getAll } = mockDb({
      u1: { avatarUrl: "A" },
      u2: { avatarUrl: "B" },
    });
    const out = await hydrateRankingEntries(db, [
      entry({ uid: "u1" }),
      entry({ uid: "u2" }),
    ]);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(out.map((e) => e.avatarUrl)).toEqual(["A", "B"]);
  });
});
