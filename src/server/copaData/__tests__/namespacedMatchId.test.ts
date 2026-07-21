import { describe, expect, it } from "vitest";

import { getChampionship } from "../championshipCatalog";
import { namespacedMatchId, parseMatchId } from "../namespacedMatchId";
import { EXPECTED_GROUP_IDS, EXPECTED_KO_IDS } from "./fixtures/espnParitySnapshot";

const fifaWorld = getChampionship("fifa.world")!;
const bra = getChampionship("bra.1-2026")!;

describe("namespacedMatchId › legado (Copa)", () => {
  it("é identidade para id de mata-mata legado", () => {
    expect(namespacedMatchId(fifaWorld, "m73")).toBe("m73");
    expect(namespacedMatchId(fifaWorld, "m104")).toBe("m104");
  });

  it("é identidade para id de grupo legado", () => {
    expect(namespacedMatchId(fifaWorld, "2026-06-14-brazil-croatia")).toBe(
      "2026-06-14-brazil-croatia",
    );
  });

  it("aceita championship mínimo com legacyMatchId true", () => {
    expect(
      namespacedMatchId({ id: "fifa.world", legacyMatchId: true }, "m1"),
    ).toBe("m1");
  });
});

describe("namespacedMatchId › campeonatos novos", () => {
  it("prefixa com {championshipId}:{base}", () => {
    expect(namespacedMatchId(bra, "m5")).toBe("bra.1-2026:m5");
    expect(namespacedMatchId(bra, "2026-04-10-a-b")).toBe(
      "bra.1-2026:2026-04-10-a-b",
    );
  });

  it("trata legacyMatchId ausente como novo (prefixa)", () => {
    expect(namespacedMatchId({ id: "eng.1-2026" }, "m9")).toBe(
      "eng.1-2026:m9",
    );
  });

  it("trata legacyMatchId false como novo (prefixa)", () => {
    expect(
      namespacedMatchId({ id: "esp.1-2026", legacyMatchId: false }, "m9"),
    ).toBe("esp.1-2026:m9");
  });
});

describe("namespacedMatchId › base inválido", () => {
  it("lança para base vazio", () => {
    expect(() => namespacedMatchId(bra, "")).toThrow();
    expect(() => namespacedMatchId(fifaWorld, "")).toThrow();
  });

  it("lança para championship.id vazio", () => {
    expect(() => namespacedMatchId({ id: "" }, "m5")).toThrow();
  });

  it("lança se base contém o separador ':' (guarda de colisão)", () => {
    expect(() => namespacedMatchId(bra, "a:b")).toThrow(/':'/);
  });

  it("lança se championship.id contém o separador ':' (guarda de colisão)", () => {
    expect(() => namespacedMatchId({ id: "bad:id" }, "m5")).toThrow(/':'/);
  });
});

describe("parseMatchId", () => {
  it("decompõe id namespaced no primeiro ':'", () => {
    expect(parseMatchId("bra.1-2026:m5")).toEqual({
      championshipId: "bra.1-2026",
      base: "m5",
    });
  });

  it("preserva '.' e '-' no championshipId e '-' no base", () => {
    expect(parseMatchId("conmebol.libertadores-2026:2026-04-10-flamengo-boca")).toEqual({
      championshipId: "conmebol.libertadores-2026",
      base: "2026-04-10-flamengo-boca",
    });
  });

  it("id legado (sem ':') → championshipId null", () => {
    expect(parseMatchId("m73")).toEqual({ championshipId: null, base: "m73" });
    expect(parseMatchId("2026-06-14-brazil-croatia")).toEqual({
      championshipId: null,
      base: "2026-06-14-brazil-croatia",
    });
  });

  it("split é no PRIMEIRO ':' (base residual mantém ':' extra)", () => {
    expect(parseMatchId("x-2026:a:b")).toEqual({
      championshipId: "x-2026",
      base: "a:b",
    });
  });
});

describe("round-trip", () => {
  it("novo: parse(namespaced(c, base)) recupera championshipId e base", () => {
    const base = "2026-04-10-a-b";
    expect(parseMatchId(namespacedMatchId(bra, base))).toEqual({
      championshipId: bra.id,
      base,
    });
  });

  it("legado: parse(namespaced(legacy, base)) tem championshipId null", () => {
    const base = "m73";
    expect(parseMatchId(namespacedMatchId(fifaWorld, base))).toEqual({
      championshipId: null,
      base,
    });
  });
});

describe("unicidade entre campeonatos", () => {
  it("mesmo base em campeonatos diferentes gera ids distintos", () => {
    const a = namespacedMatchId({ id: "bra.1-2026" }, "m5");
    const b = namespacedMatchId({ id: "eng.1-2026" }, "m5");
    expect(a).not.toBe(b);
  });

  it("base novo nunca colide com id legado da Copa (sempre tem prefixo)", () => {
    // um id de grupo idêntico ao da Copa, mas de outro campeonato, é distinto
    const copaId = "2026-06-14-brazil-croatia";
    expect(namespacedMatchId({ id: "usa.1-2026" }, copaId)).not.toBe(copaId);
    expect(parseMatchId(namespacedMatchId({ id: "usa.1-2026" }, copaId)).championshipId)
      .toBe("usa.1-2026");
  });
});

describe("não-idempotência (contrato p/ callers da TASK-04)", () => {
  it("aplicar sobre um id já namespaced LANÇA (base já contém ':')", () => {
    const once = namespacedMatchId(bra, "m5"); // "bra.1-2026:m5"
    // A guarda de colisão transforma dupla-aplicação em falha ruidosa em vez de
    // duplicar o prefixo silenciosamente — caller da TASK-04 deve passar base cru.
    expect(() => namespacedMatchId(bra, once)).toThrow(/':'/);
  });
});

describe("paridade Copa: zero regressão de matchId", () => {
  it("namespacedMatchId(fifa.world, id) é identidade para todos os ids de grupo", () => {
    for (const id of EXPECTED_GROUP_IDS) {
      expect(namespacedMatchId(fifaWorld, id)).toBe(id);
    }
  });

  it("namespacedMatchId(fifa.world, id) é identidade para todos os ids de mata-mata", () => {
    for (const id of EXPECTED_KO_IDS) {
      expect(namespacedMatchId(fifaWorld, id)).toBe(id);
    }
  });
});
