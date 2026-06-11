"use client";

/**
 * WorldcupErrorState — estado de erro compartilhado para a feature Copa (TASK-07).
 * Reutilizado por GroupsView e BracketView (TASK-08).
 *
 * Mensagem default exata do PRD: "Erro ao carregar informações."
 * Botão de retry: "Tentar novamente" (min-h-[44px]).
 */

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface WorldcupErrorStateProps {
  /** Callback invocado ao clicar em "Tentar novamente". Obrigatório. */
  onRetry: () => void;
  /** Mensagem de erro. Default: "Erro ao carregar informações." */
  message?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Estado de erro — ícone de alerta + mensagem + botão de retry.
 */
export function WorldcupErrorState({
  onRetry,
  message = "Erro ao carregar informações.",
  className,
}: WorldcupErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 gap-4 text-center px-4",
        className,
      )}
    >
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
      >
        Tentar novamente
      </Button>
    </div>
  );
}
