/**
 * TASK-13 — resolvedor de status dinâmico (RED / TDD).
 *
 * `getChampionshipStatus`/`loadChampionshipStatuses` sobrepõem o override do doc
 * `championships/{id}` (Firestore) ao `status` default do catálogo estático.
 * Produção ainda não existe → falha por módulo ausente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getChampionshipStatus,
  loadChampionshipStatuses,
} from "@/server/copaData/championshipState";
import {
  getChampionship,
  listChampionships,
} from "@/server/copaData/championshipCatalog";

/** Fake Firestore da coleção `championships` (docs de override). */
function makeDb(overrides: Record<string, { status: string }>) {
  const collection = (name: string) => {
    if (name !== "championships") throw new Error(`unexpected collection ${name}`);
    return {
      doc: (id: string) => ({
        get: async () => ({
          exists: id in overrides,
          data: () => overrides[id],
        }),
      }),
      get: async () => ({
        docs: Object.entries(overrides).map(([id, data]) => ({ id, data: () => data })),
      }),
    };
  };
  return { collection } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("getChampionshipStatus", () => {
  it("sem doc de override → default do catálogo", async () => {
    const db = makeDb({});
    const status = await getChampionshipStatus(db, "bra.1-2026");
    expect(status).toBe(getChampionship("bra.1-2026")?.status);
  });

  it("override archived vence o default estático", async () => {
    const db = makeDb({ "bra.1-2026": { status: "archived" } });
    expect(await getChampionshipStatus(db, "bra.1-2026")).toBe("archived");
  });

  it("id inválido → throw", async () => {
    const db = makeDb({});
    await expect(getChampionshipStatus(db, "nope.1-2026")).rejects.toThrow();
  });

  it("fifa.world sem doc → default estático archived (compat)", async () => {
    const db = makeDb({});
    expect(await getChampionshipStatus(db, "fifa.world")).toBe("archived");
  });
});

describe("loadChampionshipStatuses", () => {
  it("mapa cobre todo o catálogo, override aplicado por id", async () => {
    const db = makeDb({ "bra.1-2026": { status: "archived" } });
    const map = await loadChampionshipStatuses(db);

    expect(map.size).toBe(listChampionships().length);
    expect(map.get("bra.1-2026")).toBe("archived"); // override
    expect(map.get("fifa.world")).toBe("archived"); // default do catálogo
  });
});
