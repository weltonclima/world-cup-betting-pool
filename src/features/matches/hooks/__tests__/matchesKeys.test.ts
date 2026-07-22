/**
 * Testes das chaves de query de partidas/times (multi-championship TASK-09).
 *
 * Regressão de colisão de cache: `list(id)` e `teams(id)` DEVEM produzir arrays
 * distintos por campeonato — sem isso, trocar o seletor mostraria os jogos/times
 * cacheados do campeonato anterior. Também garantimos a estabilidade da chave
 * default (`fifa.world`) para não regredir o comportamento legado.
 */

import { describe, expect, it } from "vitest";

import { matchesKeys } from "../matchesKeys";

describe("matchesKeys — segmentação por campeonato", () => {
  it("list(id) difere entre campeonatos", () => {
    const copa = matchesKeys.list("fifa.world");
    const brasil = matchesKeys.list("bra.1-2026");
    expect(copa).not.toEqual(brasil);
    expect(copa).toContain("fifa.world");
    expect(brasil).toContain("bra.1-2026");
  });

  it("teams(id) difere entre campeonatos", () => {
    const copa = matchesKeys.teams("fifa.world");
    const brasil = matchesKeys.teams("bra.1-2026");
    expect(copa).not.toEqual(brasil);
  });

  it("mesma id → mesma chave (estável para o observer do React Query)", () => {
    expect(matchesKeys.list("fifa.world")).toEqual(matchesKeys.list("fifa.world"));
    expect(matchesKeys.teams("fifa.world")).toEqual(matchesKeys.teams("fifa.world"));
  });

  it("list e teams vivem sob o namespace raiz de matches", () => {
    expect(matchesKeys.list("fifa.world")[0]).toBe("matches");
    expect(matchesKeys.teams("fifa.world")[0]).toBe("matches");
  });
});
