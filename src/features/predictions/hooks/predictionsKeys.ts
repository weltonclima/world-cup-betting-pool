/**
 * Factory de query-keys da feature predictions (TASK-06).
 *
 * Hierarquia estável para invalidação granular (queryClient.invalidateQueries).
 * Segue o padrão de matchesKeys/homeKeys: funções que retornam arrays `as const`.
 *
 * - `all`           — raiz de toda a feature (invalida todas as queries de predictions).
 * - `item(matchId)` — palpite específico por partida.
 *
 * Namespace "predictions" é independente de "matches" e "home".
 * A invalidação cruzada (matchesKeys.predictions / homeKeys.predictions) ocorre
 * em useUpsertPrediction — não aqui.
 */
export const predictionsKeys = {
  all: () => ["predictions"] as const,
  item: (matchId: string) =>
    [...predictionsKeys.all(), "item", matchId] as const,
} as const;
