/**
 * TASK-13 — pipeline de arquivamento (RED / TDD).
 *
 * Cobre a detecção pura `isChampionshipFinished` e o orquestrador
 * `archiveChampionship` (persistência de schedule chunkado, freeze de snapshot
 * `history/*` por-bolão + global, ordering atômico freeze→flip no MESMO batch,
 * idempotência e erro tipado p/ campeonato não encerrado).
 *
 * Produção ainda não existe → estes testes DEVEM falhar (módulo ausente).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveMatchesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("server-only", () => ({}));

import {
  archiveChampionship,
  ChampionshipNotFinishedError,
  isChampionshipFinished,
} from "@/server/copaData/archive";
import type { Championship } from "@/types/championships";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type MatchLike = { id: string; status: string; homeScore: number; awayScore: number };

const m = (id: string, status: string, homeScore = 0, awayScore = 0): MatchLike => ({
  id,
  status,
  homeScore,
  awayScore,
});

const CHAMP = {
  id: "bra.1-2026",
  type: "league",
  name: "Brasileirão",
  status: "live",
} as unknown as Championship;

const CID = "bra.1-2026";

/** Fake Firestore com leitura + `batch()` que registra ops p/ inspeção de ordering. */
function makeArchiveDb(opts: {
  pools: Array<{ id: string; enabledChampionships: string[] }>;
  rankings: Map<string, { entries: unknown[] }>;
  statistics: Map<string, Record<string, unknown>>;
  championships?: Map<string, Record<string, unknown>>;
  history?: Map<string, Record<string, unknown>>;
}) {
  const { pools, rankings, statistics, championships = new Map(), history = new Map() } = opts;
  const batches: Array<{ seq: number; ops: Array<{ op: string; col: string; id: string; data?: unknown }> }> = [];

  const store: Record<string, Map<string, unknown>> = { rankings, statistics, championships, history };

  const docRef = (col: string, id: string) => ({
    __col: col,
    __id: id,
    get: async () => ({
      exists: !!store[col]?.has(id),
      id,
      data: () => store[col]?.get(id),
    }),
  });

  const collection = (name: string) => ({
    doc: (id: string) => docRef(name, id),
    get: async () => {
      if (name === "pools") {
        return { docs: pools.map((p) => ({ id: p.id, data: () => p })) };
      }
      return { docs: [] };
    },
  });

  const batch = () => {
    const ops: Array<{ op: string; col: string; id: string; data?: unknown }> = [];
    return {
      set: (ref: { __col: string; __id: string }, data: unknown) =>
        ops.push({ op: "set", col: ref.__col, id: ref.__id, data }),
      delete: (ref: { __col: string; __id: string }) =>
        ops.push({ op: "delete", col: ref.__col, id: ref.__id }),
      commit: async () => {
        batches.push({ seq: batches.length, ops });
      },
    };
  };

  return { db: { collection, batch } as never, batches };
}

const rankingDoc = (uids: string[]) => ({
  entries: uids.map((uid, i) => ({ uid, nickname: uid, position: i + 1, points: (uids.length - i) * 10 })),
});

const statDoc = (uid: string) => ({
  uid,
  totalCorrect: 3,
  totalPartial: 2,
  totalWrong: 1,
  accuracy: 60,
  longestStreak: 2,
  correctByStage: {},
  positionHistory: [],
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// isChampionshipFinished (puro)
// ---------------------------------------------------------------------------

describe("isChampionshipFinished", () => {
  it("lista vazia → false (sem schedule ≠ encerrado)", () => {
    expect(isChampionshipFinished([] as never)).toBe(false);
  });

  it("algum scheduled → false", () => {
    expect(isChampionshipFinished([m("a", "finished"), m("b", "scheduled")] as never)).toBe(false);
  });

  it("algum live → false", () => {
    expect(isChampionshipFinished([m("a", "finished"), m("b", "live")] as never)).toBe(false);
  });

  it("todos terminais com ≥1 finished → true", () => {
    expect(
      isChampionshipFinished([m("a", "finished"), m("b", "postponed"), m("c", "canceled")] as never),
    ).toBe(true);
  });

  it("só canceled/postponed (nenhum finished) → false", () => {
    expect(isChampionshipFinished([m("a", "canceled"), m("b", "postponed")] as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// archiveChampionship
// ---------------------------------------------------------------------------

describe("archiveChampionship", () => {
  it("campeonato não encerrado → ChampionshipNotFinishedError (não arquiva)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([m("x", "scheduled")]);
    const { db } = makeArchiveDb({ pools: [], rankings: new Map(), statistics: new Map() });
    await expect(archiveChampionship(db, CHAMP)).rejects.toBeInstanceOf(ChampionshipNotFinishedError);
  });

  it("persiste TODOS os matches efetivos com chunking >400", async () => {
    const matches = Array.from({ length: 401 }, (_, i) => m(`${CID}:m${i}`, "finished", 1, 0));
    getEffectiveMatchesMock.mockResolvedValue(matches);
    const { db, batches } = makeArchiveDb({
      pools: [],
      rankings: new Map([[`${CID}-geral`, rankingDoc([])]]),
      statistics: new Map(),
    });

    const summary = await archiveChampionship(db, CHAMP);

    const matchSets = batches.flatMap((b) => b.ops).filter((o) => o.col === "matches" && o.op === "set");
    expect(matchSets).toHaveLength(401);
    expect(summary.matchesPersisted).toBe(401);
    // 401 writes de schedule → ≥2 batches (teto chunk 400).
    const scheduleBatches = batches.filter((b) => b.ops.some((o) => o.col === "matches"));
    expect(scheduleBatches.length).toBeGreaterThanOrEqual(2);
  });

  it("congela snapshot por-bolão + global com ranking correto", async () => {
    getEffectiveMatchesMock.mockResolvedValue([m(`${CID}:m1`, "finished", 2, 0)]);
    const { db, batches } = makeArchiveDb({
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", CID] }],
      rankings: new Map([
        [`${CID}-geral`, rankingDoc(["u1", "u2"])],
        [`pool-p1-${CID}-geral`, rankingDoc(["u1"])],
      ]),
      statistics: new Map([["u1", statDoc("u1")]]),
    });

    const summary = await archiveChampionship(db, CHAMP);

    const historySets = batches.flatMap((b) => b.ops).filter((o) => o.col === "history" && o.op === "set");
    const byId = new Map(historySets.map((o) => [o.id, o.data as Record<string, unknown>]));

    // Global do campeonato.
    const global = byId.get(`${CID}__geral`);
    expect(global).toBeDefined();
    expect(global?.["poolId"]).toBeNull();
    expect((global?.["ranking"] as unknown[]).length).toBe(2);

    // Por-bolão + recorte de statistics.
    const pool = byId.get(`${CID}__p1`);
    expect(pool).toBeDefined();
    expect(pool?.["poolId"]).toBe("p1");
    expect((pool?.["ranking"] as unknown[]).length).toBe(1);
    expect(pool?.["statistics"]).toBeDefined();

    expect(summary.poolsArchived).toBe(1);
    expect(summary.historyDocs).toBe(2); // 1 pool + 1 global
  });

  it("ordering: history + flip de status no MESMO batch atômico (status nunca sem history)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([m(`${CID}:m1`, "finished", 1, 1)]);
    const { db, batches } = makeArchiveDb({
      pools: [{ id: "p1", enabledChampionships: [CID] }],
      rankings: new Map([
        [`${CID}-geral`, rankingDoc(["u1"])],
        [`pool-p1-${CID}-geral`, rankingDoc(["u1"])],
      ]),
      statistics: new Map([["u1", statDoc("u1")]]),
    });

    await archiveChampionship(db, CHAMP);

    // Batch que grava o estado do campeonato.
    const flipBatch = batches.find((b) => b.ops.some((o) => o.col === "championships"));
    expect(flipBatch).toBeDefined();
    // Mesmo batch contém history (snapshot durável junto do flip).
    expect(flipBatch?.ops.some((o) => o.col === "history")).toBe(true);
    // Nenhum batch grava championships sem history no mesmo batch.
    for (const b of batches) {
      if (b.ops.some((o) => o.col === "championships")) {
        expect(b.ops.some((o) => o.col === "history")).toBe(true);
      }
    }
    // Schedule (matches) commitado ANTES do batch de flip.
    const scheduleSeq = batches.filter((b) => b.ops.some((o) => o.col === "matches")).map((b) => b.seq);
    if (scheduleSeq.length) {
      expect(Math.max(...scheduleSeq)).toBeLessThan(flipBatch!.seq);
    }
    // Estado gravado = archived + finishedSignature.
    const stateOp = flipBatch?.ops.find((o) => o.col === "championships");
    expect((stateOp?.data as Record<string, unknown>)["status"]).toBe("archived");
    expect((stateOp?.data as Record<string, unknown>)["finishedSignature"]).toBeDefined();
  });

  it("idempotente: 2ª execução em já-arquivado regrava e reflete alreadyArchived", async () => {
    getEffectiveMatchesMock.mockResolvedValue([m(`${CID}:m1`, "finished", 0, 0)]);
    const { db } = makeArchiveDb({
      pools: [],
      rankings: new Map([[`${CID}-geral`, rankingDoc(["u1"])]]),
      statistics: new Map(),
      championships: new Map([[CID, { status: "archived", archivedAt: "2026-01-01T00:00:00Z" }]]),
    });

    const summary = await archiveChampionship(db, CHAMP);
    expect(summary.alreadyArchived).toBe(true);
    expect(summary.championshipId).toBe(CID);
  });

  it("re-arquivamento com rankings ao vivo já apagados (sweep) PRESERVA o history congelado", async () => {
    // Cenário de perda-de-dados: após o 1º arquivamento, o sweep de recalc apaga
    // `rankings/{cid}-geral` e `pool-*-{cid}-geral` (liga arquivada sai do
    // championshipUnion). Um re-arquivamento NÃO pode ler a fonte ao vivo (vazia)
    // e regravar o snapshot congelado como `[]`.
    getEffectiveMatchesMock.mockResolvedValue([m(`${CID}:m1`, "finished", 1, 0)]);
    const priorGlobal = {
      championshipId: CID,
      scopeKey: "geral",
      poolId: null,
      archivedAt: "2026-01-01T00:00:00Z",
      finishedSignature: "1:abc",
      ranking: rankingDoc(["u1", "u2"]).entries,
    };
    const priorPool = {
      championshipId: CID,
      scopeKey: "p1",
      poolId: "p1",
      archivedAt: "2026-01-01T00:00:00Z",
      finishedSignature: "1:abc",
      ranking: rankingDoc(["u1"]).entries,
      statistics: [{ uid: "u1", totalCorrect: 3, accuracy: 60, longestStreak: 2 }],
    };
    const { db, batches } = makeArchiveDb({
      pools: [{ id: "p1", enabledChampionships: [CID] }],
      rankings: new Map(), // sweep já apagou os docs ao vivo
      statistics: new Map(),
      championships: new Map([[CID, { status: "archived", archivedAt: "2026-01-01T00:00:00Z" }]]),
      history: new Map<string, Record<string, unknown>>([
        [`${CID}__geral`, priorGlobal],
        [`${CID}__p1`, priorPool],
      ]),
    });

    const summary = await archiveChampionship(db, CHAMP);
    expect(summary.alreadyArchived).toBe(true);

    const historySets = batches.flatMap((b) => b.ops).filter((o) => o.col === "history" && o.op === "set");
    const byId = new Map(historySets.map((o) => [o.id, o.data as Record<string, unknown>]));

    // Ranking preservado (NÃO zerado) apesar de a fonte ao vivo ter sumido.
    expect((byId.get(`${CID}__geral`)?.["ranking"] as unknown[]).length).toBe(2);
    const pool = byId.get(`${CID}__p1`);
    expect((pool?.["ranking"] as unknown[]).length).toBe(1);
    expect((pool?.["statistics"] as unknown[]).length).toBe(1);
  });
});
