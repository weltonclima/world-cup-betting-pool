/**
 * Lib pura da chave eliminatória derivada dos fixtures de mata-mata (TASK-03).
 * Sem React, sem Firebase — testável em isolamento.
 *
 * Consome MatchWithId[] com placeholders openfootball preservados em
 * homeTeamId/awayTeamId (D-OF4 do PRD) e classificações previstas (TASK-02)
 * para projetar a chave a partir das previsões do usuário.
 *
 * Consumida pelas telas PRD03-07…12 (bracket interativo) e PRD03-06 (TASK-12: CTA gerar chave).
 */

import type { MatchWithId, Stage } from "@/types";
import type { AllGroupStandings, GroupStandingEntry } from "./standings";

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

/**
 * Origem de um slot na chave.
 * - "group-winner"    → 1º do grupo (ex.: placeholder "1A")
 * - "group-runner-up" → 2º do grupo (ex.: placeholder "2B")
 * - "best-third"      → melhor 3º de um conjunto de grupos (ex.: placeholder "3ABC")
 * - "match-winner"    → vencedor do jogo num (ex.: placeholder "W74")
 * - "match-loser"     → perdedor do jogo num (ex.: placeholder "L101") — usado em terceiro lugar
 * - "resolved"        → teamId real já conhecido (sem ambiguidade)
 */
export type SlotOrigin =
  | "group-winner"
  | "group-runner-up"
  | "best-third"
  | "match-winner"
  | "match-loser"
  | "resolved";

/**
 * Slot de um time numa posição da chave.
 * Antes da resolução: teamId = placeholder literal ("2A", "W74", "3ABC").
 * Após resolução: teamId = código FIFA real ("BRA").
 */
export interface BracketSlot {
  /** Placeholder original do openfootball ou teamId real pós-resolução. */
  teamId: string;
  /** Como este slot foi preenchido/deriva. */
  origin: SlotOrigin;
  /**
   * Metadados de origem:
   * - Para "group-winner"/"group-runner-up": { groupId: "A" }
   * - Para "best-third": { candidateGroups: ["A","B","C"] }
   * - Para "match-winner"/"match-loser": { matchNum: 74 }
   * - Para "resolved": {}
   */
  meta: BracketSlotMeta;
}

export type BracketSlotMeta =
  | { groupId: string }
  | { candidateGroups: string[] }
  | { matchNum: number }
  | Record<string, never>;

/**
 * Confronto da chave: um jogo de mata-mata com seus dois slots e o matchId real.
 */
export interface BracketMatchup {
  /** matchId do fixture real (ex.: "m73"). Liga ao palpite pontuável. */
  matchId: string;
  /** Fase do torneio. */
  stage: Stage;
  /** Slot do time mandante (home). */
  home: BracketSlot;
  /** Slot do time visitante (away). */
  away: BracketSlot;
}

/**
 * Estrutura completa da chave, agrupada por fase.
 * Chaves do Record = Stage (ex.: "dezesseis-avos", "oitavas", ...).
 */
export type BracketStructure = Partial<Record<Stage, BracketMatchup[]>>;

/**
 * Resultado de vencedor/perdedor já resolvido numa rodada da chave.
 * Usado como entrada de advanceBracket.
 */
export interface RoundWinner {
  /** matchId do confronto (ex.: "m73"). */
  matchId: string;
  /** teamId real do vencedor (derivado de deriveWinner). null se empate. */
  winnerId: string | null;
  /** teamId real do perdedor (derivado de deriveWinner). null se empate. */
  loserId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers internos (não exportados)
// ---------------------------------------------------------------------------

/** Extrai número do matchId "m{num}" → number. Retorna NaN se não bater. */
function extractMatchNum(matchId: string): number {
  const match = /^m(\d+)$/.exec(matchId);
  return match ? Number(match[1]) : NaN;
}

/** Parseia um team string do openfootball em BracketSlot. */
function parsePlaceholder(raw: string): BracketSlot {
  if (!isPlaceholderId(raw)) {
    return { teamId: raw, origin: "resolved", meta: {} };
  }

  // 1º do grupo: "1A" … "1L"
  const groupWinnerMatch = /^1([A-Z])$/.exec(raw);
  if (groupWinnerMatch) {
    return {
      teamId: raw,
      origin: "group-winner",
      meta: { groupId: groupWinnerMatch[1]! },
    };
  }

  // 2º do grupo: "2A" … "2L"
  const groupRunnerUpMatch = /^2([A-Z])$/.exec(raw);
  if (groupRunnerUpMatch) {
    return {
      teamId: raw,
      origin: "group-runner-up",
      meta: { groupId: groupRunnerUpMatch[1]! },
    };
  }

  // Melhor 3º de um conjunto de grupos: "3ABC", "3DEF", "3ABCD" etc.
  const bestThirdMatch = /^3([A-Z]{2,})$/.exec(raw);
  if (bestThirdMatch) {
    const candidateGroups = [...bestThirdMatch[1]!]; // "ABC" → ["A","B","C"]
    return {
      teamId: raw,
      origin: "best-third",
      meta: { candidateGroups },
    };
  }

  // Vencedor do jogo num: "W73", "W104"
  const matchWinnerMatch = /^W(\d+)$/.exec(raw);
  if (matchWinnerMatch) {
    return {
      teamId: raw,
      origin: "match-winner",
      meta: { matchNum: Number(matchWinnerMatch[1]) },
    };
  }

  // Perdedor do jogo num: "L101", "L102"
  const matchLoserMatch = /^L(\d+)$/.exec(raw);
  if (matchLoserMatch) {
    return {
      teamId: raw,
      origin: "match-loser",
      meta: { matchNum: Number(matchLoserMatch[1]) },
    };
  }

  // Fallback (não deve ocorrer se isPlaceholderId for consistente)
  return { teamId: raw, origin: "resolved", meta: {} };
}

// ---------------------------------------------------------------------------
// Funções exportadas
// ---------------------------------------------------------------------------

/**
 * Retorna true se o id é um placeholder de seeding do openfootball,
 * false se é um teamId real (código FIFA, ex.: "BRA").
 *
 * Formatos de placeholder reconhecidos:
 * - "1A" … "1L"   → 1º do grupo (dígito 1 + letra maiúscula)
 * - "2A" … "2L"   → 2º do grupo (dígito 2 + letra maiúscula)
 * - "3ABC" etc.   → melhor 3º de grupos (dígito 3 + 2+ letras maiúsculas)
 * - "W73"…"W104"  → vencedor do jogo num
 * - "L101"…"L104" → perdedor do jogo num (disputa do 3º lugar)
 *
 * Resolve OQ-1 da TASK-17: detectar placeholder vs teamId real.
 *
 * @param id - String a testar.
 * @returns true se placeholder; false se teamId real.
 */
export function isPlaceholderId(id: string): boolean {
  return /^(\d[A-Z]+|[WL]\d+)$/.test(id);
}

/**
 * Converte um placeholder de seeding do openfootball em rótulo humano pt-BR (TASK-13).
 *
 * Usado pela UI da chave (Bracket/BracketMatchup) para exibir slots de mata-mata
 * cujo time real ainda não foi resolvido (D-OF4 do PRD).
 *
 * - "1A"   → "1º Grupo A"
 * - "2B"   → "2º Grupo B"
 * - "3ABC" → "3º (Grupos A/B/C)"
 * - "W74"  → "Vencedor jogo 74"
 * - "L101" → "Perdedor jogo 101"
 *
 * Se `id` não for um placeholder (teamId real, ex.: "BRA"), retorna o próprio id.
 *
 * @param id - Placeholder literal ou teamId real.
 * @returns Rótulo humano em pt-BR (ou o id original se já resolvido).
 */
export function humanizePlaceholder(id: string): string {
  if (!isPlaceholderId(id)) return id;

  const groupWinner = /^1([A-Z])$/.exec(id);
  if (groupWinner) return `1º Grupo ${groupWinner[1]!}`;

  const groupRunnerUp = /^2([A-Z])$/.exec(id);
  if (groupRunnerUp) return `2º Grupo ${groupRunnerUp[1]!}`;

  const bestThird = /^3([A-Z]{2,})$/.exec(id);
  if (bestThird) {
    const groups = [...bestThird[1]!].join("/");
    return `3º (Grupos ${groups})`;
  }

  const matchWinner = /^W(\d+)$/.exec(id);
  if (matchWinner) return `Vencedor jogo ${matchWinner[1]!}`;

  const matchLoser = /^L(\d+)$/.exec(id);
  if (matchLoser) return `Perdedor jogo ${matchLoser[1]!}`;

  return id;
}

/**
 * Constrói a estrutura de slots da chave eliminatória a partir dos fixtures reais.
 *
 * Consome MatchWithId[] filtrado para partidas de mata-mata (stage !== "grupos").
 * Para cada partida, cria um BracketMatchup com:
 * - matchId real (ex.: "m73")
 * - home e away slots com placeholder ou teamId resolvido
 *
 * Os placeholders ("2A", "1E", "W74", "L101", "3ABC") são preservados como
 * referência de slot — eles codificam o seeding FIFA e serão resolvidos por
 * resolveSlotTeam quando as classificações do usuário estiverem disponíveis.
 *
 * Não filtra internamente por stage — o chamador deve passar apenas fixtures
 * de mata-mata (stage !== "grupos"). Partidas de grupos são ignoradas se passadas
 * (homeTeamId/awayTeamId de grupos são teamIds reais, não placeholders, mas a
 * função não as rejeita explicitamente — apenas produz slots com origin "resolved").
 *
 * @param matches - Array de MatchWithId de mata-mata (stage !== "grupos").
 *                  Geralmente obtido de useMatches() filtrado pelo chamador.
 * @returns BracketStructure agrupada por stage, ordenada por matchId numérico dentro de cada fase.
 */
export function buildBracketFromFixtures(
  matches: MatchWithId[],
): BracketStructure {
  const structure: Partial<Record<Stage, BracketMatchup[]>> = {};

  for (const match of matches) {
    const home = parsePlaceholder(match.homeTeamId);
    const away = parsePlaceholder(match.awayTeamId);

    const matchup: BracketMatchup = {
      matchId: match.id,
      stage: match.stage,
      home,
      away,
    };

    const existing = structure[match.stage];
    if (existing) {
      existing.push(matchup);
    } else {
      structure[match.stage] = [matchup];
    }
  }

  // Ordenar matchups por matchNum crescente dentro de cada fase
  for (const stage of Object.keys(structure) as Stage[]) {
    structure[stage]!.sort(
      (a, b) => extractMatchNum(a.matchId) - extractMatchNum(b.matchId),
    );
  }

  return structure;
}

/**
 * Resolve um placeholder de slot para o teamId previsto pelo usuário.
 *
 * Usa as classificações calculadas pelo usuário (TASK-02) e os vencedores
 * já decididos na chave (bracketResults) para substituir o placeholder
 * pelo teamId real previsto.
 *
 * Se o placeholder não puder ser resolvido (ex.: grupo ainda incompleto,
 * confronto predecessor ainda sem vencedor), retorna null — a UI exibe
 * o placeholder como rótulo humano ("2º do Grupo A").
 *
 * Decisão A6 do PRD: fases futuras bloqueadas até completar a anterior.
 * Esta função é permissiva — retorna null quando não tem dados suficientes,
 * sem lançar erro.
 *
 * @param placeholder     - Placeholder literal (ex.: "2A", "W74", "3ABC").
 *                          Se não for um placeholder (isPlaceholderId = false),
 *                          retorna o próprio id como está (já resolvido).
 * @param standings       - Classificações previstas de todos os grupos
 *                          (AllGroupStandings da TASK-02, indexado por groupId "A"…"L").
 * @param bestThirds      - Os 8 melhores terceiros ordenados (saída de rankBestThirds).
 *                          Necessário para resolver placeholders "3XYZ".
 * @param bracketResults  - Map de matchId → RoundWinner para confrontos já resolvidos
 *                          (vencedores/perdedores previstos pelo usuário via deriveWinner).
 * @returns teamId real previsto (ex.: "BRA"), ou null se não resolvível ainda.
 */
export function resolveSlotTeam(
  placeholder: string,
  standings: AllGroupStandings,
  bestThirds: GroupStandingEntry[],
  bracketResults: Map<string, RoundWinner>,
): string | null {
  // Já é teamId real — retornar como está
  if (!isPlaceholderId(placeholder)) {
    return placeholder;
  }

  // 1º do grupo: "1A"
  const groupWinnerMatch = /^1([A-Z])$/.exec(placeholder);
  if (groupWinnerMatch) {
    const groupId = groupWinnerMatch[1]!;
    const groupStandings = standings[groupId];
    const entry = groupStandings?.find((e) => e.position === 1);
    return entry?.teamId ?? null;
  }

  // 2º do grupo: "2A"
  const groupRunnerUpMatch = /^2([A-Z])$/.exec(placeholder);
  if (groupRunnerUpMatch) {
    const groupId = groupRunnerUpMatch[1]!;
    const groupStandings = standings[groupId];
    const entry = groupStandings?.find((e) => e.position === 2);
    return entry?.teamId ?? null;
  }

  // Melhor 3º de um conjunto de grupos: "3ABC"
  const bestThirdMatch = /^3([A-Z]{2,})$/.exec(placeholder);
  if (bestThirdMatch) {
    const candidateGroupIds = new Set([...bestThirdMatch[1]!]); // "ABC" → {"A","B","C"}

    // Encontrar o primeiro bestThird cujo teamId está na classificação de um dos grupos candidatos
    for (const third of bestThirds) {
      for (const [gId, groupStandings] of Object.entries(standings)) {
        if (!candidateGroupIds.has(gId)) continue;
        const isInGroup = groupStandings.some(
          (e) => e.teamId === third.teamId && e.position === 3,
        );
        if (isInGroup) {
          return third.teamId;
        }
      }
    }
    return null;
  }

  // Vencedor do jogo num: "W73"
  const matchWinnerMatch = /^W(\d+)$/.exec(placeholder);
  if (matchWinnerMatch) {
    const matchNum = matchWinnerMatch[1]!;
    const result = bracketResults.get(`m${matchNum}`);
    return result?.winnerId ?? null;
  }

  // Perdedor do jogo num: "L101"
  const matchLoserMatch = /^L(\d+)$/.exec(placeholder);
  if (matchLoserMatch) {
    const matchNum = matchLoserMatch[1]!;
    const result = bracketResults.get(`m${matchNum}`);
    return result?.loserId ?? null;
  }

  // Placeholder não reconhecido
  return null;
}

/**
 * Projeta a próxima fase da chave a partir dos vencedores previstos de uma rodada.
 *
 * Dado um array de BracketMatchup de uma fase e os vencedores/perdedores previstos
 * (via deriveWinner), retorna um Map de placeholder → teamId resolvido para montar
 * os slots da fase seguinte.
 *
 * Usado pela UI para exibir a chave projetada enquanto o fixture real ainda não
 * tem os times definidos (A6 do PRD). Não persiste nada — é uma projeção em memória.
 *
 * @param round   - Os confrontos da fase atual (ex.: todos os dezesseis-avos).
 * @param winners - Vencedores/perdedores de cada confronto (Map matchId → RoundWinner).
 *                  Obtido via deriveWinner(homeTeamId, awayTeamId, homeScore, awayScore)
 *                  para cada confronto onde o usuário preencheu o placar.
 * @returns Map<string, string> de placeholder → teamId resolvido.
 *          Ex.: { "W73": "BRA", "W74": "ARG", "L73": ... }
 *          Confrontos sem vencedor (isDraw ou sem palpite) não aparecem no Map.
 */
export function advanceBracket(
  round: BracketMatchup[],
  winners: Map<string, RoundWinner>,
): Map<string, string> {
  const result = new Map<string, string>();

  for (const matchup of round) {
    const winner = winners.get(matchup.matchId);
    if (winner === undefined) continue; // sem palpite

    const matchNum = extractMatchNum(matchup.matchId);
    if (Number.isNaN(matchNum)) continue; // skip malformed matchId (e.g. "group-1")

    if (winner.winnerId !== null) {
      result.set(`W${matchNum}`, winner.winnerId);
    }

    if (winner.loserId !== null) {
      result.set(`L${matchNum}`, winner.loserId);
    }
  }

  return result;
}
