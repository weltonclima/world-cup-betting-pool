"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Estado de erro do ranking + retry (PRD-05, TASK-07). */
export interface RankingErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export function RankingErrorState({
  onRetry,
  message = "Erro ao carregar ranking",
}: RankingErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center"
    >
      <AlertTriangle size={40} aria-hidden="true" className="text-destructive" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <Button
        onClick={onRetry}
        className="min-h-11 px-6"
        aria-label="Tentar novamente"
      >
        Tentar Novamente
      </Button>
    </div>
  );
}
