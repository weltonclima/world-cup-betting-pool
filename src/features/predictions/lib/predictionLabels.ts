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

/**
 * Classes Tailwind para badge de status de palpite na Lista de Palpites.
 * dark-theme TASK-04: estados mapeados a tokens semânticos (win/loss/info/
 * warning/muted) — contraste WCAG AA garantido em light e dark.
 */
export const PREDICTION_DISPLAY_STATUS_COLOR: Record<PredictionDisplayStatus, string> = {
  acertou: "bg-win-bg text-win",
  // 3º estado (+5): "quase vitória". Precisa de um 5º matiz DISTINTO de win
  // (verde), loss (vermelho), info/empate (azul) e warning/pendente (âmbar) —
  // não há token semântico para lime. Mantém paleta crua com variante dark
  // (tint /20 + text lime-700/lime-400) já legível nos dois temas. Exceção
  // documentada da auditoria de contraste.
  acertou_vencedor: "bg-lime-500/20 text-lime-700 dark:text-lime-400",
  // Empate parcial (+5): azul → token info (distinto de win/loss/warning/lime).
  acertou_empate: "bg-info-bg text-info",
  errou: "bg-loss-bg text-loss",
  pendente: "bg-warning-bg text-warning",
  bloqueado: "bg-muted text-muted-foreground",
};
