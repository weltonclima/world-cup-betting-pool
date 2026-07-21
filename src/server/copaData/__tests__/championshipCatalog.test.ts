import { describe, expect, it } from "vitest";

import { championshipSchema } from "@/schemas/championships";
import {
  CHAMPIONSHIP_CATALOG,
  getChampionship,
  isCupType,
  listChampionships,
} from "@/server/copaData/championshipCatalog";

// Slugs ESPN aprovados no spike TASK-01 (matriz: 23/23 aprovados).
const APPROVED_ESPN_SLUGS = [
  "fifa.world",
  "conmebol.america",
  "uefa.euro",
  "uefa.nations",
  "fifa.cwc",
  "bra.1",
  "eng.1",
  "esp.1",
  "ita.1",
  "ger.1",
  "fra.1",
  "por.1",
  "ned.1",
  "mex.1",
  "usa.1",
  "ksa.1",
  "arg.1",
  "uefa.champions",
  "uefa.europa",
  "conmebol.libertadores",
  "conmebol.sudamericana",
  "bra.copa_do_brazil",
  "eng.fa",
];

describe("championshipCatalog › CHAMPIONSHIP_CATALOG", () => {
  it("tem 23 entradas", () => {
    expect(CHAMPIONSHIP_CATALOG).toHaveLength(23);
  });

  it("toda entrada passa championshipSchema", () => {
    for (const c of CHAMPIONSHIP_CATALOG) {
      const r = championshipSchema.safeParse(c);
      expect(r.success, `${c.id} inválido: ${JSON.stringify(r)}`).toBe(true);
    }
  });

  it("cobre exatamente os slugs ESPN aprovados no spike", () => {
    const slugs = CHAMPIONSHIP_CATALOG.map((c) => c.espnSlug).sort();
    expect(slugs).toEqual([...APPROVED_ESPN_SLUGS].sort());
  });

  it("ids são únicos", () => {
    const ids = CHAMPIONSHIP_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("espnSlugs são únicos (sem slug duplicado)", () => {
    const slugs = CHAMPIONSHIP_CATALOG.map((c) => c.espnSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("novos campeonatos usam id namespaced {slug}-{season}; só o legado é bare", () => {
    for (const c of CHAMPIONSHIP_CATALOG) {
      if (c.legacyMatchId) {
        expect(c.id).toBe(c.espnSlug);
      } else {
        expect(c.id).toBe(`${c.espnSlug}-${c.season}`);
      }
    }
  });

  it("fifa.world é legado: id bare + legacyMatchId + archived", () => {
    const wc = getChampionship("fifa.world");
    expect(wc).toBeDefined();
    expect(wc?.id).toBe("fifa.world");
    expect(wc?.espnSlug).toBe("fifa.world");
    expect(wc?.legacyMatchId).toBe(true);
    expect(wc?.status).toBe("archived");
  });

  it("só fifa.world carrega legacyMatchId=true", () => {
    const legacy = CHAMPIONSHIP_CATALOG.filter((c) => c.legacyMatchId === true);
    expect(legacy.map((c) => c.id)).toEqual(["fifa.world"]);
  });

  it("bra.1 e uefa.champions precisam de paginação (achado do spike)", () => {
    for (const c of CHAMPIONSHIP_CATALOG) {
      if (c.espnSlug === "bra.1" || c.espnSlug === "uefa.champions") {
        expect(c.needsPagination, `${c.id} deveria paginar`).toBe(true);
      }
    }
  });

  it("toda liga (type=league) precisa de paginação (regra segura)", () => {
    for (const c of CHAMPIONSHIP_CATALOG) {
      if (c.type === "league") {
        expect(c.needsPagination, `${c.id} liga sem paginação`).toBe(true);
      }
    }
  });
});

describe("championshipCatalog › helpers", () => {
  it("getChampionship retorna a entrada por id", () => {
    expect(getChampionship("bra.1-2026")?.espnSlug).toBe("bra.1");
  });

  it("getChampionship retorna undefined para id inexistente", () => {
    expect(getChampionship("nope")).toBeUndefined();
  });

  it("isCupType distingue cup de league", () => {
    const wc = getChampionship("fifa.world")!;
    expect(isCupType(wc)).toBe(true);
    const bra = getChampionship("bra.1-2026")!;
    expect(isCupType(bra)).toBe(false);
  });

  it("listChampionships retorna todo o catálogo", () => {
    expect(listChampionships()).toHaveLength(23);
  });
});
