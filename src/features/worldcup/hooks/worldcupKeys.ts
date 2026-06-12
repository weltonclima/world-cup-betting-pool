/**
 * Factory de query-keys da feature worldcup (TASK-05).
 *
 * TUDO sob um namespace raiz único (`["worldcup", ...]`).
 *
 * IMPORTANTE (review BL-01): o PRD pedia as keys literais `["groups"]` /
 * `["bracket"]`, mas a feature irmã `groups` (pool de apostas) JÁ ocupa
 * `["groups"]` (`groupsKeys.all`). Como o React Query casa invalidação por
 * PREFIXO e ambas compartilham o mesmo QueryClient, um `invalidateQueries(
 * ["groups"])` (ex.: `useCreateGroup`) derrubaria a classificação da Copa. O
 * namespace `["worldcup", ...]` elimina a colisão — o contrato literal do PRD
 * cede para preservar a coerência de cache entre features.
 *
 * Nota sobre `group(groupId)`:
 * Esta key existe para fidelidade ao PRD, mas **NÃO** é usada como `queryKey`
 * pelo `useGroupStandings`. Aquele hook usa `select` sobre a query de grupos
 * para derivar o slice do grupo — `select` não altera a cache key, apenas
 * memoiza o seletor sobre o dado bruto. Portanto `group(groupId)` permanece
 * na factory como referência de nomenclatura; invalidações pontuais por grupo
 * ficam a cargo de futuras evoluções (spec §6.5).
 */
export const worldcupKeys = {
  all: () => ["worldcup"] as const,
  groups: () => [...worldcupKeys.all(), "groups"] as const,
  group: (groupId: string) => [...worldcupKeys.all(), "group", groupId] as const,
  bracket: () => [...worldcupKeys.all(), "bracket"] as const,
} as const;
