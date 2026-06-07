/**
 * Constantes de rótulo e cor para badges da feature Jogos (TASK-01).
 * Fonte única — sem strings de cor ou rótulo hardcodadas em outros arquivos.
 *
 * WARNING-1 fix (TASK-03): GAME_STATUS_LABEL é agora derivado de deriveGameStatusLabel,
 * eliminando a duplicação silenciosa de mapa MatchStatus→rótulo.
 * Direção do import: matchLabels importa `deriveGameStatusLabel` (valor) de matchesHelpers;
 * matchesHelpers NÃO importa matchLabels — sem ciclo de runtime.
 */

import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import { deriveGameStatusLabel } from "@/features/matches/lib/matchesHelpers";
import type { MatchStatus } from "@/types";

/** Rótulo em pt-BR para o status de palpite do usuário. */
export const PREDICTION_STATUS_LABEL: Record<MatchPredictionStatus, string> = {
  enviado: "Palpite Enviado",
  pendente: "Palpite Pendente",
  bloqueado: "Palpite Bloqueado",
};

/**
 * Classes Tailwind para badge de status de palpite.
 * Semântica: enviado = verde, pendente = âmbar, bloqueado = cinza.
 * Inclui variantes dark (contraste WCAG AA no tema escuro — contrato screen §3.2-3.4).
 */
export const PREDICTION_STATUS_COLOR: Record<MatchPredictionStatus, string> = {
  enviado: "bg-green-500/20 text-green-700 dark:text-green-400",
  pendente: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  bloqueado: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};

// Todos os valores válidos de MatchStatus (espelha matchStatusSchema do shared.ts).
const MATCH_STATUS_VALUES = [
  "scheduled",
  "live",
  "finished",
  "postponed",
  "canceled",
] as const satisfies readonly MatchStatus[];

/**
 * Rótulo em pt-BR para o status do jogo.
 * Derivado de `deriveGameStatusLabel` — fonte única de verdade (WARNING-1 fix).
 */
export const GAME_STATUS_LABEL: Record<MatchStatus, string> = Object.fromEntries(
  MATCH_STATUS_VALUES.map((s) => [s, deriveGameStatusLabel(s)]),
) as Record<MatchStatus, string>;

/**
 * Classes Tailwind para badge de status do jogo.
 * Semântica: scheduled = azul, live = verde, finished/postponed/canceled = cinza.
 * Inclui variantes dark (contraste WCAG AA no tema escuro — contrato screen §3.2-3.4).
 */
export const GAME_STATUS_COLOR: Record<MatchStatus, string> = {
  scheduled: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  live: "bg-green-500/20 text-green-700 dark:text-green-400",
  finished: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
  postponed: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
  canceled: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};
