/**
 * Factory único das query keys da feature `groups` (PRD-09, TASK-04). Fonte única
 * evita strings mágicas e drift entre query e invalidação.
 */
export const groupsKeys = {
  all: ["groups"] as const,
  search: (q: string) => ["groups", "search", q] as const,
  detail: (id: string) => ["groups", "detail", id] as const,
} as const;
