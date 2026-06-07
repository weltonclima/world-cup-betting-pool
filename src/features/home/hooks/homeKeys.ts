/**
 * Factory de query-keys da feature home (TASK-05).
 * Espelha o padrão de usersKeys.ts: fonte única, sem strings mágicas.
 */
export const homeKeys = {
  generalRanking: ["home", "general-ranking"]                  as const,
  statistics:     (uid: string) => ["home", "statistics", uid] as const,
  nextMatch:      ["home", "next-match"]                        as const,
  recentResults:  ["home", "recent-results"]                    as const,
  teams:          ["home", "teams"]                             as const,
  predictions:    (uid: string) => ["home", "predictions", uid] as const,
  systemSettings: ["home", "system-settings"]                   as const,
} as const;
