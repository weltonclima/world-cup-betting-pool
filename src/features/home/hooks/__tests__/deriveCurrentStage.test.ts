/**
 * TDD RED phase — TASK-04 (PRD-16)
 * Testes da derivação pura `deriveCurrentStage` + exaustividade de `STAGE_LABEL`.
 * Função/mapa ainda NÃO existem — testes falham no import.
 * Regras: ai/spec/task-ranking-eliminatorias-04.md §6/§9.
 */
import { describe, expect, it } from "vitest";

import { deriveCurrentStage } from "@/features/home/lib/homeDashboardHelpers";
import { STAGE_LABEL } from "@/features/matches/lib/stageLabels";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";
import type { Stage } from "@/types";

const NOW = new Date("2026-06-15T12:00:00.000Z");
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
    userPrediction: null,
    ...overrides,
  };
}

describe("deriveCurrentStage", () => {
  it("retorna a fase do próximo jogo não-finalizado (menor kickoff)", () => {
    const matches = [
      makeItem({ id: "a", stage: "quartas", kickoffAt: isoFromNow(300), status: "scheduled" }),
      makeItem({ id: "b", stage: "oitavas", kickoffAt: isoFromNow(60), status: "scheduled" }),
    ];
    expect(deriveCurrentStage(matches)).toBe("oitavas");
  });

  it("ignora jogos finalizados ao escolher a fase ativa", () => {
    const matches = [
      makeItem({ id: "fin", stage: "grupos", kickoffAt: isoFromNow(-100), status: "finished" }),
      makeItem({ id: "next", stage: "oitavas", kickoffAt: isoFromNow(30), status: "scheduled" }),
    ];
    expect(deriveCurrentStage(matches)).toBe("oitavas");
  });

  it("considera não-finalizados além de scheduled (ex.: live)", () => {
    const matches = [
      makeItem({ id: "live", stage: "semifinal", kickoffAt: isoFromNow(-10), status: "live" }),
    ];
    expect(deriveCurrentStage(matches)).toBe("semifinal");
  });

  it("todos finalizados → fase do jogo finalizado mais recente", () => {
    const matches = [
      makeItem({ id: "f1", stage: "semifinal", kickoffAt: isoFromNow(-200), status: "finished" }),
      makeItem({ id: "f2", stage: "final", kickoffAt: isoFromNow(-50), status: "finished" }),
    ];
    expect(deriveCurrentStage(matches)).toBe("final");
  });

  it("sem jogos → null", () => {
    expect(deriveCurrentStage([])).toBeNull();
  });

  it("ignora postponed/canceled ao escolher a fase ativa (jogo não vai acontecer)", () => {
    const matches = [
      makeItem({ id: "pp", stage: "quartas", kickoffAt: isoFromNow(30), status: "postponed" }),
      makeItem({ id: "cc", stage: "quartas", kickoffAt: isoFromNow(20), status: "canceled" }),
      makeItem({ id: "sched", stage: "oitavas", kickoffAt: isoFromNow(60), status: "scheduled" }),
    ];
    // O scheduled (oitavas) define a fase, não o postponed/canceled de quartas.
    expect(deriveCurrentStage(matches)).toBe("oitavas");
  });

  it("só postponed/canceled + finalizados → fase do finalizado mais recente", () => {
    const matches = [
      makeItem({ id: "f", stage: "semifinal", kickoffAt: isoFromNow(-100), status: "finished" }),
      makeItem({ id: "pp", stage: "final", kickoffAt: isoFromNow(40), status: "postponed" }),
    ];
    expect(deriveCurrentStage(matches)).toBe("semifinal");
  });

  it("kickoffAt inválido não sequestra a seleção do próximo jogo", () => {
    const matches = [
      makeItem({ id: "bad", stage: "final", kickoffAt: "not-a-date", status: "scheduled" }),
      makeItem({ id: "ok", stage: "oitavas", kickoffAt: isoFromNow(45), status: "scheduled" }),
    ];
    // O jogo com data válida (oitavas) vence; o inválido vai p/ o fim da ordenação.
    expect(deriveCurrentStage(matches)).toBe("oitavas");
  });
});

describe("STAGE_LABEL", () => {
  it("cobre todos os slugs de stageSchema com rótulo pt-BR não-vazio", () => {
    const slugs: Stage[] = [
      "grupos",
      "dezesseis-avos",
      "oitavas",
      "quartas",
      "semifinal",
      "terceiro",
      "final",
    ];
    for (const slug of slugs) {
      expect(STAGE_LABEL[slug]).toBeTruthy();
      expect(typeof STAGE_LABEL[slug]).toBe("string");
    }
  });
});
