"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/features/push/hooks/useInstallPrompt";

import { IosInstallGuide } from "./IosInstallGuide";

interface InstallPromptProps {
  className?: string;
}

/**
 * Banner dispensável de instalação do PWA (web-push-pwa TASK-06).
 *
 * - Android/Chromium: botão "Instalar" dispara o prompt nativo capturado.
 * - iOS Safari (não-standalone): "Como instalar" abre o tutorial visual.
 * - Standalone / sem suporte / dispensado: não renderiza (`null`).
 *
 * Auto-gated via `useInstallPrompt`; best-effort, nada aqui pode lançar.
 * Não pede permissão de notificação (gate iOS de TASK-02 fica em
 * `registration.canRequestPush`).
 */
export function InstallPrompt({ className }: InstallPromptProps): JSX.Element | null {
  const {
    canInstallAndroid,
    isIos,
    isStandalone,
    dismissed,
    promptInstall,
    dismiss,
  } = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Aceitar/recusar o prompt zera `canInstallAndroid` → este componente
  // desmonta. Evita setState no nó já desmontado dentro do `finally`.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Não oferece quando já instalado ou já dispensado.
  if (isStandalone || dismissed) return null;

  const showIos = isIos; // iOS nunca tem beforeinstallprompt → tutorial manual
  const showAndroid = canInstallAndroid && !isIos;
  if (!showIos && !showAndroid) return null;

  async function handleAndroidInstall(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await promptInstall();
      // Aceito ou recusado: o hook já limpa o evento e esconde o CTA.
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label="Instalar aplicativo"
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
          className,
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download size={20} aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">
            Instale o Bolão
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Acesso rápido na tela inicial e notificações.
          </span>
        </div>

        {showAndroid ? (
          <Button
            size="default"
            className="min-h-11 shrink-0"
            disabled={busy}
            onClick={() => void handleAndroidInstall()}
          >
            <Download aria-hidden="true" />
            Instalar
          </Button>
        ) : (
          <Button
            size="default"
            className="min-h-11 shrink-0"
            onClick={() => setGuideOpen(true)}
          >
            <Share aria-hidden="true" />
            Como instalar
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="min-h-11 min-w-11 shrink-0"
          aria-label="Dispensar"
          onClick={dismiss}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      {showIos ? (
        <IosInstallGuide open={guideOpen} onOpenChange={setGuideOpen} />
      ) : null}
    </>
  );
}
