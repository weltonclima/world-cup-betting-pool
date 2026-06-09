/**
 * Helper puro do Resumo dos 12 Grupos (TASK-11 · PRD03-05).
 *
 * Deriva, a partir das partidas de fase de grupos, dos palpites do usuário e do
 * mapa de seleções, a visão consolidada por grupo (1º/2º classificados + 3º
 * candidato a melhor terceiro) com status de conclusão.
 *
 * VISUAL apenas (decisão A2 do PRD): nada é persistido. A classificação prevista
 * vem de `computeGroupStandings` (TASK-02) aplicada aos placares previstos.
 *
 * Sem React, sem Firebase — testável em isolamento.
 */

import { computeGroupStandings } from "@/features/predictions/lib/standings";
import type { MatchWithId, Prediction, TeamWithId } from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

/** Um classificado previsto de um grupo (posição 1, 2 ou 3). */
export interface GroupSummaryTeam {
  teamId: string;
  /** Nome resolvido via mapa de times; fallback = teamId. */
  name: string;
  flagUrl?: string;
  /** Posição prevista (1 = 1º, 2 = 2º, 3 = 3º candidato a melhor terceiro). */
  position: 1 | 2 | 3;
}

/** Resumo de um grupo. */
export interface GroupSummaryItem {
  /** Id normalizado do grupo ("A".."L"). */
  groupId: string;
  /** Rótulo humano ("Grupo A"). */
  label: string;
  /** 1º colocado previsto (apenas quando o grupo está completo). */
  first?: GroupSummaryTeam;
  /** 2º colocado previsto (apenas quando o grupo está completo). */
  second?: GroupSummaryTeam;
  /** 3º colocado previsto — candidato a melhor terceiro (apenas quando completo). */
  third?: GroupSummaryTeam;
  /** Jogos do grupo com palpite preenchido. */
  filled: number;
  /** Total de jogos do grupo. */
  total: number;
  /** Grupo concluído: filled === total && total > 0. */
  isComplete: boolean;
}

/** Resultado completo do resumo. */
export interface GroupsSummaryData {
  /** Grupos ordenados alfabeticamente por groupId (A→L). */
  groups: GroupSummaryItem[];
  /** Todos os grupos concluídos (e há ao menos 1 grupo). */
  allComplete: boolean;
  /** Número de grupos concluídos. */
  completeCount: number;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Normaliza um identificador de grupo para a forma curta ("A".."L").
 * Aceita "Group A", "Grupo A", "a", "A" → "A".
 */
export function normalizeGroupId(raw: string): string {
  return raw
    .trim()
    .replace(/^grupo\s+/i, "")
    .replace(/^group\s+/i, "")
    .trim()
    .toUpperCase();
}

/** Constrói um mapa teamId → TeamWithId para resolução de nome/bandeira. */
function buildTeamMap(teams: TeamWithId[]): Map<string, TeamWithId> {
  const map = new Map<string, TeamWithId>();
  for (const team of teams) {
    map.set(team.id, team);
  }
  return map;
}

/** Resolve um classificado previsto em GroupSummaryTeam. */
function toSummaryTeam(
  teamId: string,
  position: 1 | 2 | 3,
  teamMap: Map<string, TeamWithId>,
): GroupSummaryTeam {
  const team = teamMap.get(teamId);
  return {
    teamId,
    name: team?.name ?? teamId,
    flagUrl: team?.flagUrl,
    position,
  };
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Deriva o resumo dos grupos a partir de partidas, palpites e times.
 *
 * @param matches      - Todas as partidas (a função filtra `stage === "grupos"` com groupId).
 * @param predictions  - Palpites do usuário (qualquer matchId; filtrados por id de partida).
 * @param teams        - Seleções (para resolver nome/bandeira).
 * @returns GroupsSummaryData ordenado por groupId.
 */
export function buildGroupsSummary(
  matches: MatchWithId[],
  predictions: Prediction[],
  teams: TeamWithId[],
): GroupsSummaryData {
  const teamMap = buildTeamMap(teams);

  // Set de matchIds com palpite, para contar "filled".
  const predictedMatchIds = new Set<string>(predictions.map((p) => p.matchId));

  // Agrupar partidas de fase de grupos por groupId normalizado.
  const byGroup = new Map<string, MatchWithId[]>();
  for (const match of matches) {
    if (match.stage !== "grupos") continue;
    if (match.groupId == null) continue;
    const gid = normalizeGroupId(match.groupId);
    if (gid.length === 0) continue;
    const list = byGroup.get(gid);
    if (list) {
      list.push(match);
    } else {
      byGroup.set(gid, [match]);
    }
  }

  const groups: GroupSummaryItem[] = [];

  // Ordenar groupIds alfabeticamente (A→L).
  const sortedGroupIds = Array.from(byGroup.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const groupId of sortedGroupIds) {
    const groupMatches = byGroup.get(groupId) ?? [];
    const total = groupMatches.length;
    const filled = groupMatches.reduce(
      (acc, m) => (predictedMatchIds.has(m.id) ? acc + 1 : acc),
      0,
    );
    const isComplete = total > 0 && filled === total;

    const item: GroupSummaryItem = {
      groupId,
      label: `Grupo ${groupId}`,
      filled,
      total,
      isComplete,
    };

    // Classificados só são consolidados quando o grupo está completo —
    // classificação parcial é instável (spec §3).
    if (isComplete) {
      const standings = computeGroupStandings(groupMatches, predictions);
      const first = standings.find((e) => e.position === 1);
      const second = standings.find((e) => e.position === 2);
      const third = standings.find((e) => e.position === 3);
      if (first) item.first = toSummaryTeam(first.teamId, 1, teamMap);
      if (second) item.second = toSummaryTeam(second.teamId, 2, teamMap);
      if (third) item.third = toSummaryTeam(third.teamId, 3, teamMap);
    }

    groups.push(item);
  }

  const completeCount = groups.reduce(
    (acc, g) => (g.isComplete ? acc + 1 : acc),
    0,
  );
  const allComplete = groups.length > 0 && completeCount === groups.length;

  return { groups, allComplete, completeCount };
}
