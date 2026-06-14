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
export type PredictionDisplayStatus =
  | "pendente"
  | "acertou"
  | "acertou_vencedor"
  | "acertou_empate"
  | "errou"
  | "bloqueado";

/**
 * Resultado da pontuação de um palpite contra o resultado oficial.
 * Retornado por scorePrediction; consumido pelo Route Handler de pontuação (TASK-04).
 */
export interface ScorePredictionResult {
  // Domínio ponderado (TASK-02): placar exato = 10 (`correct`); acertou o
  // vencedor real sem placar exato = 5 (`partial`); resto = 0 (`wrong`);
  // partida não finalizada = 0 (`pending`). O legado `1` saiu do tipo de
  // RETORNO — a LEITURA (`predictionSchema.points`) ainda aceita `1` para não
  // descartar docs binários antigos (R1).
  status: "correct" | "partial" | "wrong" | "pending";
  points: 0 | 5 | 10;
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

/**
 * Filtra só os jogos **bloqueados** para palpite (PRD-12 — o admin de grupo só
 * lança palpite manual em jogo bloqueado). Puro; reusa `isPredictionLocked`.
 *
 * @param matches - Lista de partidas (`useMatches()`).
 * @param now     - Data de referência (injetada — nunca new Date() interno).
 */
export function selectLockedMatches(
  matches: MatchWithId[],
  now: Date,
): MatchWithId[] {
  return matches.filter((match) => isPredictionLocked(match, now));
}

// ---------------------------------------------------------------------------
// 2. scorePrediction
// ---------------------------------------------------------------------------

/**
 * Calcula o resultado PONDERADO de um palpite contra o placar oficial (TASK-02).
 * Só pontua quando match.status === "finished". Regra de dois critérios:
 * - placar exato                              → `correct`, 10 pontos.
 * - acertou o resultado real sem placar exato → `partial`, 5 pontos.
 *   (vencedor real acertado OU empate previsto + empate real inexato)
 * - errou o resultado                         → `wrong`, 0 pontos.
 *
 * Resultado derivado do SINAL de `homeScore − awayScore` (não há campo "winner").
 * Empate parcial (regra-empate-parcial): palpite de empate + jogo empatado com
 * placar diferente do previsto pontua `partial` (5) — o sinal 0 do palpite casa
 * com o sinal 0 do jogo. Empate exato já retornou `correct` (10) antes.
 *
 * Caso `finished` com scores null (inconsistência de dados) → `wrong` (conservador).
 * Função pura, idempotente — `now` nunca interno.
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
  if (match.homeScore === null || match.awayScore === null) {
    return { status: "wrong", points: 0 };
  }

  // Placar exato → 10.
  if (
    prediction.homeScore === match.homeScore &&
    prediction.awayScore === match.awayScore
  ) {
    return { status: "correct", points: 10 };
  }

  // Acertou o resultado (mesmo sinal de home − away), placar não-exato → 5.
  // Math.sign compara por sinal: 1 (mandante), -1 (visitante), 0 (empate).
  // Inclui empate parcial: sinal 0 do palpite casa com sinal 0 do jogo.
  const matchSign = Math.sign(match.homeScore - match.awayScore);
  const predictionSign = Math.sign(prediction.homeScore - prediction.awayScore);
  if (predictionSign === matchSign) {
    return { status: "partial", points: 5 };
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
 * 1. match.status === "finished" → "acertou" | "acertou_vencedor" | "acertou_empate" | "errou"
 * 2. isPredictionLocked(match, now) === true → "bloqueado"
 * 3. caso contrário → "pendente"
 *
 * No ramo finished, mapeia o status ponderado de scorePrediction:
 * "correct" → "acertou"; "partial" → "acertou_empate" se o palpite foi empate
 * (homeScore === awayScore), senão "acertou_vencedor" (+5); resto → "errou".
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
    if (status === "correct") return "acertou";
    if (status === "partial") {
      return prediction.homeScore === prediction.awayScore
        ? "acertou_empate"
        : "acertou_vencedor";
    }
    return "errou";
  }

  if (isPredictionLocked(match, now)) {
    return "bloqueado";
  }

  return "pendente";
}
