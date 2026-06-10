"use client";

import { useEffect, useState, type JSX } from "react";
import { Fingerprint, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePasskeySupport, useRegisterPasskey } from "../hooks";
import { consumeBiometricIntent } from "../lib/loginBiometricIntent";
import { hasPasskeyHint } from "../lib/passkeyHint";
import { deriveDeviceLabel } from "../lib/deviceLabel";

/**
 * Confirm de 1 toque para ATIVAR a biometria após o login (feature
 * login-biometric-activation). Montado no shell autenticado `(app)` porque o
 * `AuthLayout` redireciona ao concluir o login — o confirm não pode viver na
 * tela de login (desmontada pelo redirect).
 *
 * Por que o 2º toque: o WebAuthn `create()` exige ativação transitória (gesto
 * recente); disparar inline logo após o round-trip de login falha no iOS Safari.
 * O botão "Ativar agora" provê esse gesto fresco. Reusa `useRegisterPasskey`
 * (toasts pt-BR + hint local + invalidação da lista). Fallback e-mail+senha
 * nunca é afetado.
 */
export function BiometricActivationPrompt(): JSX.Element | null {
  const { supported, isWebView } = usePasskeySupport();
  const register = useRegisterPasskey();
  const [open, setOpen] = useState(false);
  // A intenção é consumida UMA vez no mount (atômico). A decisão de abrir espera
  // `supported` resolver (async) — sem suporte/sem-hint, nunca abre.
  const [intended, setIntended] = useState(false);

  useEffect(() => {
    setIntended(consumeBiometricIntent());
  }, []);

  useEffect(() => {
    if (intended && supported === true && !isWebView && !hasPasskeyHint()) {
      setOpen(true);
    }
  }, [intended, supported, isWebView]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ativar biometria?</DialogTitle>
          <DialogDescription>
            Entre mais rápido da próxima vez usando a biometria deste aparelho.
            Sua senha continua válida.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={register.isPending}
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              register.mutate(deriveDeviceLabel(), {
                onSettled: () => setOpen(false),
              });
            }}
            disabled={register.isPending}
            aria-busy={register.isPending}
          >
            {register.isPending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Fingerprint size={16} aria-hidden="true" />
            )}
            Ativar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
