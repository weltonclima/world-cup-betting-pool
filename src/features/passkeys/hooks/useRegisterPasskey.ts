"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { PasskeyError, registerPasskey } from "@/services/webauthn";
import { markPasskeyRegistered } from "../lib/passkeyHint";

/**
 * Registra um passkey (TASK-06). Sucesso → invalida a lista + toast. Erro →
 * toast pt-BR; cancelamento (`NotAllowedError`) é tratado como info neutra, não
 * erro alarmante.
 */
export function useRegisterPasskey(): UseMutationResult<
  void,
  Error,
  string | undefined
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceLabel?: string) => registerPasskey(deviceLabel),
    onSuccess: () => {
      // Hint local: este dispositivo passou a ter um passkey → a tela de login
      // habilita o atalho de biometria sem cair no diálogo nativo vazio.
      markPasskeyRegistered();
      // Invalida o prefixo (robusto a uid transitoriamente indefinido — M2).
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Biometria ativada!");
    },
    onError: (error) => {
      if (error instanceof PasskeyError && error.code === "cancelled") {
        toast.info(error.message);
        return;
      }
      toast.error(
        error instanceof PasskeyError
          ? error.message
          : "Não foi possível ativar a biometria.",
      );
    },
  });
}
