/**
 * TASK-21 — gate "ativo" no sweep de recalc por campeonato.
 *
 * A união de campeonatos pontuáveis (`championshipUnion`, §7.5) exclui, além dos
 * cups e do legado, as ligas `status === "archived"`: campeonato arquivado é
 * congelado/servido do banco (TASK-13/14) e NÃO deve ser re-pontuado ao vivo.
 *
 * O catálogo real não tem liga arquivada (só `fifa.world`, cup+legado), então
 * mockamos `getChampionship` para marcar `eng.1-2026` como arquivada e provar que:
 *  - liga ATIVA (`bra.1-2026`, upcoming) continua sendo pontuada (não regride TASK-11);
 *  - liga ARQUIVADA (`eng.1-2026`) fica de fora — nenhum doc escrito, não conta no sumário.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveMatchesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

// Marca eng.1-2026 como arquivada; o resto do catálogo permanece real.
vi.mock("@/server/copaData/championshipCatalog", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/server/copaData/championshipCatalog")
  >();
  return {
    ...actual,
    getChampionship: (id: string) => {
      const c = actual.getChampionship(id);
      if (c && c.id === "eng.1-2026") return { ...c, status: "archived" as const };
      return c;
    },
  };
});

vi.mock("server-only", () => ({}));

import { recalcRankings } from "@/server/rankings/recalc";

const baseUser = (over: Record<string, unknown>) => ({
  name: "Fulano",
  nickname: "fulano",
  email: "f@x.com",
  role: "participant",
  status: "approved",
  ...over,
});

function makeScopedDb(opts: {
  users: Array<Record<string, unknown>>;
  preds: Array<Record<string, unknown>>;
  pools: Array<Record<string, unknown>>;
}) {
  const { users, preds, pools } = opts;
  const setPayloads = new Map<string, unknown>();
  const poolById = new Map(pools.map((p) => [p["id"] as string, p]));

  const collection = vi.fn((name: string) => {
    if (name === "users") {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: users.map((u) => ({ id: u["uid"], data: () => u })),
          }),
        }),
        get: vi.fn().mockResolvedValue({ docs: [] }),
        doc: vi.fn(),
      };
    }
    if (name === "predictions") {
      return {
        get: vi.fn().mockResolvedValue({
          docs: preds.map((p, i) => ({ id: `p${i}`, data: () => p })),
        }),
        where: vi.fn((_field: string, op: string, val: unknown) => ({
          get: vi.fn().mockResolvedValue({
            docs: preds
              .filter((p) =>
                op === "in" && Array.isArray(val) ? val.includes(p["uid"]) : true,
              )
              .map((p, i) => ({ id: `p${i}`, data: () => p })),
          }),
        })),
        doc: vi.fn(),
      };
    }
    if (name === "pools") {
      return {
        get: vi.fn().mockResolvedValue({
          docs: pools.map((p) => ({ id: p["id"], data: () => p })),
        }),
        where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
        doc: vi.fn((id: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: poolById.has(id),
            data: () => poolById.get(id),
          }),
        })),
      };
    }
    if (name === "rankings") {
      return {
        get: vi.fn().mockResolvedValue({ docs: [] }),
        where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
        doc: vi.fn((id: string) => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: vi.fn(async (payload: unknown) => {
            setPayloads.set(`rankings/${id}`, payload);
          }),
          ref: { delete: vi.fn() },
        })),
      };
    }
    return {
      get: vi.fn().mockResolvedValue({ docs: [] }),
      where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
      doc: vi.fn((id: string) => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: vi.fn(async (payload: unknown) => {
          setPayloads.set(`${name}/${id}`, payload);
        }),
        ref: { delete: vi.fn() },
      })),
    };
  });
  return { db: { collection } as never, setPayloads };
}

const leagueMatch = (id: string, homeScore: number, awayScore: number) => ({
  id,
  status: "finished" as const,
  homeScore,
  awayScore,
  stage: "regular",
  groupId: null,
  kickoffAt: "2026-05-11T13:00:00-03:00",
});

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockImplementation(async (championshipId?: string) => {
    const byId: Record<string, unknown[]> = {
      "fifa.world": [],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 2, 0)],
      "eng.1-2026": [leagueMatch("eng.1-2026:em1", 2, 0)],
    };
    return byId[championshipId ?? "fifa.world"] ?? [];
  });
});
afterEach(() => vi.restoreAllMocks());

describe("recalcRankings — gate ativo (TASK-21)", () => {
  it("liga arquivada NÃO é pontuada; liga ativa segue pontuada", async () => {
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [
        { uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 },
        { uid: "u1", matchId: "eng.1-2026:em1", homeScore: 2, awayScore: 0 },
      ],
      pools: [
        { id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026", "eng.1-2026"] },
      ],
    });

    const summary = await recalcRankings(db);

    // Liga ativa (upcoming) pontuada normalmente.
    expect(setPayloads.has("rankings/bra.1-2026-geral")).toBe(true);
    expect(setPayloads.has("rankings/pool-p1-bra.1-2026-geral")).toBe(true);

    // Liga arquivada: nenhum doc (global ou por pool).
    expect([...setPayloads.keys()].some((k) => k.includes("eng.1-2026"))).toBe(false);

    // Só a liga ativa conta no sumário.
    expect(summary.championshipsProcessed).toBe(1);
  });
});
