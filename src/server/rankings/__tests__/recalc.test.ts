/**
 * Testes de `ensureRankingsFresh` (cold start: popula-se-ausente) e
 * `recalcRankingsBestEffort` (encadeado no save do resultado, nunca lança).
 *
 * `recalcRankings` roda de verdade com `getEffectiveMatches` mockado → []. Sinal de
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

import { ensureRankingsFresh, recalcRankingsBestEffort } from "@/server/rankings/recalc";

function makeDb(opts: { geral: { exists: boolean; data?: () => unknown } }) {
  const writes: string[] = [];
  const docRef = (coll: string, id: string) => ({
    get: vi.fn().mockResolvedValue(
      coll === "rankings" && id === "geral"
        ? opts.geral
        : { exists: false, data: () => undefined },
    ),
    set: vi.fn(async () => {
      writes.push(`${coll}/${id}`);
    }),
  });
  const collection = vi.fn((name: string) => ({
    get: vi.fn().mockResolvedValue({ docs: [] }),
    where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }),
    doc: vi.fn((id: string) => docRef(name, id)),
  }));
  return { db: { collection } as never, writes };
}

const recalcRan = (writes: string[]) => writes.includes("rankings/geral");

beforeEach(() => {
  vi.clearAllMocks();
  getEffectiveMatchesMock.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("ensureRankingsFresh (cold start)", () => {
  it("doc já existe → no-op (o save do resultado mantém fresco)", async () => {
    const { db, writes } = makeDb({ geral: { exists: true, data: () => ({}) } });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
    expect(recalcRan(writes)).toBe(false);
  });

  it("doc ausente → popula (recalc bloqueante)", async () => {
    const { db, writes } = makeDb({ geral: { exists: false } });
    await ensureRankingsFresh(db);
    expect(getEffectiveMatchesMock).toHaveBeenCalledTimes(1);
    expect(recalcRan(writes)).toBe(true);
  });

  it("falha de recálculo no cold start não lança", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("fonte fora"));
    const { db } = makeDb({ geral: { exists: false } });
    await expect(ensureRankingsFresh(db)).resolves.toBeUndefined();
  });
});

describe("recalcRankingsBestEffort", () => {
  it("recalcula (grava rankings/geral)", async () => {
    const { db, writes } = makeDb({ geral: { exists: true, data: () => ({}) } });
    await recalcRankingsBestEffort(db);
    expect(recalcRan(writes)).toBe(true);
  });

  it("nunca lança quando o recálculo falha", async () => {
    getEffectiveMatchesMock.mockRejectedValueOnce(new Error("boom"));
    const { db, writes } = makeDb({ geral: { exists: true, data: () => ({}) } });
    await expect(recalcRankingsBestEffort(db)).resolves.toBeUndefined();
    expect(recalcRan(writes)).toBe(false);
  });
});
