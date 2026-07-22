/**
 * Cálculo da classificação de liga de pontos corridos (TASK-20,
 * multi-championship-launch).
 *
 * Função pura — sem I/O, sem `Date.now`, determinística. Como os módulos puros
 * de `copaData`/`worldcup`, NÃO carrega `import "server-only"` (só o barrel
 * carrega; `server-only` envenena o ambiente node do Vitest).
 *
 * Divergências vs `computeGroupStandings` (Copa):
 *  - Tabela ÚNICA (liga não tem grupos), não uma por groupId.
 *  - SEM qualificação/badges (liga tem só posição numérica).
 *  - Desempate SIMPLES pts → saldo → gols-pró → nome (sem mini-tabela H2H).
 *  - Universo de times derivado das PRÓPRIAS partidas de liga (home/away de
 *    todos os eventos `stage === "liga"`), não de um registry — clubes não estão
 *    no `TEAM_REGISTRY` (só 48 seleções).
 *  - Display (name/crest) injetado via Map (extraído dos competidores ESPN);
 *    ausente → `name` = teamId (fallback), sem crest.
 */

import type { MatchWithId } from "@/types/matches";

// ─── Contrato público ────────────────────────────────────────────────────────

/** Time de uma linha da tabela (display resolvido). */
export interface LeagueStandingTeam {
  id: string;
  name: string;
  crestUrl?: string;
}

/** Uma linha da tabela de classificação. */
export interface LeagueStanding {
  position: number;
  team: LeagueStandingTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/** Mapa de display de clube (id ESPN → nome/escudo). */
export type LeagueTeamDisplay = Map<string, { name: string; crestUrl?: string }>;

// ─── Estrutura de trabalho interna ───────────────────────────────────────────

interface Stat {
  id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function emptyStat(id: string): Stat {
  return {
    id,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function goalDifference(s: Stat): number {
  return s.goalsFor - s.goalsAgainst;
}

// ─── Filtragem ────────────────────────────────────────────────────────────────

function isLeagueMatch(m: MatchWithId): boolean {
  return m.stage === "liga";
}

function isFinished(m: MatchWithId): boolean {
  return m.status === "finished";
}

// ─── Apuração ─────────────────────────────────────────────────────────────────

/**
 * Aplica uma partida finalizada às estatísticas dos dois clubes.
 * Pressupõe placares não-nulos (garantido por `matchSchema` quando `finished`).
 */
function applyMatch(home: Stat, away: Stat, homeScore: number, awayScore: number): void {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;

  if (homeScore > awayScore) {
    home.wins += 1;
    home.points += 3;
    away.losses += 1;
  } else if (homeScore < awayScore) {
    away.wins += 1;
    away.points += 3;
    home.losses += 1;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }
}

// ─── Display ──────────────────────────────────────────────────────────────────

/**
 * Resolve o display de um clube: nome do map (`displayName` ESPN) ou fallback
 * para o próprio teamId (nunca string vazia); crest opcional.
 */
function resolveTeam(id: string, display: LeagueTeamDisplay): LeagueStandingTeam {
  const entry = display.get(id);
  const name = entry?.name && entry.name.length > 0 ? entry.name : id;
  return entry?.crestUrl !== undefined
    ? { id, name, crestUrl: entry.crestUrl }
    : { id, name };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Computa a tabela única de classificação de uma liga de pontos corridos.
 *
 * @param matches partidas (qualquer stage/status — filtra `stage === "liga"`).
 * @param teams   mapa de display id → {name, crestUrl?} (dos competidores ESPN).
 * @returns tabela ordenada por pts → saldo → gols-pró → nome; `position` 1-based.
 */
export function computeLeagueStandings(
  matches: MatchWithId[],
  teams: LeagueTeamDisplay,
): LeagueStanding[] {
  const leagueMatches = matches.filter(isLeagueMatch);

  // 1) Universo de times = todos os home/away das partidas de liga (mesmo com 0
  //    jogos finalizados). Uma linha por clube distinto.
  const stats = new Map<string, Stat>();
  const ensure = (id: string): Stat => {
    let s = stats.get(id);
    if (!s) {
      s = emptyStat(id);
      stats.set(id, s);
    }
    return s;
  };
  for (const m of leagueMatches) {
    ensure(m.homeTeamId);
    ensure(m.awayTeamId);
  }

  // 2) Aplica só as partidas finalizadas.
  for (const m of leagueMatches) {
    if (!isFinished(m)) continue;
    const home = stats.get(m.homeTeamId);
    const away = stats.get(m.awayTeamId);
    if (!home || !away) continue;
    // homeScore/awayScore não-nulos em partidas finalizadas.
    applyMatch(home, away, m.homeScore!, m.awayScore!);
  }

  // 3) Resolve display e ordena pts → saldo → gols-pró → nome (determinístico).
  const rows = [...stats.values()].map((s) => ({
    stat: s,
    team: resolveTeam(s.id, teams),
  }));

  rows.sort((a, b) => {
    if (b.stat.points !== a.stat.points) return b.stat.points - a.stat.points;
    const gdA = goalDifference(a.stat);
    const gdB = goalDifference(b.stat);
    if (gdB !== gdA) return gdB - gdA;
    if (b.stat.goalsFor !== a.stat.goalsFor) return b.stat.goalsFor - a.stat.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  });

  // 4) Monta as linhas com `position` 1-based.
  return rows.map((r, i) => ({
    position: i + 1,
    team: r.team,
    played: r.stat.played,
    wins: r.stat.wins,
    draws: r.stat.draws,
    losses: r.stat.losses,
    goalsFor: r.stat.goalsFor,
    goalsAgainst: r.stat.goalsAgainst,
    goalDifference: goalDifference(r.stat),
    points: r.stat.points,
  }));
}
