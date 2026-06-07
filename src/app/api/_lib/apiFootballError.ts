/**
 * Helper compartilhado pelos Route Handlers da API-Football (TASK-04).
 *
 * Centraliza o mapeamento de erros do client da API-Football → resposta HTTP,
 * com mensagens em português e SEM vazar segredos (ex.: o erro de auth interno
 * cita `API_FOOTBALL_KEY`; aqui usamos mensagem genérica).
 *
 * Mapeamento (ver spec §4):
 *  - ApiFootballQuotaError   → 503
 *  - ApiFootballAuthError    → 502
 *  - ApiFootballTimeoutError → 504
 *  - ZodError (parse saída)  → 500 (dado da API fora do contrato do front)
 *  - genérico                → 500
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  ApiFootballAuthError,
  ApiFootballQuotaError,
  ApiFootballTimeoutError,
} from "@/server/apiFootball";

/**
 * Converte um erro lançado durante o handling de uma rota da API-Football em uma
 * resposta JSON `{ error }` com o status HTTP apropriado.
 */
export function apiFootballErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiFootballQuotaError) {
    return NextResponse.json(
      { error: "Cota da API de dados esgotada. Tente novamente mais tarde." },
      { status: 503 },
    );
  }

  if (err instanceof ApiFootballAuthError) {
    // Mensagem genérica de propósito: o erro interno cita API_FOOTBALL_KEY.
    return NextResponse.json(
      { error: "Falha na integração com a API de dados." },
      { status: 502 },
    );
  }

  if (err instanceof ApiFootballTimeoutError) {
    return NextResponse.json(
      { error: "A API de dados demorou para responder. Tente novamente." },
      { status: 504 },
    );
  }

  if (err instanceof ZodError) {
    // Dado retornado pela API violou o schema do front (contrato quebrado).
    // Loga a causa no servidor (não vai ao client) para diagnóstico em produção.
    console.error(
      "[apiFootball] Dados fora do contrato (ZodError) ao mapear resposta da API-Football:",
      err.issues,
    );
    return NextResponse.json(
      { error: "Dados recebidos fora do contrato esperado." },
      { status: 500 },
    );
  }

  // Erros de negócio do mapper (time fora do teamIdMap / round não mapeado /
  // data inválida) chegam aqui como Error genérico e cairiam em 500 opaco.
  // Loga a causa no servidor (mensagem + stack), sem expor detalhes ao client.
  console.error(
    "[apiFootball] Erro inesperado ao obter/mapear dados da API-Football:",
    err,
  );
  return NextResponse.json(
    { error: "Erro inesperado ao obter os dados." },
    { status: 500 },
  );
}
