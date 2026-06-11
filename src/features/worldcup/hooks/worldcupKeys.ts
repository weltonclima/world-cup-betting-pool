/**
 * Factory de query-keys da feature worldcup (grupos-eliminatorias, TASK-05).
 *
 * Segue o padrão TanStack Query (funções → arrays `as const`) e o do
 * `matchesKeys`: TUDO sob um namespace raiz único (`["worldcup", ...]`).
 *
 * IMPORTANTE (review BL-01): o PRD pedia as keys literais `["groups"]` /
 * `["bracket"]`, mas a feature irmã `groups` (pool de apostas) JÁ ocupa
 * `["groups"]` (`groupsKeys.all`). Como o React Query casa invalidação por
 * PREFIXO e ambas compartilham o mesmo QueryClient, criar um pool
 * (`invalidateQueries(["groups"])`) derrubaria a classificação da Copa. O
 * namespace `["worldcup", ...]` elimina a colisão — o contrato literal do PRD
 * cede para preservar a coerência de cache entre features.
 *
 * Nota (decisão travada): `group(groupId)` existe por fidelidade ao PRD, mas
 * NÃO é usada como cache entry separada. `useGroupStandings` faz `select` sobre
 * a query de grupos (React Query `select` não altera a key; não há endpoint por
 * grupo). Ver `useGroupStandings`.
 */
export const worldcupKeys = {
  all: () => ["worldcup"] as const,
  groups: () => [...worldcupKeys.all(), "groups"] as const,
  group: (groupId: string) => [...worldcupKeys.all(), "group", groupId] as const,
  bracket: () => [...worldcupKeys.all(), "bracket"] as const,
} as const;
