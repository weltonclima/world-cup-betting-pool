/**
 * Funções puras da feature Palpites (TASK-01 + TASK-02).
 * Sem React, sem Firebase — testáveis em isolamento.
 * Consumidas pelos Route Handlers (TASK-03/04) e pela UI (TASK-07/08/09).
 */

import type { MatchWithId, Prediction } from "@/types";

// ---------------------------------------------------------------------------
// 0. predictionDocId (consolidado de predictionHelpers.ts — TASK-01)
// ---------------------------------------------------------------------------

/**
 * Gera o id determinístico do doc `predictions/${uid}_${matchId}`.
 * Garante unicidade (uid, matchId) sem query extra.
 * Puro — sem side effects.
 *
 * @param uid     - Firebase Auth UID do usuário (alfanumérico, sem underscore).
 *                  O separador `_` é inequívoco porque UIDs do Firebase não contêm `_`.
 * @param matchId - Id numérico da partida no API-Football (fixture id).
 *                  Números não contêm `_`, portanto o separador nunca é ambíguo.
 */
export function predictionDocId(uid: string, matchId: string): string {
  return `${uid}_${matchId}`;
}

// ---------------------------------------------------------------------------
// Tipos de saída (reexportados pelo barrel para uso no compositor e na UI)
// ---------------------------------------------------------------------------

/**
 * Status de exibição de um palpite em pt-BR, para badges na Lista de Palpites.
 * NÃO confundir com PredictionStatus canônico de @/types
 * ("pending"|"correct"|"wrong"|"locked" — valores em inglês, persistência Firestore).
 * Este tipo é exclusivo da camada de apresentação.
 */
export type PredictionDisplayStatus = "pendente" | "acertou" | "errou" | "bloqueado";

/**
 * Resultado da pontuação de um palpite contra o resultado oficial.
 * Retornado por scorePrediction; consumido pelo Route Handler de pontuação (TASK-04).
 */
export interface ScorePredictionResult {
  status: "correct" | "wrong" | "pending";
  points: 0 | 1;
}

// ---------------------------------------------------------------------------
// 1. isPredictionLocked
// ---------------------------------------------------------------------------

/**
 * Verifica se um palpite está bloqueado para criação/edição.
 *
 * Bloqueado quando (OR lógico):
 * - agora >= kickoffAt (jogo iniciou)
 * - match.status !== "scheduled" (qualquer status diferente de agendado)
 *
 * Retorna `false` somente quando `now < kickoffAt` E `match.status === "scheduled"`.
 *
 * @param match - Partida alvo.
 * @param now   - Data de referência (injetada — nunca new Date() interno).
 */
export function isPredictionLocked(match: MatchWithId, now: Date): boolean {
  if (now.getTime() >= new Date(match.kickoffAt).getTime()) return true;
  if (match.status !== "scheduled") return true;
  return false;
}

// ---------------------------------------------------------------------------
// 2. scorePrediction
// ---------------------------------------------------------------------------

/**
 * Calcula o resultado binário de um palpite contra o placar oficial.
 * Só pontua quando match.status === "finished".
 * Pontuação binária: placar exato = 1 ponto; qualquer outro resultado = 0.
 *
 * Caso `finished` com scores null (inconsistência de dados) → trata como `wrong` (conservador).
 *
 * @param prediction - Palpite do usuário.
 * @param match      - Partida com resultado oficial.
 */
export function scorePrediction(
  prediction: Prediction,
  match: MatchWithId,
): ScorePredictionResult {
  if (match.status !== "finished") {
    return { status: "pending", points: 0 };
  }

  // Type narrowing: homeScore e awayScore são number | null no tipo TypeScript,
  // mesmo que o refinement Zod garanta number quando finished em runtime.
  if (match.homeScore !== null && match.awayScore !== null) {
    if (
      prediction.homeScore === match.homeScore &&
      prediction.awayScore === match.awayScore
    ) {
      return { status: "correct", points: 1 };
    }
  }

  return { status: "wrong", points: 0 };
}

// ---------------------------------------------------------------------------
// 3. derivePredictionDisplayStatus
// ---------------------------------------------------------------------------

/**
 * Deriva o status de exibição em pt-BR para badges na Lista de Palpites.
 * Combina resultado (scorePrediction) + lock (isPredictionLocked).
 *
 * Prioridade (ordem de avaliação — decrescente):
 * 1. match.status === "finished" → "acertou" | "errou"
 * 2. isPredictionLocked(match, now) === true → "bloqueado"
 * 3. caso contrário → "pendente"
 *
 * Rationale: `finished` tem prioridade sobre lock pois o resultado final
 * é mais informativo ao usuário do que o estado de bloqueio.
 *
 * @param prediction - Palpite do usuário.
 * @param match      - Partida alvo.
 * @param now        - Data de referência (injetada).
 */
export function derivePredictionDisplayStatus(
  prediction: Prediction,
  match: MatchWithId,
  now: Date,
): PredictionDisplayStatus {
  if (match.status === "finished") {
    const { status } = scorePrediction(prediction, match);
    return status === "correct" ? "acertou" : "errou";
  }

  if (isPredictionLocked(match, now)) {
    return "bloqueado";
  }

  return "pendente";
}
