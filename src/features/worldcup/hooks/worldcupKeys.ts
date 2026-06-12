/**
 * Factory de query-keys da feature worldcup (TASK-05).
 *
 * Keys literais conforme o PRD: `["groups"]`, `["group", groupId]`, `["bracket"]`.
 * Funções que retornam arrays `as const` — padrão TanStack Query.
 *
 * Nota sobre `group(groupId)`:
 * Esta key existe para fidelidade ao PRD, mas **NÃO** é usada como `queryKey`
 * pelo `useGroupStandings`. Aquele hook usa `select` sobre a query `["groups"]`
 * para derivar o slice do grupo — `select` não altera a cache key, apenas
 * memoiza o seletor sobre o dado bruto. Portanto `["group", groupId]` permanece
 * na factory como referência de nomenclatura; invalidações pontuais por grupo
 * ficam a cargo de futuras evoluções (spec §6.5).
 */
export const worldcupKeys = {
  groups: () => ["groups"] as const,
  group: (groupId: string) => ["group", groupId] as const,
  bracket: () => ["bracket"] as const,
} as const;
