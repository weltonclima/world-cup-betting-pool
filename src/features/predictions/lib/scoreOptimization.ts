/**
 * TASK-01 (scoring-write-cost) — Helpers puros de otimização do cron de pontuação.
 *
 * Duas funções puras (sem I/O, sem rede, sem relógio) que sustentam o corte de
 * custo do endpoint de pontuação:
 *  - matchResultFingerprint → filtro grosso (B): pula partida cujo resultado não mudou.
 *  - predictionScoreChanged → filtro fino (A): grava só o palpite cujo score mudou.
 */
import type { Match } from "@/types";

type MatchWithId = Match & { id: string };

/** Resultado de pontuação produzido por `scorePrediction`. */
type ScoreOutcome = {
  status: "correct" | "partial" | "wrong" | "pending";
  points: 0 | 5 | 10;
};

/**
 * String estável derivada SOMENTE de `{ status, homeScore, awayScore }`.
 * Determinística e independente da ordem das chaves do objeto de entrada.
 * `null` em placar gera token distinto de `0` ("null" vs "0").
 * Base do filtro grosso (B): resultado inalterado → mesmo fingerprint → pula.
 */
export function matchResultFingerprint(match: MatchWithId): string {
  const home = match.homeScore === null ? "null" : String(match.homeScore);
  const away = match.awayScore === null ? "null" : String(match.awayScore);
  return `${match.status}|${home}|${away}`;
}

/**
 * `true` se o `{ status, points }` recalculado difere do persistido.
 * Comparação estrita: `status`/`points` ausentes (palpite nunca pontuado)
 * contam como divergência (`undefined !== "wrong"`, `undefined !== 0`).
 * Base do filtro fino (A): só grava quando retorna `true`.
 */
export function predictionScoreChanged(
  persisted: { status?: string; points?: number },
  computed: ScoreOutcome,
): boolean {
  return (
    persisted.status !== computed.status || persisted.points !== computed.points
  );
}
