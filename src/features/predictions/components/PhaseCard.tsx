/**
 * PhaseCard — card de fase do Hub de Palpites (TASK-06, PRD03-01).
 *
 * Exibe título da fase, contagem de jogos/pendentes, status e CTA navegável
 * (ou estado "Bloqueado" sem navegação).
 *
 * Contrato: ai/spec/palpites-massa-task-06.md §6 · ai/screen/palpites-massa-task-06.md §5
 *
 * Tema: tokens apenas (`bg-card`, `text-primary`, `text-win`, `text-muted-foreground`).
 * Dentro de `.palpites-theme` o ícone/realce primário herda o verde.
 */

import Link from "next/link";
import { CheckCircle2, ChevronRight, Lock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Status de preenchimento de uma coleção de jogos (grupo, fase). */
export type FillStatus = "nao-iniciado" | "andamento" | "concluido";
/** Status de fase no Hub — inclui o bloqueio de fases futuras. */
export type PhaseStatus = FillStatus | "bloqueado";

export interface PhaseCardProps {
  /** Título da fase (ex.: "Fase de Grupos"). */
  title: string;
  /** Total de jogos da fase. */
  gamesCount: number;
  /** Jogos ainda sem palpite. */
  pendingCount: number;
  /** Status da fase. */
  status: PhaseStatus;
  /** Destino do CTA. Ignorado quando `status === "bloqueado"`. */
  href?: string;
  /** Ícone Lucide opcional à esquerda. */
  icon?: LucideIcon;
  className?: string;
}

function buildSubtitle(status: PhaseStatus, gamesCount: number, pendingCount: number): string {
  if (status === "bloqueado") return "Bloqueado";
  if (status === "concluido") return "Concluído";
  if (pendingCount > 0) return `${pendingCount} pendentes · ${gamesCount} jogos`;
  return `${gamesCount} jogos`;
}

export function PhaseCard({
  title,
  gamesCount,
  pendingCount,
  status,
  href,
  icon: Icon,
  className,
}: PhaseCardProps) {
  const isLocked = status === "bloqueado";
  const isDone = status === "concluido";
  const subtitle = buildSubtitle(status, gamesCount, pendingCount);
  const ariaLabel = `${title}, ${subtitle}`;

  const baseClasses = cn(
    "flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm",
    isLocked
      ? "opacity-60 cursor-not-allowed"
      : "transition-colors duration-150 motion-reduce:transition-none hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className,
  );

  const content = (
    <>
      {isLocked ? (
        <Lock size={20} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      ) : Icon ? (
        <Icon size={20} aria-hidden="true" className="shrink-0 text-primary" />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span
          className={cn(
            "text-xs",
            isDone ? "text-win" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </span>
      </div>

      {isLocked ? null : isDone ? (
        <CheckCircle2 size={20} aria-hidden="true" className="shrink-0 text-win" />
      ) : (
        <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      )}
    </>
  );

  if (isLocked || !href) {
    return (
      <div className={baseClasses} aria-label={ariaLabel} aria-disabled={isLocked || undefined}>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={baseClasses} aria-label={ariaLabel}>
      {content}
    </Link>
  );
}
