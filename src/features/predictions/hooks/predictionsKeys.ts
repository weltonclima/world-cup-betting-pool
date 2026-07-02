/**
 * Factory de query-keys da feature predictions (TASK-06).
 *
 * Hierarquia estável para invalidação granular (queryClient.invalidateQueries).
 * Segue o padrão de matchesKeys/homeKeys: funções que retornam arrays `as const`.
 *
 * - `all`           — raiz de toda a feature (invalida todas as queries de predictions).
 * - `byUid(uid)`    — palpites de um usuário específico (isolamento de cache por conta).
 * - `item(matchId)` — palpite específico por partida.
 *
 * Namespace "predictions" é independente de "matches" e "home".
 * A invalidação cruzada (matchesKeys.predictions / homeKeys.predictions) ocorre
 * em useUpsertPrediction — não aqui.
 *
 * SEGURANÇA (TASK-07 perf-hardening / B2): `byUid` inclui o uid na chave para
 * evitar vazamento de palpites entre contas em navegador compartilhado. `all()`
 * permanece como prefixo → invalidações por `all()` cobrem `byUid`/`item`.
 */
export const predictionsKeys = {
  all: () => ["predictions"] as const,
  byUid: (uid: string) => [...predictionsKeys.all(), uid] as const,
  item: (matchId: string) =>
    [...predictionsKeys.all(), "item", matchId] as const,
} as const;
