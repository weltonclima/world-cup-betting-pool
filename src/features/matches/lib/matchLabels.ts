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
 * Semântica: enviado = sucesso, pendente = alerta, bloqueado = neutro.
 * Tokens semânticos (dark-theme TASK-04): pares `bg-<estado>-bg`/`text-<estado>`
 * garantem contraste WCAG AA em light e dark sem paleta crua.
 */
export const PREDICTION_STATUS_COLOR: Record<MatchPredictionStatus, string> = {
  enviado: "bg-success-bg text-success",
  pendente: "bg-warning-bg text-warning",
  bloqueado: "bg-muted text-muted-foreground",
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
 * Semântica: scheduled = info, live = sucesso, finished/postponed/canceled = neutro.
 * Tokens semânticos (dark-theme TASK-04): pares `bg-<estado>-bg`/`text-<estado>`
 * garantem contraste WCAG AA em light e dark sem paleta crua.
 */
export const GAME_STATUS_COLOR: Record<MatchStatus, string> = {
  scheduled: "bg-info-bg text-info",
  live: "bg-success-bg text-success",
  finished: "bg-muted text-muted-foreground",
  postponed: "bg-muted text-muted-foreground",
  canceled: "bg-muted text-muted-foreground",
};
