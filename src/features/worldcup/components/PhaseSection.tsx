"use client";

/**
 * PhaseSection — uma fase do chaveamento (TASK-08).
 *
 * Título da fase (pt-BR) + lista vertical de KnockoutMatchCard.
 * Renderiza null quando o bucket está vazio (degrada graciosamente; o
 * BracketView já filtra, mas a guarda mantém o componente seguro isolado).
 */

import { useId } from "react";

import { cn } from "@/lib/utils";
import type { KnockoutMatch } from "@/types/worldcup";

import { KnockoutMatchCard } from "./KnockoutMatchCard";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface PhaseSectionProps {
  /** Rótulo da fase em pt-BR (ex.: "Oitavas de Final"). */
  label: string;
  /** Confrontos da fase. */
  matches: KnockoutMatch[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Seção de uma fase eliminatória: cabeçalho + cards de confronto empilhados.
 */
export function PhaseSection({ label, matches, className }: PhaseSectionProps) {
  const headingId = useId();

  if (matches.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-3", className)}
    >
      <h2 id={headingId} className="text-sm font-semibold text-foreground">
        {label}
        <span className="ml-1.5 font-normal text-muted-foreground">
          · {matches.length === 1 ? "1 jogo" : `${matches.length} jogos`}
        </span>
      </h2>

      <div className="flex flex-col gap-3">
        {matches.map((match) => (
          <KnockoutMatchCard key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}
