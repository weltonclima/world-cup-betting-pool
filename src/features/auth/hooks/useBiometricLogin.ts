"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";

import { PasskeyError, loginWithPasskey } from "@/services/webauthn";
import { signInWithBiometricToken } from "@/services/auth";
import { markPasskeyRegistered } from "@/features/passkeys/lib/passkeyHint";

/**
 * Login biométrico (TASK-08). Orquestra `loginWithPasskey` (cerimônia WebAuthn →
 * custom token) + `signInWithBiometricToken` (sessão Firebase + cookie). Não há
 * `onSuccess`/toast: o `AuthLayout` redireciona ao mudar o estado de auth. Erro →
 * toast pt-BR; cancelamento (`NotAllowedError` → code `"cancelled"`) é info neutra,
 * não erro alarmante.
 */
export function useBiometricLogin(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: async () => {
      const customToken = await loginWithPasskey();
      await signInWithBiometricToken(customToken);
    },
    onSuccess: () => {
      // Re-afirma o hint quando JÁ presente: login por biometria só roda com o
      // botão habilitado (logo, com hint). Não recupera um hint perdido — apenas
      // o mantém fresco para os próximos logins.
      markPasskeyRegistered();
    },
    onError: (error) => {
      if (error instanceof PasskeyError && error.code === "cancelled") {
        toast.info(error.message);
        return;
      }
      toast.error(
        error instanceof PasskeyError
          ? error.message
          : "Não foi possível entrar com biometria.",
      );
    },
  });
}
