import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { NotificationCreate } from "@/server/notifications/factory";
import { writeNotifications } from "@/server/notifications/write";

/**
 * Fake Firestore Admin para TASK-07: além de capturar sets/commits, suporta
 * `getAll` (pré-check de existência) e modela existência real — um `set` passa a
 * fazer o doc "existir", então uma 2ª chamada com o mesmo id o vê como existente
 * (re-run idempotente). `existingIds` semeia docs já presentes antes da 1ª chamada.
 */
function makeWriteDb(existingIds: string[] = []) {
  const existing = new Set(existingIds);
  const sets: { id: string; data: Record<string, unknown> }[] = [];
  const commits: number[] = [];
  const getAllChunks: number[] = []; // nº de refs por chamada de getAll
  let autoSeq = 0;

  const coll = {
    doc: vi.fn((id?: string) => ({ id: id ?? `auto-${++autoSeq}` })),
  };
  const batch = vi.fn(() => {
    let ops = 0;
    return {
      set: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
        sets.push({ id: ref.id, data });
        existing.add(ref.id); // após o set, o doc existe (re-run vê como existente)
        ops += 1;
      }),
      commit: vi.fn(async () => {
        commits.push(ops);
      }),
    };
  });
  // getAll preserva a ordem dos refs e devolve snapshot {id, exists} por ref.
  const getAll = vi.fn(async (...refs: { id: string }[]) => {
    getAllChunks.push(refs.length);
    return refs.map((r) => ({ id: r.id, exists: existing.has(r.id) }));
  });
  const db = { collection: vi.fn(() => coll), batch, getAll };
  return { db: db as never, sets, commits, getAll, getAllChunks, coll };
}

const NOW = new Date("2026-06-20T15:00:00.000Z");

function item(over: Partial<NotificationCreate> = {}): NotificationCreate {
  return {
    userId: "u1",
    type: "games",
    title: "t",
    message: "m",
    id: "games-u1-m1",
    ...over,
  };
}

describe("writeNotifications — escrita e payload", () => {
  it("lista vazia → nenhum commit, nenhum getAll, retorna []", async () => {
    const { db, commits, getAll } = makeWriteDb();
    const created = await writeNotifications(db, [], NOW);
    expect(commits).toEqual([]);
    expect(getAll).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it("payload completo: id do ref, isRead false, createdAt = now ISO", async () => {
    const { db, sets } = makeWriteDb();
    await writeNotifications(db, [item({ id: "games-u1-m1" })], NOW);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.data).toMatchObject({
      id: "games-u1-m1",
      userId: "u1",
      type: "games",
      isRead: false,
      createdAt: "2026-06-20T15:00:00.000Z",
    });
  });

  it("payload inválido (userId vazio) → lança (validação de schema)", async () => {
    const { db } = makeWriteDb();
    await expect(
      writeNotifications(db, [item({ userId: "" })], NOW),
    ).rejects.toThrow();
  });
});

describe("writeNotifications — itens recém-criados (TASK-07)", () => {
  it("determinístico inexistente → grava e retorna o item", async () => {
    const { db, sets } = makeWriteDb();
    const it1 = item({ id: "games-u1-m1" });
    const created = await writeNotifications(db, [it1], NOW);
    expect(sets.map((s) => s.id)).toEqual(["games-u1-m1"]);
    expect(created).toContain(it1); // mesma referência do item de entrada
    expect(created).toHaveLength(1);
  });

  it("determinístico já existente → NÃO grava e retorna []", async () => {
    const { db, sets, commits } = makeWriteDb(["games-u1-m1"]);
    const created = await writeNotifications(db, [item({ id: "games-u1-m1" })], NOW);
    expect(sets).toEqual([]);
    expect(commits).toEqual([]); // nada a gravar → sem commit
    expect(created).toEqual([]);
  });

  it("auto-id → sempre grava e retorna o item (sem getAll p/ auto-id)", async () => {
    const { db, sets, getAll } = makeWriteDb();
    const auto = item({ id: undefined, type: "system" });
    const created = await writeNotifications(db, [auto], NOW);
    expect(sets.map((s) => s.id)).toEqual(["auto-1"]);
    expect(getAll).not.toHaveBeenCalled(); // nenhum ref determinístico p/ checar
    expect(created).toContain(auto);
  });

  it("mix: novo determinístico + existente + auto-id → retorna [novo det, auto-id]", async () => {
    const { db, sets } = makeWriteDb(["games-u1-mEXISTING"]);
    const novo = item({ id: "games-u1-mNEW" });
    const existente = item({ id: "games-u1-mEXISTING" });
    const auto = item({ id: undefined, type: "system" });
    const created = await writeNotifications(db, [novo, existente, auto], NOW);

    // só o novo determinístico + o auto-id são gravados
    expect(sets.map((s) => s.id).sort()).toEqual(["auto-1", "games-u1-mNEW"]);
    expect(created).toContain(novo);
    expect(created).toContain(auto);
    expect(created).not.toContain(existente);
    expect(created).toHaveLength(2);
  });

  it("id vazio (\"\") → tratado como auto-id (sem getAll, sempre grava/retorna)", async () => {
    const { db, sets, getAll } = makeWriteDb();
    const vazio = item({ id: "" });
    const created = await writeNotifications(db, [vazio], NOW);
    expect(getAll).not.toHaveBeenCalled(); // "" não é ID determinístico
    expect(sets.map((s) => s.id)).toEqual(["auto-1"]); // gravado via coll.doc()
    expect(created).toContain(vazio);
  });

  it("dedup intra-chamada: dois itens mesmo id → 1 doc, 1 no retorno", async () => {
    const { db, sets } = makeWriteDb();
    const a = item({ id: "games-u1-m1" });
    const b = item({ id: "games-u1-m1" });
    const created = await writeNotifications(db, [a, b], NOW);
    expect(sets.map((s) => s.id)).toEqual(["games-u1-m1"]); // grava 1x só
    expect(created).toHaveLength(1);
  });
});

describe("writeNotifications — chunking ≤500", () => {
  it("1200 novos determinísticos → getAll e commits chunked [500,500,200]", async () => {
    const { db, commits, getAllChunks } = makeWriteDb();
    const items = Array.from({ length: 1200 }, (_, i) =>
      item({ id: `games-u1-m${i}` }),
    );
    const created = await writeNotifications(db, items, NOW);
    expect(getAllChunks).toEqual([500, 500, 200]);
    expect(commits).toEqual([500, 500, 200]);
    expect(created).toHaveLength(1200);
  });
});

describe("writeNotifications — regressão in-app PRD-15 (re-run idempotente)", () => {
  it("re-run com mesmo id: 1ª entrega in-app, 2ª não regrava nem lança", async () => {
    const { db, sets } = makeWriteDb();
    const first = await writeNotifications(db, [item({ id: "games-u1-m1" })], NOW);
    expect(sets).toHaveLength(1); // gravou na 1ª
    expect(first).toHaveLength(1); // entregue/criado na 1ª

    const second = await writeNotifications(db, [item({ id: "games-u1-m1" })], NOW);
    expect(sets).toHaveLength(1); // 2ª NÃO regrava (idempotente in-app)
    expect(second).toEqual([]); // 2ª não cria → não pusha
  });
});
