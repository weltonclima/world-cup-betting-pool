/**
 * Constantes de rótulo e cor para badges da feature Jogos (TASK-01).
 * Fonte única — sem strings de cor ou rótulo hardcodadas em outros arquivos.
 */

import type { GameStatusLabel, MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { MatchStatus } from "@/types";

/** Rótulo em pt-BR para o status de palpite do usuário. */
export const PREDICTION_STATUS_LABEL: Record<MatchPredictionStatus, string> = {
  enviado: "Enviado",
  pendente: "Pendente",
  bloqueado: "Bloqueado",
};

/**
 * Classes Tailwind para badge de status de palpite.
 * Semântica: enviado = verde, pendente = âmbar, bloqueado = cinza.
 */
export const PREDICTION_STATUS_COLOR: Record<MatchPredictionStatus, string> = {
  enviado: "bg-green-500/20 text-green-700",
  pendente: "bg-amber-500/20 text-amber-700",
  bloqueado: "bg-gray-500/20 text-gray-600",
};

/** Rótulo em pt-BR para o status do jogo. */
export const GAME_STATUS_LABEL: Record<MatchStatus, GameStatusLabel> = {
  scheduled: "Agendado",
  live: "Ao Vivo",
  finished: "Encerrado",
  postponed: "Adiado",
  canceled: "Cancelado",
};

/**
 * Classes Tailwind para badge de status do jogo.
 * Semântica: scheduled = azul, live = verde, finished/postponed/canceled = cinza.
 */
export const GAME_STATUS_COLOR: Record<MatchStatus, string> = {
  scheduled: "bg-blue-500/20 text-blue-700",
  live: "bg-green-500/20 text-green-700",
  finished: "bg-gray-500/20 text-gray-600",
  postponed: "bg-gray-500/20 text-gray-600",
  canceled: "bg-gray-500/20 text-gray-600",
};
