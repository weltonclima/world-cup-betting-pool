"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isIos, isStandalone } from "@/features/push/platform";

/**
 * Chave de persistência da dispensa. Por decisão de produto (spec TASK-06,
 * "não mostrar de novo") a dispensa é permanente neste browser — o usuário
 * ainda pode instalar pelo menu nativo do navegador. Limpar a chave reexibe.
 */
export const INSTALL_DISMISSED_KEY = "pwa-install-dismissed";

/**
 * Evento `beforeinstallprompt` — não faz parte da lib DOM padrão do TS.
 * Tipado localmente com o shape que de fato consumimos.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PromptOutcome = "accepted" | "dismissed" | "unavailable";

export interface UseInstallPrompt {
  /** Android/Chromium elegível: há um `beforeinstallprompt` capturado. */
  canInstallAndroid: boolean;
  /** Plataforma iOS (sem `beforeinstallprompt` → tutorial manual). */
  isIos: boolean;
  /** App já rodando instalado (standalone) → não oferecer instalação. */
  isStandalone: boolean;
  /** Usuário já dispensou o banner (persistido em localStorage). */
  dismissed: boolean;
  /** Dispara o prompt nativo (Android). Retorna o outcome ou "unavailable". */
  promptInstall: () => Promise<PromptOutcome>;
  /** Marca "não mostrar de novo" (persiste + esconde o banner). */
  dismiss: () => void;
}

/** Lê a flag de dispensa do localStorage com guard SSR/erro. */
function readDismissed(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Hook da UX de instalação do PWA (web-push-pwa TASK-06). Captura o evento
 * `beforeinstallprompt` (Android/Chromium), detecta plataforma/standalone e
 * gerencia a dispensa persistida. Não decide layout — o componente
 * `InstallPrompt` consome este estado. Best-effort, guard-SSR.
 */
export function useInstallPrompt(): UseInstallPrompt {
  const [canInstallAndroid, setCanInstallAndroid] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  // Snapshots estáveis no ciclo da página (evitam mismatch de hidratação:
  // só lidos após o mount, no client).
  const [ios, setIos] = useState<boolean>(false);
  const [standalone, setStandalone] = useState<boolean>(false);
  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setIos(isIos());
    setStandalone(isStandalone());
    setDismissed(readDismissed());

    const onBeforeInstallPrompt = (event: Event): void => {
      // Impede o mini-infobar nativo; guardamos o evento para disparar no CTA.
      event.preventDefault();
      promptEventRef.current = event as BeforeInstallPromptEvent;
      setCanInstallAndroid(true);
    };

    const onInstalled = (): void => {
      // Instalou via prompt nativo (Android/Chromium): esconde o CTA e libera
      // o evento. (iOS não dispara `appinstalled`; ao reabrir já vem standalone
      // → o banner some pelo gate `isStandalone`.)
      promptEventRef.current = null;
      setCanInstallAndroid(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<PromptOutcome> => {
    const event = promptEventRef.current;
    if (!event) return "unavailable";
    try {
      await event.prompt();
      const choice = await event.userChoice;
      // O evento só pode ser usado uma vez.
      promptEventRef.current = null;
      setCanInstallAndroid(false);
      return choice.outcome;
    } catch (error) {
      console.warn("[pwa] falha ao disparar prompt de instalação", error);
      return "unavailable";
    }
  }, []);

  const dismiss = useCallback((): void => {
    setDismissed(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      }
    } catch {
      // localStorage indisponível (modo privado / bloqueado) — best-effort.
    }
  }, []);

  return {
    canInstallAndroid,
    isIos: ios,
    isStandalone: standalone,
    dismissed,
    promptInstall,
    dismiss,
  };
}
