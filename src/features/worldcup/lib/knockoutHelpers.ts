import type { KnockoutMatch } from "@/types/worldcup";

export type WinningSide = "home" | "away" | "draw" | null;

export function getWinningSide(match: KnockoutMatch): WinningSide {
  if (match.status !== "encerrado") return null;
  const home = match.homeScore!;
  const away = match.awayScore!;
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function formatKickoffBr(iso?: string): string {
  if (!iso) return "Data a confirmar";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "Data a confirmar";

  const parts = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday").replace(".", "");
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const day = get("day");
  const month = get("month").replace(".", "");
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  const time = `${get("hour")}h${get("minute")}`;

  return `${weekdayCap}, ${day} ${monthCap} · ${time}`;
}
