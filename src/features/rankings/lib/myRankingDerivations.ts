// Derivações puras (client-side) da Tela 02 "Meu Ranking" (PRD-05, TASK-10).
// A partir de dados já carregados (entry.points + statistics.positionHistory),
// sem novo cálculo no servidor. Filtra escopo "geral" e ordena por `at`.

import type { EvolutionPoint } from "@/features/rankings/components/charts/EvolutionLineChart";
import type { PositionHistoryEntry } from "@/types";

/** Filtra o histórico ao escopo "geral" e ordena cronologicamente por `at`. */
export function geralHistory(
  history: readonly PositionHistoryEntry[],
): PositionHistoryEntry[] {
  return history
    .filter((h) => h.scope === "geral")
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Mapeia o histórico (escopo geral, ordenado) para pontos do gráfico de evolução.
 * `label` = `R{round}` quando `round` presente; senão índice sequencial `R{i+1}`.
 */
export function toEvolutionPoints(
  geral: readonly PositionHistoryEntry[],
): EvolutionPoint[] {
  return geral.map((h, i) => ({
    label: `R${h.round ?? i + 1}`,
    position: h.position,
  }));
}

export interface BestPosition {
  position: number;
  round: number;
}

/**
 * Melhor posição = menor `position` no histórico geral; em empate, a ocorrência
 * mais recente. `round` = `round` do snapshot ou índice sequencial (1-based).
 * `null` quando não há histórico.
 */
export function bestPosition(
  geral: readonly PositionHistoryEntry[],
): BestPosition | null {
  if (geral.length === 0) return null;
  let best: BestPosition | null = null;
  geral.forEach((h, i) => {
    const round = h.round ?? i + 1;
    if (best === null || h.position <= best.position) {
      best = { position: h.position, round };
    }
  });
  return best;
}

/** Número de rodadas registradas no escopo geral. */
export function roundsCount(geral: readonly PositionHistoryEntry[]): number {
  return geral.length;
}

const ptBR1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Média de pontos por rodada = `points / rounds` (1 casa decimal, pt-BR).
 * `rounds === 0` → "—".
 */
export function averagePointsPerRound(points: number, rounds: number): string {
  if (rounds === 0) return "—";
  return ptBR1.format(points / rounds);
}
