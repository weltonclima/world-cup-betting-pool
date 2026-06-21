"use client";

import { useEffect } from "react";

import { onForegroundMessage } from "@/firebase/messaging";

/**
 * Dedup de push em foreground (web-push-pwa TASK-05).
 *
 * Com o app aberto, o usuário já vê sino + toast in-app (listener realtime do
 * PRD-15). Assinar `onMessage` faz o FCM ROTEAR a mensagem em foreground para
 * este handler em vez de exibir a notificação do SO — e aqui NÃO chamamos
 * `showNotification`, evitando a duplicata (push do SO + in-app). Em background,
 * o service worker (TASK-02) segue exibindo normalmente.
 *
 * Headless: não renderiza nada. No-op silencioso sem suporte (o wrapper
 * `onForegroundMessage` resolve para unsubscribe vazio). Montar uma vez no shell
 * autenticado (onde vive o sino).
 */
export function useForegroundPush(): void {
  useEffect(() => {
    const unsubscribe = onForegroundMessage(() => {
      // Intencionalmente vazio: sino + toast in-app já cobrem o evento.
      // Não exibir notificação do SO → sem duplicata com o app aberto.
    });
    return unsubscribe;
  }, []);
}
