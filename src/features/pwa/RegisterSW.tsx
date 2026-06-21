"use client";

import { useEffect } from "react";

/**
 * Registra o service worker base (`/sw.js`) no client, best-effort.
 * Guards: SSR (`window`) e suporte (`serviceWorker` no navigator).
 * Falha de registro nunca propaga — não pode quebrar o render.
 * Renderiza `null` (sem UI). TASK-02 estende o SW (FCM/notificationclick).
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      // best-effort: log apenas, sem quebrar o app
      console.warn("[pwa] falha ao registrar service worker", err);
    });
  }, []);

  return null;
}
