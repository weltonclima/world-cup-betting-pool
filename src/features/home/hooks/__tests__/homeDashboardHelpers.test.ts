/**
 * TDD RED phase — TASK-05
 * Testes das 8 funções puras de homeDashboardHelpers.
 * Arquivo de implementação NÃO existe ainda — todos os testes devem falhar no import.
 */
import { describe, expect, it } from "vitest";

import type { Match } from "@/types";
import type { Prediction } from "@/types";
import type { Ranking } from "@/types";
import type { Statistics } from "@/types";
import type { SystemSettings } from "@/types";
import type { Team } from "@/types";

// Tipos auxiliares que serão definidos junto com a implementação
type MatchWithId = Match & { id: string };
type TeamWithId = Team & { id: string };

import {
  buildTeamMap,
  computeIsCorrect,
  deriveCurrentStage,
  deriveNotices,
  derivePerformanceSummary,
  derivePredictionStatus,
  deriveRankingSummary,
  resolveTeam,
} from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Helpers de fixture
// ---------------------------------------------------------------------------

function makeFinishedMatch(
  overrides: Partial<MatchWithId> = {},
): MatchWithId {
  return {
    id: "match-01",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-15T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    groupId: "group-a",
    venue: null,
    ...overrides,
  };
}

function makeScheduledMatch(
  overrides: Partial<MatchWithId> = {},
): MatchWithId {
  return {
    id: "match-02",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 2,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    groupId: "group-a",
    venue: null,
    ...overrides,
  };
}

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    uid: "user-01",
    matchId: "match-01",
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

function makeTeam(id: string, overrides: Partial<TeamWithId> = {}): TeamWithId {
  return {
    id,
    name: `Seleção ${id}`,
    code: "BRA",
    flagUrl: `https://flags.example.com/${id}.png`,
    ...overrides,
  };
}

function makeRanking(
  entries: Ranking["entries"] = [],
): Ranking {
  return {
    scope: "geral",
    updatedAt: "2026-06-15T00:00:00.000Z",
    entries,
  };
}

function makeStatistics(
  overrides: Partial<Statistics> = {},
): Statistics {
  return {
    uid: "user-01",
    totalCorrect: 5,
    accuracy: 62.5,
    longestStreak: 3,
    correctByStage: { grupos: 5 },
    positionHistory: [],
    ...overrides,
  };
}

function makeSettings(
  overrides: Partial<SystemSettings> = {},
): SystemSettings {
  return {
    registrationOpen: true,
    predictionsLocked: false,
    currentStage: "grupos",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. buildTeamMap
// ---------------------------------------------------------------------------

describe("buildTeamMap", () => {
  it("retorna Map vazio para array vazio", () => {
    const result = buildTeamMap([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("mapeia 3 times corretamente pelo id", () => {
    const teams = [
      makeTeam("team-bra"),
      makeTeam("team-arg"),
      makeTeam("team-fra"),
    ];
    const result = buildTeamMap(teams);
    expect(result.size).toBe(3);
    expect(result.get("team-bra")).toEqual(teams[0]);
    expect(result.get("team-arg")).toEqual(teams[1]);
    expect(result.get("team-fra")).toEqual(teams[2]);
  });

  it("ids únicos — sem colisão, cada id aponta para seu time", () => {
    const teams = [makeTeam("t1"), makeTeam("t2")];
    const map = buildTeamMap(teams);
    expect(map.get("t1")?.id).toBe("t1");
    expect(map.get("t2")?.id).toBe("t2");
  });
});

// ---------------------------------------------------------------------------
// 2. resolveTeam
// ---------------------------------------------------------------------------

describe("resolveTeam", () => {
  it("retorna name e flagUrl quando id está no map", () => {
    const team = makeTeam("team-bra");
    const map = new Map([["team-bra", team]]);
    const result = resolveTeam("team-bra", map);
    expect(result.name).toBe(`Seleção team-bra`);
    expect(result.flagUrl).toBe(`https://flags.example.com/team-bra.png`);
  });

  it("fallback: retorna { name: teamId, flagUrl: undefined } quando id ausente", () => {
    const map = new Map<string, TeamWithId>();
    const result = resolveTeam("team-ger", map);
    expect(result.name).toBe("team-ger");
    expect(result.flagUrl).toBeUndefined();
  });

  it("flagUrl undefined (campo opcional no schema) é passado corretamente", () => {
    const team: TeamWithId = {
      id: "team-x",
      name: "Seleção X",
      code: "SEX",
      flagUrl: undefined,
    };
    const map = new Map([["team-x", team]]);
    const result = resolveTeam("team-x", map);
    expect(result.name).toBe("Seleção X");
    expect(result.flagUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. computeIsCorrect
// ---------------------------------------------------------------------------

describe("computeIsCorrect", () => {
  it("placar exato → true", () => {
    const match = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    const pred = makePrediction({ homeScore: 2, awayScore: 1 });
    expect(computeIsCorrect(match, pred)).toBe(true);
  });

  it("homeScore diferente → false", () => {
    const match = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    const pred = makePrediction({ homeScore: 3, awayScore: 1 });
    expect(computeIsCorrect(match, pred)).toBe(false);
  });

  it("awayScore diferente → false", () => {
    const match = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    const pred = makePrediction({ homeScore: 2, awayScore: 2 });
    expect(computeIsCorrect(match, pred)).toBe(false);
  });

  it("sem palpite (null) → false", () => {
    const match = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    expect(computeIsCorrect(match, null)).toBe(false);
  });

  it("sem palpite (undefined) → false", () => {
    const match = makeFinishedMatch({ homeScore: 2, awayScore: 1 });
    expect(computeIsCorrect(match, undefined)).toBe(false);
  });

  it("placar 0-0 exato → true", () => {
    const match = makeFinishedMatch({ homeScore: 0, awayScore: 0 });
    const pred = makePrediction({ homeScore: 0, awayScore: 0 });
    expect(computeIsCorrect(match, pred)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. derivePredictionStatus
// ---------------------------------------------------------------------------

describe("derivePredictionStatus", () => {
  const matchId = "match-01";

  it("predictionsLocked: true → 'bloqueado' (sem palpite)", () => {
    expect(derivePredictionStatus(matchId, [], true)).toBe("bloqueado");
  });

  it("predictionsLocked: true com palpite existente → 'bloqueado' (bloqueado prevalece)", () => {
    const pred = makePrediction({ matchId });
    expect(derivePredictionStatus(matchId, [pred], true)).toBe("bloqueado");
  });

  it("palpite existe + não bloqueado → 'enviado'", () => {
    const pred = makePrediction({ matchId });
    expect(derivePredictionStatus(matchId, [pred], false)).toBe("enviado");
  });

  it("sem palpite + não bloqueado → 'pendente'", () => {
    expect(derivePredictionStatus(matchId, [], false)).toBe("pendente");
  });

  it("palpite para outro match + não bloqueado → 'pendente'", () => {
    const pred = makePrediction({ matchId: "match-99" });
    expect(derivePredictionStatus(matchId, [pred], false)).toBe("pendente");
  });
});

// ---------------------------------------------------------------------------
// 5. deriveRankingSummary
// ---------------------------------------------------------------------------

describe("deriveRankingSummary", () => {
  it("uid presente nas entries → retorna { position, totalParticipants, points }", () => {
    const ranking = makeRanking([
      { uid: "user-01", nickname: "user1", position: 1, points: 10 },
      { uid: "user-02", nickname: "user2", position: 2, points: 8 },
    ]);
    const result = deriveRankingSummary(ranking, "user-01");
    expect(result).toEqual({
      position: 1,
      totalParticipants: 2,
      points: 10,
    });
  });

  it("uid não está nas entries → null", () => {
    const ranking = makeRanking([
      { uid: "user-02", nickname: "user2", position: 1, points: 10 },
    ]);
    expect(deriveRankingSummary(ranking, "user-01")).toBeNull();
  });

  it("ranking null → null", () => {
    expect(deriveRankingSummary(null, "user-01")).toBeNull();
  });

  it("ranking undefined → null", () => {
    expect(deriveRankingSummary(undefined, "user-01")).toBeNull();
  });

  it("entries vazias → null (uid não pode estar em lista vazia)", () => {
    const ranking = makeRanking([]);
    expect(deriveRankingSummary(ranking, "user-01")).toBeNull();
  });

  it("totalParticipants reflete entries.length (A1)", () => {
    const ranking = makeRanking([
      { uid: "u1", nickname: "n1", position: 1, points: 5 },
      { uid: "u2", nickname: "n2", position: 2, points: 4 },
      { uid: "u3", nickname: "n3", position: 3, points: 3 },
    ]);
    const result = deriveRankingSummary(ranking, "u2");
    expect(result?.totalParticipants).toBe(3);
    expect(result?.position).toBe(2);
    expect(result?.points).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 6. derivePerformanceSummary
// ---------------------------------------------------------------------------

describe("derivePerformanceSummary", () => {
  it("statistics com dados → retorna totalCorrect, accuracy e longestStreak corretos", () => {
    const stats = makeStatistics({ totalCorrect: 7, accuracy: 70, longestStreak: 3 });
    const result = derivePerformanceSummary(stats);
    expect(result.totalCorrect).toBe(7);
    expect(result.accuracy).toBe(70);
    expect(result.longestStreak).toBe(3);
  });

  it("gamesPredicted derivado de totalCorrect / (accuracy / 100) (D1)", () => {
    // 7 acertos com 70% de aproveitamento → 10 palpites
    const stats = makeStatistics({ totalCorrect: 7, accuracy: 70 });
    const result = derivePerformanceSummary(stats);
    expect(result.gamesPredicted).toBe(10);
  });

  it("gamesPredicted = 0 quando accuracy é 0 (evita divisão por zero)", () => {
    const stats = makeStatistics({ totalCorrect: 0, accuracy: 0 });
    const result = derivePerformanceSummary(stats);
    expect(result.gamesPredicted).toBe(0);
  });

  it("statistics null → zeros", () => {
    const result = derivePerformanceSummary(null);
    expect(result.totalCorrect).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.gamesPredicted).toBe(0);
  });

  it("statistics undefined → zeros", () => {
    const result = derivePerformanceSummary(undefined);
    expect(result.totalCorrect).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.gamesPredicted).toBe(0);
  });

  it("longestStreak reflete statistics.longestStreak", () => {
    const stats = makeStatistics({ longestStreak: 5 });
    const result = derivePerformanceSummary(stats);
    expect(result.longestStreak).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 7. deriveCurrentStage
// ---------------------------------------------------------------------------

describe("deriveCurrentStage", () => {
  it("stage presente + round presente → label 'Rodada X de Y'", () => {
    const settings = makeSettings({ currentStage: "grupos" });
    const nextMatch = makeScheduledMatch({ round: 1 });
    const result = deriveCurrentStage(settings, nextMatch, []);
    expect(result.stage).toBe("grupos");
    expect(result.roundLabel).toBe("Rodada 1 de 3");
  });

  it("stage 'grupos' + round 2 → 'Rodada 2 de 3'", () => {
    const settings = makeSettings({ currentStage: "grupos" });
    const nextMatch = makeScheduledMatch({ round: 2 });
    const result = deriveCurrentStage(settings, nextMatch, []);
    expect(result.roundLabel).toBe("Rodada 2 de 3");
  });

  it("stage 'final' + round null → roundLabel null", () => {
    const settings = makeSettings({ currentStage: "final" });
    const nextMatch = makeScheduledMatch({ round: null, stage: "final" });
    const result = deriveCurrentStage(settings, nextMatch, []);
    expect(result.stage).toBe("final");
    expect(result.roundLabel).toBeNull();
  });

  it("stage presente + round null → roundLabel null", () => {
    const settings = makeSettings({ currentStage: "oitavas" });
    const nextMatch = makeScheduledMatch({ round: null });
    const result = deriveCurrentStage(settings, nextMatch, []);
    expect(result.roundLabel).toBeNull();
  });

  it("settings null → { stage: null, roundLabel: null }", () => {
    const result = deriveCurrentStage(null, null, []);
    expect(result.stage).toBeNull();
    expect(result.roundLabel).toBeNull();
  });

  it("settings undefined → { stage: null, roundLabel: null }", () => {
    const result = deriveCurrentStage(undefined, null, []);
    expect(result.stage).toBeNull();
    expect(result.roundLabel).toBeNull();
  });

  it("sem nextMatch → usa recentResults[0].round para roundLabel", () => {
    const settings = makeSettings({ currentStage: "grupos" });
    const recentMatch = makeFinishedMatch({ round: 3 });
    const result = deriveCurrentStage(settings, null, [recentMatch]);
    expect(result.roundLabel).toBe("Rodada 3 de 3");
  });

  it("sem nextMatch e sem recentResults → roundLabel null", () => {
    const settings = makeSettings({ currentStage: "grupos" });
    const result = deriveCurrentStage(settings, null, []);
    expect(result.roundLabel).toBeNull();
  });

  it("oitavas: sempre 1 rodada", () => {
    const settings = makeSettings({ currentStage: "oitavas" });
    const nextMatch = makeScheduledMatch({ round: 1, stage: "oitavas" });
    const result = deriveCurrentStage(settings, nextMatch, []);
    expect(result.roundLabel).toBe("Rodada 1 de 1");
  });
});

// ---------------------------------------------------------------------------
// 8. deriveNotices
// ---------------------------------------------------------------------------

describe("deriveNotices", () => {
  const now = new Date("2026-06-15T17:00:00.000Z");

  it("settings null → array vazio", () => {
    const result = deriveNotices(null, null, now);
    expect(result).toEqual([]);
  });

  it("settings undefined → array vazio", () => {
    const result = deriveNotices(undefined, null, now);
    expect(result).toEqual([]);
  });

  it("predictionsLocked: true → aviso 'Palpites encerrados para esta fase.'", () => {
    const settings = makeSettings({ predictionsLocked: true });
    const result = deriveNotices(settings, null, now);
    expect(result).toContainEqual({
      id: "predictions-locked",
      message: "Palpites encerrados para esta fase.",
      severity: "warning",
    });
  });

  it("predictionsLocked: false → sem aviso de palpites", () => {
    const settings = makeSettings({ predictionsLocked: false });
    const result = deriveNotices(settings, null, now);
    const locked = result.find((n) => n.id === "predictions-locked");
    expect(locked).toBeUndefined();
  });

  it("kickoff em 1h (< 3h) → aviso de prazo 'Prazo encerra em 1h 0min.'", () => {
    const nextMatch = makeScheduledMatch({
      kickoffAt: "2026-06-15T18:00:00.000Z", // 1h após now
    });
    const settings = makeSettings();
    const result = deriveNotices(settings, nextMatch, now);
    const notice = result.find((n) => n.id === "kickoff-soon");
    expect(notice).toBeDefined();
    expect(notice?.severity).toBe("warning");
    expect(notice?.message).toContain("1h");
  });

  it("kickoff em 4h (≥ 3h) → sem aviso de prazo", () => {
    const nextMatch = makeScheduledMatch({
      kickoffAt: "2026-06-15T21:00:00.000Z", // 4h após now
    });
    const settings = makeSettings();
    const result = deriveNotices(settings, nextMatch, now);
    const notice = result.find((n) => n.id === "kickoff-soon");
    expect(notice).toBeUndefined();
  });

  it("kickoff já passou (no passado) → sem aviso de prazo", () => {
    const nextMatch = makeScheduledMatch({
      kickoffAt: "2026-06-15T16:00:00.000Z", // 1h antes de now
    });
    const settings = makeSettings();
    const result = deriveNotices(settings, nextMatch, now);
    const notice = result.find((n) => n.id === "kickoff-soon");
    expect(notice).toBeUndefined();
  });

  it("registrationOpen: false → aviso 'Cadastros encerrados.' (info)", () => {
    const settings = makeSettings({ registrationOpen: false });
    const result = deriveNotices(settings, null, now);
    expect(result).toContainEqual({
      id: "registration-closed",
      message: "Cadastros encerrados.",
      severity: "info",
    });
  });

  it("registrationOpen: true → sem aviso de cadastros", () => {
    const settings = makeSettings({ registrationOpen: true });
    const result = deriveNotices(settings, null, now);
    const closed = result.find((n) => n.id === "registration-closed");
    expect(closed).toBeUndefined();
  });

  it("combinação de todas as flags ativas → 3 avisos", () => {
    const settings = makeSettings({
      predictionsLocked: true,
      registrationOpen: false,
    });
    const nextMatch = makeScheduledMatch({
      kickoffAt: "2026-06-15T18:00:00.000Z", // 1h após now
    });
    const result = deriveNotices(settings, nextMatch, now);
    expect(result).toHaveLength(3);
    const ids = result.map((n) => n.id);
    expect(ids).toContain("predictions-locked");
    expect(ids).toContain("kickoff-soon");
    expect(ids).toContain("registration-closed");
  });

  it("kickoff em exatamente 3h → sem aviso (limite exclusivo)", () => {
    const nextMatch = makeScheduledMatch({
      kickoffAt: "2026-06-15T20:00:00.000Z", // exactly 3h após now
    });
    const settings = makeSettings();
    const result = deriveNotices(settings, nextMatch, now);
    const notice = result.find((n) => n.id === "kickoff-soon");
    expect(notice).toBeUndefined();
  });

  it("nextMatch null + settings sem flags → array vazio", () => {
    const settings = makeSettings({
      predictionsLocked: false,
      registrationOpen: true,
    });
    const result = deriveNotices(settings, null, now);
    expect(result).toHaveLength(0);
  });

  it("kickoff em 30min → aviso contém '30min' sem horas", () => {
    const nextMatch = makeScheduledMatch({
      kickoffAt: "2026-06-15T17:30:00.000Z", // 30min após now
    });
    const settings = makeSettings();
    const result = deriveNotices(settings, nextMatch, now);
    const notice = result.find((n) => n.id === "kickoff-soon");
    expect(notice).toBeDefined();
    expect(notice?.message).toContain("30min");
  });
});
