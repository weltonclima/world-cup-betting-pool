/**
 * Cliente HTTP do scoreboard ESPN (API pública não-oficial `site.api.espn.com`).
 *
 * Sequência abort → fetch → status check → json → validação de shape, com
 * erros tipados (`EspnTimeoutError`/`EspnFetchError`/`EspnParseError`).
 *
 * Busca placar/estado AO VIVO da Copa (liga `fifa.world`). Cache 1min via
 * Next.js data cache (`next: { revalidate: 60 }`) — alinhado ao tier de live.
 *
 * Achados empíricos (spike TASK-00, 2026-06-14):
 * - `?dates=YYYYMMDD` é OBRIGATÓRIO — a janela default cobre só 1 dia.
 * - `score` é string → coerção feita no schema (espnTypes.ts).
 *
 * NÃO importa `server-only`: módulo usado em testes vitest (fora de RSC).
 * A restrição server-only é aplicada no caller (matchSource, TASK-06).
 */

import { parseEspnScoreboard, type EspnScoreboard, type EspnEvent } from "./espnTypes";

// ─── Erros customizados ─────────────────────────────────────────────────────

export class EspnTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout ao buscar scoreboard ESPN após ${timeoutMs}ms.`);
    this.name = "EspnTimeoutError";
  }
}

export class EspnFetchError extends Error {
  constructor(status: number) {
    super(`Erro ao buscar scoreboard ESPN: HTTP ${status}.`);
    this.name = "EspnFetchError";
  }
}

export class EspnParseError extends Error {
  constructor(cause: string) {
    super(`Scoreboard ESPN inválido ou fora do formato esperado: ${cause}`);
    this.name = "EspnParseError";
  }
}

// ─── Configuração ───────────────────────────────────────────────────────────

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

/** Cache 1min — janela ao vivo (status/placar ESPN refrescam a cada 60s). */
const REVALIDATE_LIVE = 60;

/**
 * Ranges disjuntos (`YYYYMMDD-YYYYMMDD`) que cobrem o torneio inteiro (104 jogos).
 * ESPN trunca em 100 eventos por chamada (hard cap, sem cursor — spike TASK-00),
 * por isso o split em 2 ranges: grupos (72) + mata-mata (32).
 * Range termina em 0719 (final); o `-20260715` do PRD original cortava semis/final.
 */
export const ESPN_TOURNAMENT_RANGES: readonly string[] = [
  "20260611-20260627",
  "20260628-20260719",
];

// ─── Implementação HTTP ─────────────────────────────────────────────────────

export class EspnScoreClient {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10_000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Busca o scoreboard ESPN de um dia específico.
   * @param dateUtc dia alvo no formato `YYYYMMDD` (UTC), ex.: `"20260614"`.
   */
  async fetchScoreboard(dateUtc: string): Promise<EspnScoreboard> {
    return this.fetchByDates(dateUtc);
  }

  /**
   * Busca o schedule completo da Copa via múltiplas chamadas de range disjunto
   * (hard cap ESPN = 100 eventos/chamada; Copa tem 104 jogos — spike TASK-00).
   * As chamadas são paralelas (`Promise.all`) e o resultado é deduplicado por
   * `event.id`. NÃO absorve erros — qualquer falha de range propaga (a resiliência
   * com fallback openfootball fica no caller, TASK-05).
   *
   * @param ranges ranges no formato `"YYYYMMDD-YYYYMMDD"`. Default:
   *               `ESPN_TOURNAMENT_RANGES` (grupos + mata-mata).
   * @returns eventos deduplicados por `event.id`, na ordem dos `ranges`
   *          (`Promise.all` preserva a ordem dos argumentos; em colisão de id o
   *          range posterior vence).
   */
  async fetchSchedule(
    ranges: readonly string[] = ESPN_TOURNAMENT_RANGES,
  ): Promise<EspnEvent[]> {
    const perRange = await Promise.all(
      ranges.map((range) => this.fetchRange(range)),
    );

    const byId = new Map<string, EspnEvent>();
    for (const events of perRange) {
      for (const event of events) {
        byId.set(event.id, event);
      }
    }
    return [...byId.values()];
  }

  /** Busca um range de datas e retorna apenas os eventos do scoreboard. */
  private async fetchRange(range: string): Promise<EspnEvent[]> {
    const scoreboard = await this.fetchByDates(range);
    return scoreboard.events;
  }

  /**
   * Núcleo HTTP compartilhado: abort → fetch → status → json → validação de shape.
   * @param dates valor do query param `?dates` — dia (`YYYYMMDD`) ou range
   *              (`YYYYMMDD-YYYYMMDD`); o endpoint aceita ambos.
   */
  private async fetchByDates(dates: string): Promise<EspnScoreboard> {
    const url = `${ESPN_SCOREBOARD_URL}?dates=${dates}`;

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: REVALIDATE_LIVE },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new EspnTimeoutError(this.timeoutMs);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Erro de rede ao buscar scoreboard ESPN: ${message}`);
    } finally {
      clearTimeout(timerId);
    }

    if (!response.ok) {
      throw new EspnFetchError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new EspnParseError("JSON inválido");
    }

    const result = parseEspnScoreboard(body);
    if (!result.success) {
      throw new EspnParseError(result.error.message);
    }

    return result.data;
  }
}
