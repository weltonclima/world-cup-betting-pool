"use client";

/**
 * OpenMatchesCard — card "Jogos abertos pra palpitar" da Home (TASK-02 home-revamp).
 *
 * Substitui o CurrentStageCard (sempre vazio) por uma lista acionável dos jogos
 * ainda abertos para palpitar e absorve os avisos do sistema como faixa fina no
 * topo (NoticesCard removido).
 *
 * Componente presentacional puro: recebe `OpenMatchesResult` + `SystemNotice[]`,
 * sem fetch e sem lógica de derivação (tudo vem de deriveOpenMatches/deriveNotices).
 * Contrato visual: ai/ui-spec/task-home-revamp-02.md.
 */

import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  OpenMatchesResult,
  OpenMatchSummary,
  ResolvedTeam,
  SystemNotice,
} from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OpenMatchesCardProps {
  openMatches: OpenMatchesResult;
  /** Avisos do sistema — renderizados como faixa fina no topo (só se houver). */
  notices: SystemNotice[];
}

// ---------------------------------------------------------------------------
// Faixa de avisos (integrada)
// ---------------------------------------------------------------------------

/** Ícone por severidade — color-not-only: ícone + texto carregam o sentido. */
const SEVERITY_MAP = {
  warning: { Icon: AlertTriangle, className: "text-destructive" },
  info: { Icon: Info, className: "text-muted-foreground" },
} as const;

/** Faixa fina de avisos do sistema. Não renderiza nada quando vazia. */
function NoticesStrip({ notices }: { notices: SystemNotice[] }) {
  if (notices.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      {notices.map((notice) => {
        const { Icon, className } = SEVERITY_MAP[notice.severity];
        return (
          <div key={notice.id} className="flex items-start gap-2">
            <Icon size={14} className={cn(className, "shrink-0 mt-0.5")} aria-hidden="true" />
            <span className="text-xs text-foreground">{notice.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bandeira da seleção (fallback de iniciais) — espelha TeamFlag do NextMatchCard
// ---------------------------------------------------------------------------

function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        className="size-6 shrink-0 rounded-sm object-cover border border-border"
      />
    );
  }

  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={team.name}
      className="size-6 shrink-0 flex items-center justify-center rounded-sm bg-muted text-[10px] font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

/** Nome + bandeira da seleção; nome trunca, bandeira nunca encolhe. */
function TeamLabel({ team }: { team: ResolvedTeam }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <TeamFlag team={team} />
      <span className="truncate text-sm font-medium text-foreground">{team.name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Item de jogo aberto
// ---------------------------------------------------------------------------

function OpenMatchItem({ match }: { match: OpenMatchSummary }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
      {/* Seleções */}
      <div className="flex items-center gap-2">
        <TeamLabel team={match.homeTeam} />
        <span className="shrink-0 text-xs font-bold text-muted-foreground">vs</span>
        <TeamLabel team={match.awayTeam} />
      </div>

      {/* Deadline + CTA */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-medium tabular-nums",
            match.isUrgent ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <Clock size={14} aria-hidden="true" />
          {match.deadlineLabel}
        </span>
        <Link
          href={match.predictHref}
          aria-label={`Palpitar em ${match.homeTeam.name} contra ${match.awayTeam.name}`}
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "min-h-[44px] shrink-0",
          )}
        >
          Palpitar
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/** Placeholder animado — exibir durante isLoading (sem layout shift). */
export function OpenMatchesCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando jogos abertos"
      className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
    >
      <div className="h-3 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="flex flex-col gap-2">
        <div className="h-4 w-3/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-11 w-24 rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card de jogos abertos para palpitar com faixa de avisos integrada.
 * Empty state positivo quando não há jogos abertos.
 */
export function OpenMatchesCard({ openMatches, notices }: OpenMatchesCardProps) {
  const { items, totalOpen } = openMatches;
  const remaining = totalOpen - items.length;

  return (
    <article
      aria-label="Jogos abertos para palpitar"
      className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
    >
      <NoticesStrip notices={notices} />

      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Jogos abertos pra palpitar
      </h2>

      {items.length === 0 ? (
        /* Empty state positivo */
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 size={32} aria-hidden="true" className="text-win" />
          <p className="text-sm font-medium text-foreground">Você está em dia!</p>
          <p className="text-xs text-muted-foreground">
            Nenhum jogo aberto para palpitar.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {items.map((match) => (
              <OpenMatchItem key={match.matchId} match={match} />
            ))}
          </div>

          {remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              + {remaining} {remaining === 1 ? "outro jogo aberto" : "outros jogos abertos"}
            </p>
          )}
        </>
      )}
    </article>
  );
}
