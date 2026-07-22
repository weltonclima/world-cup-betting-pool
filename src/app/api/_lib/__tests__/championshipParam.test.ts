/**
 * Testes do helper de resolução de `?championship=` (TASK-06).
 *
 * Usa o catálogo REAL (`championshipCatalog`) — sem mock: é test-safe (não RSC).
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHAMPIONSHIP_ID,
  resolveChampionshipFromRequest,
  resolveChampionshipParam,
  UnknownChampionshipError,
} from "../championshipParam";

describe("resolveChampionshipParam", () => {
  it("default fifa.world quando o param está ausente", () => {
    expect(resolveChampionshipParam(new URLSearchParams()).id).toBe("fifa.world");
  });

  it("default quando o param está vazio", () => {
    expect(
      resolveChampionshipParam(new URLSearchParams("championship=")).id,
    ).toBe("fifa.world");
  });

  it("resolve um id válido do catálogo", () => {
    const c = resolveChampionshipParam(
      new URLSearchParams("championship=bra.1-2026"),
    );
    expect(c.id).toBe("bra.1-2026");
    expect(c.type).toBe("league");
  });

  it("faz trim de espaços no id", () => {
    expect(
      resolveChampionshipParam(
        new URLSearchParams("championship=%20bra.1-2026%20"),
      ).id,
    ).toBe("bra.1-2026");
  });

  it("lança UnknownChampionshipError para id fora do catálogo", () => {
    expect(() =>
      resolveChampionshipParam(new URLSearchParams("championship=nao.existe")),
    ).toThrow(UnknownChampionshipError);
  });
});

describe("resolveChampionshipFromRequest", () => {
  it("default quando o Request está ausente", () => {
    expect(resolveChampionshipFromRequest().id).toBe(DEFAULT_CHAMPIONSHIP_ID);
  });

  it("lê o campeonato do query string do Request", () => {
    expect(
      resolveChampionshipFromRequest(
        new Request("http://x/api/matches?championship=eng.1-2026"),
      ).id,
    ).toBe("eng.1-2026");
  });

  it("propaga UnknownChampionshipError para id inválido", () => {
    expect(() =>
      resolveChampionshipFromRequest(
        new Request("http://x/api/matches?championship=nao.existe"),
      ),
    ).toThrow(UnknownChampionshipError);
  });
});
