/**
 * Lib pura de classificação de grupo, melhores terceiros e progresso (TASK-02).
 * Sem React, sem Firebase — testável em isolamento.
 * Consumida pelas telas PRD03-01 (Hub), PRD03-04 (classificação),
 * PRD03-06 (melhores terceiros) e pela lib de bracket (TASK-03).
 */

import type { MatchWithId, Prediction, Stage } from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída (exportados)
// ---------------------------------------------------------------------------

/** Linha de uma tabela de classificação prevista de grupo. */
export interface GroupStandingEntry {
  /** ID do time (teamId, igual a homeTeamId/awayTeamId em MatchWithId). */
  teamId: string;
  /** Jogos disputados (com palpite preenchido pelo usuário). */
  played: number;
  /** Vitórias previstas. */
  wins: number;
  /** Empates previstos. */
  draws: number;
  /** Derrotas previstas. */
  losses: number;
  /** Gols pró (marcados pelo time nos palpites do usuário). */
  goalsFor: number;
  /** Gols contra (sofridos pelo time nos palpites do usuário). */
  goalsAgainst: number;
  /** Saldo de gols (goalsFor - goalsAgainst). */
  goalDifference: number;
  /** Pontos (vitória=3, empate=1, derrota=0). */
  points: number;
  /** Posição final na tabela (1-based, pós-ordenação). */
  position: number;
}

/** Tabela de classificação prevista de um grupo (4 times, ordenada). */
export type GroupStandings = GroupStandingEntry[];

/**
 * Tabela de todos os grupos, indexada por groupId.
 * Ex.: { "group-a": [...4 entries], "group-b": [...4 entries], ... }
 */
export type AllGroupStandings = Record<string, GroupStandings>;

/**
 * Resultado de deriveWinner.
 * Em eliminatórias, empate requer tratamento especial na UI.
 */
export interface WinnerResult {
  /** ID do time vencedor, ou null em caso de empate. */
  winnerId: string | null;
  /** ID do time perdedor, ou null em caso de empate. */
  loserId: string | null;
  /** true quando homeScore === awayScore (empate de placar previsto). */
  isDraw: boolean;
  /** Placar previsto do mandante. */
  homeScore: number;
  /** Placar previsto do visitante. */
  awayScore: number;
}

/**
 * Métricas de progresso de preenchimento de palpites.
 * "preenchido" = prediction existe para o matchId (via predictions array).
 */
export interface ProgressMetrics {
  /** Número de palpites preenchidos no escopo. */
  filled: number;
  /** Total de partidas no escopo. */
  total: number;
  /** Percentual de preenchimento (0–100, arredondado para 1 casa decimal). */
  percentage: number;
}

/**
 * Progresso global + por fase.
 * A chave "global" agrega todas as partidas; as demais são valores de Stage.
 */
export interface ComputeProgressResult {
  /** Progresso agregando todas as partidas da lista `matches`. */
  global: ProgressMetrics;
  /** Progresso por fase (stage). Inclui apenas fases com ao menos 1 partida. */
  byStage: Partial<Record<Stage, ProgressMetrics>>;
}

// ---------------------------------------------------------------------------
// Helpers internos (não exportados)
// ---------------------------------------------------------------------------

/** Inicializa uma entrada de tabela zerada para um time. */
function initEntry(teamId: string): GroupStandingEntry {
  return {
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    position: 0,
  };
}

/** Aplica o resultado de uma partida prevista às entradas de dois times. */
function applyResult(
  home: GroupStandingEntry,
  away: GroupStandingEntry,
  homeScore: number,
  awayScore: number,
): void {
  home.played += 1;
  away.played += 1;

  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  home.goalDifference = home.goalsFor - home.goalsAgainst;

  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (homeScore > awayScore) {
    home.wins += 1;
    home.points += 3;
    away.losses += 1;
  } else if (awayScore > homeScore) {
    away.wins += 1;
    away.points += 3;
    home.losses += 1;
  } else {
    home.draws += 1;
    home.points += 1;
    away.draws += 1;
    away.points += 1;
  }
}

/**
 * Calcula a sub-tabela de confronto direto entre um grupo de times empatados.
 * Retorna um Map de teamId → { points, gd, gf } no contexto do sub-grupo.
 */
function headToHeadSubTable(
  teamIds: string[],
  matches: MatchWithId[],
  predMap: Map<string, Prediction>,
): Map<string, { points: number; gd: number; gf: number }> {
  const teamSet = new Set(teamIds);
  const stats = new Map<string, { points: number; gd: number; gf: number }>();
  for (const id of teamIds) {
    stats.set(id, { points: 0, gd: 0, gf: 0 });
  }

  for (const match of matches) {
    if (!teamSet.has(match.homeTeamId) || !teamSet.has(match.awayTeamId))
      continue;
    const pred = predMap.get(match.id);
    if (!pred) continue;

    const hs = pred.homeScore;
    const as_ = pred.awayScore;
    const home = stats.get(match.homeTeamId)!;
    const away = stats.get(match.awayTeamId)!;

    home.gf += hs;
    home.gd += hs - as_;
    away.gf += as_;
    away.gd += as_ - hs;

    if (hs > as_) {
      home.points += 3;
    } else if (as_ > hs) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return stats;
}

/**
 * Ordena entries de standings aplicando critérios multi-nível com sub-tabela h2h
 * para grupos de times empatados em pontos/saldo/gols pró.
 *
 * Algoritmo:
 * 1. Ordenar globalmente por pts → gd → gf → teamId (sem h2h ainda).
 * 2. Identificar blocos contíguos com pts/gd/gf idênticos.
 * 3. Para cada bloco com 2+ times: calcular sub-tabela h2h entre eles.
 * 4. Ordenar o bloco por sub-tabela pts → gd → gf → teamId (recursivo para sub-blocos se necessário).
 */
function sortStandings(
  entries: GroupStandingEntry[],
  matches: MatchWithId[],
  predMap: Map<string, Prediction>,
): void {
  // 1. Ordenação base (sem h2h): pts DESC → gd DESC → gf DESC → teamId ASC
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
  });

  // 2. Identificar blocos empatados em pts/gd/gf e aplicar h2h sub-tabela
  let i = 0;
  while (i < entries.length) {
    const current = entries[i]!;
    let j = i + 1;
    // Avançar j enquanto próximo entry tem mesmos pts/gd/gf
    while (
      j < entries.length &&
      entries[j]!.points === current.points &&
      entries[j]!.goalDifference === current.goalDifference &&
      entries[j]!.goalsFor === current.goalsFor
    ) {
      j++;
    }

    // Bloco de [i, j) está empatado em pts/gd/gf
    if (j - i > 1) {
      const block = entries.slice(i, j);
      sortBlockByH2H(block, matches, predMap);
      // Escrever de volta na posição correta
      for (let k = 0; k < block.length; k++) {
        entries[i + k] = block[k]!;
      }
    }

    i = j;
  }
}

/**
 * Ordena um bloco de times empatados usando sub-tabela de confronto direto.
 * Se o bloco tiver sub-blocos ainda empatados após h2h, aplica teamId ASC.
 */
function sortBlockByH2H(
  block: GroupStandingEntry[],
  matches: MatchWithId[],
  predMap: Map<string, Prediction>,
): void {
  const teamIds = block.map((e) => e.teamId);
  const h2hStats = headToHeadSubTable(teamIds, matches, predMap);

  // Verificar se h2h sub-tabela quebra algum empate
  const allH2HSame = block.every((e) => {
    const stats = h2hStats.get(e.teamId)!;
    const first = h2hStats.get(block[0]!.teamId)!;
    return (
      stats.points === first.points &&
      stats.gd === first.gd &&
      stats.gf === first.gf
    );
  });

  if (allH2HSame) {
    // Sub-tabela também empatada: aplicar teamId ASC como critério final
    block.sort((a, b) => a.teamId.localeCompare(b.teamId));
    return;
  }

  // Ordenar o bloco pela sub-tabela h2h: pts → gd → gf → teamId ASC
  block.sort((a, b) => {
    const sa = h2hStats.get(a.teamId)!;
    const sb = h2hStats.get(b.teamId)!;
    if (sb.points !== sa.points) return sb.points - sa.points;
    if (sb.gd !== sa.gd) return sb.gd - sa.gd;
    if (sb.gf !== sa.gf) return sb.gf - sa.gf;
    return a.teamId.localeCompare(b.teamId);
  });
}

/** Calcula ProgressMetrics a partir de contadores. */
function toMetrics(filled: number, total: number): ProgressMetrics {
  const percentage =
    total > 0 ? Math.round((filled / total) * 1000) / 10 : 0;
  return { filled, total, percentage };
}

// ---------------------------------------------------------------------------
// Funções exportadas
// ---------------------------------------------------------------------------

/**
 * Calcula a tabela de classificação prevista de um grupo a partir dos palpites do usuário.
 *
 * Usa os placares PREVISTOS (prediction.homeScore / prediction.awayScore),
 * não os resultados reais. Partidas sem palpite são ignoradas (não contam pontos).
 *
 * Desempate (ordem de aplicação — critério FIFA padrão, A7 do PRD):
 * 1. Pontos (decrescente)
 * 2. Saldo de gols (decrescente)
 * 3. Gols pró (decrescente)
 * 4. Confronto direto — pontos entre os times empatados nos critérios 1-3
 *    (se mais de 2 times empatados: saldo entre eles → gols pró entre eles)
 * 5. Sorteio determinístico: ordenar por teamId ASC (estabilidade entre renders)
 *
 * @param matches    - Todas as partidas do grupo (stage === "grupos", mesmo groupId).
 *                     Deve conter apenas partidas do grupo em questão.
 * @param predictions - Palpites do usuário (podem cobrir qualquer matchId;
 *                      a função filtra os relevantes pelo matchId das partidas).
 * @returns Tabela ordenada com posição 1–4 atribuída (position = índice + 1).
 */
export function computeGroupStandings(
  matches: MatchWithId[],
  predictions: Prediction[],
): GroupStandings {
  // 1. Coletar times únicos
  const teamIdSet = new Set<string>();
  for (const match of matches) {
    teamIdSet.add(match.homeTeamId);
    teamIdSet.add(match.awayTeamId);
  }

  // 2. Inicializar entradas
  const entryMap = new Map<string, GroupStandingEntry>();
  for (const teamId of teamIdSet) {
    entryMap.set(teamId, initEntry(teamId));
  }

  // 3. Indexar palpites por matchId (último prevalece em caso de duplicatas)
  const predMap = new Map<string, Prediction>();
  for (const pred of predictions) {
    predMap.set(pred.matchId, pred);
  }

  // 4. Iterar partidas e aplicar resultados
  for (const match of matches) {
    const pred = predMap.get(match.id);
    if (!pred) continue; // partida sem palpite — ignorar

    const homeEntry = entryMap.get(match.homeTeamId);
    const awayEntry = entryMap.get(match.awayTeamId);
    if (!homeEntry || !awayEntry) continue;

    applyResult(homeEntry, awayEntry, pred.homeScore, pred.awayScore);
  }

  // 5. Ordenação multi-critério com sub-tabela de confronto direto para grupos empatados
  const entries = Array.from(entryMap.values());
  sortStandings(entries, matches, predMap);

  // 6. Atribuir position (1-based)
  for (let i = 0; i < entries.length; i++) {
    entries[i]!.position = i + 1;
  }

  return entries;
}

/**
 * Seleciona e ordena os 8 melhores terceiros colocados (posição 3 de cada grupo)
 * a partir das tabelas de todos os grupos. Critério FIFA Copa 2026.
 *
 * Critério de ordenação (decrescente — melhor 3º primeiro):
 * 1. Pontos (decrescente)
 * 2. Saldo de gols (decrescente)
 * 3. Gols pró (decrescente)
 * 4. Sorteio determinístico: teamId ASC (estabilidade entre renders)
 *
 * Decisão A2 do PRD: esta classificação é VISUAL, não pontuada.
 * Decisão A7: sem fair play e sem ajuste manual.
 *
 * @param allGroupStandings - Tabelas de todos os grupos (Record<groupId, GroupStandings>).
 *                            Espera-se uma tabela ordenada por grupo (pós-computeGroupStandings).
 * @returns Array de 8 GroupStandingEntry (ou menos se houver < 8 grupos com 3º colocado),
 *          ordenado do melhor ao pior terceiro.
 */
export function rankBestThirds(
  allGroupStandings: AllGroupStandings,
): GroupStandingEntry[] {
  // 1. Extrair o 3º colocado (position === 3) de cada grupo
  const thirds: GroupStandingEntry[] = [];
  for (const standings of Object.values(allGroupStandings)) {
    const third = standings.find((e) => e.position === 3);
    if (third) {
      thirds.push(third);
    }
  }

  // 2. Ordenar pelo mesmo critério simplificado (sem h2h — apenas pontos/saldo/gols/teamId)
  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
  });

  // 3. Retornar os primeiros 8
  return thirds.slice(0, 8);
}

/**
 * Deriva o vencedor de um confronto eliminatório a partir do placar previsto.
 *
 * Usado nas telas de bracket (PRD03-07…11) para projetar o avanço na chave.
 * Em caso de empate, retorna winnerId: null e isDraw: true — a UI deve exigir
 * que o usuário ajuste o placar (placares empatados são inválidos em eliminatórias).
 *
 * Decisão A1 do PRD: eliminatória pontua placar exato; vencedor é DERIVADO do placar.
 *
 * @param homeTeamId  - ID do time mandante.
 * @param awayTeamId  - ID do time visitante.
 * @param homeScore   - Placar previsto do mandante (inteiro ≥ 0).
 * @param awayScore   - Placar previsto do visitante (inteiro ≥ 0).
 * @returns WinnerResult com winnerId, loserId, isDraw e os placares.
 */
export function deriveWinner(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
): WinnerResult {
  if (homeScore > awayScore) {
    return {
      winnerId: homeTeamId,
      loserId: awayTeamId,
      isDraw: false,
      homeScore,
      awayScore,
    };
  }

  if (awayScore > homeScore) {
    return {
      winnerId: awayTeamId,
      loserId: homeTeamId,
      isDraw: false,
      homeScore,
      awayScore,
    };
  }

  // Empate
  return {
    winnerId: null,
    loserId: null,
    isDraw: true,
    homeScore,
    awayScore,
  };
}

/**
 * Sobrecarga conveniente: recebe um palpite e a partida correspondente.
 * Equivalente a chamar deriveWinner(match.homeTeamId, match.awayTeamId, pred.homeScore, pred.awayScore).
 *
 * @param prediction - Palpite do usuário.
 * @param match      - Partida correspondente (fonte de homeTeamId/awayTeamId).
 * @returns WinnerResult com winnerId, loserId, isDraw e os placares.
 */
export function deriveWinnerFromPrediction(
  prediction: Prediction,
  match: MatchWithId,
): WinnerResult {
  return deriveWinner(
    match.homeTeamId,
    match.awayTeamId,
    prediction.homeScore,
    prediction.awayScore,
  );
}

/**
 * Calcula métricas de preenchimento de palpites: global e por fase (stage).
 *
 * "Preenchido" = existe ao menos um Prediction no array com matchId === match.id.
 * Partidas de qualquer stage são consideradas; a função não filtra por groupId.
 *
 * @param predictions - Array de palpites do usuário (de qualquer partida).
 * @param matches     - Array de partidas a considerar (escopo total ou filtrado pelo chamador).
 * @returns ComputeProgressResult com global e byStage.
 */
export function computeProgress(
  predictions: Prediction[],
  matches: MatchWithId[],
): ComputeProgressResult {
  // 1. Construir Set de matchIds com palpite preenchido
  const filledMatchIds = new Set<string>(predictions.map((p) => p.matchId));

  // 2. Contadores globais e por stage
  let globalFilled = 0;
  let globalTotal = 0;
  const stageCounters = new Map<Stage, { filled: number; total: number }>();

  for (const match of matches) {
    globalTotal += 1;
    const isFilled = filledMatchIds.has(match.id);
    if (isFilled) globalFilled += 1;

    // Por stage
    const existing = stageCounters.get(match.stage);
    if (existing) {
      existing.total += 1;
      if (isFilled) existing.filled += 1;
    } else {
      stageCounters.set(match.stage, { filled: isFilled ? 1 : 0, total: 1 });
    }
  }

  // 3. Montar byStage (apenas stages com total > 0)
  const byStage: Partial<Record<Stage, ProgressMetrics>> = {};
  for (const [stage, counters] of stageCounters) {
    byStage[stage] = toMetrics(counters.filled, counters.total);
  }

  return {
    global: toMetrics(globalFilled, globalTotal),
    byStage,
  };
}
