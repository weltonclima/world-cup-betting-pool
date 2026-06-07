"use client";

/**
 * MatchesEmptyState — estado vazio da lista de jogos (TASK-03).
 * Exibe quando não há jogos para o filtro/busca aplicado.
 */

import { Calendar } from "lucide-react";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface MatchesEmptyStateProps {
  /** Mensagem principal. Default: "Nenhum jogo encontrado". */
  message?: string;
  /** Subtexto auxiliar opcional. */
  subtitle?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Estado vazio — exibe ícone de calendário + mensagem quando a lista está vazia.
 */
export function MatchesEmptyState({
  message = "Nenhum jogo encontrado",
  subtitle,
}: MatchesEmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4"
    >
      <Calendar
        size={40}
        aria-hidden="true"
        className="text-muted-foreground"
      />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
