/**
 * Gera o id determinístico do doc `predictions/${uid}_${matchId}`.
 * Garante unicidade (uid, matchId) sem query extra.
 * Puro — sem side effects.
 *
 * @param uid     - Firebase Auth UID do usuário (alfanumérico, sem underscore).
 *                  O separador `_` é inequívoco porque UIDs do Firebase não contêm `_`.
 * @param matchId - Id numérico da partida no API-Football (fixture id).
 *                  Números não contêm `_`, portanto o separador nunca é ambíguo.
 */
export function predictionDocId(uid: string, matchId: string): string {
  return `${uid}_${matchId}`;
}
