/**
 * TASK-11 — POST /api/predictions/score pontua TODOS os campeonatos habilitados.
 *
 * Antes: a rota chamava `getEffectiveMatches()` (só Copa). Agora ela lê os
 * campeonatos habilitados nos pools e pontua a UNIÃO. Invariantes verificadas:
 *  - partidas finalizadas de dois campeonatos habilitados são ambas pontuadas;
 *  - `score_state/cron` recebe os DOIS matchIds (namespaced ≠ legado) sem colisão;
 *  - falha da fonte de UM campeonato extra não derruba o legado (best-effort);
 *  - sem pools legíveis → degrada para só a Copa (comportamento legado).
 */

import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifySessionCookieMock,
  getFirestoreMock,
  getEffectiveMatchesMock,
  cookiesMock,
} = vi.hoisted(() => ({
  verifySessionCookieMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
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
  id: "bra.1-2026:9001", // namespaced — matchId globalmente único
  status: "finished" as const,
  kickoffAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  homeTeamId: "team-3",
  awayTeamId: "team-4",
  homeScore: 0,
  awayScore: 0,
};

const predByMatch: Record<string, Record<string, unknown>[]> = {
  "5001": [{ uid: "u1", matchId: "5001", homeScore: 2, awayScore: 1 }], // Copa exato
  "bra.1-2026:9001": [{ uid: "u1", matchId: "bra.1-2026:9001", homeScore: 0, awayScore: 0 }], // liga exato
};

/** db fake: users, pools, predictions, score_state (captura set). */
function makeDb(opts: { pools: Array<Record<string, unknown>>; poolsThrows?: boolean }) {
  const scoreStateSet = vi.fn().mockResolvedValue(undefined);
  const predSets: Record<string, ReturnType<typeof vi.fn>[]> = {};

  const collection = vi.fn((name: string) => {
    if (name === "pools") {
      return {
        get: opts.poolsThrows
          ? vi.fn().mockRejectedValue(new Error("boom"))
          : vi.fn().mockResolvedValue({
              docs: opts.pools.map((p) => ({ id: p["id"], data: () => p })),
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
          set: scoreStateSet,
        })),
      };
    }
    // users / statistics / notifications / etc. — genéricos vazios.
    return {
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: vi.fn().mockResolvedValue(undefined),
      })),
      where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) })),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
  });

  return { db: { collection } as never, scoreStateSet, predSets };
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
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/predictions/score — multi-campeonato (TASK-11)", () => {
  it("pontua partidas de dois campeonatos habilitados; score_state recebe ambos os matchIds", async () => {
    getEffectiveMatchesMock.mockImplementation(async (cid?: string) =>
      cid === "bra.1-2026" ? [leagueMatch] : [copaMatch],
    );
    const { db, scoreStateSet, predSets } = makeDb({
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });
    getFirestoreMock.mockReturnValue(db);

    const res = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
    expect(res.status).toBe(200);

    // Ambos os palpites pontuados (1 set por palpite exato).
    expect(predSets["5001"]![0]).toHaveBeenCalled();
    expect(predSets["bra.1-2026:9001"]![0]).toHaveBeenCalled();

    // score_state gravado com os DOIS matchIds (chaves distintas, sem colisão).
    const payload = scoreStateSet.mock.calls.at(-1)?.[0] as { matches: Record<string, string> };
    expect(Object.keys(payload.matches).sort()).toEqual(["5001", "bra.1-2026:9001"]);

    // TASK-19: observabilidade — Copa + 1 liga ativa varrida = 2.
    const body = (await res.json()) as { championshipsProcessed: number };
    expect(body.championshipsProcessed).toBe(2);
  });

  it("falha da fonte de um campeonato extra NÃO derruba o legado (best-effort)", async () => {
    getEffectiveMatchesMock.mockImplementation(async (cid?: string) => {
      if (cid === "bra.1-2026") throw new Error("fonte fora do ar");
      return [copaMatch];
    });
    const { db, predSets } = makeDb({
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });
    getFirestoreMock.mockReturnValue(db);

    const res = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
    expect(res.status).toBe(200);
    // Copa segue pontuada mesmo com a liga fora do ar.
    expect(predSets["5001"]![0]).toHaveBeenCalled();

    // TASK-19: liga com fetch falho NÃO conta — só a Copa (1).
    const body = (await res.json()) as { championshipsProcessed: number };
    expect(body.championshipsProcessed).toBe(1);
  });

  it("sem pools legíveis → degrada para só a Copa (uma fonte)", async () => {
    getEffectiveMatchesMock.mockResolvedValue([copaMatch]);
    const { db } = makeDb({ pools: [], poolsThrows: true });
    getFirestoreMock.mockReturnValue(db);

    const res = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
    expect(res.status).toBe(200);
    // Só o campeonato default foi buscado (nenhuma iteração extra).
    const cids = getEffectiveMatchesMock.mock.calls.map((c) => c[0]);
    expect(cids).toEqual(["fifa.world"]);

    // TASK-19: degradação só-Copa → championshipsProcessed = 1.
    const body = (await res.json()) as { championshipsProcessed: number };
    expect(body.championshipsProcessed).toBe(1);
  });

  it("early-return (0 finalizadas) ainda inclui championshipsProcessed (TASK-19)", async () => {
    // Copa sem partidas finalizadas → caminho de saída antecipada. O contrato de
    // observabilidade do cron precisa do campo nas DUAS saídas 200.
    const openCopaMatch = { ...copaMatch, status: "scheduled" as const };
    getEffectiveMatchesMock.mockImplementation(async (cid?: string) =>
      cid === "bra.1-2026" ? [{ ...leagueMatch, status: "scheduled" as const }] : [openCopaMatch],
    );
    const { db } = makeDb({
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });
    getFirestoreMock.mockReturnValue(db);

    const res = await POST(postRequestWithSecret(MOCK_SCORE_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scoredMatches: number;
      championshipsProcessed: number;
    };
    expect(body.scoredMatches).toBe(0);
    // Copa + liga ativa: ambas varridas com sucesso mesmo sem partidas finalizadas.
    expect(body.championshipsProcessed).toBe(2);
  });
});
