/**
 * Aproveitamento (%) — função pura. PRD-05 Tela 02/05 ("X de Y jogos").
 *
 * Denominador = partidas FINALIZADAS elegíveis ao escopo (o caller fornece o número pronto).
 * O 1º argumento é a contagem de ACERTOS EXATOS (`status === "correct"`), NUNCA os
 * pontos ponderados (5/10) — sob a regra ponderada (TASK-03) os dois divergem; o
 * caller é responsável por passar os exatos para preservar a semântica de %acerto (D2).
 */
export function computeAccuracy(exactCorrect: number, finishedEligible: number): number {
  if (finishedEligible <= 0) return 0;
  const pct = Math.round((exactCorrect / finishedEligible) * 100);
  return Math.max(0, Math.min(100, pct)); // clamp defensivo 0–100
}
