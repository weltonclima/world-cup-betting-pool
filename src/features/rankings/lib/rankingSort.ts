/**
 * Ordenação e desempate de ranking (PRD-05 "Critérios de Desempate"), funções puras.
 *
 * Sob pontuação binária `points === acertos exatos`, então o critério "mais acertos exatos"
 * do PRD é redundante com "maior pontuação". Cadeia efetiva de desempate:
 *   1. points DESC
 *   2. accuracy DESC
 *   3. wrong ASC
 *   4. firstPredictionAt ASC (mais antigo primeiro; ausente vai por último)
 *   5. uid ASC (fallback estável → ordem total determinística)
 */

/** Shape de domínio para ordenação. NÃO persistido (firstPredictionAt não está em RankingEntry). */
export interface RankableParticipant {
  uid: string;
  points: number; // acertos exatos (binário)
  accuracy: number; // 0–100
  wrong: number; // erros
  firstPredictionAt?: string; // ISO; ausente = sem palpites
}

export interface RankedParticipant extends RankableParticipant {
  position: number; // 1-indexed
}

/** Comparador total. Retorna 0 apenas quando o uid é igual (mesma entidade). */
export function compareRanking(
  a: RankableParticipant,
  b: RankableParticipant,
): number {
  if (b.points !== a.points) return b.points - a.points; // points DESC
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy; // accuracy DESC
  if (a.wrong !== b.wrong) return a.wrong - b.wrong; // wrong ASC

  // firstPredictionAt ASC, ausente por último
  const fa = a.firstPredictionAt;
  const fb = b.firstPredictionAt;
  if (fa !== fb) {
    if (fa === undefined) return 1;
    if (fb === undefined) return -1;
    return fa < fb ? -1 : 1;
  }

  return a.uid.localeCompare(b.uid); // fallback estável
}

/** Ordena (cópia, sem mutar a entrada) e atribui `position` 1-indexed sequencial. */
export function rankParticipants(
  list: RankableParticipant[],
): RankedParticipant[] {
  return [...list]
    .sort(compareRanking)
    .map((participant, index) => ({ ...participant, position: index + 1 }));
}
