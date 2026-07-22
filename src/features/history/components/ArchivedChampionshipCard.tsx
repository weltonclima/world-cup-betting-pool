import Link from "next/link";
import { ChevronRight, Lock, ListOrdered, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ChampionshipType } from "@/types/championships";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TYPE_LABEL: Record<ChampionshipType, string> = {
  league: "Liga",
  cup: "Copa",
};

export interface ArchivedChampionshipCardProps {
  championshipId: string;
  name: string;
  season: string;
  type: ChampionshipType;
  archivedAt: string; // ISO
}

/**
 * Card de campeonato arquivado (landing do Histórico, TASK-15). Link para o
 * detalhe congelado. Ícone de tipo + badge textual (Liga/Copa — `color-not-only`)
 * + cadeado/data (sinal "congelado") + chevron.
 */
export function ArchivedChampionshipCard({
  championshipId,
  name,
  season,
  type,
  archivedAt,
}: ArchivedChampionshipCardProps) {
  const typeLabel = TYPE_LABEL[type];
  const formattedDate = dateFormatter.format(new Date(archivedAt));
  const TypeIcon = type === "cup" ? Trophy : ListOrdered;

  return (
    <Link
      href={`/rankings/history/${championshipId}`}
      aria-label={`${name}, temporada ${season}, ${typeLabel}, arquivado em ${formattedDate}. Ver histórico.`}
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:active:scale-[0.99]"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
      >
        <TypeIcon size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          <Badge variant="secondary" className="shrink-0">
            {typeLabel}
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">Temporada {season}</span>
        <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <Lock size={14} aria-hidden="true" className="shrink-0" />
          Arquivado em {formattedDate}
        </span>
      </span>

      <ChevronRight
        size={16}
        aria-hidden="true"
        className="shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
