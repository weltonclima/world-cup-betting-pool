"use client";

/**
 * StandingsLegend — legenda da tabela de classificação dos grupos (TASK-07).
 * Duas partes:
 * 1. Abreviações das colunas: J, V, E, D, GP, GC, SG, PTS com descrição completa.
 * 2. Cores de qualificação: amostras de cor (barra border-l-4) + rótulos textuais.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface StandingsLegendProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Dados de legenda de abreviações
// ---------------------------------------------------------------------------

/** Abreviações das colunas da tabela (strings exatas do PRD). */
const ABBREVIATIONS = "J Jogos · V Vitórias · E Empates · D Derrotas · GP Gols Pró · GC Gols Contra · SG Saldo de Gols · PTS Pontos";

// ---------------------------------------------------------------------------
// Dados de legenda de qualificação
// ---------------------------------------------------------------------------

interface QualificationLegendItem {
  /** Classes Tailwind da barra de cor (espelha a barra border-l-4 das linhas da tabela). */
  barClass: string;
  label: string;
}

/** Itens de legenda de qualificação (tokens-only, sem hex — ui-spec §10). */
const QUALIFICATION_ITEMS: QualificationLegendItem[] = [
  { barClass: "border-l-4 border-primary", label: "Classificado" },
  { barClass: "border-l-4 border-primary/40", label: "Possível classificado" },
  { barClass: "border-l-4 border-muted-foreground/30", label: "Eliminado" },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Legenda abaixo da tabela de grupos: abreviações de colunas + cores de qualificação.
 */
export function StandingsLegend({ className }: StandingsLegendProps) {
  return (
    <div className={cn("mt-3 space-y-2 text-xs text-muted-foreground", className)}>
      {/* Abreviações das colunas */}
      <p>{ABBREVIATIONS}</p>

      {/* Cores de qualificação */}
      <div className="flex flex-wrap gap-3">
        {QUALIFICATION_ITEMS.map(({ barClass, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            {/* Amostra de cor — barra vertical que espelha o border-l-4 das linhas */}
            <span
              aria-hidden="true"
              className={cn("inline-block h-4 w-0", barClass)}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
