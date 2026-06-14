import type { SystemLogType } from "@/schemas/systemLogs";

/** Query-keys da área global do Super Admin (PRD-11). Fonte única de verdade. */
export const superAdminKeys = {
  all: ["super-admin"] as const,
  dashboard: () => ["admin-dashboard"] as const,
  groups: (status: "pending" | "active" | "blocked") =>
    ["admin-groups", status] as const,
  admins: () => ["admin-admins"] as const,
  users: (filter: "without-group" | "all") =>
    ["admin-users", filter] as const,
  matches: (filters: { group?: string; stage?: string; status?: string }) =>
    ["admin-matches", filters] as const,
  logs: (type?: SystemLogType) => ["admin-logs", type ?? "all"] as const,
  groupInvite: (poolId: string) => ["admin-group-invite", poolId] as const,
} as const;
