/**
 * Testes do Route Handler GET /api/history (lista de campeonatos arquivados,
 * TASK-15 — Seção Histórico).
 *
 * Isola a rota: `requireApprovedUser`, `getAdminFirestore` e
 * `loadChampionshipStatuses` são mockados (mesmo padrão de
 * `route.archivedGate.test.ts` da TASK-13, que mocka `championshipState`
 * inteiro para controlar o status por-campeonato sem depender do catálogo
 * default). `getEnabledChampionships`/`getChampionship` ficam REAIS (puros,
 * usam o catálogo curado) — só os ids reais do catálogo são usados nas
 * fixtures. Foco: filtragem archived∩enabled, ordenação, hasPoolSnapshot,
 * isolamento multi-tenant (groupId só da sessão) e validação do contrato Zod.
 */

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireApprovedMock, getFirestoreMock, loadChampionshipStatusesMock } =
  vi.hoisted(() => ({
    requireApprovedMock: vi.fn(),
    getFirestoreMock: vi.fn(),
    loadChampionshipStatusesMock: vi.fn(),
  }));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/copaData/championshipState", () => ({
  loadChampionshipStatuses: loadChampionshipStatusesMock,
}));
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/history/route";
import { archivedChampionshipsResponseSchema } from "@/schemas/history";

// ───────────────────────── Fixtures ─────────────────────────
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
 * Fake Firestore mínimo: um mapa por-coleção resolve `.doc(id).get()` e
 * `db.getAll(...refs)` no mesmo dado (refs carregam a coleção de origem).
 */
function makeDb(opts: {
  groupId?: string;
  poolDoc?: Record<string, unknown>;
  historyDocs?: Record<string, Record<string, unknown>>;
  stateDocs?: Record<string, Record<string, unknown>>;
}) {
  function snap(name: string, id: string) {
    const bucket: Record<string, Record<string, unknown>> =
      name === "users"
        ? opts.groupId !== undefined
          ? { [id]: { groupId: opts.groupId } }
          : {}
        : name === "pools"
          ? opts.poolDoc !== undefined
            ? { [id]: opts.poolDoc }
            : {}
          : name === "history"
            ? (opts.historyDocs ?? {})
            : name === "championships"
              ? (opts.stateDocs ?? {})
              : {};
    const val = bucket[id];
    return { exists: val !== undefined, data: () => val, id };
  }
  const collection = vi.fn((name: string) => ({
    doc: vi.fn((id: string) => ({
      id,
      _collection: name,
      get: vi.fn(async () => snap(name, id)),
    })),
  }));
  const getAll = vi.fn(
    async (...refs: Array<{ _collection: string; id: string }>) =>
      refs.map((r) => snap(r._collection, r.id)),
  );
  getFirestoreMock.mockReturnValue({ collection, getAll });
  return { collection, getAll };
}

const approved = (uid = "u1") => requireApprovedMock.mockResolvedValue({ user: { uid } });

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/history", () => {
  it("sessão inválida → repassa o errorResponse (401), sem tocar Firestore", async () => {
    requireApprovedMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("usuário sem groupId (doc ausente ou campo ausente) → 200 { items: [] }", async () => {
    approved();
    makeDb({ groupId: undefined });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("pool sem NENHUM campeonato archived → 200 { items: [] } (empty state)", async () => {
    approved();
    makeDb({
      groupId: "pool-1",
      poolDoc: { enabledChampionships: ["eng.1-2026"] },
    });
    loadChampionshipStatusesMock.mockResolvedValue(
      new Map([["eng.1-2026", "upcoming"]]),
    );
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it(
    "filtra a interseção archived∩enabled (exclui ativo enabled e archived não-enabled), " +
      "ordena archivedAt desc e reporta hasPoolSnapshot corretamente",
    async () => {
      approved("u1");
      // bra.1-2026 é "archived" no mock de status mas NÃO está habilitado no pool
      // → nunca deve aparecer (prova de isolamento por pool, não só por status).
      makeDb({
        groupId: "pool-1",
        poolDoc: { enabledChampionships: ["fifa.world", "eng.1-2026"] },
        historyDocs: {
          // fifa.world: só snapshot __geral (sem doc do pool) → hasPoolSnapshot=false.
          "fifa.world__geral": historySnapshot({
            championshipId: "fifa.world",
            archivedAt: "2026-01-10T00:00:00.000Z",
          }),
          // bra.1-2026: archived porém NÃO habilitado no pool → não deve ler nem listar.
          "bra.1-2026__geral": historySnapshot({
            championshipId: "bra.1-2026",
            archivedAt: "2026-05-01T00:00:00.000Z",
          }),
        },
      });
      loadChampionshipStatusesMock.mockResolvedValue(
        new Map([
          ["fifa.world", "archived"],
          ["bra.1-2026", "archived"], // archived mas fora de enabledChampionships
          ["eng.1-2026", "upcoming"], // enabled mas não archived
        ]),
      );

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].championshipId).toBe("fifa.world");
      expect(body.items[0].hasPoolSnapshot).toBe(false);
    },
  );

  it("ordena por archivedAt desc e computa hasPoolSnapshot=true quando o doc do pool existe", async () => {
    approved("u1");
    makeDb({
      groupId: "pool-9",
      poolDoc: { enabledChampionships: ["fifa.world", "bra.1-2026"] },
      historyDocs: {
        // fifa.world: só __geral (mais antigo).
        "fifa.world__geral": historySnapshot({
          championshipId: "fifa.world",
          archivedAt: "2026-01-10T00:00:00.000Z",
        }),
        // bra.1-2026: só o doc do pool (sem __geral) — cai no ramo "só pool"
        // (geral ausente, poolSnapshot presente) → hasPoolSnapshot=true e
        // archivedAt vem do snapshot do pool (mais recente).
        "bra.1-2026__pool-9": historySnapshot({
          championshipId: "bra.1-2026",
          scopeKey: "pool-9",
          poolId: "pool-9",
          archivedAt: "2026-05-01T00:00:00.000Z",
          statistics: [
            { uid: "u1", totalCorrect: 5, accuracy: 60, longestStreak: 3 },
          ],
        }),
      },
    });
    loadChampionshipStatusesMock.mockResolvedValue(
      new Map([
        ["fifa.world", "archived"],
        ["bra.1-2026", "archived"],
      ]),
    );

    const res = await GET();
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    // desc por archivedAt: bra.1-2026 (maio) antes de fifa.world (janeiro).
    expect(body.items.map((i: { championshipId: string }) => i.championshipId)).toEqual([
      "bra.1-2026",
      "fifa.world",
    ]);
    const bra = body.items.find(
      (i: { championshipId: string }) => i.championshipId === "bra.1-2026",
    );
    const fifa = body.items.find(
      (i: { championshipId: string }) => i.championshipId === "fifa.world",
    );
    expect(bra.hasPoolSnapshot).toBe(true);
    expect(fifa.hasPoolSnapshot).toBe(false);
  });

  it("resposta passa por archivedChampionshipsResponseSchema sem lançar", async () => {
    approved("u1");
    makeDb({
      groupId: "pool-1",
      poolDoc: { enabledChampionships: ["fifa.world"] },
      historyDocs: {
        "fifa.world__geral": historySnapshot(),
      },
    });
    loadChampionshipStatusesMock.mockResolvedValue(new Map([["fifa.world", "archived"]]));

    const res = await GET();
    const body = await res.json();
    expect(() => archivedChampionshipsResponseSchema.parse(body)).not.toThrow();
  });
});
