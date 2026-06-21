import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { defaultPreferences } from "@/schemas/notificationPreferences";
import {
  fetchPreferencesMap,
  shouldDeliver,
  shouldDeliverPush,
} from "@/server/notifications/preferences";

/** Fake Firestore Admin: getAll resolve snapshots a partir de um mapa uid→data. */
function makePrefsDb(docsByUid: Record<string, unknown>) {
  const doc = vi.fn((uid: string) => ({ __uid: uid }));
  const getAll = vi.fn(
    async (...refs: { __uid: string }[]) =>
      refs.map((r) => {
        const data = docsByUid[r.__uid];
        return {
          exists: data !== undefined,
          id: r.__uid,
          data: () => data,
        };
      }),
  );
  const db = {
    collection: vi.fn(() => ({ doc })),
    getAll,
  };
  return { db: db as never, doc, getAll };
}

describe("fetchPreferencesMap", () => {
  it("doc presente → valores do usuário; ausente → default", async () => {
    const { db } = makePrefsDb({
      u1: { userId: "u1", system: false, games: true, ranking: false },
      // u2 ausente
    });

    const map = await fetchPreferencesMap(db, ["u1", "u2"]);

    expect(map.get("u1")).toMatchObject({ system: false, games: true, ranking: false });
    expect(map.get("u2")).toEqual(defaultPreferences("u2"));
  });

  it("deduplica uids repetidos (1 ref por uid único)", async () => {
    const { db, doc } = makePrefsDb({});

    await fetchPreferencesMap(db, ["u1", "u1", "u1"]);

    expect(doc).toHaveBeenCalledTimes(1);
  });

  it("doc legado inválido (campo extra) → cai no default, não quebra", async () => {
    const { db } = makePrefsDb({
      u1: { userId: "u1", system: true, games: true, ranking: true, pool: true },
    });

    const map = await fetchPreferencesMap(db, ["u1"]);

    expect(map.get("u1")).toEqual(defaultPreferences("u1"));
  });

  it("lista vazia → map vazio, sem getAll", async () => {
    const { db, getAll } = makePrefsDb({});

    const map = await fetchPreferencesMap(db, []);

    expect(map.size).toBe(0);
    expect(getAll).not.toHaveBeenCalled();
  });
});

describe("shouldDeliver", () => {
  const off = {
    userId: "u1",
    system: false,
    games: false,
    ranking: false,
    pushEnabled: false,
  };

  it("system sempre entrega (ignora system:false)", () => {
    expect(shouldDeliver("system", off)).toBe(true);
  });

  it("games respeita o toggle", () => {
    expect(shouldDeliver("games", off)).toBe(false);
    expect(shouldDeliver("games", { ...off, games: true })).toBe(true);
  });

  it("ranking respeita o toggle", () => {
    expect(shouldDeliver("ranking", off)).toBe(false);
    expect(shouldDeliver("ranking", { ...off, ranking: true })).toBe(true);
  });
});

describe("shouldDeliverPush — master switch + por-tipo (TASK-05)", () => {
  // Helper: prefs com pushEnabled (campo novo da TASK-05).
  function p(over: Record<string, unknown> = {}) {
    return {
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
      pushEnabled: true,
      ...over,
    } as never;
  }

  it("pushEnabled=false → não entrega NENHUM tipo (mesmo com toggles on)", () => {
    const off = p({ pushEnabled: false });
    expect(shouldDeliverPush("system", off)).toBe(false);
    expect(shouldDeliverPush("games", off)).toBe(false);
    expect(shouldDeliverPush("ranking", off)).toBe(false);
  });

  it("pushEnabled=true + system → entrega (master only, ignora toggle system)", () => {
    expect(
      shouldDeliverPush("system", p({ system: false, games: false, ranking: false })),
    ).toBe(true);
  });

  it("pushEnabled=true + games → respeita o toggle do tipo", () => {
    expect(shouldDeliverPush("games", p({ games: true }))).toBe(true);
    expect(shouldDeliverPush("games", p({ games: false }))).toBe(false);
  });

  it("pushEnabled=true + ranking → respeita o toggle do tipo", () => {
    expect(shouldDeliverPush("ranking", p({ ranking: true }))).toBe(true);
    expect(shouldDeliverPush("ranking", p({ ranking: false }))).toBe(false);
  });
});
