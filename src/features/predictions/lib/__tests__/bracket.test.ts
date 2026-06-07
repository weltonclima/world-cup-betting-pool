import { describe, expect, it } from "vitest";
import type { MatchWithId } from "@/types";
import type {
  AllGroupStandings,
  GroupStandingEntry,
} from "@/features/predictions/lib/standings";
import {
  isPlaceholderId,
  buildBracketFromFixtures,
  resolveSlotTeam,
  advanceBracket,
} from "@/features/predictions/lib/bracket";
import type { BracketMatchup, RoundWinner } from "@/features/predictions/lib/bracket";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cria MatchWithId de mata-mata com placeholders */
function makeKnockoutMatch(
  num: number,
  team1: string,
  team2: string,
  stage:
    | "dezesseis-avos"
    | "oitavas"
    | "quartas"
    | "semifinal"
    | "terceiro"
    | "final",
): MatchWithId {
  return {
    id: `m${num}`,
    homeTeamId: team1,
    awayTeamId: team2,
    kickoffAt: "2026-06-28T18:00:00+00:00",
    stage,
    round: null,
    groupId: null,
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  };
}

/** Cria GroupStandings mínima para um grupo de 4 times */
function makeGroupStandings(
  _groupId: string,
  teamIds: [string, string, string, string], // posições 1..4
): GroupStandingEntry[] {
  return teamIds.map((teamId, i) => ({
    teamId,
    played: 3,
    wins: 3 - i,
    draws: 0,
    losses: i,
    goalsFor: 6 - i * 2,
    goalsAgainst: i * 2,
    goalDifference: 6 - i * 4,
    points: (3 - i) * 3,
    position: i + 1,
  }));
}

/** Cria AllGroupStandings para N grupos */
function makeAllGroupStandings(
  groups: Record<string, [string, string, string, string]>,
): AllGroupStandings {
  const result: AllGroupStandings = {};
  for (const [groupId, teams] of Object.entries(groups)) {
    result[groupId] = makeGroupStandings(groupId, teams);
  }
  return result;
}

// ─── Fixtures de mata-mata (espelhando openfootball real) ────────────────────

const ROUND32_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(73, "2A", "2B", "dezesseis-avos"),
  makeKnockoutMatch(74, "1C", "3DEF", "dezesseis-avos"),
  makeKnockoutMatch(75, "1E", "3ABC", "dezesseis-avos"),
  makeKnockoutMatch(76, "1D", "2E", "dezesseis-avos"),
];

const ROUND16_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(89, "W73", "W74", "oitavas"),
  makeKnockoutMatch(90, "W75", "W76", "oitavas"),
];

const QF_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(97, "W89", "W90", "quartas"),
];

const SF_MATCHES: MatchWithId[] = [
  makeKnockoutMatch(101, "W97", "W98", "semifinal"),
  makeKnockoutMatch(102, "W98", "W99", "semifinal"),
];

const THIRD_MATCH: MatchWithId[] = [
  makeKnockoutMatch(103, "L101", "L102", "terceiro"),
];

const FINAL_MATCH: MatchWithId[] = [
  makeKnockoutMatch(104, "W101", "W102", "final"),
];

const ALL_KNOCKOUT_MATCHES: MatchWithId[] = [
  ...ROUND32_MATCHES,
  ...ROUND16_MATCHES,
  ...QF_MATCHES,
  ...SF_MATCHES,
  ...THIRD_MATCH,
  ...FINAL_MATCH,
];

// ─── Suíte isPlaceholderId ───────────────────────────────────────────────────

describe("isPlaceholderId", () => {
  it.each([
    ["2A", true],
    ["1E", true],
    ["1L", true],
    ["3ABC", true],
    ["3ABCD", true],
    ["W73", true],
    ["W104", true],
    ["L101", true],
    ["L102", true],
  ])("placeholder '%s' → true", (id, expected) => {
    expect(isPlaceholderId(id)).toBe(expected);
  });

  it.each([
    ["BRA", false],
    ["ARG", false],
    ["m73", false],
    ["", false],
    ["1", false],
    ["A", false],
    ["w73", false], // lowercase w
    ["l101", false], // lowercase l
  ])("teamId '%s' → false", (id, expected) => {
    expect(isPlaceholderId(id)).toBe(expected);
  });
});

// ─── Suíte buildBracketFromFixtures ─────────────────────────────────────────

describe("buildBracketFromFixtures", () => {
  it("array vazio → estrutura vazia {}", () => {
    const result = buildBracketFromFixtures([]);
    expect(result).toEqual({});
  });

  it("agrupa matchups pela fase correta", () => {
    const result = buildBracketFromFixtures(ALL_KNOCKOUT_MATCHES);
    expect(result["dezesseis-avos"]).toHaveLength(4);
    expect(result["oitavas"]).toHaveLength(2);
    expect(result["quartas"]).toHaveLength(1);
    expect(result["semifinal"]).toHaveLength(2);
    expect(result["terceiro"]).toHaveLength(1);
    expect(result["final"]).toHaveLength(1);
  });

  it("matchId é preservado corretamente", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const matchIds = result["dezesseis-avos"]!.map((m) => m.matchId);
    expect(matchIds).toContain("m73");
    expect(matchIds).toContain("m75");
  });

  it("ordena por matchNum crescente dentro de cada fase", () => {
    // Passar na ordem invertida para testar a ordenação
    const reversed = [...ROUND32_MATCHES].reverse();
    const result = buildBracketFromFixtures(reversed);
    const matchNums = result["dezesseis-avos"]!.map((m) =>
      parseInt(m.matchId.slice(1), 10),
    );
    expect(matchNums).toEqual([...matchNums].sort((a, b) => a - b));
  });

  it("placeholder '2A' → home slot com origin 'group-runner-up', groupId 'A'", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const m73 = result["dezesseis-avos"]!.find((m) => m.matchId === "m73")!;
    expect(m73.home.origin).toBe("group-runner-up");
    expect(m73.home.teamId).toBe("2A");
    expect((m73.home.meta as { groupId: string }).groupId).toBe("A");
  });

  it("placeholder '3ABC' → slot com origin 'best-third', candidateGroups ['A','B','C']", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const m75 = result["dezesseis-avos"]!.find((m) => m.matchId === "m75")!;
    expect(m75.away.origin).toBe("best-third");
    expect(m75.away.teamId).toBe("3ABC");
    const meta = m75.away.meta as { candidateGroups: string[] };
    expect(meta.candidateGroups).toEqual(["A", "B", "C"]);
  });

  it("placeholder 'W73' → slot com origin 'match-winner', matchNum 73", () => {
    const result = buildBracketFromFixtures(ROUND16_MATCHES);
    const m89 = result["oitavas"]!.find((m) => m.matchId === "m89")!;
    expect(m89.home.origin).toBe("match-winner");
    expect((m89.home.meta as { matchNum: number }).matchNum).toBe(73);
  });

  it("placeholder 'L101' → slot com origin 'match-loser', matchNum 101", () => {
    const result = buildBracketFromFixtures(THIRD_MATCH);
    const m103 = result["terceiro"]![0]!;
    expect(m103.home.origin).toBe("match-loser");
    expect((m103.home.meta as { matchNum: number }).matchNum).toBe(101);
  });

  it("placeholder '1E' → slot com origin 'group-winner', groupId 'E'", () => {
    const result = buildBracketFromFixtures(ROUND32_MATCHES);
    const m75 = result["dezesseis-avos"]!.find((m) => m.matchId === "m75")!;
    expect(m75.home.origin).toBe("group-winner");
    expect((m75.home.meta as { groupId: string }).groupId).toBe("E");
  });

  it("teamId real → slot com origin 'resolved'", () => {
    const matchWithRealTeam = makeKnockoutMatch(73, "BRA", "ARG", "dezesseis-avos");
    const result = buildBracketFromFixtures([matchWithRealTeam]);
    const m73 = result["dezesseis-avos"]![0]!;
    expect(m73.home.origin).toBe("resolved");
    expect(m73.home.teamId).toBe("BRA");
    expect(m73.away.origin).toBe("resolved");
  });

  it("idempotência: mesmo input → mesmo output", () => {
    const r1 = buildBracketFromFixtures(ALL_KNOCKOUT_MATCHES);
    const r2 = buildBracketFromFixtures(ALL_KNOCKOUT_MATCHES);
    expect(r1).toEqual(r2);
  });
});

// ─── Suíte resolveSlotTeam ───────────────────────────────────────────────────

describe("resolveSlotTeam", () => {
  const standings = makeAllGroupStandings({
    A: ["BRA", "ARG", "BOL", "CHI"],
    B: ["MEX", "USA", "CAN", "JAM"],
    C: ["FRA", "ENG", "ESP", "POR"],
    D: ["GER", "ITA", "NED", "BEL"],
    E: ["URU", "COL", "PAR", "ECU"],
  });

  // bestThirds simulados: 3ºs de A, B, C (BOL, CAN, ESP)
  const bestThirds: GroupStandingEntry[] = [
    standings["A"]!.find((e) => e.position === 3)!, // BOL
    standings["B"]!.find((e) => e.position === 3)!, // CAN
    standings["C"]!.find((e) => e.position === 3)!, // ESP
  ];

  const noResults = new Map<string, RoundWinner>();

  it("id já resolvido (teamId real) → retorna o próprio id", () => {
    expect(resolveSlotTeam("BRA", standings, bestThirds, noResults)).toBe("BRA");
  });

  it("'1A' → 1º do grupo A (BRA)", () => {
    expect(resolveSlotTeam("1A", standings, bestThirds, noResults)).toBe("BRA");
  });

  it("'2A' → 2º do grupo A (ARG)", () => {
    expect(resolveSlotTeam("2A", standings, bestThirds, noResults)).toBe("ARG");
  });

  it("'2B' → 2º do grupo B (USA)", () => {
    expect(resolveSlotTeam("2B", standings, bestThirds, noResults)).toBe("USA");
  });

  it("'1E' → 1º do grupo E (URU)", () => {
    expect(resolveSlotTeam("1E", standings, bestThirds, noResults)).toBe("URU");
  });

  it("grupo inexistente → null", () => {
    expect(resolveSlotTeam("1Z", standings, bestThirds, noResults)).toBeNull();
  });

  it("'3ABC' → melhor 3º entre grupos A, B, C (BOL, primeiro na lista bestThirds)", () => {
    // bestThirds[0] = BOL (grupo A) — BOL está em candidateGroups {A,B,C}
    const result = resolveSlotTeam("3ABC", standings, bestThirds, noResults);
    expect(result).toBe("BOL");
  });

  it("'3ABC' → null quando nenhum 3º de A/B/C está em bestThirds", () => {
    // bestThirds contendo apenas 3ºs de grupos D, E (não A/B/C)
    const otherThirds: GroupStandingEntry[] = [
      standings["D"]!.find((e) => e.position === 3)!, // NED
      standings["E"]!.find((e) => e.position === 3)!, // PAR
    ];
    const result = resolveSlotTeam("3ABC", standings, otherThirds, noResults);
    expect(result).toBeNull();
  });

  it("'W73' → vencedor do jogo m73 de bracketResults", () => {
    const results = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    expect(resolveSlotTeam("W73", standings, bestThirds, results)).toBe("BRA");
  });

  it("'L73' → perdedor do jogo m73 de bracketResults", () => {
    const results = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    expect(resolveSlotTeam("L73", standings, bestThirds, results)).toBe("ARG");
  });

  it("'W73' sem jogo m73 em bracketResults → null", () => {
    expect(resolveSlotTeam("W73", standings, bestThirds, noResults)).toBeNull();
  });

  it("'W73' com isDraw (winnerId null) → null", () => {
    const results = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: null, loserId: null }],
    ]);
    expect(resolveSlotTeam("W73", standings, bestThirds, results)).toBeNull();
  });

  it("'L101' → perdedor de semifinal m101", () => {
    const results = new Map<string, RoundWinner>([
      ["m101", { matchId: "m101", winnerId: "FRA", loserId: "GER" }],
    ]);
    expect(resolveSlotTeam("L101", standings, bestThirds, results)).toBe("GER");
  });

  it("placeholder '3DEF' → melhor 3º entre grupos D, E, F", () => {
    const standingsDEF = makeAllGroupStandings({
      D: ["GER", "ITA", "NED", "BEL"],
      E: ["URU", "COL", "PAR", "ECU"],
      F: ["JPN", "KOR", "AUS", "NZL"],
    });
    const thirdsAll: GroupStandingEntry[] = [
      standingsDEF["D"]!.find((e) => e.position === 3)!, // NED
      standingsDEF["E"]!.find((e) => e.position === 3)!, // PAR
      standingsDEF["F"]!.find((e) => e.position === 3)!, // AUS
    ];
    const result = resolveSlotTeam("3DEF", standingsDEF, thirdsAll, noResults);
    // Primeiro da lista (melhor 3º) que pertence a D, E ou F
    expect(result).toBe("NED");
  });
});

// ─── Suíte advanceBracket ────────────────────────────────────────────────────

describe("advanceBracket", () => {
  // Bracket de dezesseis-avos: m73(BRA vs ARG) e m74(FRA vs GER)
  const round: BracketMatchup[] = [
    {
      matchId: "m73",
      stage: "dezesseis-avos",
      home: { teamId: "BRA", origin: "resolved", meta: {} },
      away: { teamId: "ARG", origin: "resolved", meta: {} },
    },
    {
      matchId: "m74",
      stage: "dezesseis-avos",
      home: { teamId: "FRA", origin: "resolved", meta: {} },
      away: { teamId: "GER", origin: "resolved", meta: {} },
    },
  ];

  it("vencedores resolvidos → Map com 'W{num}' e 'L{num}'", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
      ["m74", { matchId: "m74", winnerId: "GER", loserId: "FRA" }],
    ]);
    const result = advanceBracket(round, winners);
    expect(result.get("W73")).toBe("BRA");
    expect(result.get("L73")).toBe("ARG");
    expect(result.get("W74")).toBe("GER");
    expect(result.get("L74")).toBe("FRA");
    expect(result.size).toBe(4);
  });

  it("confronto com isDraw (winnerId null) → 'W{num}'/'L{num}' NÃO entram no Map", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: null, loserId: null }],
    ]);
    const result = advanceBracket(round, winners);
    expect(result.has("W73")).toBe(false);
    expect(result.has("L73")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("confronto sem palpite (não está em winners) → não entra no Map", () => {
    const result = advanceBracket(round, new Map());
    expect(result.size).toBe(0);
  });

  it("apenas m73 resolvido → apenas W73/L73 no Map (m74 ausente)", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    const result = advanceBracket(round, winners);
    expect(result.get("W73")).toBe("BRA");
    expect(result.get("L73")).toBe("ARG");
    expect(result.has("W74")).toBe(false);
    expect(result.size).toBe(2);
  });

  it("round vazio → Map vazio", () => {
    const result = advanceBracket([], new Map());
    expect(result.size).toBe(0);
  });

  it("idempotência: mesmo input → mesmo output", () => {
    const winners = new Map<string, RoundWinner>([
      ["m73", { matchId: "m73", winnerId: "BRA", loserId: "ARG" }],
    ]);
    const r1 = advanceBracket(round, winners);
    const r2 = advanceBracket(round, winners);
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });

  it("matchId malformado (ex: 'group-1') → não insere WNaN/LNaN no Map", () => {
    const malformedRound: BracketMatchup[] = [
      {
        matchId: "group-1",
        stage: "dezesseis-avos",
        home: { teamId: "BRA", origin: "resolved", meta: {} },
        away: { teamId: "ARG", origin: "resolved", meta: {} },
      },
    ];
    const winners = new Map<string, RoundWinner>([
      ["group-1", { matchId: "group-1", winnerId: "BRA", loserId: "ARG" }],
    ]);
    const result = advanceBracket(malformedRound, winners);
    expect(result.has("WNaN")).toBe(false);
    expect(result.has("LNaN")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("jogo m103 (terceiro) com L101/L102 → resolve perdedores de semifinal", () => {
    // advanceBracket do round de semifinal gera L101/L102
    const sfRound: BracketMatchup[] = [
      {
        matchId: "m101",
        stage: "semifinal",
        home: { teamId: "BRA", origin: "resolved", meta: {} },
        away: { teamId: "FRA", origin: "resolved", meta: {} },
      },
      {
        matchId: "m102",
        stage: "semifinal",
        home: { teamId: "GER", origin: "resolved", meta: {} },
        away: { teamId: "ARG", origin: "resolved", meta: {} },
      },
    ];
    const sfWinners = new Map<string, RoundWinner>([
      ["m101", { matchId: "m101", winnerId: "BRA", loserId: "FRA" }],
      ["m102", { matchId: "m102", winnerId: "ARG", loserId: "GER" }],
    ]);
    const result = advanceBracket(sfRound, sfWinners);
    expect(result.get("W101")).toBe("BRA");
    expect(result.get("L101")).toBe("FRA");
    expect(result.get("W102")).toBe("ARG");
    expect(result.get("L102")).toBe("GER");
  });
});
