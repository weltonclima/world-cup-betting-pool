import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { NotificationCreate } from "@/server/notifications/factory";
import { writeNotifications } from "@/server/notifications/write";

/** Fake Firestore Admin: captura sets + tamanho de cada commit (batch). */
function makeWriteDb() {
  const sets: { id: string; data: Record<string, unknown> }[] = [];
  const commits: number[] = [];
  let autoSeq = 0;

  const coll = {
    doc: vi.fn((id?: string) => ({ id: id ?? `auto-${++autoSeq}` })),
  };
  const batch = vi.fn(() => {
    let ops = 0;
    return {
      set: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
        sets.push({ id: ref.id, data });
        ops += 1;
      }),
      commit: vi.fn(async () => {
        commits.push(ops);
      }),
    };
  });
  const db = { collection: vi.fn(() => coll), batch };
  return { db: db as never, sets, commits, coll };
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

describe("writeNotifications", () => {
  it("lista vazia → nenhum commit", async () => {
    const { db, commits } = makeWriteDb();
    await writeNotifications(db, [], NOW);
    expect(commits).toEqual([]);
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

  it("id determinístico → coll.doc(id); sem id → coll.doc() (auto)", async () => {
    const { db, sets, coll } = makeWriteDb();
    await writeNotifications(
      db,
      [item({ id: "games-u1-m1" }), item({ id: undefined, type: "system" })],
      NOW,
    );
    expect(coll.doc).toHaveBeenCalledWith("games-u1-m1");
    expect(coll.doc).toHaveBeenCalledWith(); // auto-id
    expect(sets.map((s) => s.id)).toEqual(["games-u1-m1", "auto-1"]);
  });

  it("chunking em ≤500 por batch: 1200 itens → commits [500,500,200]", async () => {
    const { db, commits } = makeWriteDb();
    const items = Array.from({ length: 1200 }, (_, i) =>
      item({ id: `games-u1-m${i}` }),
    );
    await writeNotifications(db, items, NOW);
    expect(commits).toEqual([500, 500, 200]);
  });

  it("payload inválido (userId vazio) → lança (validação de schema)", async () => {
    const { db } = makeWriteDb();
    await expect(
      writeNotifications(db, [item({ userId: "" })], NOW),
    ).rejects.toThrow();
  });

  it("idempotência: dois itens com mesmo id → set no mesmo ref (não duplica)", async () => {
    const { db, sets, coll } = makeWriteDb();
    await writeNotifications(
      db,
      [item({ id: "games-u1-m1" }), item({ id: "games-u1-m1" })],
      NOW,
    );
    // Mesmo id resolve sempre para coll.doc("games-u1-m1") — re-run sobrescreve.
    expect(coll.doc).toHaveBeenCalledWith("games-u1-m1");
    expect(sets.map((s) => s.id)).toEqual(["games-u1-m1", "games-u1-m1"]);
  });
});
