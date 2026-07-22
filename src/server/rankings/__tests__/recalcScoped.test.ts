/**
 * TASK-11 — recalc escopado por campeonato.
 *
 * `recalcRankings` deve pontuar TODOS os campeonatos habilitados nos pools (não só
 * a Copa legada). Para cada campeonato NÃO-legado habilitado, grava a dimensão
 * `geral` global (`rankings/{C}-geral`) e por pool (`rankings/pool-{poolId}-{C}-geral`).
 *
 * Invariantes travadas aqui:
 *  - Copa legada (fifa.world) NÃO regride: docs/valores byte-idênticos (escopo bare).
 *  - Ligas e copas novas produzem SÓ `geral` — sem fase/grupo/eliminatória por campeonato.
 *  - Elegibilidade por matchId: palpite de um campeonato não vaza para o escopo de outro.
 *  - Cleanup de órfão reconhece o novo shape de escopo (`pool-{p}-{C}-geral`).
 *
 * Sinal de "recalc rodou p/ campeonato C" = `set` em `rankings/{C}-geral`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveMatchesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

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

/**
 * Fake Firestore multi-campeonato: serve usuários aprovados (`where in`/`get`),
 * predictions cruas (`get`/`where uid in`), pools com `enabledChampionships`
 * (`get`/`doc().get()`), a coleção `rankings` (docs órfãos via `get`, escritas via
 * `doc().set()`, deleções via `ref.delete`) e captura payloads em `setPayloads`.
 */
function makeScopedDb(opts: {
  users: Array<Record<string, unknown>>;
  preds: Array<Record<string, unknown>>;
  pools: Array<Record<string, unknown>>;
  existingRankingDocIds?: string[];
}) {
  const { users, preds, pools, existingRankingDocIds = [] } = opts;
  const setPayloads = new Map<string, unknown>();
  const deletes: string[] = [];
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
        get: vi.fn().mockResolvedValue({
          docs: existingRankingDocIds.map((id) => ({
            id,
            ref: {
              delete: vi.fn(async () => {
                deletes.push(id);
              }),
            },
          })),
        }),
        where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
        doc: vi.fn((id: string) => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: vi.fn(async (payload: unknown) => {
            setPayloads.set(`rankings/${id}`, payload);
          }),
          ref: {
            delete: vi.fn(async () => {
              deletes.push(id);
            }),
          },
        })),
      };
    }
    // statistics, pool_stats, etc.
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
  return { db: { collection } as never, setPayloads, deletes };
}

/** getEffectiveMatches responde por campeonato; sem arg (ou undefined) → fifa.world. */
function mockMatchesByChampionship(byId: Record<string, unknown[]>) {
  getEffectiveMatchesMock.mockImplementation(async (championshipId?: string) => {
    const cid = championshipId ?? "fifa.world";
    return byId[cid] ?? [];
  });
}

const copaMatch = (id: string, homeScore: number, awayScore: number) => ({
  id,
  status: "finished" as const,
  homeScore,
  awayScore,
  stage: "grupos",
  groupId: "A",
  kickoffAt: "2026-06-11T13:00:00-06:00",
});

const leagueMatch = (id: string, homeScore: number, awayScore: number) => ({
  id,
  status: "finished" as const,
  homeScore,
  awayScore,
  stage: "regular",
  groupId: null,
  kickoffAt: "2026-05-11T13:00:00-03:00",
});

const cupMatch = (id: string, stage: string, homeScore: number, awayScore: number) => ({
  id,
  status: "finished" as const,
  homeScore,
  awayScore,
  stage,
  groupId: null,
  kickoffAt: "2026-06-20T13:00:00-06:00",
});

const pointsOf = (payload: unknown, uid: string): number | undefined =>
  (payload as { entries: Array<{ uid: string; points: number }> } | undefined)?.entries.find(
    (e) => e.uid === uid,
  )?.points;

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("recalcRankings — escopo por campeonato (TASK-11)", () => {
  it("grava geral global + por pool para campeonato novo (liga), sem regredir a Copa", async () => {
    mockMatchesByChampionship({
      "fifa.world": [copaMatch("m1", 2, 0)],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 2, 0)],
    });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [
        { uid: "u1", matchId: "m1", homeScore: 2, awayScore: 0 }, // Copa: exato → 10
        { uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 }, // liga: exato → 10
      ],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });

    await recalcRankings(db);

    // Copa legada: escopo bare, SÓ pontos da Copa (não soma a liga).
    expect(pointsOf(setPayloads.get("rankings/geral"), "u1")).toBe(10);
    expect(pointsOf(setPayloads.get("rankings/pool-p1-geral"), "u1")).toBe(10);

    // Campeonato novo: geral global + por pool, com os pontos da liga.
    expect(pointsOf(setPayloads.get("rankings/bra.1-2026-geral"), "u1")).toBe(10);
    expect(pointsOf(setPayloads.get("rankings/pool-p1-bra.1-2026-geral"), "u1")).toBe(10);
  });

  it("campeonato de liga produz SÓ geral — sem fase/grupo/eliminatória por campeonato", async () => {
    mockMatchesByChampionship({
      "fifa.world": [],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 2, 0)],
    });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [{ uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 }],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });

    await recalcRankings(db);

    expect(setPayloads.has("rankings/bra.1-2026-geral")).toBe(true);
    const braScopes = [...setPayloads.keys()].filter(
      (k) => k.startsWith("rankings/bra.1-2026-") && k !== "rankings/bra.1-2026-geral",
    );
    expect(braScopes).toEqual([]); // nenhum -grupos/-eliminatorias/-grupo-*
  });

  it("cup NÃO-legado NÃO é pontuado — ids bare colidiriam com a Copa (proteção CR-01)", async () => {
    // Cups não-legados roteiam pelo mapper da Copa (ids BARE `m73`/`{data}-{home}-{away}`),
    // que colidem com a Copa legada. Até serem namespaced (foundation/TASK-10) ficam FORA
    // do scoring: nenhum doc de ranking do cup, e a Copa segue intocada (zero regressão).
    mockMatchesByChampionship({
      "fifa.world": [copaMatch("m1", 2, 0)],
      "conmebol.america-2026": [cupMatch("conmebol.america-2026:c1", "final", 2, 0)],
    });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [
        { uid: "u1", matchId: "m1", homeScore: 2, awayScore: 0 },
        { uid: "u1", matchId: "conmebol.america-2026:c1", homeScore: 2, awayScore: 0 },
      ],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "conmebol.america-2026"] }],
    });

    const summary = await recalcRankings(db);

    // Nenhum doc do cup (global ou por pool) foi escrito.
    expect([...setPayloads.keys()].some((k) => k.includes("conmebol.america-2026"))).toBe(false);
    // Copa legada segue pontuada normalmente.
    expect(pointsOf(setPayloads.get("rankings/geral"), "u1")).toBe(10);
    // Cup não conta como campeonato processado.
    expect(summary.championshipsProcessed).toBe(0);
  });

  it("pool que NÃO habilitou o campeonato não recebe doc por pool desse campeonato", async () => {
    mockMatchesByChampionship({
      "fifa.world": [],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 2, 0)],
    });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u2", groupId: "p2" })],
      preds: [{ uid: "u2", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 }],
      // p2 só habilita a Copa → nenhum pool habilita bra.1 → nem global nem por pool.
      pools: [{ id: "p2", enabledChampionships: ["fifa.world"] }],
    });

    await recalcRankings(db);

    expect(setPayloads.has("rankings/pool-p2-bra.1-2026-geral")).toBe(false);
    expect(setPayloads.has("rankings/bra.1-2026-geral")).toBe(false);
  });

  it("falha da fonte de UMA liga não derruba as demais nem o legado (resiliência)", async () => {
    getEffectiveMatchesMock.mockImplementation(async (championshipId?: string) => {
      const cid = championshipId ?? "fifa.world";
      if (cid === "bra.1-2026") throw new Error("fonte fora do ar");
      if (cid === "eng.1-2026") return [leagueMatch("eng.1-2026:em1", 2, 0)];
      return []; // fifa.world
    });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [
        { uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 },
        { uid: "u1", matchId: "eng.1-2026:em1", homeScore: 2, awayScore: 0 },
      ],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026", "eng.1-2026"] }],
    });

    const summary = await recalcRankings(db);

    // Copa legada sempre escrita; a liga sã sobrevive apesar da outra falhar.
    expect(setPayloads.has("rankings/geral")).toBe(true);
    expect(setPayloads.has("rankings/eng.1-2026-geral")).toBe(true);
    expect(setPayloads.has("rankings/bra.1-2026-geral")).toBe(false); // fonte falhou → pulado
    // Só a liga bem-sucedida conta no sumário aditivo.
    expect(summary.championshipsProcessed).toBe(1);
  });

  it("championshipsProcessed conta só as ligas processadas (Copa e cups não contam)", async () => {
    mockMatchesByChampionship({
      "fifa.world": [copaMatch("m1", 1, 0)],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 2, 0)],
      "eng.1-2026": [leagueMatch("eng.1-2026:em1", 2, 0)],
      "conmebol.america-2026": [cupMatch("conmebol.america-2026:c1", "final", 2, 0)],
    });
    const { db } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [{ uid: "u1", matchId: "m1", homeScore: 1, awayScore: 0 }],
      pools: [
        {
          id: "p1",
          enabledChampionships: ["fifa.world", "bra.1-2026", "eng.1-2026", "conmebol.america-2026"],
        },
      ],
    });

    const summary = await recalcRankings(db);
    expect(summary.championshipsProcessed).toBe(2); // 2 ligas; Copa legada e cup fora
  });

  it("cleanup de órfão preserva pool-{p}-{C}-geral vivo e apaga o órfão", async () => {
    mockMatchesByChampionship({
      "fifa.world": [],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 2, 0)],
    });
    const { db, deletes } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [{ uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 }],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
      existingRankingDocIds: ["pool-p1-bra.1-2026-geral", "pool-dead-bra.1-2026-geral"],
    });

    await recalcRankings(db);

    expect(deletes).toContain("pool-dead-bra.1-2026-geral"); // órfão removido
    expect(deletes).not.toContain("pool-p1-bra.1-2026-geral"); // pool vivo preservado
  });
});
