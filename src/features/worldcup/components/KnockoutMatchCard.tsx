"use client";

/**
 * KnockoutMatchCard — card de um confronto de mata-mata (TASK-08).
 *
 * Componente presentacional puro (sem hooks/fetch). 3 variantes por `status`:
 *   - aguardando → nomes/rótulos placeholder + "Aguardando definição" (sem placar)
 *   - definido   → bandeiras + nomes, separador "x" (sem placar)
 *   - encerrado  → bandeiras + nomes + placar "home x away" em destaque
 *
 * Os estados derivam direto de `match.status` (validado pelas refines do schema
 * em TASK-01); não recomputamos a partir de defined/scores.
 *
 * Contrato visual: ai/ui-spec/grupos-eliminatorias-task-08.md
 */

import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { KnockoutMatch, KnockoutSide } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface KnockoutMatchCardProps {
  match: KnockoutMatch;
  className?: string;
}

// ---------------------------------------------------------------------------
// Subcomponente: SideFlag (bandeira de seleção definida ou ícone neutro)
// Espelha o padrão de TeamFlag (MatchCard/GroupStandingsTable).
// ---------------------------------------------------------------------------

function SideFlag({ side }: { side: KnockoutSide }) {
  // Lado ainda não apurado → ícone neutro (significado vem do nome textual).
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
        className="w-8 h-6 shrink-0 rounded-sm object-contain"
      />
    );
  }

  // Fallback: iniciais (até 3 letras) quando flagUrl ausente.
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
// Subcomponente: SideRow (bandeira + nome de um lado)
// ---------------------------------------------------------------------------

function SideRow({ side }: { side: KnockoutSide }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <SideFlag side={side} />
      <span
        className={cn(
          "truncate text-sm",
          side.defined ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {side.name}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card de confronto eliminatório — somente leitura, 3 variantes por status.
 */
export function KnockoutMatchCard({ match, className }: KnockoutMatchCardProps) {
  const { homeTeam, awayTeam, status, homeScore, awayScore } = match;
  const isEncerrado = status === "encerrado";
  const isAguardando = status === "aguardando";

  // aria-label completo do resultado quando encerrado.
  const resultLabel = isEncerrado
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
      <div className="flex items-center gap-2">
        {/* Lado mandante */}
        <SideRow side={homeTeam} />

        {/* Centro: placar (encerrado) ou separador "x" */}
        <div className="flex shrink-0 items-center justify-center px-2">
          {isEncerrado ? (
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
        <SideRow side={awayTeam} />
      </div>

      {/* Rótulo de estado para confrontos ainda não definidos */}
      {isAguardando && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Aguardando definição
        </p>
      )}
    </article>
  );
}
