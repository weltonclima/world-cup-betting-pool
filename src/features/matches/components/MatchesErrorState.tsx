"use client";

/**
 * MatchesErrorState — estado de erro da lista de jogos (TASK-03).
 * Exibe quando a query de matches falha, com botão "Tentar novamente".
 */

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface MatchesErrorStateProps {
  /** Callback invocado ao clicar em "Tentar novamente". Obrigatório. */
  onRetry: () => void;
  /** Mensagem de erro. Default: "Erro ao carregar jogos". */
  message?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Estado de erro — exibe ícone de alerta + mensagem + botão de retry.
 */
export function MatchesErrorState({
  onRetry,
  message = "Erro ao carregar jogos",
}: MatchesErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4">
      <AlertCircle
        size={40}
        aria-hidden="true"
        className="text-destructive"
      />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="min-h-[44px] px-6"
        aria-label="Tentar novamente"
      >
        Tentar novamente
      </Button>
    </div>
  );
}
