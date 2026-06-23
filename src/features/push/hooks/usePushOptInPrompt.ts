"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { registerPush } from "@/features/push/registration";
import { usePushRegistration } from "@/features/push/hooks/usePushRegistration";
import {
  usePreferences,
  useUpdatePreferences,
} from "@/features/notifications/hooks";

/**
 * Soft-ask de push para todos os usuários (push-optin). O opt-in via tela de
 * Preferências (TASK-05) é passivo — quem nunca abre Preferências nunca liga o
 * push. Este hook dirige um banner pró-ativo na abertura do app (mountado no
 * shell, não no login: a sessão persiste e um prompt pós-login não dispararia).
 *
 * Permissão de browser NÃO pode ser forçada server-side; "Bloquear" é definitivo
 * e queima o grant iOS. A pressão legítima máxima é insistir: a dispensa apenas
 * adia ("snooze" diário), não some pra sempre como o `InstallPrompt`.
 */

/** Timestamp (ms) até o qual o banner fica suprimido. localStorage. */
export const PUSH_OPTIN_SNOOZE_KEY = "push-optin-snoozed-until";

/** Re-nag diário: "Agora não" adia 24h em vez de dispensar permanente. */
export const PUSH_OPTIN_SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface UsePushOptInPrompt {
  /** Banner deve aparecer agora (todas as condições de gate satisfeitas). */
  shouldShow: boolean;
  /** Opt-in em voo (prompt de permissão + registro do token + write). */
  activating: boolean;
  /** Liga o push: pede permissão, registra token e liga `pushEnabled`. */
  activate: () => Promise<void>;
  /** Adia o banner por `PUSH_OPTIN_SNOOZE_MS` (persistido). */
  snooze: () => void;
}

/** Lê o snooze do localStorage com guard SSR/erro. 0 = nunca adiado. */
function readSnoozedUntil(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(PUSH_OPTIN_SNOOZE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Estado do soft-ask de push. Combina suporte/permissão (`usePushRegistration`),
 * o master switch `pushEnabled` (`usePreferences`) e o snooze local. Best-effort:
 * nada aqui pode lançar.
 */
export function usePushOptInPrompt(): UsePushOptInPrompt {
  const push = usePushRegistration();
  const query = usePreferences();
  const update = useUpdatePreferences();

  // Antes do mount, snoozedUntil=+∞ e now=0 → snooze ativo → banner escondido.
  // Evita flash na hidratação (localStorage só existe no client).
  const [snoozedUntil, setSnoozedUntil] = useState<number>(
    Number.POSITIVE_INFINITY,
  );
  const [now, setNow] = useState<number>(0);
  const [activating, setActivating] = useState<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    setSnoozedUntil(readSnoozedUntil());
    setNow(Date.now());
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const snoozed = now < snoozedUntil;
  const shouldShow =
    push.supported &&
    push.permission !== "denied" &&
    query.data?.pushEnabled === false &&
    !snoozed &&
    !activating;

  const activate = useCallback(async (): Promise<void> => {
    if (activating) return;
    setActivating(true);
    try {
      const token = await registerPush();
      if (!token) {
        // Negada / sem suporte / falha de rede: sem token o push não chega.
        toast.error("Não foi possível ativar as notificações.");
        return;
      }
      const data = query.data;
      if (!data) return;
      // Liga o master switch; pushEnabled=true → shouldShow vira false sozinho
      // após o invalidate da query (não precisa snooze no sucesso).
      update.mutate(
        {
          system: data.system,
          games: data.games,
          ranking: data.ranking,
          pushEnabled: true,
        },
        {
          onError: () =>
            toast.error("Não foi possível salvar a preferência."),
        },
      );
    } catch (error) {
      console.warn("[push] opt-in falhou (best-effort)", error);
    } finally {
      if (mountedRef.current) setActivating(false);
    }
  }, [activating, query.data, update]);

  const snooze = useCallback((): void => {
    const until = Date.now() + PUSH_OPTIN_SNOOZE_MS;
    setSnoozedUntil(until);
    setNow(Date.now());
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PUSH_OPTIN_SNOOZE_KEY, String(until));
      }
    } catch {
      // localStorage indisponível (modo privado / bloqueado) — best-effort.
    }
  }, []);

  return { shouldShow, activating, activate, snooze };
}
