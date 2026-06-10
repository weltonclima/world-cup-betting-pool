"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { PasskeyError, revokePasskey } from "@/services/webauthn";

/** Revoga um passkey (TASK-06). Sucesso → invalida a lista + toast. */
export function useRevokePasskey(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialId: string) => revokePasskey(credentialId),
    onSuccess: () => {
      // Invalida o prefixo (robusto a uid transitoriamente indefinido — M2).
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Dispositivo removido.");
    },
    onError: (error) => {
      toast.error(
        error instanceof PasskeyError
          ? error.message
          : "Não foi possível remover o dispositivo.",
      );
    },
  });
}
