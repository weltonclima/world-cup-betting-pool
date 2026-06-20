import {
  CalendarClock,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { NotificationType } from "@/schemas/notifications";

/** Metadados de exibição por categoria de notificação (PRD-08). */
export interface NotificationMeta {
  label: string;
  icon: LucideIcon;
}

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  system: { label: "Sistema", icon: ShieldCheck },
  games: { label: "Jogos", icon: CalendarClock },
  ranking: { label: "Ranking", icon: Trophy },
};

/** Ação contextual da tela de detalhe (PRD08-02), conforme o tipo. */
export interface NotificationAction {
  label: string;
  href: string;
}

export function actionFor(type: NotificationType): NotificationAction | null {
  switch (type) {
    case "ranking":
      return { label: "Ver Ranking", href: "/rankings" };
    case "games":
      return { label: "Ver Jogo", href: "/matches" };
    default:
      return null;
  }
}

/**
 * Tempo relativo curto para a lista (PRD08-01): hoje → HH:mm; ontem → "Ontem";
 * demais → "há N dias" (date-fns + ptBR). `now` injetável para testes.
 */
export function relativeTime(createdAt: string, now: Date = new Date()): string {
  const date = new Date(createdAt);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, "HH:mm");
  if (days === 1) return "Ontem";
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

/** Data/hora por extenso para o detalhe (PRD08-02). */
export function fullDateTime(createdAt: string): string {
  return format(new Date(createdAt), "d 'de' MMMM 'de' yyyy 'às' HH:mm", {
    locale: ptBR,
  });
}
