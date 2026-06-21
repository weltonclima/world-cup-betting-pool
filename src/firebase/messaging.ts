"use client";

import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";

import { firebaseApp } from "./client";
import { firebaseClientEnv } from "./env";

/**
 * Wrappers client-only de `firebase/messaging` (web-push-pwa TASK-02).
 *
 * Toda a borda é best-effort e degrada gracioso: em SSR, browser sem suporte
 * (sem Notification/PushManager/ServiceWorker) ou VAPID ausente, as funções
 * retornam `null`/`false`/no-op em vez de lançar. O envio do token ao backend e
 * a orquestração (gate iOS, POST/DELETE) ficam em `features/push/registration`.
 */

const VAPID_KEY = firebaseClientEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Singleton da instância de Messaging (resolvida async por causa de isSupported).
let messagingPromise: Promise<Messaging | null> | undefined;

/**
 * Resolve a instância de Messaging se o ambiente suportar, senão `null`.
 * Guards: SSR (`window`) e `isSupported()` (Push API + SW + Notification).
 * Resultado memoizado (a checagem de suporte é estável no ciclo da página).
 */
export function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (messagingPromise) return messagingPromise;

  messagingPromise = isSupported()
    .then((ok) => (ok ? getMessaging(firebaseApp) : null))
    .catch(() => null);

  return messagingPromise;
}

/**
 * Indica se o opt-in de push deve ser oferecido na UI. Falso quando: SSR, sem
 * suporte do browser, ou VAPID key ausente (degrada gracioso — opt-in oculto).
 */
export async function isPushSupported(): Promise<boolean> {
  if (!VAPID_KEY) return false;
  const messaging = await getMessagingIfSupported();
  return messaging !== null;
}

/**
 * Obtém o token FCM do device. A própria chamada de `getToken` dispara
 * `Notification.requestPermission()` quando a permissão está `default` — por
 * isso só deve ser invocada no momento intencional (ação do usuário). Retorna
 * `null` (sem lançar) quando: sem suporte, VAPID ausente, ou permissão negada /
 * erro. FCM auto-registra `/firebase-messaging-sw.js` no seu próprio escopo.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!VAPID_KEY) return null;
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (error) {
    // Permissão bloqueada / falha de rede do FCM — best-effort, não propaga.
    console.warn("[push] falha ao obter token FCM", error);
    return null;
  }
}

/**
 * Lê o token FCM corrente SEM disparar prompt de permissão. Só tenta quando a
 * permissão já é `granted` (no `default`, `getToken` pediria permissão — não
 * queremos isso no load nem no logout). Retorna `null` caso contrário.
 */
export async function getCurrentPushToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "granted") return null;
  return requestPushToken();
}

/** Revoga o token FCM localmente (desinscrição do Push). Best-effort. */
export async function deletePushTokenLocal(): Promise<void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  try {
    await deleteToken(messaging);
  } catch (error) {
    console.warn("[push] falha ao revogar token FCM local", error);
  }
}

/**
 * Subscreve mensagens em foreground (app aberto). Consumido por TASK-05
 * (dedup foreground). Aqui só expõe o wrapper; retorna unsubscribe no-op se
 * sem suporte. A lógica de supressão NÃO pertence a este task.
 */
export function onForegroundMessage(
  cb: (payload: MessagePayload) => void,
): () => void {
  let unsubscribe: (() => void) | undefined;
  let cancelled = false;

  void getMessagingIfSupported().then((messaging) => {
    if (!messaging || cancelled) return;
    unsubscribe = onMessage(messaging, cb);
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
