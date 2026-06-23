import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { scoreStateSchema } from "@/schemas/scoreState";
import { readScoreState, writeScoreState } from "@/server/scoring/scoreState";

/**
 * Fake Firestore Admin para TASK-02: modela o doc único `score_state/cron`.
 * `get` devolve { exists, data() } conforme semeado; `set` captura o payload.
 * Registra os ids de collection/doc tocados para afirmar o path fixo.
 */
function makeDb(seed?: { exists: boolean; data?: unknown }) {
  const sets: Record<string, unknown>[] = [];
  const calls = { collection: [] as string[], doc: [] as string[] };

  const docRef = {
    get: vi.fn(async () => ({
      exists: seed?.exists ?? false,
      data: () => seed?.data,
    })),
    set: vi.fn(async (payload: Record<string, unknown>) => {
      sets.push(payload);
    }),
  };
  const coll = {
    doc: vi.fn((id: string) => {
      calls.doc.push(id);
      return docRef;
    }),
  };
  const db = {
    collection: vi.fn((name: string) => {
      calls.collection.push(name);
      return coll;
    }),
  };
  return { db: db as never, sets, calls, docRef };
}

const NOW = new Date("2026-06-23T12:00:00.000Z");

describe("readScoreState", () => {
  it("doc ausente → Map vazio, sem throw (BR2/AC2)", async () => {
    const { db } = makeDb({ exists: false });
    const map = await readScoreState(db);
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it("doc presente → Map com as entradas (T2)", async () => {
    const { db } = makeDb({
      exists: true,
      data: {
        matches: { m1: "finished|2|1", m2: "finished|0|0" },
        updatedAt: "2026-06-23T10:00:00.000Z",
      },
    });
    const map = await readScoreState(db);
    expect(map.size).toBe(2);
    expect(map.get("m1")).toBe("finished|2|1");
    expect(map.get("m2")).toBe("finished|0|0");
  });

  it("doc com `matches` ausente → Map vazio (defensivo, T3)", async () => {
    const { db } = makeDb({
      exists: true,
      data: { updatedAt: "2026-06-23T10:00:00.000Z" },
    });
    const map = await readScoreState(db);
    expect(map.size).toBe(0);
  });

  it("doc com `matches` malformado (valor não-string) → Map vazio (T3)", async () => {
    const { db } = makeDb({
      exists: true,
      data: { matches: { m1: 42 }, updatedAt: "2026-06-23T10:00:00.000Z" },
    });
    const map = await readScoreState(db);
    expect(map.size).toBe(0);
  });

  it("lê do path fixo `score_state/cron`", async () => {
    const { db, calls } = makeDb({ exists: false });
    await readScoreState(db);
    expect(calls.collection).toEqual(["score_state"]);
    expect(calls.doc).toEqual(["cron"]);
  });
});

describe("writeScoreState", () => {
  it("grava { matches, updatedAt } com now injetado (T4/AC3)", async () => {
    const { db, sets, calls } = makeDb();
    const map = new Map([
      ["m1", "finished|2|1"],
      ["m2", "finished|0|0"],
    ]);

    await writeScoreState(db, map, NOW);

    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({
      matches: { m1: "finished|2|1", m2: "finished|0|0" },
      updatedAt: NOW.toISOString(),
    });
    // 1 write no path fixo
    expect(calls.collection).toEqual(["score_state"]);
    expect(calls.doc).toEqual(["cron"]);
  });

  it("Map vazio → grava matches vazio (doc nasce vazio)", async () => {
    const { db, sets } = makeDb();
    await writeScoreState(db, new Map(), NOW);
    expect(sets[0]).toEqual({ matches: {}, updatedAt: NOW.toISOString() });
  });

  it("round-trip: read(write(map)) preserva chaves/valores (BR5/T5)", async () => {
    const original = new Map([
      ["m1", "finished|3|2"],
      ["m2", "scheduled|null|null"],
    ]);

    // captura o payload gravado; clona p/ desacoplar a referência JS (simula o
    // ciclo serializa→Firestore→desserializa, em vez de reusar o mesmo objeto).
    const writeDb = makeDb();
    await writeScoreState(writeDb.db, original, NOW);
    const persisted = structuredClone(writeDb.sets[0]);

    // realimenta como doc presente e relê
    const readDb = makeDb({ exists: true, data: persisted });
    const roundTripped = await readScoreState(readDb.db);

    expect(roundTripped).toEqual(original);
  });
});

describe("scoreStateSchema", () => {
  it("aceita shape válido", () => {
    const r = scoreStateSchema.safeParse({
      matches: { m1: "finished|2|1" },
      updatedAt: "2026-06-23T10:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita `matches` com valor não-string (T6)", () => {
    const r = scoreStateSchema.safeParse({
      matches: { m1: 42 },
      updatedAt: "2026-06-23T10:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita `updatedAt` não-ISO", () => {
    const r = scoreStateSchema.safeParse({
      matches: {},
      updatedAt: "ontem",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita campo extra (strict)", () => {
    const r = scoreStateSchema.safeParse({
      matches: {},
      updatedAt: "2026-06-23T10:00:00.000Z",
      extra: true,
    });
    expect(r.success).toBe(false);
  });
});
