/**
 * Testes de `ensureRankingsFresh` (dirty-by-finish: recomputa quando a assinatura
 * dos finalizados muda) e `recalcRankingsBestEffort` (encadeado no save do
 * resultado, nunca lança).
 *
 * `recalcRankings` roda de verdade com `getEffectiveMatches` mockado. Sinal de
 * "recalc rodou" = houve `set` em `rankings/geral` (capturado em `writes`).
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
  computeFinishedSignature,
  ensureRankingsFresh,
  recalcRankingsBestEffort,
} from "@/server/rankings/recalc";

/**
 * `fresh` controla o doc-sentinela `rankings/_freshness` lido pelo dirty-by-finish;
 * os demais docs retornam ausentes (suficiente para os cenários do guard).
 */
function makeDb(opts: { fresh?: { exists: boolean; data?: () => unknown } } = {}) {
  const writes: string[] = [];
  const docRef = (coll: string, id: string) => ({
    get: vi.fn().mockResolvedValue(
      coll === "rankings" && id === "_freshness"
        ? (opts.fresh ?? { exists: false, data: () => undefined })
        : { exists: false, data: () => undefined },
    ),
    set: vi.fn(async () => {
      writes.push(`${coll}/${id}`);
    }),
    ref: { delete: vi.fn() },
  });
  const collection = vi.fn((name: string) => ({
    get: vi.fn().mockResolvedValue({ docs: [] }),
    where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
    doc: vi.fn((id: string) => docRef(name, id)),
  }));
  return { db: { collection } as never, writes };
}

const recalcRan = (writes: string[]) => writes.includes("rankings/geral");
const EMPTY_SIG = computeFinishedSignature([]); // assinatura de "[] finalizados"

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("ensureRankingsFresh (dirty-by-finish)", () => {
  it("assinatura bate → no-op (nada mudou desde o último recalc)", async () => {
    const { db, writes } = makeDb({
      fresh: { exists: true, data: () => ({ signature: EMPTY_SIG }) },
    });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).toHaveBeenCalledTimes(1); // só p/ a assinatura
    expect(recalcRan(writes)).toBe(false);
  });

  it("doc de frescor ausente → recalc (cold start)", async () => {
    const { db, writes } = makeDb({ fresh: { exists: false } });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).toHaveBeenCalled();
    expect(recalcRan(writes)).toBe(true);
  });

  it("assinatura diverge (placar novo) → recalc", async () => {
    const { db, writes } = makeDb({
      fresh: { exists: true, data: () => ({ signature: "stale-signature" }) },
    });
    await ensureRankingsFresh(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("falha lendo partidas efetivas não lança nem recalcula", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("fonte fora"));
    const { db, writes } = makeDb({ fresh: { exists: true, data: () => ({ signature: EMPTY_SIG }) } });
    await expect(ensureRankingsFresh(db)).resolves.toBeUndefined();
    expect(recalcRan(writes)).toBe(false);
  });

  it("falha no recálculo (cold start) não lança", async () => {
    getEffectiveMatchesMock
      .mockResolvedValueOnce([]) // assinatura calcula ok
      .mockRejectedValueOnce(new Error("fonte fora")); // recalc re-busca e falha
    const { db } = makeDb({ fresh: { exists: false } });
    await expect(ensureRankingsFresh(db)).resolves.toBeUndefined();
  });
});

describe("computeFinishedSignature", () => {
  const m = (over: Record<string, unknown>) => ({
    id: "m1",
    status: "finished",
    homeScore: 1,
    awayScore: 0,
    ...over,
  }) as never;

  it("ignora não-finalizados", () => {
    expect(computeFinishedSignature([m({ id: "x", status: "scheduled" })])).toBe(EMPTY_SIG);
  });

  it("muda quando um jogo novo finaliza", () => {
    const a = computeFinishedSignature([m({ id: "m1" })]);
    const b = computeFinishedSignature([m({ id: "m1" }), m({ id: "m2" })]);
    expect(a).not.toBe(b);
  });

  it("muda quando um placar finalizado é corrigido", () => {
    const a = computeFinishedSignature([m({ id: "m1", homeScore: 1, awayScore: 0 })]);
    const b = computeFinishedSignature([m({ id: "m1", homeScore: 2, awayScore: 0 })]);
    expect(a).not.toBe(b);
  });

  it("é estável independente da ordem de entrada", () => {
    const a = computeFinishedSignature([m({ id: "m1" }), m({ id: "m2" })]);
    const b = computeFinishedSignature([m({ id: "m2" }), m({ id: "m1" })]);
    expect(a).toBe(b);
  });
});

describe("recalcRankingsBestEffort", () => {
  it("recalcula (grava rankings/geral)", async () => {
    const { db, writes } = makeDb();
    await recalcRankingsBestEffort(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("nunca lança quando o recálculo falha", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("boom"));
    const { db, writes } = makeDb();
    await expect(recalcRankingsBestEffort(db)).resolves.toBeUndefined();
    expect(recalcRan(writes)).toBe(false);
  });
});

// ── TASK-05: propagação de avatarUrl às entries do ranking ──────────────────
/**
 * DB mock que devolve usuários aprovados (com/sem `avatarUrl`) e captura o PAYLOAD
 * gravado em cada doc — diferente do `makeDb` (que só registra o path). Sem partidas
 * finalizadas: os usuários ainda entram no ranking geral (pontos 0), bastando para
 * exercitar `toEntry` + `applyAvatarBudget`.
 */
function makeUsersDb(users: Array<Record<string, unknown>>) {
  const setPayloads = new Map<string, unknown>();
  const collection = vi.fn((name: string) => {
    if (name === "users") {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: users.map((u) => ({ id: u["uid"], data: () => u })) }),
        }),
        get: vi.fn().mockResolvedValue({ docs: [] }),
        doc: vi.fn(),
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

const baseUser = (over: Record<string, unknown>) => ({
  name: "Fulano",
  nickname: "fulano",
  email: "f@x.com",
  role: "participant",
  status: "approved",
  ...over,
});

describe("recalc — avatarUrl nas entries (TASK-05)", () => {
  it("propaga avatarUrl do user para a entry correspondente", async () => {
    const { db, setPayloads } = makeUsersDb([
      baseUser({ uid: "comFoto", avatarUrl: "data:image/jpeg;base64,QUJD" }),
    ]);
    await recalcRankingsBestEffort(db);
    const geral = setPayloads.get("rankings/geral") as { entries: Array<Record<string, unknown>> };
    const entry = geral.entries.find((e) => e["uid"] === "comFoto");
    expect(entry?.["avatarUrl"]).toBe("data:image/jpeg;base64,QUJD");
  });

  it("entry de user sem avatarUrl não carrega o campo", async () => {
    const { db, setPayloads } = makeUsersDb([baseUser({ uid: "semFoto" })]);
    await recalcRankingsBestEffort(db);
    const geral = setPayloads.get("rankings/geral") as { entries: Array<Record<string, unknown>> };
    const entry = geral.entries.find((e) => e["uid"] === "semFoto");
    expect(entry).toBeDefined();
    expect("avatarUrl" in entry!).toBe(false);
  });
});

describe("recalc — doc de frescor (dirty-by-finish)", () => {
  it("grava rankings/_freshness com a assinatura dos finalizados", async () => {
    const finished = [
      {
        id: "m1",
        status: "finished",
        homeScore: 2,
        awayScore: 1,
        stage: "grupos",
        groupId: "A",
        kickoffAt: "2026-06-11T13:00:00-06:00",
      },
    ];
    getEffectiveMatchesMock.mockResolvedValue(finished);
    const { db, setPayloads } = makeUsersDb([baseUser({ uid: "u1" })]);
    await recalcRankingsBestEffort(db);
    const fresh = setPayloads.get("rankings/_freshness") as { signature: string } | undefined;
    expect(fresh).toBeDefined();
    // Persistido === o que o guard recomputa ao ler → no-op enquanto nada mudar.
    expect(fresh!.signature).toBe(computeFinishedSignature(finished as never));
  });
});
