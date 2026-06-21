"use client";

import {
  deletePushTokenLocal,
  getCurrentPushToken,
  requestPushToken,
} from "@/firebase/messaging";
import { deletePushToken, registerPushToken } from "@/services/pushTokens";

import { isIos, isStandalone } from "./platform";

/**
 * Orquestração de registro de push (web-push-pwa TASK-02). Funções planas
 * (sem React) reusadas pelo hook `usePushRegistration` e pelo fluxo de logout
 * (`services/auth.signOut`). Tudo best-effort: nenhuma falha de push pode
 * derrubar a UI nem o logout.
 *
 * Detecção de plataforma (`isIos`/`isStandalone`) vive em `./platform` —
 * compartilhada com a UX de instalação (TASK-06).
 */

/**
 * Em iOS, Web Push só funciona com o PWA instalado (standalone). Pedir permissão
 * numa aba não-instalada QUEIMA a permissão (iOS não remostra o prompt). Bloqueia
 * o opt-in nesse caso. Em outras plataformas sempre libera.
 */
export function canRequestPush(): boolean {
  if (isIos() && !isStandalone()) return false;
  return true;
}

/**
 * Fluxo intencional de opt-in: gate iOS → obtém token (dispara o prompt de
 * permissão) → registra no backend (POST idempotente). Retorna o token ou `null`
 * (gate bloqueado / sem suporte / permissão negada / falha de rede). Best-effort.
 */
export async function registerPush(): Promise<string | null> {
  if (!canRequestPush()) return null;

  const token = await requestPushToken();
  if (!token) return null;

  try {
    await registerPushToken(token);
  } catch (error) {
    // Token obtido mas POST falhou — best-effort, não propaga.
    console.warn("[push] falha ao registrar token no backend", error);
    return null;
  }
  return token;
}

/**
 * Re-registra o token no app load quando a permissão já é `granted` (atualiza
 * `lastSeenAt` via POST idempotente). NÃO dispara prompt. No-op silencioso se
 * sem permissão/suporte. Cobre o "lifecycle" do token (o SDK modular não expõe
 * `onTokenRefresh`; re-adquirir no load é o padrão).
 */
export async function refreshPushTokenOnLoad(): Promise<void> {
  const token = await getCurrentPushToken();
  if (!token) return;
  try {
    await registerPushToken(token);
  } catch (error) {
    console.warn("[push] falha ao re-registrar token no load", error);
  }
}

/**
 * Limpeza no logout / revogação: remove o token no backend (DELETE) e revoga
 * localmente. Evita push cruzada em device compartilhado. Best-effort em ambas
 * as pernas — nunca lança (não pode bloquear o logout).
 */
export async function unregisterPush(): Promise<void> {
  const token = await getCurrentPushToken();
  if (token) {
    try {
      await deletePushToken(token);
    } catch (error) {
      console.warn("[push] falha ao remover token no backend", error);
    }
  }
  await deletePushTokenLocal();
}
