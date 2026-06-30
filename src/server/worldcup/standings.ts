/**
 * Cálculo da classificação da fase de grupos da Copa.
 *
 * Função pura — sem I/O, sem Date.now, determinística. Como os demais módulos
 * puros de `copaData`, NÃO carrega `import "server-only"` (só o barrel `index.ts`
 * carrega, pois `server-only` envenena o ambiente node do Vitest). Logo, este
 * módulo é livre de `server-only`.
 *
 * Regras de ordenação/desempate (critérios FIFA 1–4 + fallback determinístico):
 *  1. pontos desc → saldo desc → gols-pró desc (sobre TODOS os jogos do grupo).
 *  2. Para cada subconjunto MAXIMAL ainda empatado nos três acima: mini-tabela de
 *     confronto direto (só partidas finalizadas ENTRE os empatados), reordena por
 *     pts/saldo/gols-pró da mini; recursão em cada sub-subconjunto ainda empatado,
 *     restringindo a mini aos jogos entre eles.
 *  3. Se uma mini-tabela não separa NINGUÉM (subconjunto inalterado), para e cai no
 *     fallback alfabético `name.localeCompare`. Os critérios FIFA 5–6 (fair play e
 *     sorteio) NÃO são computáveis a partir dos dados do openfootball, então usamos
 *     ordem alfabética determinística no lugar deles.
 */

import type { MatchWithId } from "@/types/matches";
import type { TeamWithId } from "@/types/teams";
import type {
  GroupStanding,
  GroupTable,
  Qualification,
} from "@/types/worldcup";

// ─── Estrutura de trabalho interna ───────────────────────────────────────────

/** Estatística acumulada de uma seleção (mutável durante a apuração). */
interface Stat {
  team: TeamWithId;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function emptyStat(team: TeamWithId): Stat {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

/** Saldo de gols de uma estatística. */
function goalDifference(s: Stat): number {
  return s.goalsFor - s.goalsAgainst;
}

// ─── Filtragem de partidas ───────────────────────────────────────────────────

/**
 * Mantém só partidas de fase de grupos com groupId presente. Não filtra por
 * status aqui — partidas agendadas ainda contam para "grupo incompleto".
 */
function isGroupMatch(m: MatchWithId): boolean {
  return m.stage === "grupos" && m.groupId !== null && m.groupId !== undefined;
}

function isFinished(m: MatchWithId): boolean {
  return m.status === "finished";
}

// ─── Apuração das estatísticas de um grupo ───────────────────────────────────

/**
 * Aplica uma partida finalizada às estatísticas dos dois times.
 * Pressupõe placares não-nulos (garantido por matchSchema quando finished).
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

// ─── Mini-tabela de confronto direto ─────────────────────────────────────────

/**
 * Constrói uma mini-tabela restrita a um subconjunto de times, contando apenas
 * as partidas finalizadas ENTRE eles. Devolve um Map id → Stat (estatística da
 * mini, zerada e recomputada do zero sobre os confrontos diretos).
 */
function buildMiniTable(
  subset: Stat[],
  finishedMatches: MatchWithId[],
): Map<string, Stat> {
  const ids = new Set(subset.map((s) => s.team.id));
  const mini = new Map<string, Stat>();
  for (const s of subset) {
    mini.set(s.team.id, emptyStat(s.team));
  }

  for (const m of finishedMatches) {
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) continue;
    const home = mini.get(m.homeTeamId);
    const away = mini.get(m.awayTeamId);
    if (!home || !away) continue;
    // homeScore/awayScore são não-nulos em partidas finalizadas.
    applyMatch(home, away, m.homeScore!, m.awayScore!);
  }

  return mini;
}

// ─── Comparadores ─────────────────────────────────────────────────────────────

/** Compara por pts desc → saldo desc → gols-pró desc. Retorna 0 se empatados nos três. */
function compareByOverall(a: Stat, b: Stat): number {
  if (b.points !== a.points) return b.points - a.points;
  const sa = goalDifference(a);
  const sb = goalDifference(b);
  if (sb !== sa) return sb - sa;
  return b.goalsFor - a.goalsFor;
}

/** Iguais nos três critérios principais (pts/saldo/gols-pró)? */
function tiedOnOverall(a: Stat, b: Stat): boolean {
  return (
    a.points === b.points &&
    goalDifference(a) === goalDifference(b) &&
    a.goalsFor === b.goalsFor
  );
}

/** Fallback terminal: ordem alfabética determinística por name (localeCompare). */
function compareAlphabetical(a: Stat, b: Stat): number {
  return a.team.name.localeCompare(b.team.name);
}

// ─── Ordenação com desempate recursivo ───────────────────────────────────────

/**
 * Ordena `stats` aplicando o critério geral e, para cada bloco maximal ainda
 * empatado, o desempate por confronto direto (mini-tabela) recursivo.
 *
 * @param stats           subconjunto a ordenar
 * @param finishedMatches todas as partidas finalizadas do grupo (a mini-tabela
 *                        filtra internamente os confrontos relevantes)
 * @param useMini         quando true, separa blocos empatados via mini-tabela;
 *                        quando false (mini-tabela não separou), cai no alfabético
 */
function orderStats(
  stats: Stat[],
  finishedMatches: MatchWithId[],
  useMini: boolean,
): Stat[] {
  if (stats.length <= 1) return [...stats];

  // 1) Ordena pelo critério vigente (geral ou da mini-tabela já embutida em stats).
  const sorted = [...stats].sort(compareByOverall);

  // 2) Agrupa em blocos maximais empatados em pts/saldo/gols-pró.
  const blocks: Stat[][] = [];
  let current: Stat[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (tiedOnOverall(prev, cur)) {
      current.push(cur);
    } else {
      blocks.push(current);
      current = [cur];
    }
  }
  blocks.push(current);

  // 3) Resolve cada bloco empatado (length > 1) por confronto direto / fallback.
  const result: Stat[] = [];
  for (const block of blocks) {
    if (block.length === 1) {
      result.push(block[0]!);
      continue;
    }
    result.push(...resolveTiedBlock(block, finishedMatches, useMini));
  }
  return result;
}

/**
 * Resolve um bloco de times empatados nos critérios gerais.
 *  - Se já estamos sem mini disponível (useMini=false) → fallback alfabético.
 *  - Senão, monta a mini-tabela (confrontos entre os empatados), reordena por
 *    pts/saldo/gols-pró da mini e recursa nos sub-blocos ainda empatados.
 *  - Se a mini NÃO separa ninguém (todos ainda empatados na mini) → fallback
 *    alfabético determinístico (critérios FIFA 5–6 não computáveis).
 */
function resolveTiedBlock(
  block: Stat[],
  finishedMatches: MatchWithId[],
  useMini: boolean,
): Stat[] {
  if (!useMini) {
    return [...block].sort(compareAlphabetical);
  }

  const mini = buildMiniTable(block, finishedMatches);
  const miniStats = block.map((s) => mini.get(s.team.id)!);

  // A mini separou alguém? Verifica se TODOS continuam empatados entre si.
  const first = miniStats[0]!;
  const allMiniTied = miniStats.every((s) => tiedOnOverall(s, first));
  if (allMiniTied) {
    // Confronto direto não separou nada → fallback alfabético terminal.
    return [...block].sort(compareAlphabetical);
  }

  // Ordena o bloco pela mini-tabela; recursa nos sub-blocos ainda empatados,
  // restringindo a mini aos jogos entre eles (RECURSÃO).
  const orderedMini = orderStats(miniStats, finishedMatches, true);

  // Mapeia de volta da estatística-mini para a estatística-geral original.
  const byId = new Map(block.map((s) => [s.team.id, s]));
  return orderedMini.map((ms) => byId.get(ms.team.id)!);
}

// ─── Qualificação ─────────────────────────────────────────────────────────────

/**
 * Determina as badges de classificação de um grupo já ordenado.
 *  - Incompleto (qualquer partida não finalizada OU menos de 6 partidas do grupo
 *    presentes nos dados) → todos "indefinido".
 *  - Completo → 1º/2º "classificado", 3º "possivel", ≥4º "eliminado" (defensivo
 *    para grupos com mais de 4 times).
 */
function qualificationFor(position: number, complete: boolean): Qualification {
  if (!complete) return "indefinido";
  if (position <= 2) return "classificado";
  if (position === 3) return "possivel";
  return "eliminado";
}

// ─── Montagem da linha de saída ──────────────────────────────────────────────

function toGroupStanding(s: Stat, position: number, complete: boolean): GroupStanding {
  const { flagUrl } = s.team;
  return {
    position,
    team: {
      id: s.team.id,
      name: s.team.name,
      code: s.team.code,
      // Omite a chave quando ausente — JSON limpo (schema aceita optional).
      ...(flagUrl !== undefined ? { flagUrl } : {}),
    },
    played: s.played,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    goalsFor: s.goalsFor,
    goalsAgainst: s.goalsAgainst,
    goalDifference: goalDifference(s),
    points: s.points,
    qualification: qualificationFor(position, complete),
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Computa as tabelas de classificação de todos os grupos.
 *
 * @param matches partidas (qualquer fase/status — filtradas internamente)
 * @param teams   seleções; cada uma com groupId define em qual tabela entra.
 *                Times sem groupId ficam fora de qualquer tabela.
 * @returns       tabelas ordenadas por groupId asc; standings por position asc.
 */
export function computeGroupStandings(
  matches: MatchWithId[],
  teams: TeamWithId[],
): GroupTable[] {
  // 1) Times com groupId → uma linha por time no seu grupo (mesmo com 0 jogos).
  const groupStats = new Map<string, Map<string, Stat>>();
  const teamIds = new Set<string>();
  for (const t of teams) {
    teamIds.add(t.id);
    if (t.groupId === undefined) continue; // sem grupo → fora das tabelas
    let g = groupStats.get(t.groupId);
    if (!g) {
      g = new Map<string, Stat>();
      groupStats.set(t.groupId, g);
    }
    g.set(t.id, emptyStat(t));
  }

  // 2) Partidas de grupo (qualquer status) agrupadas por groupId — usadas tanto
  //    para apurar finalizadas quanto para aferir completude.
  const groupMatches = new Map<string, MatchWithId[]>();
  for (const m of matches) {
    if (!isGroupMatch(m)) continue;
    // Ignora partida que referencia teamId ausente de `teams` (robustez).
    if (!teamIds.has(m.homeTeamId) || !teamIds.has(m.awayTeamId)) continue;
    const gid = m.groupId as string;
    const list = groupMatches.get(gid);
    if (list) list.push(m);
    else groupMatches.set(gid, [m]);
  }

  // 3) Aplica partidas finalizadas às estatísticas do grupo.
  for (const [gid, list] of groupMatches) {
    const g = groupStats.get(gid);
    if (!g) continue; // grupo sem times cadastrados (não deveria ocorrer)
    for (const m of list) {
      if (!isFinished(m)) continue;
      const home = g.get(m.homeTeamId);
      const away = g.get(m.awayTeamId);
      if (!home || !away) continue; // time não pertence a este grupo
      applyMatch(home, away, m.homeScore!, m.awayScore!);
    }
  }

  // 4) Monta cada tabela: ordena com desempate e atribui badges.
  const tables: GroupTable[] = [];
  for (const [gid, statsMap] of groupStats) {
    const stats = [...statsMap.values()];
    const groupAllMatches = groupMatches.get(gid) ?? [];
    const finished = groupAllMatches.filter(isFinished);

    // Completude: 6 partidas do grupo presentes E todas finalizadas.
    const complete =
      groupAllMatches.length >= 6 &&
      groupAllMatches.every(isFinished) &&
      finished.length >= 6;

    const ordered = orderStats(stats, finished, true);

    const standings = ordered.map((s, i) =>
      toGroupStanding(s, i + 1, complete),
    );
    tables.push({ groupId: gid, standings });
  }

  // 5) Grupos ordenados por groupId asc.
  tables.sort((a, b) => a.groupId.localeCompare(b.groupId));
  return tables;
}
