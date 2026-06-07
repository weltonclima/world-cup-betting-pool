/**
 * TDD RED phase — TASK-01 (jogos)
 * Testes das funções puras de matchesHelpers.
 * Arquivo de implementação NÃO existe ainda — todos os testes devem falhar no import.
 */
import { describe, expect, it } from "vitest";

import type { Match, Prediction, Team } from "@/types";

// Tipos locais auxiliares (espelham os do implementation)
type MatchWithId = Match & { id: string };
type TeamWithId = Team & { id: string };

import {
  buildTeamMap,
  deriveGameStatusLabel,
  deriveMatchPredictionStatus,
  filterMatches,
  groupMatchesByDay,
  resolveTeam,
  searchMatchesByCountry,
} from "@/features/matches/lib/matchesHelpers";

// ---------------------------------------------------------------------------
// Helpers de fixture
// ---------------------------------------------------------------------------

function makeScheduledMatch(
  overrides: Partial<MatchWithId> = {},
): MatchWithId {
  return {
    id: "match-01",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    groupId: "group-a",
    venue: null,
    ...overrides,
  };
}

function makeFinishedMatch(
  overrides: Partial<MatchWithId> = {},
): MatchWithId {
  return {
    id: "match-02",
    homeTeamId: "team-fra",
    awayTeamId: "team-ger",
    kickoffAt: "2026-06-15T14:00:00.000Z",
    stage: "grupos",
    round: 1,
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    groupId: "group-b",
    venue: null,
    ...overrides,
  };
}

function makeTeam(id: string, name: string, overrides: Partial<TeamWithId> = {}): TeamWithId {
  return {
    id,
    name,
    code: id.slice(-3).toUpperCase().padEnd(3, "X"),
    flagUrl: `https://flags.example.com/${id}.png`,
    ...overrides,
  };
}

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    uid: "user-01",
    matchId: "match-01",
    homeScore: 1,
    awayScore: 0,
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
      makeTeam("team-bra", "Brasil"),
      makeTeam("team-arg", "Argentina"),
      makeTeam("team-fra", "França"),
    ];
    const result = buildTeamMap(teams);
    expect(result.size).toBe(3);
    expect(result.get("team-bra")).toEqual(teams[0]);
    expect(result.get("team-arg")).toEqual(teams[1]);
    expect(result.get("team-fra")).toEqual(teams[2]);
  });

  it("ids únicos — sem colisão, cada id aponta para seu time", () => {
    const t1 = makeTeam("t1", "Time 1");
    const t2 = makeTeam("t2", "Time 2");
    const map = buildTeamMap([t1, t2]);
    expect(map.get("t1")?.id).toBe("t1");
    expect(map.get("t2")?.id).toBe("t2");
  });
});

// ---------------------------------------------------------------------------
// 2. resolveTeam
// ---------------------------------------------------------------------------

describe("resolveTeam", () => {
  it("retorna name e flagUrl quando id está no map", () => {
    const team = makeTeam("team-bra", "Brasil");
    const map = new Map([["team-bra", team]]);
    const result = resolveTeam("team-bra", map);
    expect(result.name).toBe("Brasil");
    expect(result.flagUrl).toBe("https://flags.example.com/team-bra.png");
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
// 3. groupMatchesByDay
// ---------------------------------------------------------------------------

describe("groupMatchesByDay", () => {
  // now = 2026-06-20T10:00:00.000Z (um sábado qualquer)
  const now = new Date("2026-06-20T10:00:00.000Z");
  // tomorrow = 2026-06-21
  // day after tomorrow = 2026-06-22

  it("array vazio → retorna []", () => {
    const result = groupMatchesByDay([], now);
    expect(result).toEqual([]);
  });

  it("1 partida hoje → seção com label 'Hoje'", () => {
    const match = makeScheduledMatch({
      id: "m1",
      kickoffAt: "2026-06-20T18:00:00.000Z",
    });
    const result = groupMatchesByDay([match], now);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe("Hoje");
    expect(result[0]!.matches).toHaveLength(1);
    expect(result[0]!.date).toBe("2026-06-20");
  });

  it("1 partida amanhã → seção com label 'Amanhã'", () => {
    const match = makeScheduledMatch({
      id: "m1",
      kickoffAt: "2026-06-21T18:00:00.000Z",
    });
    const result = groupMatchesByDay([match], now);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe("Amanhã");
    expect(result[0]!.date).toBe("2026-06-21");
  });

  it("1 partida em data futura (> amanhã) → seção com data por extenso pt-BR", () => {
    const match = makeScheduledMatch({
      id: "m1",
      kickoffAt: "2026-06-22T18:00:00.000Z",
    });
    const result = groupMatchesByDay([match], now);
    expect(result).toHaveLength(1);
    // "22 de junho de 2026" — formato date-fns pt-BR
    expect(result[0]!.label).toBe("22 de junho de 2026");
    expect(result[0]!.date).toBe("2026-06-22");
  });

  it("múltiplas partidas no mesmo dia → 1 seção com todas", () => {
    const m1 = makeScheduledMatch({ id: "m1", kickoffAt: "2026-06-20T14:00:00.000Z" });
    const m2 = makeScheduledMatch({ id: "m2", kickoffAt: "2026-06-20T18:00:00.000Z" });
    const result = groupMatchesByDay([m1, m2], now);
    expect(result).toHaveLength(1);
    expect(result[0]!.matches).toHaveLength(2);
  });

  it("partidas de dias diferentes → seções separadas (ASC)", () => {
    const mHoje = makeScheduledMatch({ id: "m1", kickoffAt: "2026-06-20T14:00:00.000Z" });
    const mAmanha = makeScheduledMatch({ id: "m2", kickoffAt: "2026-06-21T14:00:00.000Z" });
    const mDepois = makeScheduledMatch({ id: "m3", kickoffAt: "2026-06-22T14:00:00.000Z" });
    const result = groupMatchesByDay([mDepois, mAmanha, mHoje], now);
    expect(result).toHaveLength(3);
    expect(result[0]!.label).toBe("Hoje");
    expect(result[1]!.label).toBe("Amanhã");
    expect(result[2]!.label).toBe("22 de junho de 2026");
  });

  it("ordenação por kickoffAt ASC dentro de cada seção", () => {
    const m1 = makeScheduledMatch({ id: "m1", kickoffAt: "2026-06-20T20:00:00.000Z" });
    const m2 = makeScheduledMatch({ id: "m2", kickoffAt: "2026-06-20T14:00:00.000Z" });
    const m3 = makeScheduledMatch({ id: "m3", kickoffAt: "2026-06-20T17:00:00.000Z" });
    const result = groupMatchesByDay([m1, m2, m3], now);
    expect(result[0]!.matches[0]!.id).toBe("m2");
    expect(result[0]!.matches[1]!.id).toBe("m3");
    expect(result[0]!.matches[2]!.id).toBe("m1");
  });

  it("ordenação de seções por data ASC (seções mais antigas primeiro)", () => {
    const mAmanha = makeScheduledMatch({ id: "m2", kickoffAt: "2026-06-21T14:00:00.000Z" });
    const mHoje = makeScheduledMatch({ id: "m1", kickoffAt: "2026-06-20T14:00:00.000Z" });
    const result = groupMatchesByDay([mAmanha, mHoje], now);
    expect(result[0]!.date).toBe("2026-06-20");
    expect(result[1]!.date).toBe("2026-06-21");
  });
});

// ---------------------------------------------------------------------------
// 4. filterMatches
// ---------------------------------------------------------------------------

describe("filterMatches", () => {
  const m1 = makeScheduledMatch({
    id: "m1",
    stage: "grupos",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
  });
  const m2 = makeScheduledMatch({
    id: "m2",
    stage: "oitavas",
    homeTeamId: "team-fra",
    awayTeamId: "team-ger",
  });
  const m3 = makeScheduledMatch({
    id: "m3",
    stage: "grupos",
    homeTeamId: "team-esp",
    awayTeamId: "team-bra",
  });

  it("sem filtros → retorna array completo", () => {
    const result = filterMatches([m1, m2, m3], {});
    expect(result).toHaveLength(3);
  });

  it("filtro stage='grupos' → apenas partidas dessa fase", () => {
    const result = filterMatches([m1, m2, m3], { stage: "grupos" });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m3"]));
  });

  it("filtro stage='oitavas' → apenas partidas das oitavas", () => {
    const result = filterMatches([m1, m2, m3], { stage: "oitavas" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("m2");
  });

  it("filtro teamId → partidas onde é mandante OU visitante", () => {
    const result = filterMatches([m1, m2, m3], { teamId: "team-bra" });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m3"]));
  });

  it("filtros combinados (stage + teamId) → AND lógico", () => {
    const result = filterMatches([m1, m2, m3], { stage: "grupos", teamId: "team-bra" });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m3"]));
  });

  it("filtro que não combina com nenhuma partida → []", () => {
    const result = filterMatches([m1, m2, m3], { stage: "final" });
    expect(result).toEqual([]);
  });

  it("não muta o array original", () => {
    const original = [m1, m2, m3];
    filterMatches(original, { stage: "grupos" });
    expect(original).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 5. searchMatchesByCountry
// ---------------------------------------------------------------------------

describe("searchMatchesByCountry", () => {
  const teamMap = new Map([
    ["team-bra", makeTeam("team-bra", "Brasil")],
    ["team-arg", makeTeam("team-arg", "Argentina")],
    ["team-fra", makeTeam("team-fra", "França")],
  ]);

  const m1 = makeScheduledMatch({
    id: "m1",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
  });
  const m2 = makeScheduledMatch({
    id: "m2",
    homeTeamId: "team-fra",
    awayTeamId: "team-bra",
  });
  const m3 = makeScheduledMatch({
    id: "m3",
    homeTeamId: "team-arg",
    awayTeamId: "team-fra",
  });

  it("query vazia → retorna array original sem filtrar", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "");
    expect(result).toHaveLength(3);
  });

  it("query apenas espaços (trim) → retorna array original", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "   ");
    expect(result).toHaveLength(3);
  });

  it("query combina com mandante → inclui partida", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "França");
    // m2 (França mandante) + m3 (França visitante)
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m2", "m3"]));
  });

  it("query combina com visitante → inclui partida", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "Argentina");
    // m1 (Argentina visitante) + m3 (Argentina mandante)
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m3"]));
  });

  it("query não combina com nenhum → []", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "Alemanha");
    expect(result).toEqual([]);
  });

  it("case-insensitive: 'brasil' combina 'Brasil'", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "brasil");
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m2"]));
  });

  it("case-insensitive: 'BRASIL' combina 'Brasil'", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "BRASIL");
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m2"]));
  });

  it("substring match: 'rasil' combina 'Brasil'", () => {
    const result = searchMatchesByCountry([m1, m2, m3], teamMap, "rasil");
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m2"]));
  });

  it("team ausente no map → usa teamId como nome (fallback), não lança", () => {
    const mapSemFra = new Map([
      ["team-bra", makeTeam("team-bra", "Brasil")],
      ["team-arg", makeTeam("team-arg", "Argentina")],
    ]);
    // m2 tem team-fra que não está no map — não deve lançar
    expect(() => searchMatchesByCountry([m1, m2, m3], mapSemFra, "Brasil")).not.toThrow();
    // Brasil aparece em m1 (home) e m2 (away)
    const result = searchMatchesByCountry([m1, m2, m3], mapSemFra, "Brasil");
    expect(result.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m2"]));
  });
});

// ---------------------------------------------------------------------------
// 6. deriveMatchPredictionStatus — casos de aresta obrigatórios
// ---------------------------------------------------------------------------

describe("deriveMatchPredictionStatus", () => {
  const kickoffAt = "2026-06-20T18:00:00.000Z";
  const kickoffMs = new Date(kickoffAt).getTime();

  // Helper para montar partida mínima
  function makeMatch(status: MatchWithId["status"] = "scheduled"): MatchWithId {
    return makeScheduledMatch({
      id: "match-01",
      kickoffAt,
      status,
      homeScore: status === "finished" ? 1 : null,
      awayScore: status === "finished" ? 0 : null,
    });
  }

  const predCorreto = makePrediction({ matchId: "match-01" });
  const predOutroMatch = makePrediction({ matchId: "match-99" });

  // --- globalLock ---
  it("globalLock === true + sem prediction → 'bloqueado'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 60_000); // 1 minuto antes
    expect(deriveMatchPredictionStatus(match, [], now, true)).toBe("bloqueado");
  });

  it("globalLock === true + com prediction → 'bloqueado' (lock prevalece)", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 60_000);
    expect(deriveMatchPredictionStatus(match, [predCorreto], now, true)).toBe("bloqueado");
  });

  // --- tempo ---
  it("now === kickoffAt (exatamente no horário) → 'bloqueado'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs); // exatamente no kickoff
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("bloqueado");
  });

  it("now 1ms antes do kickoff + scheduled + sem pred → 'pendente'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 1); // 1ms antes
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("pendente");
  });

  it("now 1ms antes do kickoff + scheduled + com pred → 'enviado'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 1);
    expect(deriveMatchPredictionStatus(match, [predCorreto], now)).toBe("enviado");
  });

  // --- status da partida ---
  it("status === 'live' + now < kickoffAt → 'bloqueado' (status não é scheduled)", () => {
    const match = makeScheduledMatch({
      id: "match-01",
      kickoffAt,
      status: "live",
      homeScore: 1,
      awayScore: 0,
    });
    const now = new Date(kickoffMs - 60_000);
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("bloqueado");
  });

  it("status === 'finished' → 'bloqueado'", () => {
    const match = makeMatch("finished");
    const now = new Date(kickoffMs - 60_000);
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("bloqueado");
  });

  it("status === 'postponed' → 'bloqueado'", () => {
    const match = makeMatch("postponed");
    const now = new Date(kickoffMs - 60_000);
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("bloqueado");
  });

  it("status === 'canceled' → 'bloqueado'", () => {
    const match = makeMatch("canceled");
    const now = new Date(kickoffMs - 60_000);
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("bloqueado");
  });

  // --- estado normal ---
  it("status === 'scheduled' + now < kickoffAt + sem pred → 'pendente'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 3_600_000); // 1h antes
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("pendente");
  });

  it("status === 'scheduled' + now < kickoffAt + com pred → 'enviado'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 3_600_000);
    expect(deriveMatchPredictionStatus(match, [predCorreto], now)).toBe("enviado");
  });

  it("prediction de outro matchId + scheduled + now < kickoffAt → 'pendente'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 3_600_000);
    expect(deriveMatchPredictionStatus(match, [predOutroMatch], now)).toBe("pendente");
  });

  it("globalLock omitido (default false) + scheduled + now < kickoffAt + sem pred → 'pendente'", () => {
    const match = makeMatch("scheduled");
    const now = new Date(kickoffMs - 3_600_000);
    // globalLock omitido — deve usar default false
    expect(deriveMatchPredictionStatus(match, [], now)).toBe("pendente");
  });
});

// ---------------------------------------------------------------------------
// 7. deriveGameStatusLabel
// ---------------------------------------------------------------------------

describe("deriveGameStatusLabel", () => {
  it("'scheduled' → 'Agendado'", () => {
    expect(deriveGameStatusLabel("scheduled")).toBe("Agendado");
  });

  it("'live' → 'Ao Vivo'", () => {
    expect(deriveGameStatusLabel("live")).toBe("Ao Vivo");
  });

  it("'finished' → 'Encerrado'", () => {
    expect(deriveGameStatusLabel("finished")).toBe("Encerrado");
  });

  it("'postponed' → 'Adiado'", () => {
    expect(deriveGameStatusLabel("postponed")).toBe("Adiado");
  });

  it("'canceled' → 'Cancelado'", () => {
    expect(deriveGameStatusLabel("canceled")).toBe("Cancelado");
  });
});
