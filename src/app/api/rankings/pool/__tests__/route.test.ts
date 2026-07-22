/**
 * Testes do Route Handler GET /api/rankings/pool (ranking fechado por pool).
 *
 * Isola a rota: `requireApprovedUser`, `getAdminFirestore` e `ensureRankingsFresh`
 * são mockados. Foco: isolamento multi-tenant (groupId SÓ da sessão), usuário sem
 * pool → null, doc ausente/malformado → null, e que o guard roda só quando há pool.
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApprovedMock, getFirestoreMock, ensureFreshMock } = vi.hoisted(() => ({
  requireApprovedMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  ensureFreshMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/rankings/recalc", () => ({
  ensureRankingsFresh: ensureFreshMock,
  AGGREGATE_SCOPE: "agregado",
}));
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/rankings/pool/route";

// ───────────────────────── Fixtures ─────────────────────────
function rankingDoc(overrides: Record<string, unknown> = {}) {
  return {
    scope: "geral",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
    ],
    ...overrides,
  };
}

function mockDb(opts: {
  groupId?: string;
  poolSnap?: { exists: boolean; data: () => unknown };
  // users vivos para a hidratação (uid → campos). Default: vazio (mantém snapshot).
  liveUsers?: Record<string, Record<string, unknown>>;
  // doc do pool `pools/{groupId}` (split-phase-ranking TASK-02). `undefined` = doc
  // ausente. Quando objeto, vira o data() do snapshot do pool.
  poolDoc?: Record<string, unknown>;
  // doc agregado `rankings/pool-{groupId}-agregado` (multi-championship TASK-12).
  // `undefined` (default) = agregado AUSENTE → a rota faz fallback ao `geral` bare
  // (realidade do pool só-Copa, maioria legada). Quando objeto, vira o data() do
  // snapshot agregado (pool com ≥2 campeonatos pontuáveis, modo geral).
  aggregateDoc?: Record<string, unknown>;
}) {
  const poolGet = vi
    .fn()
    .mockResolvedValue(opts.poolSnap ?? { exists: true, data: () => rankingDoc() });
  const aggGet = vi.fn().mockResolvedValue(
    opts.aggregateDoc !== undefined
      ? { exists: true, data: () => opts.aggregateDoc }
      : { exists: false, data: () => undefined },
  );
  const poolsGet = vi.fn().mockResolvedValue(
    opts.poolDoc !== undefined
      ? { exists: true, data: () => opts.poolDoc }
      : { exists: false, data: () => undefined },
  );
  const collection = vi.fn((name: string) => ({
    // O doc-id importa para `rankings`: o `-agregado` é servido por `aggGet`
    // (ausente por default), o restante (`-geral`/escopado) por `poolGet`.
    doc: vi.fn((docId?: string) => ({
      uid: docId,
      get: vi.fn().mockResolvedValue(
        name === "users"
          ? { exists: true, data: () => (opts.groupId ? { groupId: opts.groupId } : {}) }
          : { exists: false, data: () => undefined },
      ),
      ...(name === "rankings"
        ? { get: docId?.endsWith("-agregado") ? aggGet : poolGet }
        : {}),
      ...(name === "pools" ? { get: poolsGet } : {}),
    })),
  }));
  // getAll: hidratação das entries → snaps de users vivos por uid.
  const getAll = vi.fn(async (...refs: Array<{ uid?: string }>) =>
    refs.map((r) => {
      const data = r.uid ? opts.liveUsers?.[r.uid] : undefined;
      return { id: r.uid, exists: data !== undefined, data: () => data };
    }),
  );
  getFirestoreMock.mockReturnValue({ collection, getAll });
  return { poolGet, aggGet, poolsGet, getAll };
}

const approved = (uid = "u1") => requireApprovedMock.mockResolvedValue({ user: { uid } });

// TASK-21: GET agora recebe Request (lê `?championship`). Helper para os casos legados
// (sem query) — comportamento byte-idêntico ao anterior.
const req = (url = "http://localhost/api/rankings/pool") => new Request(url);

beforeEach(() => {
  vi.clearAllMocks();
  ensureFreshMock.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/rankings/pool", () => {
  it("sessão inválida → repassa o errorResponse (401), sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("usuário SEM pool → 200 null, e NÃO dispara recalc", async () => {
    approved();
    mockDb({ groupId: undefined });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(ensureFreshMock).not.toHaveBeenCalled();
  });

  it("usuário com pool + doc presente → 200 com Ranking; recalc-on-read roda", async () => {
    approved();
    mockDb({ groupId: "pool-1" });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(ensureFreshMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
  });

  it("lê o pool DA SESSÃO (pool-{groupId}-geral), nunca um do request", async () => {
    approved();
    // Agregado ausente (pool só-Copa) → a rota faz fallback e lê o `geral` bare.
    const docFn = vi.fn((id?: string) => ({
      get: vi.fn().mockResolvedValue(
        id?.endsWith("-agregado")
          ? { exists: false, data: () => undefined }
          : { exists: true, data: () => rankingDoc() },
      ),
    }));
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "pool-42" }) }) }))
            : docFn,
      })),
      // hidratação das entries não é o foco aqui → sem users vivos (mantém snapshot).
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    await GET(req());
    expect(docFn).toHaveBeenCalledWith("pool-pool-42-geral");
  });

  it("hidrata a foto/apelido AO VIVO (sobrescreve o snapshot do recalc)", async () => {
    approved("u1");
    mockDb({
      groupId: "pool-1",
      liveUsers: { u1: { avatarUrl: "data:image/jpeg;base64,NEW", nickname: "novo" } },
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.entries[0].avatarUrl).toBe("data:image/jpeg;base64,NEW");
    expect(body.entries[0].nickname).toBe("novo");
  });

  it("doc do pool ausente → 200 null", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolSnap: { exists: false, data: () => undefined } });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("doc do pool fora do schema → 200 null", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolSnap: { exists: true, data: () => rankingDoc({ scope: "x" }) } });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  // ── splitPhaseRanking no payload (split-phase-ranking TASK-02) ─────────────
  it("anexa splitPhaseRanking: true quando o pool tem a flag ON", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: { splitPhaseRanking: true } });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.splitPhaseRanking).toBe(true);
    expect(body.entries).toHaveLength(1);
  });

  it("anexa splitPhaseRanking: false quando a flag é false explícito", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: { splitPhaseRanking: false } });
    const res = await GET(req());
    const body = await res.json();
    expect(body.splitPhaseRanking).toBe(false);
  });

  it("flag ausente no pool doc → payload sem splitPhaseRanking (OFF)", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: {} });
    const res = await GET(req());
    const body = await res.json();
    expect(body.splitPhaseRanking).toBeUndefined();
    expect(body.entries).toHaveLength(1);
  });

  it("doc do pool ausente → payload sem splitPhaseRanking, ranking intacto", async () => {
    approved();
    mockDb({ groupId: "pool-1" }); // poolDoc undefined → pools/{id} não existe
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.splitPhaseRanking).toBeUndefined();
    expect(body.entries).toHaveLength(1);
  });

  it("lê a flag do pool DA SESSÃO (pools/{groupId}), nunca do request", async () => {
    approved();
    const { poolsGet } = mockDb({ groupId: "pool-42", poolDoc: { splitPhaseRanking: true } });
    await GET(req());
    expect(poolsGet).toHaveBeenCalledTimes(1);
  });

  it("NÃO vaza outros campos do pool no payload (só flags de exibição)", async () => {
    approved();
    mockDb({
      groupId: "pool-1",
      poolDoc: {
        splitPhaseRanking: true,
        name: "Bolão Secreto",
        photoBase64: "data:image/png;base64,XXX",
        maxParticipants: 50,
        predictionsLocked: true,
      },
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.splitPhaseRanking).toBe(true);
    expect(body.name).not.toBe("Bolão Secreto");
    expect(body).not.toHaveProperty("photoBase64");
    expect(body).not.toHaveProperty("maxParticipants");
    expect(body).not.toHaveProperty("predictionsLocked");
  });

  // ── ignoreOvertimeGoals no payload (ignorar-gols-prorrogacao TASK-04) ───────
  it("anexa ignoreOvertimeGoals: true quando o pool tem a flag ON", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: { ignoreOvertimeGoals: true } });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignoreOvertimeGoals).toBe(true);
    expect(body.entries).toHaveLength(1);
  });

  it("anexa ignoreOvertimeGoals: false quando a flag é false explícito", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: { ignoreOvertimeGoals: false } });
    const res = await GET(req());
    const body = await res.json();
    expect(body.ignoreOvertimeGoals).toBe(false);
  });

  it("flag ausente no pool doc → payload sem ignoreOvertimeGoals (OFF)", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: {} });
    const res = await GET(req());
    const body = await res.json();
    expect(body.ignoreOvertimeGoals).toBeUndefined();
    expect(body.entries).toHaveLength(1);
  });

  it("expõe as duas flags juntas quando ambas ON", async () => {
    approved();
    mockDb({
      groupId: "pool-1",
      poolDoc: { splitPhaseRanking: true, ignoreOvertimeGoals: true },
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.splitPhaseRanking).toBe(true);
    expect(body.ignoreOvertimeGoals).toBe(true);
  });

  // ── cores de marca no payload (personalizacao-grupo TASK-03) ────────────────
  it("anexa primaryColorLight/Dark quando o pool tem cores", async () => {
    approved();
    mockDb({
      groupId: "pool-1",
      poolDoc: { primaryColorLight: "#1a2b3c", primaryColorDark: "#aabbcc" },
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.primaryColorLight).toBe("#1a2b3c");
    expect(body.primaryColorDark).toBe("#aabbcc");
  });

  it("cores ausentes → payload sem primaryColor* (grupo sem cor)", async () => {
    approved();
    mockDb({ groupId: "pool-1", poolDoc: {} });
    const res = await GET(req());
    const body = await res.json();
    expect(body.primaryColorLight).toBeUndefined();
    expect(body.primaryColorDark).toBeUndefined();
  });

  it("cor malformada no banco → omitida (não quebra o parse do payload)", async () => {
    approved();
    mockDb({
      groupId: "pool-1",
      poolDoc: { primaryColorLight: "verde", primaryColorDark: "#00ff00" },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.primaryColorLight).toBeUndefined();
    expect(body.primaryColorDark).toBe("#00ff00");
  });

  // ── TASK-21: ?championship ────────────────────────────────────────────────
  const champUrl = (id: string) => `http://localhost/api/rankings/pool?championship=${id}`;

  it("?championship={liga} → lê pool-{groupId}-{id}-geral (schema dedicado)", async () => {
    approved();
    const champDoc = {
      scope: "bra.1-2026-geral",
      championshipId: "bra.1-2026",
      updatedAt: "2026-06-01T02:00:00.000Z",
      entries: [
        { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
      ],
    };
    const rankingsDoc = vi.fn((id?: string) => ({
      id,
      get: vi.fn().mockResolvedValue({ exists: true, data: () => champDoc }),
    }));
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "pool-7" }) }) }))
            : name === "pools"
              ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }) }))
              : rankingsDoc,
      })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    const res = await GET(req(champUrl("bra.1-2026")));
    expect(res.status).toBe(200);
    expect(rankingsDoc).toHaveBeenCalledWith("pool-pool-7-bra.1-2026-geral");
    const body = await res.json();
    expect(body.championshipId).toBe("bra.1-2026");
    expect(body.entries).toHaveLength(1);
  });

  it("?championship=desconhecido → 400, sem tocar Firestore", async () => {
    approved();
    const res = await GET(req(champUrl("nao.existe-2026")));
    expect(res.status).toBe(400);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  // ── TASK-12: agregado (modo geral) e modo por-campeonato ──────────────────
  const aggDoc = {
    scope: "agregado",
    updatedAt: "2026-06-01T02:00:00.000Z",
    entries: [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 20, wrong: 1, accuracy: 90 },
    ],
  };

  it("modo geral + agregado presente → serve o agregado com rankingMode: geral", async () => {
    approved();
    // poolDoc ausente → rankingMode default "geral"; aggregateDoc presente → servido.
    mockDb({ groupId: "pool-1", aggregateDoc: aggDoc });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe("agregado");
    expect(body.rankingMode).toBe("geral");
    expect(body.entries[0].points).toBe(20);
  });

  it("modo geral SEM agregado → fallback ao geral bare, rankingMode: geral", async () => {
    approved();
    // aggregateDoc undefined (default) → rota cai no `pool-{id}-geral`.
    mockDb({ groupId: "pool-1", poolDoc: {} });
    const res = await GET(req());
    const body = await res.json();
    expect(body.scope).toBe("geral");
    expect(body.rankingMode).toBe("geral");
    expect(body.entries).toHaveLength(1);
  });

  it("modo por-campeonato (sem ?championship) → serve geral bare + rankingMode: por-campeonato", async () => {
    approved();
    // Mesmo com agregado presente, modo por-campeonato NÃO agrega: serve o geral bare.
    mockDb({
      groupId: "pool-1",
      poolDoc: { rankingMode: "por-campeonato" },
      aggregateDoc: aggDoc,
    });
    const res = await GET(req());
    const body = await res.json();
    expect(body.scope).toBe("geral");
    expect(body.rankingMode).toBe("por-campeonato");
    expect(body.entries[0].points).toBe(10); // rankingDoc bare, não o agregado (20)
  });

  it("modo geral, pool liga-única (Copa OFF) sem agregado → serve o doc da liga, NÃO a Copa", async () => {
    approved();
    // Pool habilita SÓ bra.1-2026 (Copa desabilitada) → 1 pontuável → sem agregado.
    // O fallback NÃO pode servir `pool-{id}-geral` (Copa); deve servir a liga.
    const leagueDoc = {
      scope: "bra.1-2026-geral",
      championshipId: "bra.1-2026",
      updatedAt: "2026-06-01T02:00:00.000Z",
      entries: [
        { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 7, wrong: 1, accuracy: 88 },
      ],
    };
    const rankingsDoc = vi.fn((id?: string) => ({
      id,
      get: vi.fn().mockResolvedValue(
        id === "pool-pool-9-bra.1-2026-geral"
          ? { exists: true, data: () => leagueDoc }
          // agregado ausente E o `pool-{id}-geral` bare (Copa) NÃO deve ser lido/servido.
          : { exists: false, data: () => undefined },
      ),
    }));
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "pool-9" }) }) }))
            : name === "pools"
              ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ enabledChampionships: ["bra.1-2026"] }) }) }))
              : rankingsDoc,
      })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(rankingsDoc).toHaveBeenCalledWith("pool-pool-9-bra.1-2026-geral");
    expect(rankingsDoc).not.toHaveBeenCalledWith("pool-pool-9-geral"); // Copa NUNCA servida
    const body = await res.json();
    expect(body.championshipId).toBe("bra.1-2026");
    expect(body.entries[0].points).toBe(7);
    expect(body.rankingMode).toBe("geral");
    expect(body).not.toHaveProperty("splitPhaseRanking"); // resposta escopada (LOW-2)
  });

  it("?championship={liga} → resposta escopada carrega rankingMode do pool", async () => {
    approved();
    const champDoc = {
      scope: "bra.1-2026-geral",
      championshipId: "bra.1-2026",
      updatedAt: "2026-06-01T02:00:00.000Z",
      entries: [
        { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10, wrong: 2, accuracy: 83 },
      ],
    };
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "pool-7" }) }) }))
            : name === "pools"
              ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ rankingMode: "por-campeonato" }) }) }))
              : vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => champDoc }) })),
      })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    const res = await GET(req(`http://localhost/api/rankings/pool?championship=bra.1-2026`));
    const body = await res.json();
    expect(body.rankingMode).toBe("por-campeonato");
    // Resposta escopada NÃO carrega flags Copa/pool-display (LOW-2).
    expect(body).not.toHaveProperty("splitPhaseRanking");
    expect(body).not.toHaveProperty("primaryColorLight");
  });

  it("?championship=fifa.world → legado (doc bare pool-{groupId}-geral)", async () => {
    approved();
    const rankingsDoc = vi.fn((id?: string) => ({
      id,
      get: vi.fn().mockResolvedValue({ exists: true, data: () => rankingDoc() }),
    }));
    getFirestoreMock.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc:
          name === "users"
            ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ groupId: "pool-1" }) }) }))
            : name === "pools"
              ? vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }) }))
              : rankingsDoc,
      })),
      getAll: vi.fn(async (...refs: unknown[]) => refs.map(() => ({ exists: false, data: () => undefined }))),
    });
    const res = await GET(req(champUrl("fifa.world")));
    expect(res.status).toBe(200);
    expect(rankingsDoc).toHaveBeenCalledWith("pool-pool-1-geral"); // bare, sem prefixo de campeonato
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
  });
});
