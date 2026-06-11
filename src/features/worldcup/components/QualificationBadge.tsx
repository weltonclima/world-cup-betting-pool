"use client";

/**
 * QualificationBadge — badge textual de qualificação para a tabela de grupos (TASK-07).
 * Mapeia Qualification → rótulo + variante de Badge.
 * Retorna null para "indefinido" (situação ainda não definida).
 */

import { Badge } from "@/components/ui/badge";
import type { Qualification } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface QualificationBadgeProps {
  qualification: Qualification;
  className?: string;
}

// ---------------------------------------------------------------------------
// Mapeamento de qualificação → rótulo + variante
// ---------------------------------------------------------------------------

/**
 * Variantes do Badge disponíveis no sistema de design (badge.tsx).
 * Espelham as variantes do cva sem depender do tipo interno.
 */
type BadgeVariant = "default" | "secondary" | "muted" | "destructive" | "outline";

interface QualificationConfig {
  label: string;
  variant: BadgeVariant;
}

const QUALIFICATION_MAP: Record<Exclude<Qualification, "indefinido">, QualificationConfig> = {
  classificado: { label: "Classificado", variant: "default" },
  possivel: { label: "Possível classificado", variant: "secondary" },
  eliminado: { label: "Eliminado", variant: "muted" },
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Badge de qualificação — exibe o rótulo textual com a variante de cor adequada.
 * Usado pela legenda (StandingsLegend) e opcionalmente em listagens.
 * Retorna null para "indefinido" (situação não definida — sem badge textual).
 */
export function QualificationBadge({ qualification, className }: QualificationBadgeProps) {
  if (qualification === "indefinido") return null;

  const { label, variant } = QUALIFICATION_MAP[qualification];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
