"use client";

/**
 * CupOnlyNotice — aviso de recurso disponível apenas para copas/torneios
 * (multi-championship TASK-10).
 *
 * Semântica distinta do `WorldcupEmptyState` ("sem dados"): aqui o recurso NÃO se
 * aplica ao tipo do campeonato ativo (liga de pontos corridos não tem fase de
 * grupos nem chaveamento). Reutiliza o mesmo conjunto de tokens visuais da casa
 * (ícone 40 / `text-muted-foreground`, `role="status"`, tipografia da mensagem)
 * para consistência — só troca o ícone default (Trophy) e a semântica da cópia.
 */

import { Trophy, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CupOnlyNoticeProps {
  /** Mensagem exibida (ex.: "Chaveamento disponível apenas para copas..."). */
  message: string;
  /** Ícone lucide opcional. Default: `Trophy`. */
  icon?: LucideIcon;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/** Aviso centralizado "recurso só para copas" — ícone + mensagem. */
export function CupOnlyNotice({
  message,
  icon: Icon = Trophy,
  className,
}: CupOnlyNoticeProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-12 gap-3 text-center px-4",
        className,
      )}
    >
      <Icon size={40} aria-hidden="true" className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{message}</p>
    </div>
  );
}
