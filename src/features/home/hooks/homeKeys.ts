/**
 * Factory de query-keys da feature home (TASK-05).
 * Todas as entradas são funções que retornam arrays `as const`,
 * seguindo o padrão recomendado do TanStack Query para estabilidade e invalidação.
 */
export const homeKeys = {
  statistics:     (uid: string) => ["home", "statistics", uid]                as const,
  nextMatch:      ()          => ["home", "next-match"]                        as const,
  recentResults:  ()          => ["home", "recent-results"]                    as const,
  teams:          ()          => ["home", "teams"]                             as const,
  predictions:    (uid: string) => ["home", "predictions", uid]               as const,
  systemSettings: ()          => ["home", "system-settings"]                   as const,
} as const;
