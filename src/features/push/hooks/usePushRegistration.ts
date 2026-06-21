"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isPushSupported } from "@/firebase/messaging";
import {
  canRequestPush,
  refreshPushTokenOnLoad,
  registerPush,
  unregisterPush,
} from "@/features/push/registration";

/**
 * Estado inicial de permissão, com guard SSR/sem-suporte. `Notification` pode
 * não existir (SSR, browser antigo) → tratamos como "default".
 */
function readPermission(): NotificationPermission {
  try {
    if (typeof Notification === "undefined") return "default";
    return Notification.permission;
  } catch {
    return "default";
  }
}

export interface UsePushRegistration {
  /** Push é oferecível neste ambiente (suporte + VAPID + gate iOS). */
  supported: boolean;
  /** Estado da permissão de notificação do browser. */
  permission: NotificationPermission;
  /** true enquanto `register` está em andamento. */
  registering: boolean;
  /** Opt-in intencional: pede permissão e registra o token. Best-effort. */
  register: () => Promise<void>;
  /** Remove o token (backend + local). Best-effort. */
  unregister: () => Promise<void>;
}

/**
 * Hook de registro de Web Push (web-push-pwa TASK-02). Dirige o opt-in de
 * notificação: resolve suporte de forma assíncrona, re-registra o token no load
 * quando já há permissão, e expõe `register`/`unregister`. Não pede permissão no
 * load — só em `register` (ação intencional do usuário).
 */
export function usePushRegistration(): UsePushRegistration {
  const [supported, setSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [registering, setRegistering] = useState<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;

    void (async () => {
      const ok = (await isPushSupported()) && canRequestPush();
      if (!mountedRef.current) return;
      setSupported(ok);
      setPermission(readPermission());
      // Lifecycle: atualiza lastSeenAt no load se a permissão já foi concedida.
      void refreshPushTokenOnLoad();
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const register = useCallback(async (): Promise<void> => {
    if (mountedRef.current) setRegistering(true);
    try {
      // `registerPush` já é best-effort, mas o hook nunca pode lançar
      // (handler de clique/UI): captura qualquer falha inesperada.
      await registerPush();
    } catch (error) {
      console.warn("[push] register falhou (best-effort)", error);
    } finally {
      if (mountedRef.current) {
        setPermission(readPermission());
        setRegistering(false);
      }
    }
  }, []);

  const unregister = useCallback(async (): Promise<void> => {
    await unregisterPush();
    if (mountedRef.current) setPermission(readPermission());
  }, []);

  return { supported, permission, registering, register, unregister };
}
