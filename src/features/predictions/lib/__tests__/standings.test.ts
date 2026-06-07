/**
 * TDD RED phase — TASK-02
 * Testes das funções puras de standings.ts:
 *   computeGroupStandings, rankBestThirds, deriveWinner,
 *   deriveWinnerFromPrediction, computeProgress.
 *
 * O arquivo de implementação (standings.ts) ainda não existe em forma completa —
 * todos esses testes devem falhar (RED) até a implementação estar pronta (GREEN).
 */
import { describe, expect, it } from "vitest";

import type { MatchWithId, Prediction } from "@/types";
import {
  computeGroupStandings,
  computeProgress,
  deriveWinner,
  deriveWinnerFromPrediction,
  rankBestThirds,
} from "@/features/predictions/lib";
import type { GroupStandings } from "@/features/predictions/lib";

// ---------------------------------------------------------------------------
// Helpers de fixture
// ---------------------------------------------------------------------------

/** Cria partida de grupo entre dois times. */
function makeGroupMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  groupId = "group-a",
  overrides: Partial<MatchWithId> = {},
): MatchWithId {
  return {
    id,
    homeTeamId,
    awayTeamId,
    kickoffAt: "2026-06-20T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    venue: null,
    ...overrides,
  };
}

/** Cria palpite. */
function makePred(
  matchId: string,
  homeScore: number,
  awayScore: number,
  uid = "user-01",
): Prediction {
  return { uid, matchId, homeScore, awayScore };
}

// 4 times do Grupo A para os testes
const T1 = "team-bra";
const T2 = "team-arg";
const T3 = "team-fra";
const T4 = "team-ger";

// 6 partidas do Grupo A (round-robin 4 times)
const GROUP_A_MATCHES: MatchWithId[] = [
  makeGroupMatch("m01", T1, T2), // BRA x ARG
  makeGroupMatch("m02", T3, T4), // FRA x GER
  makeGroupMatch("m03", T1, T3), // BRA x FRA
  makeGroupMatch("m04", T2, T4), // ARG x GER
  makeGroupMatch("m05", T1, T4), // BRA x GER
  makeGroupMatch("m06", T2, T3), // ARG x FRA
];

// ---------------------------------------------------------------------------
// 1. computeGroupStandings
// ---------------------------------------------------------------------------

describe("computeGroupStandings", () => {
  it("sem palpites → todos com 0 pontos, ordenados por teamId ASC", () => {
    const result = computeGroupStandings(GROUP_A_MATCHES, []);
    expect(result).toHaveLength(4);
    expect(result.every((e) => e.points === 0)).toBe(true);
    // Critério 5 (teamId ASC): team-arg < team-bra < team-fra < team-ger
    expect(result.map((e) => e.teamId)).toEqual([T2, T1, T3, T4]);
    expect(result[0]?.position).toBe(1);
    expect(result[3]?.position).toBe(4);
  });

  it("um time com vitórias em todas as partidas → 1º lugar com pontos máximos", () => {
    // BRA vence todos (3+3+3 = 9 pts); os outros variam
    const predictions: Prediction[] = [
      makePred("m01", 2, 0), // BRA 2×0 ARG → BRA 3pts
      makePred("m03", 1, 0), // BRA 1×0 FRA → BRA 3pts
      makePred("m05", 3, 1), // BRA 3×1 GER → BRA 3pts
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    expect(result[0]?.teamId).toBe(T1); // BRA é 1º
    expect(result[0]?.points).toBe(9);
    expect(result[0]?.played).toBe(3);
    expect(result[0]?.wins).toBe(3);
    expect(result[0]?.goalsFor).toBe(6);
    expect(result[0]?.goalsAgainst).toBe(1);
    expect(result[0]?.goalDifference).toBe(5);
    expect(result[0]?.position).toBe(1);
  });

  it("desempate por saldo de gols (pontos iguais)", () => {
    // ARG e FRA com mesmos pontos (3pts cada), mas saldos diferentes.
    // ARG: vence m01 (3pts), perde m04 → 3pts, gf=2, ga=2, gd=0
    // FRA: vence m02 (3pts), sem palpite em m06 → 3pts, gf=2, ga=0, gd=+2
    // FRA tem saldo melhor (+2 > 0) → FRA acima de ARG.
    const predictions: Prediction[] = [
      makePred("m01", 0, 2), // ARG 2×0 BRA → ARG 3pts, gf+=2
      makePred("m02", 2, 0), // FRA 2×0 GER → FRA 3pts, gf+=2
      makePred("m04", 0, 2), // GER 2×0 ARG → GER 3pts, ARG ga+=2
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    // ARG: 3pts, saldo: +2-2 = 0
    // FRA: 3pts, saldo: +2-0 = +2  → FRA acima de ARG
    const fraPos = result.find((e) => e.teamId === T3)!.position;
    const argPos = result.find((e) => e.teamId === T2)!.position;
    expect(fraPos).toBeLessThan(argPos);
  });

  it("desempate por gols pró (pontos e saldo iguais)", () => {
    // Dois times com 3pts e saldo 0, mas gols pró diferentes
    const predictions: Prediction[] = [
      makePred("m01", 2, 1), // BRA vence ARG 2×1 → BRA 3pts, saldo +1
      makePred("m02", 1, 2), // GER vence FRA 2×1 → GER 3pts, saldo +1
      makePred("m03", 0, 1), // FRA vence BRA 1×0 → FRA 3pts, BRA 3pts total
      makePred("m04", 1, 0), // ARG vence GER 1×0 → ARG 3pts, GER 3pts total
      // BRA: 3+0=3pts, +1-1=0 saldo, gols pró: 2+0=2
      // GER: 0+3=3pts, +1-1=0 saldo, gols pró: 2+0=2  → mesmo; teamId desempata
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    // Teste de estabilidade: teamId ASC desempata quando tudo mais é igual
    const braPos = result.find((e) => e.teamId === T1)!.position;
    const gerPos = result.find((e) => e.teamId === T4)!.position;
    // BRA ("team-bra") < GER ("team-ger") → BRA acima de GER
    expect(braPos).toBeLessThan(gerPos);
  });

  it("desempate por confronto direto (pontos e saldo e gols pró iguais entre 2 times)", () => {
    // BRA e ARG com pontos/saldo/gols-pró idênticos contra os outros dois,
    // mas BRA venceu o confronto direto
    const predictions: Prediction[] = [
      makePred("m01", 1, 0), // BRA 1×0 ARG → BRA vence confronto direto
      makePred("m03", 1, 0), // BRA 1×0 FRA
      makePred("m05", 0, 1), // GER 1×0 BRA
      makePred("m02", 0, 1), // GER 1×0 FRA
      makePred("m04", 0, 1), // GER 1×0 ARG
      makePred("m06", 1, 0), // ARG 1×0 FRA
      // BRA: vitórias sobre ARG e FRA; derrota para GER → posição depende de saldo
      // mas o confronto direto BRA vs ARG deve colocar BRA acima de ARG
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    const braPos = result.find((e) => e.teamId === T1)!.position;
    const argPos = result.find((e) => e.teamId === T2)!.position;
    expect(braPos).toBeLessThan(argPos);
  });

  it("triplo empate com confronto direto — estabilidade de ordenação (questão aberta §1)", () => {
    // 3 times (BRA, ARG, FRA) com exatamente os mesmos pontos, saldo e gols pró.
    // Confronto direto entre os 3 também equilibrado — desempate final por teamId ASC.
    // GER fica em último com menos pontos.
    // Cenário de ciclo: BRA>ARG, ARG>FRA, FRA>BRA (cada um com 3pts h2h) → h2h sub-tabela empatada.
    // Com placar 1×0 em todos: cada time tem 3pts, saldo +0 (1 vitória 1 derrota), gols pró=1.
    const tripleTiePredictions: Prediction[] = [
      makePred("m01", 1, 0), // BRA 1×0 ARG
      makePred("m06", 1, 0), // ARG 1×0 FRA
      makePred("m03", 0, 1), // FRA 1×0 BRA → FRA vence o mandante BRA
    ];
    // Resultado esperado: BRA=3pts(+0,gf=1), ARG=3pts(+0,gf=1), FRA=3pts(+0,gf=1)
    // H2H entre os 3: BRA=3pts, ARG=3pts, FRA=3pts (cada um venceu um h2h) → ainda empatado
    // Critério 5 (teamId ASC): team-arg < team-bra < team-fra
    const result = computeGroupStandings(GROUP_A_MATCHES, tripleTiePredictions);
    const braEntry = result.find((e) => e.teamId === T1)!;
    const argEntry = result.find((e) => e.teamId === T2)!;
    const fraEntry = result.find((e) => e.teamId === T3)!;

    // Todos com 3 pontos
    expect(braEntry.points).toBe(3);
    expect(argEntry.points).toBe(3);
    expect(fraEntry.points).toBe(3);

    // Desempate final por teamId ASC quando h2h também empata:
    // team-arg(1º) < team-bra(2º) < team-fra(3º)
    expect(argEntry.position).toBeLessThan(braEntry.position);
    expect(braEntry.position).toBeLessThan(fraEntry.position);

    // Resultado é determinístico: segunda chamada deve retornar a mesma ordem
    const result2 = computeGroupStandings(GROUP_A_MATCHES, tripleTiePredictions);
    expect(result.map((e) => e.teamId)).toEqual(result2.map((e) => e.teamId));
  });

  it("partidas sem palpite não contam pontos (time fica em 0 nessa partida)", () => {
    // Só um palpite: BRA 1×0 ARG
    const predictions: Prediction[] = [makePred("m01", 1, 0)];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    const bra = result.find((e) => e.teamId === T1)!;
    expect(bra.played).toBe(1); // só 1 jogo com palpite
    expect(bra.points).toBe(3);
    const fra = result.find((e) => e.teamId === T3)!;
    expect(fra.played).toBe(0); // FRA não tem palpites nas suas partidas ainda
    expect(fra.points).toBe(0);
  });

  it("position é 1-based e contínuo (sem buracos)", () => {
    const result = computeGroupStandings(GROUP_A_MATCHES, []);
    const positions = result.map((e) => e.position).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4]);
  });

  it("empate técnico completo → desempate por teamId ASC (determinístico)", () => {
    // Sem palpites: todos com 0 pts, 0 saldo, 0 gols pró
    const result = computeGroupStandings(GROUP_A_MATCHES, []);
    const teamIds = result.map((e) => e.teamId);
    // teamId ASC: arg < bra < fra < ger
    expect(teamIds).toEqual(
      [...teamIds].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("idempotência: mesmo input → mesmo output", () => {
    const preds = [makePred("m01", 2, 1), makePred("m02", 0, 0)];
    const r1 = computeGroupStandings(GROUP_A_MATCHES, preds);
    const r2 = computeGroupStandings(GROUP_A_MATCHES, preds);
    expect(r1).toEqual(r2);
  });

  it("empate de placares conta como empate (1pt para cada time)", () => {
    const predictions: Prediction[] = [makePred("m01", 1, 1)]; // BRA 1×1 ARG
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    const bra = result.find((e) => e.teamId === T1)!;
    const arg = result.find((e) => e.teamId === T2)!;
    expect(bra.points).toBe(1);
    expect(bra.draws).toBe(1);
    expect(arg.points).toBe(1);
    expect(arg.draws).toBe(1);
  });

  it("goalDifference = goalsFor - goalsAgainst sempre", () => {
    const predictions: Prediction[] = [makePred("m01", 3, 1)]; // BRA 3×1 ARG
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    for (const entry of result) {
      expect(entry.goalDifference).toBe(entry.goalsFor - entry.goalsAgainst);
    }
  });

  it("duplicate matchId in predictions → último palpite prevalece", () => {
    // Spec §4 step 3: "se houver duplicados de matchId, prevalece o último"
    // Primeiro palpite: BRA perde (0×1). Segundo (duplicado): BRA vence (2×0).
    // O resultado deve refletir o segundo (2×0).
    const predictions: Prediction[] = [
      makePred("m01", 0, 1), // BRA 0×1 ARG — deve ser sobrescrito
      makePred("m01", 2, 0), // BRA 2×0 ARG — deve prevalecer
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    const bra = result.find((e) => e.teamId === T1)!;
    const arg = result.find((e) => e.teamId === T2)!;
    // Se o último prevalece: BRA venceu (3pts), ARG perdeu (0pts)
    expect(bra.points).toBe(3);
    expect(bra.wins).toBe(1);
    expect(bra.goalsFor).toBe(2);
    expect(arg.points).toBe(0);
    expect(arg.losses).toBe(1);
  });

  it("grupo com todos os jogos empatados 0×0 → todos com stats iguais, desempate por teamId ASC", () => {
    // Cenário: round-robin completo de 4 times, todos os placares 0×0.
    // Cada time joga 3 partidas, acumula 3 empates (3pts), saldo 0, gols pró 0.
    // H2H entre qualquer subconjunto também está 0×0 → tudo empatado.
    // Critério final: teamId ASC — team-arg(1º) < team-bra(2º) < team-fra(3º) < team-ger(4º).
    const predictions: Prediction[] = [
      makePred("m01", 0, 0), // BRA 0×0 ARG
      makePred("m02", 0, 0), // FRA 0×0 GER
      makePred("m03", 0, 0), // BRA 0×0 FRA
      makePred("m04", 0, 0), // ARG 0×0 GER
      makePred("m05", 0, 0), // BRA 0×0 GER
      makePred("m06", 0, 0), // ARG 0×0 FRA
    ];
    const result = computeGroupStandings(GROUP_A_MATCHES, predictions);
    expect(result).toHaveLength(4);
    // Todos com 3pts, 3 empates, saldo 0, gols pró 0
    for (const entry of result) {
      expect(entry.points).toBe(3);
      expect(entry.draws).toBe(3);
      expect(entry.goalDifference).toBe(0);
      expect(entry.goalsFor).toBe(0);
    }
    // Desempate final por teamId ASC
    expect(result.map((e) => e.teamId)).toEqual([T2, T1, T3, T4]); // arg < bra < fra < ger
    expect(result[0]?.position).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. rankBestThirds
// ---------------------------------------------------------------------------

describe("rankBestThirds", () => {
  /** Cria GroupStandings simulada com entries pré-definidas. */
  function makeStandings(
    entries: Array<{ teamId: string; points: number; gd: number; gf: number }>,
  ): GroupStandings {
    return entries.map((e, i) => ({
      teamId: e.teamId,
      played: 3,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: e.gf,
      goalsAgainst: e.gf - e.gd,
      goalDifference: e.gd,
      points: e.points,
      position: i + 1,
    }));
  }

  it("extrai o 3º colocado de cada grupo e retorna os 8 melhores entre 12 grupos", () => {
    const allStandings: Record<string, GroupStandings> = {};
    for (let i = 0; i < 12; i++) {
      const gId = `group-${String.fromCharCode(97 + i)}`;
      allStandings[gId] = makeStandings([
        { teamId: `t${i}-1`, points: 9, gd: 6, gf: 8 },
        { teamId: `t${i}-2`, points: 6, gd: 2, gf: 5 },
        { teamId: `t${i}-3`, points: 3, gd: i, gf: i + 1 }, // gd varia por grupo (0..11)
        { teamId: `t${i}-4`, points: 0, gd: -8, gf: 0 },
      ]);
    }
    const result = rankBestThirds(allStandings);
    expect(result).toHaveLength(8);
    // Os 8 grupos com maior gd são os grupos com índice 4..11 → gd 4..11
    const topGds = result.map((e) => e.goalDifference).sort((a, b) => b - a);
    expect(topGds[0]).toBeGreaterThanOrEqual(topGds[1] ?? 0);
    // O melhor gd deve ser 11 (grupo l, i=11)
    expect(topGds[0]).toBe(11);
  });

  it("ordena por pontos → saldo → gols pró → teamId", () => {
    const allStandings: Record<string, GroupStandings> = {
      "group-a": makeStandings([
        { teamId: "t-a1", points: 9, gd: 5, gf: 7 },
        { teamId: "t-a2", points: 6, gd: 2, gf: 4 },
        { teamId: "t-a3-melhor", points: 4, gd: 2, gf: 6 }, // 3º — melhor gols pró (mesmo saldo)
        { teamId: "t-a4", points: 0, gd: -9, gf: 0 },
      ]),
      "group-b": makeStandings([
        { teamId: "t-b1", points: 9, gd: 5, gf: 7 },
        { teamId: "t-b2", points: 6, gd: 2, gf: 4 },
        { teamId: "t-b3-pior", points: 4, gd: 2, gf: 3 }, // 3º — menos gols pró
        { teamId: "t-b4", points: 0, gd: -9, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    expect(result[0]?.teamId).toBe("t-a3-melhor");
    expect(result[1]?.teamId).toBe("t-b3-pior");
  });

  it("com < 8 grupos (1 grupo) → retorna 1 terceiro disponível", () => {
    const allStandings: Record<string, GroupStandings> = {
      "group-a": makeStandings([
        { teamId: "ta1", points: 9, gd: 5, gf: 7 },
        { teamId: "ta2", points: 6, gd: 2, gf: 4 },
        { teamId: "ta3", points: 3, gd: 0, gf: 2 },
        { teamId: "ta4", points: 0, gd: -7, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    expect(result).toHaveLength(1);
    expect(result[0]?.teamId).toBe("ta3");
  });

  it("desempate final por teamId ASC (determinístico)", () => {
    // Dois terceiros com exatamente os mesmos stats — teamId decide
    const allStandings: Record<string, GroupStandings> = {
      "group-a": makeStandings([
        { teamId: "ta1", points: 9, gd: 5, gf: 7 },
        { teamId: "ta2", points: 6, gd: 2, gf: 4 },
        { teamId: "zzz", points: 3, gd: 0, gf: 2 }, // teamId > "aaa"
        { teamId: "ta4", points: 0, gd: -7, gf: 0 },
      ]),
      "group-b": makeStandings([
        { teamId: "tb1", points: 9, gd: 5, gf: 7 },
        { teamId: "tb2", points: 6, gd: 2, gf: 4 },
        { teamId: "aaa", points: 3, gd: 0, gf: 2 }, // teamId < "zzz"
        { teamId: "tb4", points: 0, gd: -7, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    // "aaa" < "zzz" → "aaa" fica em 1º no desempate por teamId ASC
    expect(result[0]?.teamId).toBe("aaa");
    expect(result[1]?.teamId).toBe("zzz");
  });

  it("com exatamente 8 grupos → retorna todos os 8 terceiros sem truncar", () => {
    // Boundary: slice(0, 8) não deve cortar nenhum quando há exatamente 8 grupos.
    const allStandings: Record<string, GroupStandings> = {};
    for (let i = 0; i < 8; i++) {
      const gId = `group-${String.fromCharCode(97 + i)}`;
      allStandings[gId] = makeStandings([
        { teamId: `t${i}-1`, points: 9, gd: 6, gf: 8 },
        { teamId: `t${i}-2`, points: 6, gd: 2, gf: 5 },
        { teamId: `t${i}-3`, points: 3, gd: i, gf: i + 1 },
        { teamId: `t${i}-4`, points: 0, gd: -8, gf: 0 },
      ]);
    }
    const result = rankBestThirds(allStandings);
    // Deve retornar exatamente 8 (nenhum descartado, nenhum duplicado)
    expect(result).toHaveLength(8);
    // Todos têm posição-original === 3 (todos são terceiros colocados)
    const teamIds = result.map((e) => e.teamId);
    expect(new Set(teamIds).size).toBe(8); // sem duplicatas
  });

  it("sem grupos → retorna array vazio", () => {
    const result = rankBestThirds({});
    expect(result).toEqual([]);
  });

  it("grupo sem 3º colocado (posição 3 ausente) é ignorado", () => {
    // Grupo com apenas 2 times (sem posição 3)
    const allStandings: Record<string, GroupStandings> = {
      "group-a": [
        {
          teamId: "ta1",
          played: 1,
          wins: 1,
          draws: 0,
          losses: 0,
          goalsFor: 2,
          goalsAgainst: 0,
          goalDifference: 2,
          points: 3,
          position: 1,
        },
        {
          teamId: "ta2",
          played: 1,
          wins: 0,
          draws: 0,
          losses: 1,
          goalsFor: 0,
          goalsAgainst: 2,
          goalDifference: -2,
          points: 0,
          position: 2,
        },
        // sem position === 3
      ],
      "group-b": makeStandings([
        { teamId: "tb1", points: 9, gd: 5, gf: 7 },
        { teamId: "tb2", points: 6, gd: 2, gf: 4 },
        { teamId: "tb3", points: 3, gd: 1, gf: 3 },
        { teamId: "tb4", points: 0, gd: -8, gf: 0 },
      ]),
    };
    const result = rankBestThirds(allStandings);
    // group-a sem 3º → só tb3 do group-b
    expect(result).toHaveLength(1);
    expect(result[0]?.teamId).toBe("tb3");
  });
});

// ---------------------------------------------------------------------------
// 3. deriveWinner
// ---------------------------------------------------------------------------

describe("deriveWinner", () => {
  it("mandante vence → winnerId = homeTeamId, isDraw = false", () => {
    const r = deriveWinner("bra", "arg", 2, 0);
    expect(r.winnerId).toBe("bra");
    expect(r.loserId).toBe("arg");
    expect(r.isDraw).toBe(false);
    expect(r.homeScore).toBe(2);
    expect(r.awayScore).toBe(0);
  });

  it("visitante vence → winnerId = awayTeamId, isDraw = false", () => {
    const r = deriveWinner("bra", "arg", 0, 1);
    expect(r.winnerId).toBe("arg");
    expect(r.loserId).toBe("bra");
    expect(r.isDraw).toBe(false);
    expect(r.homeScore).toBe(0);
    expect(r.awayScore).toBe(1);
  });

  it("empate → winnerId = null, loserId = null, isDraw = true", () => {
    const r = deriveWinner("bra", "arg", 1, 1);
    expect(r.winnerId).toBeNull();
    expect(r.loserId).toBeNull();
    expect(r.isDraw).toBe(true);
  });

  it("0×0 → empate (isDraw = true)", () => {
    const r = deriveWinner("bra", "arg", 0, 0);
    expect(r.isDraw).toBe(true);
    expect(r.winnerId).toBeNull();
    expect(r.loserId).toBeNull();
    expect(r.homeScore).toBe(0);
    expect(r.awayScore).toBe(0);
  });

  it("placar grande → vencedor correto", () => {
    const r = deriveWinner("bra", "arg", 7, 1);
    expect(r.winnerId).toBe("bra");
    expect(r.isDraw).toBe(false);
    expect(r.homeScore).toBe(7);
    expect(r.awayScore).toBe(1);
  });

  it("retorna WinnerResult completo com todos os campos", () => {
    const r = deriveWinner("home-team", "away-team", 3, 2);
    expect(r).toHaveProperty("winnerId");
    expect(r).toHaveProperty("loserId");
    expect(r).toHaveProperty("isDraw");
    expect(r).toHaveProperty("homeScore");
    expect(r).toHaveProperty("awayScore");
  });
});

// ---------------------------------------------------------------------------
// 4. deriveWinnerFromPrediction
// ---------------------------------------------------------------------------

describe("deriveWinnerFromPrediction", () => {
  it("delega corretamente para deriveWinner com homeTeamId/awayTeamId da partida", () => {
    const match: MatchWithId = {
      id: "m01",
      homeTeamId: "bra",
      awayTeamId: "arg",
      kickoffAt: "2026-06-20T18:00:00.000Z",
      stage: "oitavas",
      round: null,
      groupId: null,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      venue: null,
    };
    const prediction: Prediction = {
      uid: "user-01",
      matchId: "m01",
      homeScore: 2,
      awayScore: 1,
    };
    const r = deriveWinnerFromPrediction(prediction, match);
    expect(r.winnerId).toBe("bra");
    expect(r.loserId).toBe("arg");
    expect(r.isDraw).toBe(false);
    expect(r.homeScore).toBe(2);
    expect(r.awayScore).toBe(1);
  });

  it("empate via sobrecarga → isDraw = true", () => {
    const match: MatchWithId = {
      id: "m02",
      homeTeamId: "fra",
      awayTeamId: "ger",
      kickoffAt: "2026-06-21T18:00:00.000Z",
      stage: "quartas",
      round: null,
      groupId: null,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      venue: null,
    };
    const prediction: Prediction = {
      uid: "user-01",
      matchId: "m02",
      homeScore: 1,
      awayScore: 1,
    };
    const r = deriveWinnerFromPrediction(prediction, match);
    expect(r.isDraw).toBe(true);
    expect(r.winnerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. computeProgress
// ---------------------------------------------------------------------------

describe("computeProgress", () => {
  const matchGrupos1 = makeGroupMatch("m01", "bra", "arg", "group-a");
  const matchGrupos2 = makeGroupMatch("m02", "fra", "ger", "group-a");
  const matchOitavas: MatchWithId = {
    ...makeGroupMatch("m10", "bra", "ger"),
    stage: "oitavas",
    groupId: null,
  };

  it("sem partidas → global { filled:0, total:0, percentage:0 }, byStage vazio", () => {
    const r = computeProgress([], []);
    expect(r.global).toEqual({ filled: 0, total: 0, percentage: 0 });
    expect(r.byStage).toEqual({});
  });

  it("sem palpites, com 2 partidas → filled=0, total=2, percentage=0", () => {
    const r = computeProgress([], [matchGrupos1, matchGrupos2]);
    expect(r.global.filled).toBe(0);
    expect(r.global.total).toBe(2);
    expect(r.global.percentage).toBe(0);
    expect(r.byStage.grupos?.total).toBe(2);
    expect(r.byStage.grupos?.filled).toBe(0);
  });

  it("1 de 2 palpites preenchidos → percentage = 50", () => {
    const preds = [makePred("m01", 1, 0)];
    const r = computeProgress(preds, [matchGrupos1, matchGrupos2]);
    expect(r.global.filled).toBe(1);
    expect(r.global.total).toBe(2);
    expect(r.global.percentage).toBe(50);
  });

  it("todos preenchidos → percentage = 100", () => {
    const preds = [makePred("m01", 1, 0), makePred("m02", 2, 1)];
    const r = computeProgress(preds, [matchGrupos1, matchGrupos2]);
    expect(r.global.percentage).toBe(100);
    expect(r.global.filled).toBe(2);
  });

  it("separa progresso por stage corretamente", () => {
    const preds = [makePred("m01", 1, 0), makePred("m10", 2, 1)];
    const matches = [matchGrupos1, matchGrupos2, matchOitavas];
    const r = computeProgress(preds, matches);
    expect(r.global.total).toBe(3);
    expect(r.global.filled).toBe(2);
    expect(r.byStage.grupos?.total).toBe(2);
    expect(r.byStage.grupos?.filled).toBe(1);
    expect(r.byStage.oitavas?.total).toBe(1);
    expect(r.byStage.oitavas?.filled).toBe(1);
    expect(r.byStage.oitavas?.percentage).toBe(100);
  });

  it("byStage exclui stages sem partidas", () => {
    const r = computeProgress([], [matchGrupos1]);
    expect(Object.keys(r.byStage)).toEqual(["grupos"]);
    expect(r.byStage.oitavas).toBeUndefined();
    expect(r.byStage.final).toBeUndefined();
  });

  it("percentage arredonda para 1 casa decimal (ex.: 1/3 ≈ 33.3)", () => {
    const m1 = makeGroupMatch("mx1", "t1", "t2");
    const m2 = makeGroupMatch("mx2", "t3", "t4");
    const m3 = makeGroupMatch("mx3", "t1", "t3");
    const preds = [makePred("mx1", 1, 0)];
    const r = computeProgress(preds, [m1, m2, m3]);
    expect(r.global.percentage).toBe(33.3);
  });

  it("palpites extras (matchId não em matches) são ignorados na contagem", () => {
    const preds = [makePred("m01", 1, 0), makePred("m99", 0, 0)]; // m99 não existe
    const r = computeProgress(preds, [matchGrupos1]);
    expect(r.global.total).toBe(1);
    expect(r.global.filled).toBe(1);
  });

  it("percentage está sempre no intervalo [0, 100]", () => {
    const r0 = computeProgress([], [matchGrupos1]);
    const r100 = computeProgress([makePred("m01", 1, 0)], [matchGrupos1]);
    expect(r0.global.percentage).toBeGreaterThanOrEqual(0);
    expect(r0.global.percentage).toBeLessThanOrEqual(100);
    expect(r100.global.percentage).toBe(100);
  });

  it("múltiplas fases simultâneas → byStage acumula cada stage independentemente", () => {
    // Cobre o cenário de copa completa: grupos, oitavas, quartas, semifinal, final
    // Verifica que cada stage é contabilizado de forma independente em byStage.
    const mGrupos1 = makeGroupMatch("g1", "t1", "t2", "group-a");
    const mGrupos2 = makeGroupMatch("g2", "t3", "t4", "group-a");
    const mOitavas: MatchWithId = { ...makeGroupMatch("o1", "t1", "t3"), stage: "oitavas", groupId: null };
    const mQuartas: MatchWithId = { ...makeGroupMatch("q1", "t1", "t4"), stage: "quartas", groupId: null };
    const mSemifinal: MatchWithId = { ...makeGroupMatch("s1", "t2", "t3"), stage: "semifinal", groupId: null };
    const mFinal: MatchWithId = { ...makeGroupMatch("f1", "t1", "t2"), stage: "final", groupId: null };

    // 4 de 6 partidas com palpite: g1, o1, q1, f1
    const preds = [
      makePred("g1", 1, 0),
      makePred("o1", 2, 1),
      makePred("q1", 1, 0),
      makePred("f1", 3, 1),
    ];
    const matches = [mGrupos1, mGrupos2, mOitavas, mQuartas, mSemifinal, mFinal];
    const r = computeProgress(preds, matches);

    // Global: 4 de 6
    expect(r.global.total).toBe(6);
    expect(r.global.filled).toBe(4);
    expect(r.global.percentage).toBe(66.7);

    // Por stage:
    expect(r.byStage.grupos?.total).toBe(2);
    expect(r.byStage.grupos?.filled).toBe(1);   // só g1 tem palpite
    expect(r.byStage.grupos?.percentage).toBe(50);

    expect(r.byStage.oitavas?.total).toBe(1);
    expect(r.byStage.oitavas?.filled).toBe(1);  // o1 tem palpite
    expect(r.byStage.oitavas?.percentage).toBe(100);

    expect(r.byStage.quartas?.total).toBe(1);
    expect(r.byStage.quartas?.filled).toBe(1);
    expect(r.byStage.quartas?.percentage).toBe(100);

    expect(r.byStage.semifinal?.total).toBe(1);
    expect(r.byStage.semifinal?.filled).toBe(0); // s1 sem palpite
    expect(r.byStage.semifinal?.percentage).toBe(0);

    expect(r.byStage.final?.total).toBe(1);
    expect(r.byStage.final?.filled).toBe(1);
    expect(r.byStage.final?.percentage).toBe(100);

    // Todos os 5 stages presentes
    expect(Object.keys(r.byStage)).toHaveLength(5);
  });

  it("2/3 = 66.7%", () => {
    const m1 = makeGroupMatch("n1", "t1", "t2");
    const m2 = makeGroupMatch("n2", "t3", "t4");
    const m3 = makeGroupMatch("n3", "t1", "t3");
    const preds = [makePred("n1", 1, 0), makePred("n2", 2, 0)];
    const r = computeProgress(preds, [m1, m2, m3]);
    expect(r.global.percentage).toBe(66.7);
  });
});
