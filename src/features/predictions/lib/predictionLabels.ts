import type { PredictionDisplayStatus } from "./predictionsHelpers";

/** Rótulo em pt-BR para o status de exibição de palpite. */
export const PREDICTION_DISPLAY_STATUS_LABEL: Record<PredictionDisplayStatus, string> = {
  pendente: "Pendente",
  acertou: "Acertou",
  acertou_vencedor: "Acertou o vencedor",
  acertou_empate: "Acertou o empate",
  errou: "Errou",
  bloqueado: "Bloqueado",
};

/** Classes Tailwind para badge de status de palpite na Lista de Palpites. */
export const PREDICTION_DISPLAY_STATUS_COLOR: Record<PredictionDisplayStatus, string> = {
  acertou: "bg-win-bg text-win",
  // 3º estado (+5): cor intermediária distinta de acertou (verde/win),
  // errou (vermelho/loss) e pendente (âmbar). Lime lê como "quase vitória".
  acertou_vencedor: "bg-lime-500/20 text-lime-700 dark:text-lime-400",
  // Empate parcial (+5): azul, distinto de acertou (verde), acertou_vencedor
  // (lime), errou (vermelho) e pendente (âmbar). Azul lê como "empate".
  acertou_empate: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  errou: "bg-loss-bg text-loss",
  pendente: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  bloqueado: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};
