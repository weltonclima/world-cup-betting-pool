/**
 * Aproveitamento (%) — função pura. PRD-05 Tela 02/05 ("X de Y jogos").
 *
 * Denominador = partidas FINALIZADAS elegíveis ao escopo (o caller fornece o número pronto).
 * Sob binário, `points` === acertos exatos.
 */
export function computeAccuracy(points: number, finishedEligible: number): number {
  if (finishedEligible <= 0) return 0;
  const pct = Math.round((points / finishedEligible) * 100);
  return Math.max(0, Math.min(100, pct)); // clamp defensivo 0–100
}
