/**
 * TDD RED phase — TASK-02 (home-revamp)
 * Testes da derivação pura `deriveOpenMatches`.
 * A função NÃO existe ainda — todos os testes devem falhar no import.
 * Regras: ai/spec/task-home-revamp-02.md §6 + ui-spec (campo `isUrgent`).
 */
import { describe, expect, it } from "vitest";

import { deriveOpenMatches } from "@/features/home/lib/homeDashboardHelpers";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Referência temporal fixa — todos os testes injetam este `now`. */
const NOW = new Date("2026-06-15T12:00:00.000Z");

/** Desloca `NOW` em minutos e devolve ISO 8601. */
function isoFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString();
}

function makeItem(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: "match-1",
    kickoffAt: isoFromNow(120),
    stage: "grupos",
    round: 1,
    groupId: "group-a",
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    homeTeamId: "team-bra",
    awayTeamId: "team-srb",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "Sérvia", flagUrl: undefined },
    predictionStatus: "pendente",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R1 — Elegibilidade (só "pendente")
// ---------------------------------------------------------------------------

describe("deriveOpenMatches — elegibilidade", () => {
  it("inclui apenas jogos com predictionStatus 'pendente'", () => {
    const matches = [
      makeItem({ id: "m-pendente", predictionStatus: "pendente" }),
      makeItem({ id: "m-enviado", predictionStatus: "enviado" }),
      makeItem({ id: "m-bloqueado", predictionStatus: "bloqueado" }),
    ];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.matchId).toBe("m-pendente");
    expect(result.totalOpen).toBe(1);
  });

  it("retorna vazio quando nenhum jogo está pendente", () => {
    const matches = [
      makeItem({ id: "a", predictionStatus: "enviado" }),
      makeItem({ id: "b", predictionStatus: "bloqueado" }),
    ];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items).toEqual([]);
    expect(result.totalOpen).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R2 — Ordenação e limite
// ---------------------------------------------------------------------------

describe("deriveOpenMatches — ordenação e limite", () => {
  it("ordena por kickoffAt ascendente (mais próximo primeiro)", () => {
    const matches = [
      makeItem({ id: "tarde", kickoffAt: isoFromNow(180) }),
      makeItem({ id: "cedo", kickoffAt: isoFromNow(30) }),
      makeItem({ id: "meio", kickoffAt: isoFromNow(90) }),
    ];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items.map((i) => i.matchId)).toEqual(["cedo", "meio", "tarde"]);
  });

  it("respeita limit (padrão 3) e reporta totalOpen real", () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `m-${i}`, kickoffAt: isoFromNow(60 + i * 30) }),
    );

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items).toHaveLength(3);
    expect(result.totalOpen).toBe(5);
  });

  it("aplica limit customizado", () => {
    const matches = Array.from({ length: 4 }, (_, i) =>
      makeItem({ id: `m-${i}`, kickoffAt: isoFromNow(60 + i * 30) }),
    );

    const result = deriveOpenMatches(matches, NOW, 2);

    expect(result.items).toHaveLength(2);
    expect(result.totalOpen).toBe(4);
  });

  it("totalOpen igual a items.length quando abaixo do limit", () => {
    const matches = [makeItem({ id: "x" }), makeItem({ id: "y" })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.totalOpen).toBe(2);
    expect(result.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// R3 — Rótulo de deadline
// ---------------------------------------------------------------------------

describe("deriveOpenMatches — deadlineLabel", () => {
  it("usa só minutos quando faltam menos de 60min", () => {
    const matches = [makeItem({ kickoffAt: isoFromNow(45) })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.deadlineLabel).toBe("Fecha em 45m");
  });

  it("usa horas + minutos quando faltam 60min ou mais", () => {
    const matches = [makeItem({ kickoffAt: isoFromNow(90) })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.deadlineLabel).toBe("Fecha em 1h 30m");
  });

  it("60min exatos exibem '1h 0m'", () => {
    const matches = [makeItem({ kickoffAt: isoFromNow(60) })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.deadlineLabel).toBe("Fecha em 1h 0m");
  });
});

// ---------------------------------------------------------------------------
// Urgência (ui-spec carry: campo isUrgent)
// ---------------------------------------------------------------------------

describe("deriveOpenMatches — isUrgent", () => {
  it("marca isUrgent quando faltam menos de 60min", () => {
    const matches = [makeItem({ kickoffAt: isoFromNow(45) })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.isUrgent).toBe(true);
  });

  it("não marca isUrgent em 60min exatos ou mais", () => {
    const matches = [makeItem({ kickoffAt: isoFromNow(60) })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.isUrgent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R6 — CTA / predictHref
// ---------------------------------------------------------------------------

describe("deriveOpenMatches — predictHref", () => {
  it("aponta para a tela de palpite do jogo", () => {
    const matches = [makeItem({ id: "match-1" })];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.predictHref).toBe("/matches/match-1/predict");
  });

  it("preserva times resolvidos no resumo", () => {
    const matches = [
      makeItem({
        homeTeam: { name: "Portugal", flagUrl: "https://flag/pt.png" },
        awayTeam: { name: "Gana", flagUrl: undefined },
      }),
    ];

    const result = deriveOpenMatches(matches, NOW);

    expect(result.items[0]?.homeTeam).toEqual({
      name: "Portugal",
      flagUrl: "https://flag/pt.png",
    });
    expect(result.items[0]?.awayTeam.name).toBe("Gana");
  });
});
