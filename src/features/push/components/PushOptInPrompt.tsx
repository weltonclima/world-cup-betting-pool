"use client";

import { type JSX } from "react";
import { BellRing, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePushOptInPrompt } from "@/features/push/hooks/usePushOptInPrompt";

interface PushOptInPromptProps {
  className?: string;
}

/**
 * Banner pró-ativo de opt-in de push (push-optin). Aparece na abertura do app
 * para quem ainda não ligou o push, em qualquer tela do shell autenticado.
 *
 * - "Ativar": pede permissão, registra o token e liga `pushEnabled`.
 * - "Agora não": adia o banner por 24h (re-nag diário, não some pra sempre).
 * - Some sozinho quando push é ligado ou a permissão é negada.
 *
 * Auto-gated via `usePushOptInPrompt`; best-effort, nada aqui pode lançar.
 */
export function PushOptInPrompt({
  className,
}: PushOptInPromptProps): JSX.Element | null {
  const { shouldShow, activating, activate, snooze } = usePushOptInPrompt();

  if (!shouldShow) return null;

  return (
    <div
      role="region"
      aria-label="Ativar notificações"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BellRing size={20} aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">
          Ative as notificações
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Receba alertas de jogos, resultados e ranking.
        </span>
      </div>

      <Button
        size="default"
        className="min-h-11 shrink-0"
        disabled={activating}
        onClick={() => void activate()}
      >
        <BellRing aria-hidden="true" />
        Ativar
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        className="min-h-11 min-w-11 shrink-0"
        aria-label="Agora não"
        onClick={snooze}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
