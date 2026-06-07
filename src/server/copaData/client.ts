/**
 * Interface do cliente copaData e implementação concreta via HTTP.
 *
 * Importar diretamente de ./client (não do barrel ./index) nos testes,
 * pois o barrel inclui `import "server-only"` que lança fora de RSC (vitest).
 */

import type { OpenFootballData } from "./types";

// ─── Erros customizados ─────────────────────────────────────────────────────

export class CopaDataTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout ao buscar dados da Copa após ${timeoutMs}ms.`);
    this.name = "CopaDataTimeoutError";
  }
}

export class CopaDataFetchError extends Error {
  constructor(status: number) {
    super(`Erro ao buscar dados da Copa: HTTP ${status}.`);
    this.name = "CopaDataFetchError";
  }
}

export class CopaDataParseError extends Error {
  constructor(cause: string) {
    super(`JSON da Copa inválido ou fora do formato esperado: ${cause}`);
    this.name = "CopaDataParseError";
  }
}

// ─── Interface ──────────────────────────────────────────────────────────────

/**
 * Abstração de acesso aos dados da Copa 2026.
 * Implementações: HttpCopaDataClient (produção) e MockCopaDataClient (testes).
 */
export interface CopaDataClient {
  getData(): Promise<OpenFootballData>;
}

// ─── Implementação HTTP ─────────────────────────────────────────────────────

export class HttpCopaDataClient implements CopaDataClient {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(url: string, timeoutMs = 10_000) {
    this.url = url;
    this.timeoutMs = timeoutMs;
  }

  async getData(): Promise<OpenFootballData> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.url, {
        signal: controller.signal,
        // next: { revalidate } é configurado no route handler via export const revalidate
        // aqui apenas a chamada nua — o cache do Next.js envolve o fetch automaticamente
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new CopaDataTimeoutError(this.timeoutMs);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Erro de rede ao buscar dados da Copa: ${message}`);
    } finally {
      clearTimeout(timerId);
    }

    if (!response.ok) {
      throw new CopaDataFetchError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CopaDataParseError("JSON inválido");
    }

    // Validação mínima de shape: deve ter `matches` como array.
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as Record<string, unknown>)["matches"])
    ) {
      throw new CopaDataParseError("campo 'matches' ausente ou não é array");
    }

    return body as OpenFootballData;
  }
}
