/**
 * Helper compartilhado pelos Route Handlers que escopam a fonte de partidas por
 * campeonato (TASK-06, multi-championship-launch).
 *
 * Resolve o query param `?championship=` contra o catálogo curado
 * (`championshipCatalog`). Ausência do param → default `"fifa.world"` (compat
 * byte-a-byte com a Copa 2026 e todos os clientes atuais sem argumento). Id fora
 * do catálogo → `UnknownChampionshipError`, que o caller mapeia para `400`
 * (input inválido do cliente ≠ erro de fonte → nunca `500`).
 *
 * NÃO importa `server-only` (segue `copaDataError.ts`): só consome o catálogo,
 * que é test-safe (não RSC), simplificando os route tests.
 */

import { NextResponse } from "next/server";

import {
  DEFAULT_CHAMPIONSHIP_ID,
  getChampionship,
} from "@/server/copaData/championshipCatalog";
import type { Championship } from "@/types/championships";

// Re-export para os route handlers manterem o import de um único lugar (o helper).
export { DEFAULT_CHAMPIONSHIP_ID };

/** Lançado quando `?championship=` aponta para id fora do catálogo curado. */
export class UnknownChampionshipError extends Error {
  constructor(public readonly championshipId: string) {
    super(`Campeonato desconhecido: ${championshipId}`);
    this.name = "UnknownChampionshipError";
  }
}

/**
 * Resolve o campeonato pedido pela query string contra o catálogo.
 * Ausente/vazio → default (`fifa.world`). Fora do catálogo →
 * `UnknownChampionshipError`.
 */
export function resolveChampionshipParam(
  searchParams: URLSearchParams,
): Championship {
  const raw = searchParams.get("championship");
  const id = raw !== null && raw.trim() !== "" ? raw.trim() : DEFAULT_CHAMPIONSHIP_ID;
  const championship = getChampionship(id);
  if (championship === undefined) {
    throw new UnknownChampionshipError(id);
  }
  return championship;
}

/**
 * Extrai o campeonato de um `Request` (via `searchParams`). `Request` ausente
 * (ex.: chamada de teste `GET()` sem argumento) → default. Mesmo mapeamento de
 * erro que `resolveChampionshipParam`.
 */
export function resolveChampionshipFromRequest(request?: Request): Championship {
  const searchParams = request
    ? new URL(request.url).searchParams
    : new URLSearchParams();
  return resolveChampionshipParam(searchParams);
}

/** Resposta `400` padrão para campeonato desconhecido (pt-BR, sem vazar o id). */
export function unknownChampionshipResponse(): NextResponse {
  return NextResponse.json(
    { error: "Campeonato desconhecido." },
    { status: 400 },
  );
}
