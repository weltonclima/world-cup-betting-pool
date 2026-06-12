import type { RankingScope } from "@/types";

/**
 * Factory de query-keys da feature rankings (TASK-05).
 * Arrays `as const` para estabilidade e invalidação (padrão homeKeys).
 */
export const rankingKeys = {
  all: () => ["ranking"] as const,
  scope: (scope: RankingScope) => ["ranking", "scope", scope] as const,
  pool: (groupId: string) => ["ranking", "pool", groupId] as const, // ranking fechado do pool (PRD-09)
  group: (groupId: string) => ["ranking", "group", groupId] as const,
  user: (uid: string) => ["ranking", "user", uid] as const, // linha do usuário no geral (UserRankingResult)
  profile: (uid: string) => ["ranking", "profile", uid] as const, // statistics/{uid} (Statistics)
  poolStats: () => ["pool-stats"] as const,
} as const;
