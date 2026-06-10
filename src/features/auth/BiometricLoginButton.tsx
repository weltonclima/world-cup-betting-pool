"use client";

import type { JSX } from "react";
import { Fingerprint, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePasskeySupport } from "@/features/passkeys/hooks";
import { PasskeyUnsupportedNotice } from "@/features/passkeys/components";
import { useBiometricLogin } from "@/features/auth/hooks/useBiometricLogin";

/**
 * CTA secundário "Entrar com biometria" na tela de login (TASK-08).
 *
 * Aditivo ao formulário e-mail+senha (M3: o fallback NUNCA é escondido). Render
 * condicional:
 *  - WebView/in-app browser (A9) → nota "abrir no navegador";
 *  - sem autenticador de plataforma OU ainda resolvendo → nada (o fallback basta);
 *  - suportado → divisor "ou" + botão `outline` (secundário, não compete com o
 *    "Entrar" primário verde).
 * A cerimônia roda só no clique (gesto do usuário — req. iOS Safari). Cancelamento
 * é tratado como neutro pelo hook. Sucesso → `AuthLayout` redireciona (sem navegar
 * aqui).
 */
export function BiometricLoginButton(): JSX.Element | null {
  const { supported, isWebView } = usePasskeySupport();
  const { mutate, isPending } = useBiometricLogin();

  // WebView (A9): orienta abrir no navegador (substitui o botão, sem divisor).
  if (isWebView) {
    return <PasskeyUnsupportedNotice reason="webview" />;
  }

  // Resolvendo (null) ou sem suporte (false) → nada: o fallback e-mail+senha basta.
  if (supported !== true) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Divisor "ou" — decorativo (a relação é visual). */}
      <div
        className="flex items-center gap-3 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={() => mutate()}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <LoaderCircle
            size={18}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Fingerprint size={18} aria-hidden="true" />
        )}
        {isPending ? "Entrando com biometria…" : "Entrar com biometria"}
      </Button>
    </div>
  );
}
