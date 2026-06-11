"use client";

import type { JSX } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Notification } from "@/schemas/notifications";

import { NOTIFICATION_META, relativeTime } from "../lib/notificationMeta";
import { useMarkAsRead } from "../hooks";

/** Item da lista de notificações (PRD08-01). Abrir → detalhe + marca como lida. */
export function NotificationItem({
  notification,
}: {
  notification: Notification;
}): JSX.Element {
  const markAsRead = useMarkAsRead();
  const meta = NOTIFICATION_META[notification.type];
  const Icon = meta.icon;

  return (
    <Link
      href={`/notifications/${notification.id}`}
      onClick={() => {
        if (!notification.isRead) markAsRead.mutate(notification.id);
      }}
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              notification.isRead
                ? "font-medium text-foreground"
                : "font-semibold text-foreground",
            )}
          >
            {notification.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(notification.createdAt)}
          </span>
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {notification.message}
        </span>
      </span>

      {!notification.isRead ? (
        <span
          aria-label="Não lida"
          className="mt-1 size-2 shrink-0 rounded-full bg-primary"
        />
      ) : null}
    </Link>
  );
}
