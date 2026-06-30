"use client";

/**
 * KnockoutMatchCard — card de um confronto de mata-mata (PRD-16).
 *
 * Componente presentacional puro (sem hooks/fetch). 3 variantes por `status`:
 *   - aguardando → nomes/rótulos placeholder + "Aguardando definição" (sem placar)
 *   - definido   → bandeiras + nomes, separador "x" (sem placar)
 *   - encerrado  → bandeiras + nomes + placar "home x away" + badge vencedor
 *
 * Novidades PRD-16 TASK-03:
 *   - Header de metadados: data/hora via formatKickoffBr + venue.city opcional
 *   - Badge vencedor: ring verde + Trophy amber no side com maior placar
 *   - Empate (draw): nenhum destaque visual
 *
 * Contrato visual: ai/ui-spec/task-chaveamento-eliminatorias-visual-03.md
 */

import { HelpCircle, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  KnockoutMatch,
  KnockoutMatchStatus,
  KnockoutSide,
} from "@/types/worldcup";

import {
  formatKickoffBr,
  getWinningSide,
} from "@/features/worldcup/lib/knockoutHelpers";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface KnockoutMatchCardProps {
  match: KnockoutMatch;
  /**
   * "full" (padrão): card completo com data/venue/nomes/placar (TASK-03).
   * "compact": nó de árvore do chaveamento — só bandeiras + placar, sem nomes
   * (nomes preservados no aria-label p/ leitores de tela). TASK-04 v2.
   */
  variant?: "full" | "compact";
  className?: string;
}

// ---------------------------------------------------------------------------
// Subcomponente: SideFlag (bandeira de seleção definida ou ícone neutro)
// ---------------------------------------------------------------------------

function SideFlag({ side }: { side: KnockoutSide }) {
  if (!side.defined) {
    return (
      <HelpCircle
        size={24}
        aria-hidden="true"
        className="w-8 h-6 shrink-0 text-muted-foreground"
      />
    );
  }

  if (side.flagUrl) {
    return (
      <img
        src={side.flagUrl}
        alt={side.name}
        loading="lazy"
        decoding="async"
        className="w-8 h-6 shrink-0 rounded-sm object-cover border border-border"
      />
    );
  }

  const initials = side.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={side.name}
      className="w-8 h-6 shrink-0 flex items-center justify-center rounded-sm bg-muted text-[10px] font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: SideRow (bandeira + nome + badge opcional de vencedor)
// ---------------------------------------------------------------------------

function SideRow({
  side,
  isWinner,
}: {
  side: KnockoutSide;
  isWinner?: boolean;
}) {
  return (
    <div
      data-winner={isWinner || undefined}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg",
        isWinner &&
          "ring-2 ring-primary/60 px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-shadow duration-150",
      )}
    >
      <SideFlag side={side} />
      <span
        className={cn(
          "truncate text-sm",
          side.defined ? "text-foreground" : "text-muted-foreground",
          isWinner && "font-medium",
        )}
      >
        {side.name}
      </span>
      {isWinner && (
        <Trophy
          size={12}
          aria-hidden={true}
          data-testid="winner-icon"
          className="shrink-0 text-amber-500"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rótulo de status (variante compact) — label + cor por situação do jogo
// ---------------------------------------------------------------------------

const COMPACT_STATUS: Record<
  KnockoutMatchStatus,
  { label: string; className: string }
> = {
  aguardando: { label: "Aguardando", className: "bg-muted text-muted-foreground" },
  definido: { label: "Agendado", className: "bg-primary/10 text-primary" },
  "em-andamento": { label: "Ao vivo", className: "bg-red-500/15 text-red-600" },
  encerrado: { label: "Encerrado", className: "bg-foreground/10 text-foreground" },
};

// ---------------------------------------------------------------------------
// Subcomponente: SideRowCompact (variante chaveamento — bandeira + placar)
// ---------------------------------------------------------------------------

function SideRowCompact({
  side,
  score,
  isWinner,
}: {
  side: KnockoutSide;
  score?: number;
  isWinner?: boolean;
}) {
  return (
    <div
      data-winner={isWinner || undefined}
      className={cn(
        "flex items-center justify-between gap-1.5 rounded px-1 py-1",
        isWinner && "bg-primary/10 ring-1 ring-primary/50",
      )}
    >
      <SideFlag side={side} />
      {score !== undefined && (
        <span
          className={cn(
            "text-sm tabular-nums",
            isWinner ? "font-bold text-foreground" : "font-semibold text-muted-foreground",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card de confronto eliminatório — somente leitura, 3 variantes por status.
 */
export function KnockoutMatchCard({
  match,
  variant = "full",
  className,
}: KnockoutMatchCardProps) {
  const { homeTeam, awayTeam, status, homeScore, awayScore } = match;
  const isEncerrado = status === "encerrado";
  const isAoVivo = status === "em-andamento";
  const isAguardando = status === "aguardando";

  // Placar visível em jogo encerrado OU ao vivo (parcial). Aguardando/definido: sem placar.
  const showScore = isEncerrado || isAoVivo;

  // Vencedor (ring + troféu) só ao encerrar — não coroa líder no meio do jogo.
  const winningSide = isEncerrado ? getWinningSide(match) : null;

  // Variante compacta (nó de árvore): bandeiras + placar + metadados enxutos.
  // Nomes das seleções ficam no aria-label (não há nome visível por espaço).
  if (variant === "compact") {
    const matchLabel = showScore
      ? `${homeTeam.name} ${homeScore} x ${awayScore} ${awayTeam.name}`
      : `${homeTeam.name} x ${awayTeam.name}`;
    const statusInfo = COMPACT_STATUS[status];
    return (
      <article
        aria-label={matchLabel}
        className={cn(
          "flex flex-col gap-1 rounded-lg border border-border bg-card p-1.5 shadow-sm",
          className,
        )}
      >
        {/* Metadados: data/hora + estádio/cidade */}
        <div className="text-center leading-tight">
          <p className="text-[10px] text-muted-foreground">
            {formatKickoffBr(match.kickoffAt)}
          </p>
          {match.venue?.name && (
            <p className="truncate text-[10px] text-muted-foreground/80">
              {match.venue.name}
            </p>
          )}
          {match.venue?.city && (
            <p className="truncate text-[10px] text-muted-foreground/60">
              {match.venue.city}
            </p>
          )}
        </div>

        {/* Confronto: bandeiras + placar */}
        <div>
          <SideRowCompact
            side={homeTeam}
            score={showScore ? homeScore : undefined}
            isWinner={winningSide === "home"}
          />
          <div className="my-0.5 border-t border-border/40" />
          <SideRowCompact
            side={awayTeam}
            score={showScore ? awayScore : undefined}
            isWinner={winningSide === "away"}
          />
        </div>

        {/* Status do jogo */}
        <span
          className={cn(
            "mx-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium",
            statusInfo.className,
          )}
        >
          {statusInfo.label}
        </span>
      </article>
    );
  }

  const resultLabel = showScore
    ? `${homeTeam.name} ${homeScore} x ${awayScore} ${awayTeam.name}`
    : undefined;

  return (
    <article
      aria-label={resultLabel}
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm p-4",
        className,
      )}
    >
      {/* Header: data/hora e cidade do estádio */}
      <div className="mb-2 text-center">
        <p className="text-xs text-muted-foreground">
          {formatKickoffBr(match.kickoffAt)}
        </p>
        {match.venue?.city && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            {match.venue.city}
          </p>
        )}
      </div>
      <div className="mb-3 border-t border-border/50" />

      <div className="flex items-center gap-2">
        {/* Lado mandante */}
        <SideRow side={homeTeam} isWinner={winningSide === "home"} />

        {/* Centro: placar (encerrado) ou separador "x" */}
        <div className="flex shrink-0 items-center justify-center px-2">
          {showScore ? (
            <span className="flex items-center gap-1.5 tabular-nums">
              <span className="text-2xl font-bold text-foreground">{homeScore}</span>
              <span className="text-base font-bold text-muted-foreground">x</span>
              <span className="text-2xl font-bold text-foreground">{awayScore}</span>
            </span>
          ) : (
            <span className="text-base font-bold text-muted-foreground">x</span>
          )}
        </div>

        {/* Lado visitante */}
        <SideRow side={awayTeam} isWinner={winningSide === "away"} />
      </div>

      {/* Indicador "ao vivo" — jogo em andamento com placar parcial */}
      {isAoVivo && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-red-600">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600"
          />
          Ao vivo
        </p>
      )}

      {/* Rótulo de estado para confrontos ainda não definidos */}
      {isAguardando && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Aguardando definição
        </p>
      )}
    </article>
  );
}
