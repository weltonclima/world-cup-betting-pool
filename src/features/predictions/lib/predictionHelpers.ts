/**
 * Gera o id determinístico do doc `predictions/${uid}_${matchId}`.
 * Garante unicidade (uid, matchId) sem query extra.
 * Puro — sem side effects.
 */
export function predictionDocId(uid: string, matchId: string): string {
  return `${uid}_${matchId}`;
}
