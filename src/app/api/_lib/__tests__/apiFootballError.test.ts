/**
 * Testes de apiFootballErrorResponse (integracao-api-football, TASK-04 WR-01).
 *
 * Foco: erros de negócio do mapper (Error genérico) e ZodError são LOGADOS no
 * servidor (console.error) antes de devolver 500 — diagnóstico em produção sem
 * vazar segredo ao client. `@/server/apiFootball` é mockado (barrel `server-only`)
 * reaproveitando as classes de erro reais para o `instanceof` funcionar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/server/apiFootball", async () => {
  const client = await vi.importActual<
    typeof import("@/server/apiFootball/client")
  >("@/server/apiFootball/client");
  return {
    ApiFootballQuotaError: client.ApiFootballQuotaError,
    ApiFootballAuthError: client.ApiFootballAuthError,
    ApiFootballTimeoutError: client.ApiFootballTimeoutError,
  };
});

import {
  ApiFootballAuthError,
  ApiFootballQuotaError,
  ApiFootballTimeoutError,
} from "@/server/apiFootball/client";
import { apiFootballErrorResponse } from "../apiFootballError";

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function bodyOf(res: Response): Promise<{ error: string }> {
  return (await res.json()) as { error: string };
}

describe("apiFootballErrorResponse — mapeamento de status", () => {
  it("quota → 503 (sem log)", async () => {
    const res = apiFootballErrorResponse(new ApiFootballQuotaError());
    expect(res.status).toBe(503);
    expect((await bodyOf(res)).error).toMatch(/cota/i);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("auth → 502 com mensagem genérica (sem vazar segredo, sem log)", async () => {
    const res = apiFootballErrorResponse(new ApiFootballAuthError());
    expect(res.status).toBe(502);
    const body = await bodyOf(res);
    expect(body.error).not.toMatch(/API_FOOTBALL_KEY/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("timeout → 504 (sem log)", async () => {
    const res = apiFootballErrorResponse(new ApiFootballTimeoutError(5000));
    expect(res.status).toBe(504);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("apiFootballErrorResponse — log antes do 500 (WR-01)", () => {
  it("ZodError → 500 e loga a causa (issues) no servidor", async () => {
    const result = z.object({ a: z.string() }).safeParse({ a: 1 });
    expect(result.success).toBe(false);
    const res = apiFootballErrorResponse(
      result.success ? new Error("inalcançável") : result.error,
    );
    expect(res.status).toBe(500);
    expect((await bodyOf(res)).error).toMatch(/contrato/i);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]![0])).toMatch(/ZodError/i);
  });

  it("erro de negócio do mapper (Error genérico) → 500 e loga a causa", async () => {
    const err = new Error("Round não reconhecido pela API-Football: \"X\".");
    const res = apiFootballErrorResponse(err);
    expect(res.status).toBe(500);
    expect((await bodyOf(res)).error).toMatch(/inesperado/i);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // O erro original (com a causa) é passado ao logger.
    expect(errorSpy.mock.calls[0]).toContain(err);
  });

  it("não expõe a mensagem interna do erro ao client no 500", async () => {
    const err = new Error("detalhe interno sensível");
    const res = apiFootballErrorResponse(err);
    expect((await bodyOf(res)).error).not.toMatch(/sensível/);
  });
});
