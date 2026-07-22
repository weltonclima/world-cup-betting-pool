/**
 * TASK-11 — helpers puros de escopo por campeonato.
 *
 * `deriveChampionshipId`: mapeia um matchId (namespaced ou legado) ao seu
 * campeonato — fonte da elegibilidade de pontuação por campeonato.
 * `championshipScope`: gera o doc-scope de ranking por campeonato, espelhando a
 * invariante de `namespacedMatchId` (legado = identidade/bare; novo = prefixado).
 */

import { describe, expect, it } from "vitest";

import { getChampionship } from "@/server/copaData/championshipCatalog";
import {
  championshipScope,
  deriveChampionshipId,
  resolveChampionshipDocScope,
} from "@/server/rankings/championshipScope";

const fifaWorld = getChampionship("fifa.world")!;
const bra1 = getChampionship("bra.1-2026")!;
const america = getChampionship("conmebol.america-2026")!;

describe("deriveChampionshipId", () => {
  it("id legado (sem prefixo) → fifa.world (default/compat)", () => {
    expect(deriveChampionshipId("m73")).toBe("fifa.world");
  });

  it("id legado no formato de data → fifa.world", () => {
    expect(deriveChampionshipId("2026-06-14-brazil-croatia")).toBe("fifa.world");
  });

  it("id namespaced de liga → campeonato do prefixo", () => {
    expect(deriveChampionshipId("bra.1-2026:401")).toBe("bra.1-2026");
  });

  it("id namespaced de copa → campeonato do prefixo", () => {
    expect(deriveChampionshipId("uefa.champions-2026:99")).toBe("uefa.champions-2026");
  });
});

describe("championshipScope", () => {
  it("campeonato legado → dimensão BARE (identidade, compat Copa)", () => {
    expect(championshipScope(fifaWorld, "geral")).toBe("geral");
  });

  it("campeonato novo (liga) → dimensão prefixada com o id", () => {
    expect(championshipScope(bra1, "geral")).toBe("bra.1-2026-geral");
  });

  it("campeonato novo (copa) → dimensão prefixada com o id", () => {
    expect(championshipScope(america, "geral")).toBe("conmebol.america-2026-geral");
  });
});

// TASK-21 — resolução do param `?championship` para doc-scope de leitura.
describe("resolveChampionshipDocScope", () => {
  it("param ausente (null) → identidade BARE, não-escopado (compat Copa)", () => {
    const r = resolveChampionshipDocScope(null, "geral");
    expect(r).toEqual({ ok: true, docScope: "geral", isChampionshipScoped: false });
  });

  it("param vazio ('') → identidade BARE, não-escopado", () => {
    const r = resolveChampionshipDocScope("", "grupos");
    expect(r).toEqual({ ok: true, docScope: "grupos", isChampionshipScoped: false });
  });

  it("fifa.world (legado) → identidade BARE, não-escopado", () => {
    const r = resolveChampionshipDocScope("fifa.world", "geral");
    expect(r).toEqual({ ok: true, docScope: "geral", isChampionshipScoped: false });
  });

  it("id desconhecido → erro de validação", () => {
    const r = resolveChampionshipDocScope("nao.existe-9999", "geral");
    expect(r.ok).toBe(false);
  });

  it("liga + geral → doc-scope prefixado, escopado", () => {
    const r = resolveChampionshipDocScope("bra.1-2026", "geral");
    expect(r).toEqual({
      ok: true,
      docScope: "bra.1-2026-geral",
      isChampionshipScoped: true,
    });
  });

  it("liga + fase (grupos) → erro: liga só tem ranking geral", () => {
    const r = resolveChampionshipDocScope("bra.1-2026", "grupos");
    expect(r.ok).toBe(false);
  });

  it("cup não-legado + geral → doc-scope prefixado, escopado (doc pode não existir)", () => {
    const r = resolveChampionshipDocScope("conmebol.america-2026", "geral");
    expect(r).toEqual({
      ok: true,
      docScope: "conmebol.america-2026-geral",
      isChampionshipScoped: true,
    });
  });
});
