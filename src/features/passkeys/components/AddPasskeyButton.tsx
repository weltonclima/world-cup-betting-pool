"use client";

import type { JSX } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

/**
 * CTA primário "Ativar biometria neste dispositivo" (TASK-06). Estilizado como
 * card row (consistente com ProfileMenuItem), com ícone em destaque verde.
 * Deve ser acionado por gesto do usuário (req. iOS Safari).
 */
export function AddPasskeyButton({
  onClick,
  loading = false,
  disabled = false,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {loading ? (
          <LoaderCircle
            size={20}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <ShieldCheck size={20} aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">
          {loading ? "Aguardando biometria…" : "Biometria neste dispositivo"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Face ID, Touch ID ou digital
        </span>
      </span>
    </button>
  );
}
