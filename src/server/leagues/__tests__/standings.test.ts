/**
 * TASK-20 — testes de domínio de `computeLeagueStandings` (TDD, escritos antes
 * da implementação). Regras: spec §6/§9. Pura, determinística, sem I/O.
 *
 * Universo de times = os próprios competidores das partidas de liga (não um
 * registry). Estatística só de `status === "finished"`; ordenação
 * pts → saldo → gols-pró → name; display (name/crest) vem de um Map injetado.
 */

import { describe, expect, it } from "vitest";

import { computeLeagueStandings } from "@/server/leagues/standings";
import type { MatchWithId } from "@/types/matches";

// ─── Helpers de fixture ──────────────────────────────────────────────────────

/** Constrói um MatchWithId de liga (stage "liga") com defaults válidos. */
function ligaMatch(partial: Partial<MatchWithId> & Pick<MatchWithId, "id" | "homeTeamId" | "awayTeamId">): MatchWithId {
  return {
    championshipId: "bra.1",
    kickoffAt: "2026-03-01T20:00:00.000Z",
    stage: "liga",
    round: 1,
    status: "finished",
    homeScore: null,
    awayScore: null,
    ...partial,
  } as MatchWithId;
}

/** Map de display (id → {name, crestUrl?}). */
function teams(entries: Array<[string, { name: string; crestUrl?: string }]>) {
  return new Map(entries);
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("computeLeagueStandings", () => {
  it("soma pts/GF/GA/saldo apenas de partidas finalizadas e ignora scheduled/live", () => {
    const matches: MatchWithId[] = [
      // FLA 3 x 1 PAL (finished) → FLA +3pts, PAL 0
      ligaMatch({ id: "m1", homeTeamId: "fla", awayTeamId: "pal", status: "finished", homeScore: 3, awayScore: 1 }),
      // FLA x PAL agendado — NÃO conta
      ligaMatch({ id: "m2", homeTeamId: "pal", awayTeamId: "fla", status: "scheduled", homeScore: null, awayScore: null }),
      // FLA x PAL ao vivo — NÃO conta
      ligaMatch({ id: "m3", homeTeamId: "fla", awayTeamId: "pal", status: "live", homeScore: 1, awayScore: 0 }),
    ];

    const table = computeLeagueStandings(matches, teams([
      ["fla", { name: "Flamengo" }],
      ["pal", { name: "Palmeiras" }],
    ]));

    const fla = table.find((r) => r.team.id === "fla")!;
    expect(fla.played).toBe(1);
    expect(fla.wins).toBe(1);
    expect(fla.draws).toBe(0);
    expect(fla.losses).toBe(0);
    expect(fla.goalsFor).toBe(3);
    expect(fla.goalsAgainst).toBe(1);
    expect(fla.goalDifference).toBe(2);
    expect(fla.points).toBe(3);

    const pal = table.find((r) => r.team.id === "pal")!;
    expect(pal.played).toBe(1);
    expect(pal.losses).toBe(1);
    expect(pal.points).toBe(0);
    expect(pal.goalDifference).toBe(-2);
  });

  it("empate soma 1 ponto a cada lado", () => {
    const matches = [
      ligaMatch({ id: "m1", homeTeamId: "a", awayTeamId: "b", status: "finished", homeScore: 2, awayScore: 2 }),
    ];
    const table = computeLeagueStandings(matches, teams([
      ["a", { name: "Alpha" }],
      ["b", { name: "Beta" }],
    ]));
    expect(table.every((r) => r.points === 1 && r.draws === 1)).toBe(true);
  });

  it("ordena por pts → saldo → gols-pró → nome, com position 1-based", () => {
    const matches: MatchWithId[] = [
      // C vence B (saldo grande p/ C); A vence B; empate entre A e C nos pontos após rodadas.
      ligaMatch({ id: "m1", homeTeamId: "c", awayTeamId: "b", status: "finished", homeScore: 5, awayScore: 0 }), // C +3, saldo +5
      ligaMatch({ id: "m2", homeTeamId: "a", awayTeamId: "b", status: "finished", homeScore: 1, awayScore: 0 }), // A +3, saldo +1
    ];
    const table = computeLeagueStandings(matches, teams([
      ["a", { name: "AAA" }],
      ["b", { name: "BBB" }],
      ["c", { name: "CCC" }],
    ]));

    // C e A com 3 pts; C tem saldo maior → C em 1º, A em 2º, B (0 pts) em 3º.
    expect(table.map((r) => r.team.id)).toEqual(["c", "a", "b"]);
    expect(table.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("empate total (pts/saldo/gols-pró) cai em ordem alfabética determinística por nome", () => {
    // Nenhuma partida finalizada → todos zerados e empatados → alfabético por name.
    const table = computeLeagueStandings(
      [ligaMatch({ id: "m1", homeTeamId: "zeta", awayTeamId: "alpha", status: "scheduled", homeScore: null, awayScore: null })],
      teams([
        ["zeta", { name: "Zeta FC" }],
        ["alpha", { name: "Alpha FC" }],
      ]),
    );
    expect(table.map((r) => r.team.name)).toEqual(["Alpha FC", "Zeta FC"]);
  });

  it("time com 0 jogos finalizados aparece com linha zerada", () => {
    const matches = [
      ligaMatch({ id: "m1", homeTeamId: "a", awayTeamId: "b", status: "scheduled", homeScore: null, awayScore: null }),
    ];
    const table = computeLeagueStandings(matches, teams([
      ["a", { name: "Alpha" }],
      ["b", { name: "Beta" }],
    ]));
    expect(table).toHaveLength(2);
    expect(table.every((r) => r.played === 0 && r.points === 0 && r.goalDifference === 0)).toBe(true);
  });

  it("universo de times deriva das partidas mesmo sem entrada no map de display → name = teamId (fallback)", () => {
    const matches = [
      ligaMatch({ id: "m1", homeTeamId: "known", awayTeamId: "orphan", status: "finished", homeScore: 1, awayScore: 0 }),
    ];
    // 'orphan' não está no map → fallback name = teamId, sem crest.
    const table = computeLeagueStandings(matches, teams([
      ["known", { name: "Known FC", crestUrl: "https://cdn.espn.com/known.png" }],
    ]));

    const orphan = table.find((r) => r.team.id === "orphan")!;
    expect(orphan.team.name).toBe("orphan");
    expect(orphan.team.crestUrl).toBeUndefined();

    const known = table.find((r) => r.team.id === "known")!;
    expect(known.team.name).toBe("Known FC");
    expect(known.team.crestUrl).toBe("https://cdn.espn.com/known.png");
  });

  it("é robusta a lista vazia de partidas", () => {
    expect(computeLeagueStandings([], teams([]))).toEqual([]);
  });

  it("ignora partidas que não são de liga (stage != 'liga')", () => {
    const matches = [
      ligaMatch({ id: "m1", homeTeamId: "a", awayTeamId: "b", status: "finished", homeScore: 2, awayScore: 0, stage: "grupos" as MatchWithId["stage"] }),
    ];
    const table = computeLeagueStandings(matches, teams([
      ["a", { name: "Alpha" }],
      ["b", { name: "Beta" }],
    ]));
    // Partida de grupos ignorada → nenhum time entra na tabela de liga.
    expect(table).toEqual([]);
  });
});
