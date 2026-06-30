/**
 * Helper compartilhado pelos Route Handlers da camada copaData.
 *
 * Centraliza o mapeamento de erros da fonte ESPN → resposta HTTP,
 * com mensagens em português e SEM vazar detalhes internos.
 *
 * Mapeamento:
 *  - EspnTimeoutError → 504
 *  - EspnFetchError   → 502
 *  - EspnParseError   → 500
 *  - ZodError (parse) → 500
 *  - genérico         → 500
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  EspnTimeoutError,
  EspnFetchError,
  EspnParseError,
} from "@/server/copaData/espnClient";

/**
 * Converte um erro lançado durante o handling de uma rota copaData em uma
 * resposta JSON `{ error }` com o status HTTP apropriado.
 */
export function copaDataErrorResponse(err: unknown): NextResponse {
  if (err instanceof EspnTimeoutError) {
    return NextResponse.json(
      { error: "A fonte de dados demorou para responder." },
      { status: 504 },
    );
  }

  if (err instanceof EspnFetchError) {
    return NextResponse.json(
      { error: "Falha ao buscar dados da Copa." },
      { status: 502 },
    );
  }

  if (err instanceof EspnParseError) {
    console.error("[copaData] Dados fora do contrato (EspnParseError):", err.message);
    return NextResponse.json(
      { error: "Dados recebidos fora do contrato esperado." },
      { status: 500 },
    );
  }

  if (err instanceof ZodError) {
    console.error("[copaData] Dados fora do contrato (ZodError) ao mapear resposta da Copa:", err.issues);
    return NextResponse.json(
      { error: "Dados recebidos fora do contrato esperado." },
      { status: 500 },
    );
  }

  console.error("[copaData] Erro inesperado ao obter/mapear dados da Copa:", err);
  return NextResponse.json(
    { error: "Erro inesperado ao obter os dados." },
    { status: 500 },
  );
}
