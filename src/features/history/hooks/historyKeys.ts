/**
 * Factory único das query keys da Seção Histórico (multi-championship TASK-15).
 * Fonte única evita strings mágicas e drift entre query e invalidação — mesmo
 * padrão de `groupKeys`/`matchesKeys`.
 */
export const historyKeys = {
  all: () => ["history"] as const,
  lists: () => [...historyKeys.all(), "list"] as const,
  list: () => [...historyKeys.lists()] as const,
  details: () => [...historyKeys.all(), "detail"] as const,
  detail: (championshipId: string) =>
    [...historyKeys.details(), championshipId] as const,
} as const;
