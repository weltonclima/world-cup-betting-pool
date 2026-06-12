"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

import { useUnreadCount } from "../hooks";

/** Sino de notificações + badge de não-lidas no Header (PRD-08). */
export function NotificationBell(): JSX.Element {
  const unread = useUnreadCount();
  const pathname = usePathname();
  const isActive = pathname.startsWith("/notifications");
  const label =
    unread > 0
      ? `Notificações, ${unread} não lidas`
      : "Notificações";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: "ghost" }), "relative size-11")}
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
