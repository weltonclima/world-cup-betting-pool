/**
 * Factory de query-keys da feature matches (integracao-api-football, TASK-06).
 *
 * Hierarquia estável para uso pelos hooks de partidas/seleções e para
 * invalidação granular (`queryClient.invalidateQueries`). Segue o padrão
 * recomendado do TanStack Query: funções que retornam arrays `as const`.
 *
 * - `all`     — raiz de tudo da feature (invalida todas as queries de matches).
 * - `lists`/`list` — listagem completa de partidas (`useMatches`).
 * - `details`/`detail(id)` — detalhe de uma partida (`useMatch`).
 * - `teams`   — cache de seleções (`useTeams`).
 *
 * Namespace `"matches"` é independente do namespace `"home"` (`homeKeys`) — a Home
 * mantém suas próprias chaves; estas servem à futura tela de Jogos e a qualquer
 * consumidor compartilhado de matches/teams.
 */
export const matchesKeys = {
  all: () => ["matches"] as const,
  lists: () => [...matchesKeys.all(), "list"] as const,
  list: () => [...matchesKeys.lists()] as const,
  details: () => [...matchesKeys.all(), "detail"] as const,
  detail: (id: string) => [...matchesKeys.details(), id] as const,
  teams: () => [...matchesKeys.all(), "teams"] as const,
} as const;
