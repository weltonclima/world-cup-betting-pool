/**
 * GroupCard — card de grupo do grid de seleção (TASK-06, PRD03-02).
 *
 * Exibe nome do grupo, progresso ("X / Y" + barra) e status (não-iniciado /
 * andamento / concluído ✓). Suporta estado `selected` (realce verde).
 *
 * Contrato: ai/spec/palpites-massa-task-06.md §6 · ai/screen/palpites-massa-task-06.md §5
 *
 * Tema: tokens apenas (`bg-card`, `border-primary`, `ring-primary`, `text-win`).
 * Dentro de `.palpites-theme` o realce de seleção herda o verde.
 */

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { ProgressBar } from "./ProgressBar";
import type { FillStatus } from "./PhaseCard";

export interface GroupCardProps {
  /** Nome do grupo (ex.: "Grupo C"). */
  name: string;
  /** Jogos já preenchidos. */
  filledCount: number;
  /** Total de jogos do grupo. Default 6. */
  totalCount?: number;
  /** Status de preenchimento. */
  status: FillStatus;
  /** Destino ao tocar no card. */
  href?: string;
  /** Realce de seleção (borda/ring primary). */
  selected?: boolean;
  className?: string;
}

const STATUS_LABEL: Record<FillStatus, string> = {
  "nao-iniciado": "não iniciado",
  andamento: "em andamento",
  concluido: "concluído",
};

export function GroupCard({
  name,
  filledCount,
  totalCount = 6,
  status,
  href,
  selected = false,
  className,
}: GroupCardProps) {
  const isDone = status === "concluido";
  const ariaLabel = `${name}, ${filledCount} de ${totalCount} jogos, ${STATUS_LABEL[status]}`;

  const baseClasses = cn(
    "flex min-h-[44px] flex-col gap-2 rounded-xl border bg-card p-3",
    "transition-colors duration-150 motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    selected
      ? "border-primary ring-1 ring-primary"
      : "border-border hover:border-primary/50",
    className,
  );

  const content = (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        {isDone ? (
          <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-win" />
        ) : null}
      </div>
      <ProgressBar
        value={filledCount}
        total={totalCount}
        showPercent={false}
        className="gap-1"
      />
    </>
  );

  if (!href) {
    return (
      <div className={baseClasses} aria-label={ariaLabel} aria-current={selected || undefined}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={baseClasses}
      aria-label={ariaLabel}
      aria-current={selected || undefined}
    >
      {content}
    </Link>
  );
}
