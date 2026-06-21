"use client";

/**
 * Detecção de plataforma/instalação compartilhada do feature push/PWA
 * (web-push-pwa). Extraído de `registration.ts` para ser reusado pela UX de
 * instalação (TASK-06) sem duplicar a regra. Tudo guard-SSR e best-effort.
 */

/** Detecta iOS (iPhone/iPad/iPod), incluindo iPadOS que se reporta como Mac touch. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOsClassic = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ finge ser "Macintosh"; detecta pelo touch.
  const iPadOs =
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return iOsClassic || iPadOs;
}

/** App rodando instalado (tela inicial / standalone), não em aba do browser. */
export function isStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || displayStandalone;
}
