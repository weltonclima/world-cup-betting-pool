/**
 * TASK-12 — ranking `geral` AGREGADO por pool (recalc §7.6).
 *
 * Quando um pool tem ≥2 campeonatos PONTUÁVEIS (Copa legada + ligas ativas), o recalc
 * grava `rankings/pool-{poolId}-agregado` com a SOMA BRUTA dos pontos do membro entre
 * esses campeonatos, re-rankeado só entre os membros do pool. `accuracy` é recomputada
 * sobre a soma das finalizadas (não somada). Gate simétrico escrita×cleanup: <2 pontuáveis
 * → nenhum doc agregado (e um doc existente vira órfão → limpo).
 *
 * Invariantes travadas aqui:
 *  - SOMA BRUTA (não normalização): pontos do agregado = Σ pontos por campeonato.
 *  - Gate ≥2: pool só-Copa (ou Copa+cup não pontuável) NÃO escreve `agregado`.
 *  - Re-ranqueação só entre membros do pool (não vaza usuário de outro pool).
 *  - Doc agregado NÃO carrega `championshipId` e valida em `aggregateRankingSchema`.
 *  - Cleanup: pool que caiu de 2→1 pontuável → `pool-{p}-agregado` deletado;
 *    pool que segue com ≥2 preserva o seu.
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
import { aggregateRankingSchema } from "@/schemas/rankings";

const baseUser = (over: Record<string, unknown>) => ({
  name: "Fulano",
  nickname: "fulano",
  email: "f@x.com",
  role: "participant",
  status: "approved",
  ...over,
});

/** Fake Firestore multi-campeonato (mesma infra do recalcScoped.test.ts). */
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

/** getEffectiveMatches responde por campeonato; sem arg → fifa.world. */
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

type Entry = { uid: string; position: number; points: number };
const entriesOf = (payload: unknown): Entry[] =>
  (payload as { entries: Entry[] } | undefined)?.entries ?? [];
const pointsOf = (payload: unknown, uid: string): number | undefined =>
  entriesOf(payload).find((e) => e.uid === uid)?.points;
const positionOf = (payload: unknown, uid: string): number | undefined =>
  entriesOf(payload).find((e) => e.uid === uid)?.position;

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("recalcRankings — ranking agregado por pool (TASK-12)", () => {
  it("pool Copa+liga ativa → grava agregado com SOMA BRUTA, re-rankeado só entre membros", async () => {
    // Copa m1 2-0; liga bra.1 bm1 1-1 (empate).
    mockMatchesByChampionship({
      "fifa.world": [copaMatch("m1", 2, 0)],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 1, 1)],
    });
    const { db, setPayloads } = makeScopedDb({
      users: [
        baseUser({ uid: "u1", groupId: "p1" }),
        baseUser({ uid: "u2", groupId: "p1" }),
        baseUser({ uid: "u3", groupId: "p2" }), // outro pool — não pode vazar
      ],
      preds: [
        // u1: Copa exato (10) + liga empate exato (10) = 20
        { uid: "u1", matchId: "m1", homeScore: 2, awayScore: 0 },
        { uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 1, awayScore: 1 },
        // u2: Copa vencedor s/ placar (5) + liga errado (0) = 5
        { uid: "u2", matchId: "m1", homeScore: 1, awayScore: 0 },
        { uid: "u2", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 },
        // u3 (pool p2, só-Copa): não deve aparecer no agregado de p1
        { uid: "u3", matchId: "m1", homeScore: 2, awayScore: 0 },
      ],
      pools: [
        { id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] },
        { id: "p2", enabledChampionships: ["fifa.world"] },
      ],
    });

    const summary = await recalcRankings(db);

    const agg = setPayloads.get("rankings/pool-p1-agregado");
    expect(agg).toBeDefined();
    // SOMA BRUTA: u1 = 10+10, u2 = 5+0.
    expect(pointsOf(agg, "u1")).toBe(20);
    expect(pointsOf(agg, "u2")).toBe(5);
    // Re-ranqueado só entre membros de p1; u3 (outro pool) ausente.
    expect(positionOf(agg, "u1")).toBe(1);
    expect(positionOf(agg, "u2")).toBe(2);
    expect(entriesOf(agg).map((e) => e.uid).sort()).toEqual(["u1", "u2"]);
    // p2 (só-Copa) NÃO agrega.
    expect(setPayloads.has("rankings/pool-p2-agregado")).toBe(false);
    expect(summary.aggregatesWritten).toBe(1);
  });

  it("doc agregado NÃO carrega championshipId e valida em aggregateRankingSchema", async () => {
    mockMatchesByChampionship({
      "fifa.world": [copaMatch("m1", 2, 0)],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 1, 0)],
    });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [
        { uid: "u1", matchId: "m1", homeScore: 2, awayScore: 0 },
        { uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 1, awayScore: 0 },
      ],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });

    await recalcRankings(db);

    const agg = setPayloads.get("rankings/pool-p1-agregado");
    expect((agg as { scope: string }).scope).toBe("agregado");
    expect((agg as Record<string, unknown>)["championshipId"]).toBeUndefined();
    expect(aggregateRankingSchema.safeParse(agg).success).toBe(true);
  });

  it("pool só-Copa (1 pontuável) → NÃO grava agregado; pool-{p}-geral intacto", async () => {
    mockMatchesByChampionship({ "fifa.world": [copaMatch("m1", 2, 0)] });
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [{ uid: "u1", matchId: "m1", homeScore: 2, awayScore: 0 }],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world"] }],
    });

    const summary = await recalcRankings(db);

    expect(setPayloads.has("rankings/pool-p1-agregado")).toBe(false);
    // O "geral" do pool segue sendo o bare, com os pontos da Copa.
    expect(pointsOf(setPayloads.get("rankings/pool-p1-geral"), "u1")).toBe(10);
    expect(summary.aggregatesWritten).toBe(0);
  });

  it("pool Copa+cup (cup não pontuável) conta como 1 → sem agregado", async () => {
    // Cup não-legado não é pontuado (ids bare colidem c/ Copa; fora da união) → 1 pontuável.
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

    expect(setPayloads.has("rankings/pool-p1-agregado")).toBe(false);
    expect(summary.aggregatesWritten).toBe(0);
  });

  it("cleanup: pool que caiu de 2→1 pontuável → agregado órfão deletado; pool com ≥2 preservado", async () => {
    // p1 dropou a liga (só-Copa agora) → agregado vira órfão. p2 segue Copa+liga → preservado.
    mockMatchesByChampionship({
      "fifa.world": [copaMatch("m1", 2, 0)],
      "bra.1-2026": [leagueMatch("bra.1-2026:bm1", 1, 0)],
    });
    const { db, deletes } = makeScopedDb({
      users: [
        baseUser({ uid: "u1", groupId: "p1" }),
        baseUser({ uid: "u2", groupId: "p2" }),
      ],
      preds: [
        { uid: "u1", matchId: "m1", homeScore: 2, awayScore: 0 },
        { uid: "u2", matchId: "m1", homeScore: 2, awayScore: 0 },
        { uid: "u2", matchId: "bra.1-2026:bm1", homeScore: 1, awayScore: 0 },
      ],
      pools: [
        { id: "p1", enabledChampionships: ["fifa.world"] }, // caiu p/ 1
        { id: "p2", enabledChampionships: ["fifa.world", "bra.1-2026"] }, // segue 2
      ],
      existingRankingDocIds: ["pool-p1-agregado", "pool-p2-agregado"],
    });

    await recalcRankings(db);

    expect(deletes).toContain("pool-p1-agregado"); // órfão (1 pontuável)
    expect(deletes).not.toContain("pool-p2-agregado"); // vivo (2 pontuáveis)
  });
});
