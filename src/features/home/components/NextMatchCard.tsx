"use client";

/**
 * NextMatchCard — card "Próximo Jogo" da Home Dashboard (TASK-08).
 * Componente presentacional puro: recebe props, sem efeitos colaterais.
 * Contrato visual: ai/screen/home-dashboard-task-06.md §3.4
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  NextMatchSummary,
  PredictionStatus,
  ResolvedTeam,
} from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface NextMatchCardProps {
  /** null → exibe estado empty "Nenhum jogo disponível". */
  nextMatch: NextMatchSummary | null;
  /** true → exibe skeleton de loading. */
  isLoading?: boolean;
  /**
   * Href ou handler do CTA. Recebe via prop para manter o componente
   * agnóstico de roteamento (destinos são placeholders no MVP).
   */
  onCtaClick?: () => void;
  ctaHref?: string;
}

// ---------------------------------------------------------------------------
// Mapeamentos de status do palpite → badge e texto do CTA
// ---------------------------------------------------------------------------

/** Mapeamento de PredictionStatus → texto do CTA. */
const CTA_LABEL: Record<PredictionStatus, string> = {
  pendente: "Enviar Palpite",
  enviado: "Editar Palpite",
  bloqueado: "Ver Jogo",
};

// ---------------------------------------------------------------------------
// Subcomponentes internos
// ---------------------------------------------------------------------------

/** Badge de status do palpite do usuário para o próximo jogo (§3.4.1). */
function PredictionStatusBadge({ status }: { status: PredictionStatus }) {
  if (status === "bloqueado") {
    return <Badge variant="destructive">Encerrado</Badge>;
  }

  if (status === "enviado") {
    return (
      <Badge
        variant="outline"
        className="border-win text-win"
      >
        Palpite enviado
      </Badge>
    );
  }

  // pendente
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Sem palpite
    </Badge>
  );
}

/** Bandeira da seleção com fallback de iniciais (§3.4). */
function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        className="size-8 rounded-sm object-contain"
      />
    );
  }

  // Fallback: iniciais quando flagUrl não está disponível
  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={team.name}
      className="size-8 flex items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton de loading (§5.1)
// ---------------------------------------------------------------------------

/** Skeleton para NextMatchCard enquanto os dados carregam. */
export function NextMatchCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando Próximo Jogo"
      className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
    >
      <div className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="flex items-center justify-center gap-4 py-2">
        <div className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-5 w-8 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="h-4 w-1/2 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-9 w-full rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card "Próximo Jogo" — exibe o próximo jogo agendado com:
 * - seleções (nome + bandeira/fallback de iniciais),
 * - data e hora formatadas em pt-BR,
 * - badge de status do palpite (enviado/pendente/bloqueado),
 * - CTA adaptado ao status.
 *
 * Estado empty: quando nextMatch é null.
 * Estado loading: quando isLoading é true.
 */
export function NextMatchCard({
  nextMatch,
  isLoading = false,
  onCtaClick,
  ctaHref,
}: NextMatchCardProps) {
  if (isLoading) {
    return <NextMatchCardSkeleton />;
  }

  // Estado empty
  if (!nextMatch) {
    return (
      <article
        aria-label="Próximo Jogo"
        className="rounded-lg border border-border bg-card p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Próximo Jogo
        </h2>
        <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
          <Calendar size={24} aria-hidden="true" className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhum jogo agendado
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Os jogos aparecem quando disponíveis
          </p>
        </div>
      </article>
    );
  }

  // Formatação de data/hora: "Sáb, 14 Jun · 15:00"
  const kickoffDate = new Date(nextMatch.kickoffAt);
  const formattedDate = format(kickoffDate, "EEE, d MMM · HH:mm", {
    locale: ptBR,
  });

  const ctaLabel = CTA_LABEL[nextMatch.predictionStatus];

  return (
    <article
      aria-label="Próximo Jogo"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      {/* Cabeçalho: título + badge de status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">Próximo Jogo</h2>
        <PredictionStatusBadge status={nextMatch.predictionStatus} />
      </div>

      {/* Seleções com bandeiras */}
      <div className="flex items-center justify-center gap-4 py-3">
        <div className="flex items-center gap-2">
          <TeamFlag team={nextMatch.homeTeam} />
          <span className="text-sm font-medium text-foreground">
            {nextMatch.homeTeam.name}
          </span>
        </div>

        <span className="text-xs font-bold text-muted-foreground">VS</span>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {nextMatch.awayTeam.name}
          </span>
          <TeamFlag team={nextMatch.awayTeam} />
        </div>
      </div>

      {/* Data e hora formatada em pt-BR */}
      <p className="text-sm text-muted-foreground text-center mb-2">
        {formattedDate}
      </p>

      {/* CTA adaptado ao status do palpite */}
      {ctaHref ? (
        /* Usa Link com buttonVariants para evitar button-dentro-de-anchor */
        <Link
          href={ctaHref}
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "w-full mt-2 min-h-[44px]",
          )}
        >
          {ctaLabel}
        </Link>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="w-full mt-2 min-h-[44px]"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </Button>
      )}
    </article>
  );
}
