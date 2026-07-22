/**
 * TASK-13 — gate de recalc honra status ARQUIVADO DINÂMICO (Firestore), não só
 * o default estático do catálogo (RED / TDD).
 *
 * Diferença vs `recalcArchivedGate.test.ts`: ali `eng.1-2026` é marcada arquivada
 * mockando o CATÁLOGO. Aqui o catálogo fica REAL (bra.1-2026 = liga ativa) e o
 * override vem do resolvedor dinâmico `loadChampionshipStatuses(db)` — provando
 * que o sweep consome o estado de runtime (doc `championships/{id}`), não só o
 * estático. Produção ainda lê `getChampionship().status` → este teste falha (RED).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getEffectiveMatchesMock, loadStatusesMock } = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
  loadStatusesMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("@/server/copaData/championshipState", () => ({
  loadChampionshipStatuses: loadStatusesMock,
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
              .filter((p) => (op === "in" && Array.isArray(val) ? val.includes(p["uid"]) : true))
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
          get: vi.fn().mockResolvedValue({ exists: poolById.has(id), data: () => poolById.get(id) }),
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
    };
    return byId[championshipId ?? "fifa.world"] ?? [];
  });
  // Override dinâmico: bra.1-2026 arquivada em runtime (catálogo real diria "ativa").
  loadStatusesMock.mockResolvedValue(
    new Map<string, string>([
      ["fifa.world", "archived"],
      ["bra.1-2026", "archived"],
    ]),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("recalcRankings — gate arquivado dinâmico (TASK-13)", () => {
  it("liga com override archived (Firestore) sai do union; não re-pontua", async () => {
    const { db, setPayloads } = makeScopedDb({
      users: [baseUser({ uid: "u1", groupId: "p1" })],
      preds: [{ uid: "u1", matchId: "bra.1-2026:bm1", homeScore: 2, awayScore: 0 }],
      pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
    });

    const summary = await recalcRankings(db);

    // Arquivada dinamicamente → nenhum doc por campeonato.
    expect([...setPayloads.keys()].some((k) => k.includes("bra.1-2026"))).toBe(false);
    expect(summary.championshipsProcessed).toBe(0);
  });
});
