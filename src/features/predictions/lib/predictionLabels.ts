import type { PredictionDisplayStatus } from "./predictionsHelpers";

/** Rótulo em pt-BR para o status de exibição de palpite. */
export const PREDICTION_DISPLAY_STATUS_LABEL: Record<PredictionDisplayStatus, string> = {
  pendente: "Pendente",
  acertou: "Acertou",
  errou: "Errou",
  bloqueado: "Bloqueado",
};

/** Classes Tailwind para badge de status de palpite na Lista de Palpites. */
export const PREDICTION_DISPLAY_STATUS_COLOR: Record<PredictionDisplayStatus, string> = {
  acertou: "bg-green-500/20 text-green-700 dark:text-green-400",
  errou: "bg-destructive/20 text-destructive dark:text-destructive",
  pendente: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  bloqueado: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};
