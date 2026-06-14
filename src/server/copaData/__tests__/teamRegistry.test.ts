/**
 * Testes TDD do registry de seleções (48 entradas).
 * REG-01..REG-08
 *
 * Importa diretamente de ../teamRegistry (não do barrel ../index),
 * pois o barrel inclui `import "server-only"` que lança fora de RSC (vitest).
 */

import { describe, it, expect, afterEach } from "vitest";
import { TEAM_REGISTRY, resolveTeam, resolveTeamByCode, ESPN_ALIASES } from "../teamRegistry";

// ─── Nomes exatos como aparecem no JSON openfootball (a confirmar no GREEN) ───
// Os nomes abaixo são os 48 esperados na Copa 2026 conforme spec §4.3.
// O implementador deve mapear cada um ao TeamEntry correspondente.

// Nomes exatos conforme o JSON ao vivo do openfootball (verificado em 2026-06-07):
// https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
const EXPECTED_48_NAMES = [
  // Grupo A
  "Mexico",
  "South Africa",
  "South Korea",
  "Czech Republic",
  // Grupo B
  "Canada",
  "Bosnia & Herzegovina",
  "Qatar",
  "Switzerland",
  // Grupo C
  "Brazil",
  "Morocco",
  "Haiti",
  "Scotland",
  // Grupo D
  "USA",
  "Paraguay",
  "Australia",
  "Turkey",
  // Grupo E
  "Germany",
  "Curaçao",
  "Ivory Coast",
  "Ecuador",
  // Grupo F
  "Netherlands",
  "Japan",
  "Sweden",
  "Tunisia",
  // Grupo G
  "Belgium",
  "Egypt",
  "Iran",
  "New Zealand",
  // Grupo H
  "Spain",
  "Cape Verde",
  "Saudi Arabia",
  "Uruguay",
  // Grupo I
  "France",
  "Senegal",
  "Iraq",
  "Norway",
  // Grupo J
  "Argentina",
  "Algeria",
  "Austria",
  "Jordan",
  // Grupo K
  "Portugal",
  "DR Congo",
  "Uzbekistan",
  "Colombia",
  // Grupo L
  "England",
  "Croatia",
  "Ghana",
  "Panama",
] as const;

describe("TEAM_REGISTRY", () => {
  it("REG-01: TEAM_REGISTRY tem exatamente 48 entradas", () => {
    expect(Object.keys(TEAM_REGISTRY)).toHaveLength(48);
  });

  it("REG-02: todos os code satisfazem regex ^[A-Z]{3}$", () => {
    const codeRegex = /^[A-Z]{3}$/;
    for (const [name, entry] of Object.entries(TEAM_REGISTRY)) {
      expect(entry.code, `code inválido para "${name}"`).toMatch(codeRegex);
    }
  });

  it("REG-03: todos os flagUrl são strings não vazias iniciando com https://", () => {
    for (const [name, entry] of Object.entries(TEAM_REGISTRY)) {
      expect(entry.flagUrl, `flagUrl inválida para "${name}"`).toBeTruthy();
      expect(entry.flagUrl, `flagUrl não é https:// para "${name}"`).toMatch(/^https:\/\//);
    }
  });

  it("REG-04: resolveTeam('Brazil') retorna id=BRA, code=BRA", () => {
    const entry = resolveTeam("Brazil");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("BRA");
    expect(entry?.code).toBe("BRA");
  });

  it("REG-05: resolveTeam('Mexico') retorna id=MEX, code=MEX", () => {
    const entry = resolveTeam("Mexico");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("MEX");
    expect(entry?.code).toBe("MEX");
  });

  it("REG-06: resolveTeam('Unknown Country') retorna undefined", () => {
    expect(resolveTeam("Unknown Country")).toBeUndefined();
  });

  it("REG-07: IDs no registry são únicos (sem duplicatas)", () => {
    const ids = Object.values(TEAM_REGISTRY).map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("REG-08: todos os id === code (invariante D-OF3)", () => {
    for (const [name, entry] of Object.entries(TEAM_REGISTRY)) {
      expect(entry.id, `id !== code para "${name}"`).toBe(entry.code);
    }
  });
});

describe("resolveTeam — lookup por nome openfootball", () => {
  it("todos os 48 nomes esperados resolvem para um TeamEntry (não undefined)", () => {
    for (const name of EXPECTED_48_NAMES) {
      const entry = resolveTeam(name);
      expect(entry, `resolveTeam("${name}") retornou undefined — nome não está no registry`).toBeDefined();
    }
  });

  it("todos os nomes do registry resolvem para si mesmos", () => {
    for (const [name] of Object.entries(TEAM_REGISTRY)) {
      const entry = resolveTeam(name);
      expect(entry, `resolveTeam("${name}") retornou undefined`).toBeDefined();
    }
  });
});

// ─── Índice reverso ESPN abbreviation → TeamEntry (TASK-01) ───
describe("resolveTeamByCode — lookup por ESPN abbreviation", () => {
  afterEach(() => {
    // limpa aliases injetados em testes para não vazar entre casos
    for (const k of Object.keys(ESPN_ALIASES)) {
      delete ESPN_ALIASES[k];
    }
  });

  it("RCB-01: resolveTeamByCode('BRA') retorna TeamEntry com id=BRA", () => {
    const entry = resolveTeamByCode("BRA");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("BRA");
  });

  it("RCB-02: resolveTeamByCode('USA') retorna TeamEntry com id=USA", () => {
    const entry = resolveTeamByCode("USA");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("USA");
  });

  it("RCB-03: resolveTeamByCode('RSA') retorna TeamEntry com id=RSA (code não-ISO)", () => {
    const entry = resolveTeamByCode("RSA");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("RSA");
  });

  it("RCB-04: resolveTeamByCode('SUI') retorna TeamEntry com id=SUI", () => {
    const entry = resolveTeamByCode("SUI");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("SUI");
  });

  it("RCB-05: resolveTeamByCode('GER') retorna TeamEntry com id=GER", () => {
    const entry = resolveTeamByCode("GER");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("GER");
  });

  it("RCB-06: resolveTeamByCode('1A') retorna undefined (placeholder mata-mata)", () => {
    expect(resolveTeamByCode("1A")).toBeUndefined();
  });

  it("RCB-07: resolveTeamByCode('RD16 W1') retorna undefined", () => {
    expect(resolveTeamByCode("RD16 W1")).toBeUndefined();
  });

  it("RCB-08: resolveTeamByCode('') retorna undefined", () => {
    expect(resolveTeamByCode("")).toBeUndefined();
  });

  it("RCB-09: todos os 48 codes do registry resolvem via resolveTeamByCode", () => {
    for (const [name, entry] of Object.entries(TEAM_REGISTRY)) {
      const resolved = resolveTeamByCode(entry.code);
      expect(resolved, `resolveTeamByCode("${entry.code}") (${name}) retornou undefined`).toBeDefined();
      expect(resolved?.id).toBe(entry.id);
    }
  });

  it("RCB-10: alias ESPN→code é aplicado antes do lookup", () => {
    Object.assign(ESPN_ALIASES, { US: "USA" });
    const entry = resolveTeamByCode("US");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("USA");
  });

  it("RCB-11: ESPN_ALIASES exportado nasce vazio (zero divergências — TASK-00)", () => {
    // afterEach limpa qualquer alias injetado; estado base deve ser vazio
    expect(Object.keys(ESPN_ALIASES)).toHaveLength(0);
  });

  it("RCB-12: outros placeholders de mata-mata (2L, 3RD, RD32, RD16 W8) → undefined", () => {
    for (const ph of ["2L", "3RD", "RD32", "RD16 W8"]) {
      expect(resolveTeamByCode(ph), `placeholder "${ph}" não deveria resolver`).toBeUndefined();
    }
  });

  it("RCB-13: displayName da ESPN NÃO resolve — só abbreviation (TASK-00)", () => {
    // ESPN emite displayName divergente (Czechia/United States/Congo DR);
    // o matcher deve usar abbreviation, nunca displayName.
    for (const dn of ["Czechia", "United States", "Congo DR", "Türkiye", "Brazil"]) {
      expect(resolveTeamByCode(dn), `displayName "${dn}" não deveria resolver via code`).toBeUndefined();
    }
  });
});
