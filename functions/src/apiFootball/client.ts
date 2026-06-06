/**
 * Interface do cliente API-Football e implementação concreta via HTTP.
 *
 * A chave da API é lida de process.env.API_FOOTBALL_KEY (server-side apenas).
 * NUNCA deve ser prefixada com NEXT_PUBLIC_ nem acessada no browser.
 *
 * Em produção, usar defineSecret("API_FOOTBALL_KEY") do Firebase Functions v2.
 * Para esta task (esqueleto), process.env é suficiente — wiring com Secret Manager
 * será feito na TASK-10 (deploy).
 */

import { z } from "zod";
import type { TeamResponse, FixtureResponse } from "./types";

// Schema mínimo do envelope de resposta da API-Football (BL-01 — validação runtime).
// Garante que o campo `response` existe e é array antes de retornar aos mappers.
const envelopeSchema = z.object({
  response: z.array(z.unknown()),
  errors: z.unknown().optional(),
});

export type { TeamResponse, FixtureResponse };

// ─── Erros customizados ────────────────────────────────────────────────────────

/** Cota diária da API-Football esgotada (HTTP 429) */
export class ApiFootballQuotaError extends Error {
  constructor() {
    super("Cota diária da API-Football esgotada. Tente novamente amanhã.");
    this.name = "ApiFootballQuotaError";
  }
}

/** Chave de API inválida ou não autorizada (HTTP 401/403) */
export class ApiFootballAuthError extends Error {
  constructor() {
    super(
      "Autenticação na API-Football falhou. Verifique se API_FOOTBALL_KEY está correta.",
    );
    this.name = "ApiFootballAuthError";
  }
}

/** Timeout na requisição à API-Football */
export class ApiFootballTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout na API-Football após ${timeoutMs}ms.`);
    this.name = "ApiFootballTimeoutError";
  }
}

// ─── Interface do cliente ──────────────────────────────────────────────────────

/**
 * Abstração de todas as chamadas HTTP à API-Football.
 * Implementações: HttpApiFootballClient (produção) e MockApiFootballClient (mock).
 */
export interface ApiFootballClient {
  getTeamsByTournament(
    tournamentId: number,
    season: number,
  ): Promise<TeamResponse[]>;
  getFixtures(
    tournamentId: number,
    season: number,
  ): Promise<FixtureResponse[]>;
}

// ─── Implementação concreta (HTTP) ────────────────────────────────────────────

export class HttpApiFootballClient implements ApiFootballClient {
  private readonly baseUrl = "https://v3.football.api-sports.io";
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 10_000) {
    if (!apiKey) throw new Error("API_FOOTBALL_KEY não configurada.");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async getTeamsByTournament(
    tournamentId: number,
    season: number,
  ): Promise<TeamResponse[]> {
    const url = `${this.baseUrl}/teams?league=${tournamentId}&season=${season}`;
    const data = await this.fetchJson<TeamResponse>(url);
    return data;
  }

  async getFixtures(
    tournamentId: number,
    season: number,
  ): Promise<FixtureResponse[]> {
    const url = `${this.baseUrl}/fixtures?league=${tournamentId}&season=${season}`;
    const data = await this.fetchJson<FixtureResponse>(url);
    return data;
  }

  private async fetchJson<T>(url: string): Promise<T[]> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "x-apisports-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });
    } catch (err: unknown) {
      // IN-01: clearTimeout removido daqui — o bloco finally abaixo sempre executa
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiFootballTimeoutError(this.timeoutMs);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Erro de rede ao acessar a API-Football: ${message}`);
    } finally {
      clearTimeout(timerId);
    }

    if (response.status === 429) {
      throw new ApiFootballQuotaError();
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiFootballAuthError();
    }
    if (!response.ok) {
      throw new Error(
        `API-Football retornou status inesperado: ${response.status}`,
      );
    }

    const body: unknown = await response.json();

    // BL-01: validar o envelope com Zod antes de retornar — evita cast cego e
    // garante que `response` existe e é array (ex.: erros de cota retornam
    // { errors: { rateLimit: "..." }, response: [] } — já tratados acima pelo 429).
    const parsed = envelopeSchema.safeParse(body);
    if (!parsed.success) {
      // Inclui o campo `errors` no texto do erro quando presente (útil para debug de cota)
      const errorsInfo =
        body !== null && typeof body === "object" && "errors" in body
          ? ` Erros reportados pela API: ${JSON.stringify((body as Record<string, unknown>)["errors"])}`
          : "";
      throw new Error(
        `Resposta inesperada da API-Football (envelope inválido): ${parsed.error.message}.${errorsInfo}`,
      );
    }

    // O cast final para T[] é seguro: o envelope foi validado acima; a validação de cada
    // item fica a cargo dos Zod schemas nos mappers (matchSchema, teamSchema).
    return parsed.data.response as T[];
  }
}
