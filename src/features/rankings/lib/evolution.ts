/**
 * Indicador de evolução de posição (PRD-05 Tela 04). Função pura.
 * Posição menor = melhor → subiu quando a posição atual é menor que a anterior.
 */
export type EvolutionDirection = "up" | "same" | "down";

export interface EvolutionResult {
  direction: EvolutionDirection;
  delta: number; // sempre >= 0
}

export function evolutionIndicator(
  previousPosition: number | undefined | null,
  currentPosition: number,
): EvolutionResult {
  if (previousPosition === undefined || previousPosition === null) {
    return { direction: "same", delta: 0 }; // primeira rodada / sem histórico
  }
  if (currentPosition < previousPosition) {
    return { direction: "up", delta: previousPosition - currentPosition };
  }
  if (currentPosition > previousPosition) {
    return { direction: "down", delta: currentPosition - previousPosition };
  }
  return { direction: "same", delta: 0 };
}
