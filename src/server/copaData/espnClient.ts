/**
 * Cliente HTTP do scoreboard ESPN (API pública não-oficial `site.api.espn.com`).
 *
 * Espelha `HttpCopaDataClient` (./client.ts): mesma sequência
 * abort → fetch → status check → json → validação de shape, com erros tipados.
 *
 * Busca placar/estado AO VIVO da Copa (liga `fifa.world`). Cache 5min via
 * Next.js data cache (`next: { revalidate: 300 }`) — alinhado ao tier de live.
 *
 * Achados empíricos (spike TASK-00, 2026-06-14):
 * - `?dates=YYYYMMDD` é OBRIGATÓRIO — a janela default cobre só 1 dia.
 * - `score` é string → coerção feita no schema (espnTypes.ts).
 *
 * NÃO importa `server-only`: módulo usado em testes vitest (fora de RSC).
 * A restrição server-only é aplicada no caller (matchSource, TASK-06).
 */

import { parseEspnScoreboard, type EspnScoreboard } from "./espnTypes";

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

/** Cache 5min — janela ao vivo (não confundir com REVALIDATE_MATCHES=3600). */
const REVALIDATE_LIVE = 300;

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
    const url = `${ESPN_SCOREBOARD_URL}?dates=${dateUtc}`;

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
