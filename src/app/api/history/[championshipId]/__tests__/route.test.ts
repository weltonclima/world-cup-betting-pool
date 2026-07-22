/**
 * Testes do Route Handler GET /api/history/[championshipId] (detalhe de um
 * campeonato arquivado, TASK-15 — Seção Histórico).
 *
 * Mocka `requireApprovedUser`, `getAdminFirestore`, `championshipState`
 * (`getChampionshipStatus`) e `matchSource` (`getEffectiveMatches`) — mesmo
 * padrão de `route.archivedGate.test.ts` (TASK-13), que mocka os dois módulos
 * de colaboração inteiros para controlar status/jogos sem depender de ESPN
 * real. `getChampionship` fica REAL (catálogo curado) — usa ids reais para
 * exercer a validação "desconhecido → 404".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireApprovedMock,
  getFirestoreMock,
  getChampionshipStatusMock,
  getEffectiveMatchesMock,
} = vi.hoisted(() => ({
  requireApprovedMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  getChampionshipStatusMock: vi.fn(),
  getEffectiveMatchesMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/copaData/championshipState", () => ({
  getChampionshipStatus: getChampionshipStatusMock,
}));
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/history/[championshipId]/route";
import { championshipHistoryResponseSchema } from "@/schemas/history";

const ctx = (championshipId: string) => ({ params: Promise.resolve({ championshipId }) });

function rankingEntry(uid: string, position: number, points: number) {
  return { uid, nickname: uid, position, points };
}

function historySnapshot(overrides: Record<string, unknown> = {}) {
  return {
    championshipId: "fifa.world",
    scopeKey: "geral",
    poolId: null,
    archivedAt: "2026-01-10T00:00:00.000Z",
    finishedSignature: "sig-1",
    ranking: [rankingEntry("u1", 1, 10)],
    ...overrides,
  };
}

/**
 * Fake Firestore: `users/{uid}` (groupId) + `pools/{groupId}`
 * (`enabledChampionships`, gate de habilitação) + `history/{docId}` por id
 * literal. `enabled` default `["fifa.world"]` (mesmo default de
 * `getEnabledChampionships` p/ pool sem o campo) → cobre os testes fifa.world.
 */
function makeDb(opts: {
  groupId?: string;
  enabled?: string[];
  historyDocs?: Record<string, Record<string, unknown>>;
}) {
  const historyDocFn = vi.fn((id: string) => ({
    id,
    get: vi.fn(async () => {
      const val = opts.historyDocs?.[id];
      return { exists: val !== undefined, data: () => val };
    }),
  }));
  const usersDocFn = vi.fn(() => ({
    get: vi.fn(async () => ({
      exists: opts.groupId !== undefined,
      data: () => (opts.groupId !== undefined ? { groupId: opts.groupId } : {}),
    })),
  }));
  const poolsDocFn = vi.fn(() => ({
    get: vi.fn(async () => ({
      exists: true,
      data: () => ({ enabledChampionships: opts.enabled ?? ["fifa.world"] }),
    })),
  }));
  const collection = vi.fn((name: string) => ({
    doc:
      name === "users"
        ? usersDocFn
        : name === "pools"
          ? poolsDocFn
          : historyDocFn,
  }));
  getFirestoreMock.mockReturnValue({ collection });
  return { historyDocFn, usersDocFn, poolsDocFn };
}

const approved = (uid = "u1") => requireApprovedMock.mockResolvedValue({ user: { uid } });

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/history/[championshipId]", () => {
  it("sessão inválida → repassa o errorResponse (401), sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: Response.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(new Request("http://localhost/api/history/fifa.world"), ctx("fifa.world"));
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("championshipId desconhecido (fora do catálogo) → 404", async () => {
    approved();
    const res = await GET(
      new Request("http://localhost/api/history/nao.existe-2026"),
      ctx("nao.existe-2026"),
    );
    expect(res.status).toBe(404);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("championshipId com traversal → 404, sem tocar catálogo/Firestore", async () => {
    approved();
    const res = await GET(
      new Request("http://localhost/api/history/..%2Ffifa.world"),
      ctx("../fifa.world"),
    );
    expect(res.status).toBe(404);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("campeonato não-arquivado (status live/upcoming) → 404", async () => {
    approved();
    getChampionshipStatusMock.mockResolvedValue("upcoming");
    // Pool HABILITA eng.1-2026 → passa o gate de enablement e chega no gate de
    // status (que é quem deve 404 aqui).
    makeDb({ groupId: "pool-1", enabled: ["eng.1-2026"] });
    const res = await GET(
      new Request("http://localhost/api/history/eng.1-2026"),
      ctx("eng.1-2026"),
    );
    expect(res.status).toBe(404);
  });

  it("campeonato NÃO habilitado no pool do usuário → 404 (gate anti-vazamento cross-pool)", async () => {
    approved("u1");
    // Pool só habilita fifa.world; usuário tenta deep-linkar eng.1-2026
    // (arquivado, mas habilitado só em OUTRO pool) → não deve receber o __geral.
    getChampionshipStatusMock.mockResolvedValue("archived");
    const { historyDocFn } = makeDb({
      groupId: "pool-1",
      enabled: ["fifa.world"],
      historyDocs: {
        "eng.1-2026__geral": historySnapshot({ championshipId: "eng.1-2026" }),
      },
    });
    const res = await GET(
      new Request("http://localhost/api/history/eng.1-2026"),
      ctx("eng.1-2026"),
    );
    expect(res.status).toBe(404);
    // Nunca leu nenhum doc de history (gate barra antes).
    expect(historyDocFn).not.toHaveBeenCalled();
    // Nunca resolveu status/jogos do campeonato não habilitado.
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
  });

  it("nem history/{id}__{groupId} nem history/{id}__geral existem → 404", async () => {
    approved();
    getChampionshipStatusMock.mockResolvedValue("archived");
    makeDb({ groupId: "pool-1", historyDocs: {} });
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    expect(res.status).toBe(404);
  });

  it("snapshot do pool presente → rankingScope 'pool', com statistics", async () => {
    approved("u1");
    getChampionshipStatusMock.mockResolvedValue("archived");
    makeDb({
      groupId: "pool-1",
      historyDocs: {
        "fifa.world__pool-1": historySnapshot({
          scopeKey: "pool-1",
          poolId: "pool-1",
          statistics: [
            { uid: "u1", totalCorrect: 8, accuracy: 70, longestStreak: 4 },
          ],
        }),
        // __geral também existe, mas o doc do pool tem precedência.
        "fifa.world__geral": historySnapshot({ archivedAt: "2020-01-01T00:00:00.000Z" }),
      },
    });
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rankingScope).toBe("pool");
    expect(body.statistics).toHaveLength(1);
    expect(body.statistics[0].uid).toBe("u1");
    expect(body.archivedAt).toBe("2026-01-10T00:00:00.000Z");
  });

  it("só __geral existe (sem doc do pool) → fallback rankingScope 'geral', sem statistics", async () => {
    approved("u1");
    getChampionshipStatusMock.mockResolvedValue("archived");
    makeDb({
      groupId: "pool-1",
      historyDocs: {
        "fifa.world__geral": historySnapshot({
          ranking: [rankingEntry("u9", 1, 30)],
        }),
      },
    });
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rankingScope).toBe("geral");
    expect(body.statistics).toBeUndefined();
    expect(body.ranking).toEqual([rankingEntry("u9", 1, 30)]);
  });

  it("usuário sem groupId (sem pool) → 404, sem tocar history (não há pool p/ habilitar)", async () => {
    approved("u1");
    getChampionshipStatusMock.mockResolvedValue("archived");
    const { historyDocFn } = makeDb({
      groupId: undefined,
      historyDocs: { "fifa.world__geral": historySnapshot() },
    });
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    expect(res.status).toBe(404);
    // Sem groupId, o gate barra antes de qualquer leitura de history.
    expect(historyDocFn).not.toHaveBeenCalled();
  });

  it("jogos vêm de getEffectiveMatches(championshipId)", async () => {
    approved("u1");
    getChampionshipStatusMock.mockResolvedValue("archived");
    makeDb({ groupId: "pool-1", historyDocs: { "fifa.world__geral": historySnapshot() } });
    getEffectiveMatchesMock.mockResolvedValue([
      { id: "m1", status: "finished", kickoffAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    expect(getEffectiveMatchesMock).toHaveBeenCalledWith("fifa.world");
    const body = await res.json();
    expect(body.matches).toEqual([
      { id: "m1", status: "finished", kickoffAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("getEffectiveMatches lança → matches: [], mas o detalhe continua 200 (degrada, não derruba)", async () => {
    approved("u1");
    getChampionshipStatusMock.mockResolvedValue("archived");
    makeDb({ groupId: "pool-1", historyDocs: { "fifa.world__geral": historySnapshot() } });
    getEffectiveMatchesMock.mockRejectedValue(new Error("ESPN indisponível"));
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
    expect(body.rankingScope).toBe("geral"); // ranking/estatísticas não são afetados
  });

  it("groupId SEMPRE da sessão — ignora qualquer valor no request (query/URL)", async () => {
    approved("u1"); // users/u1 → groupId "pool-1" (única fonte)
    getChampionshipStatusMock.mockResolvedValue("archived");
    const { historyDocFn } = makeDb({
      groupId: "pool-1",
      historyDocs: {
        "fifa.world__pool-1": historySnapshot({ scopeKey: "pool-1", poolId: "pool-1" }),
      },
    });
    // Tenta injetar um groupId diferente via querystring — a rota não lê `Request`
    // para isso (só usa `session.user.uid` → `users/{uid}.groupId`).
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world?groupId=pool-ATACANTE"),
      ctx("fifa.world"),
    );
    expect(res.status).toBe(200);
    expect(historyDocFn).toHaveBeenCalledWith("fifa.world__pool-1");
    expect(historyDocFn).not.toHaveBeenCalledWith("fifa.world__pool-ATACANTE");
  });

  it("resposta passa por championshipHistoryResponseSchema sem lançar", async () => {
    approved("u1");
    getChampionshipStatusMock.mockResolvedValue("archived");
    makeDb({ groupId: "pool-1", historyDocs: { "fifa.world__geral": historySnapshot() } });
    const res = await GET(
      new Request("http://localhost/api/history/fifa.world"),
      ctx("fifa.world"),
    );
    const { matches: _matches, ...rest } = await res.json();
    expect(() => championshipHistoryResponseSchema.parse(rest)).not.toThrow();
  });
});
