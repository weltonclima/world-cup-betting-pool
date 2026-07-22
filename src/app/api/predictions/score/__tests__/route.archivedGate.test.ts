/**
 * TASK-13 — gate de status ARQUIVADO no POST /api/predictions/score.
 *
 * A rota resolve o status via `loadChampionshipStatuses(db)` (override do doc
 * `championships/{id}` sobre o default do catálogo). Uma liga `type: "league"`
 * cujo status dinâmico é `archived` NÃO é buscada/pontuada ao vivo — ela passa a
 * ser servida do snapshot congelado (TASK-14). Complementa
 * `route.multichampionship.test` (que exercita o caminho ativo com o resolver
 * real degradando p/ defaults do catálogo).
 *
 * Aqui `championshipState` é MOCKADO para controlar o status por-campeonato,
 * isolando o gate do resto do fluxo.
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifySessionCookieMock,
  getFirestoreMock,
  getEffectiveMatchesMock,
  loadChampionshipStatusesMock,
  cookiesMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
  loadChampionshipStatusesMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
  getAdminFirestore: getFirestoreMock,
}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));
vi.mock("@/server/copaData/championshipState", () => ({
  loadChampionshipStatuses: loadChampionshipStatusesMock,
}));
vi.mock("@/server/copaData", () => ({ fetchAllTeams: vi.fn() }));
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/predictions/score/route";

const MOCK_SCORE_SECRET = "super-secret-cron-token-abc123";

const copaMatch = {
  id: "5001",
  status: "finished" as const,
  kickoffAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  homeTeamId: "team-1",
  awayTeamId: "team-2",
  homeScore: 2,
  awayScore: 1,
};
const leagueMatch = {
  id: "bra.1-2026:9001",
  status: "finished" as const,
  kickoffAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  homeTeamId: "team-3",
  awayTeamId: "team-4",
  homeScore: 0,
  awayScore: 0,
};

const predByMatch: Record<string, Record<string, unknown>[]> = {
  "5001": [{ uid: "u1", matchId: "5001", homeScore: 2, awayScore: 1 }],
  "bra.1-2026:9001": [{ uid: "u1", matchId: "bra.1-2026:9001", homeScore: 0, awayScore: 0 }],
};

function makeDb(pools: Array<Record<string, unknown>>) {
  const predSets: Record<string, ReturnType<typeof vi.fn>[]> = {};
  const collection = vi.fn((name: string) => {
    if (name === "pools") {
      return {
        get: vi.fn().mockResolvedValue({
          docs: pools.map((p) => ({ id: p["id"], data: () => p })),
        }),
      };
    }
    if (name === "predictions") {
      return {
        where: vi.fn((_f: string, _op: string, matchId: string) => {
          const preds = predByMatch[matchId] ?? [];
          const sets = preds.map(() => vi.fn().mockResolvedValue(undefined));
          predSets[matchId] = sets;
          return {
            get: vi.fn().mockResolvedValue({
              empty: preds.length === 0,
              docs: preds.map((data, i) => ({ data: () => data, ref: { set: sets[i] } })),
            }),
          };
        }),
      };
    }
    if (name === "score_state") {
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue(undefined),
        })),
      };
    }
    return {
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: vi.fn().mockResolvedValue(undefined),
      })),
      where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) })),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
  });
  return { db: { collection } as never, predSets };
}

function postRequestWithSecret(secret: string): NextRequest {
  return new Request("http://localhost/api/predictions/score", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SCORE_SECRET", MOCK_SCORE_SECRET);
  verifySessionCookieMock.mockResolvedValue({ uid: "irrelevant" });
  cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
  getEffectiveMatchesMock.mockImplementation(async (cid?: string) =>
    cid === "bra.1-2026" ? [leagueMatch] : [copaMatch],
  );
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/predictions/score — gate de status arquivado (TASK-13)", () => {
  it("liga ARQUIVADA (override dinâmico) NÃO é buscada nem pontuada ao vivo", async () => {
    loadChampionshipStatusesMock.mockResolvedValue(
      new Map([["bra.1-2026", "archived"]]),
    );
    const { db, predSets } = makeDb([
      { id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] },
    ]);
    getFirestoreMock.mockReturnValue(db);

    const res = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
    expect(res.status).toBe(200);

    // Só a Copa foi buscada — a liga arquivada saiu do sweep ao vivo.
    const cids = getEffectiveMatchesMock.mock.calls.map((c) => c[0]);
    expect(cids).toEqual(["fifa.world"]);

    // Copa pontuada; palpite da liga arquivada nunca consultado.
    expect(predSets["5001"]![0]).toHaveBeenCalled();
    expect(predSets["bra.1-2026:9001"]).toBeUndefined();

    // TASK-19: liga arquivada saiu de `leagueIds` → não infla championshipsProcessed.
    const body = (await res.json()) as { championshipsProcessed: number };
    expect(body.championshipsProcessed).toBe(1);
  });

  it("liga ATIVA (status dinâmico não-arquivado) permanece no sweep", async () => {
    loadChampionshipStatusesMock.mockResolvedValue(
      new Map([["bra.1-2026", "live"]]),
    );
    const { db, predSets } = makeDb([
      { id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] },
    ]);
    getFirestoreMock.mockReturnValue(db);

    const res = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
    expect(res.status).toBe(200);

    const cids = getEffectiveMatchesMock.mock.calls.map((c) => c[0]).sort();
    expect(cids).toEqual(["bra.1-2026", "fifa.world"]);
    expect(predSets["bra.1-2026:9001"]![0]).toHaveBeenCalled();
  });
});
