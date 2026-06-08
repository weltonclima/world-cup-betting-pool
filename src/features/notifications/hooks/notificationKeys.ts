import type { NotificationType } from "@/schemas/notifications";

/**
 * Factory de query-keys da feature notifications (PRD-08). Arrays `as const`
 * para estabilidade e invalidação (padrão `rankingKeys`/`usersKeys`).
 */
export const notificationKeys = {
  all: () => ["notifications"] as const,
  list: (uid: string, type?: NotificationType) =>
    ["notifications", "list", uid, type ?? "all"] as const,
  detail: (id: string) => ["notification", id] as const,
  unread: (uid: string) => ["notifications", "unread", uid] as const,
  preferences: (uid: string) => ["notification-preferences", uid] as const,
} as const;
