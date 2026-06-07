import { FirebaseError } from "firebase/app";

import { InvalidStatusTransitionError } from "../hooks/useUpdateUserStatus";

const PERMISSION_MESSAGE = "Você não tem permissão para esta ação.";
const INVALID_TRANSITION_MESSAGE =
  "Não é possível alterar o status deste usuário.";
const FALLBACK_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

/**
 * Traduz um erro de mutação de status (TASK-03) para mensagem pt-BR (Sonner).
 * Ordem: erro de transição client-side (mais específico) → permission-denied das
 * rules → fallback. Função pura — a UI mapeia (services/hook não traduzem).
 */
export function mapUserActionError(error: unknown): string {
  if (error instanceof InvalidStatusTransitionError) {
    return INVALID_TRANSITION_MESSAGE;
  }
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return PERMISSION_MESSAGE;
  }
  // Defensivo: alguns wrappers expõem só `.code` string.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "permission-denied"
  ) {
    return PERMISSION_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
