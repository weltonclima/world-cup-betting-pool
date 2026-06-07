import type { UserStatus } from "@/types";

/**
 * Factory único das query keys da feature admin (TASK-03). Fonte única evita
 * strings mágicas e drift entre query e invalidação (causa raiz do R2 do plano).
 */
export const usersKeys = {
  all: ["users"] as const,
  byStatus: (status: UserStatus) => ["users", "by-status", status] as const,
} as const;
