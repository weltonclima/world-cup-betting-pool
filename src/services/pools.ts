import { z } from "zod";

import { poolSchema } from "@/schemas";
import type { Pool } from "@/types/pools";

/**
 * Camada de serviço de pools (grupos de bolão — PRD-09, TASK-04).
 *
 * Read/Write split: TODAS as operações passam pelos Route Handlers `/api/groups`
 * (Admin SDK server-side). Leitura também via fetch (não Client SDK): o dono
 * precisa enxergar o próprio pool `pending`, que as Rules bloqueiam no client.
 * Erros HTTP → `PoolServiceError` com mensagem pt-BR (espelha PredictionServiceError);
 * a UI nunca lida com status HTTP.
 */

export class PoolServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PoolServiceError";
    this.status = status;
  }
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Não foi possível processar os dados do grupo.",
  401: "Você precisa estar autenticado para acessar grupos.",
  403: "Seu acesso ainda não foi aprovado pelo administrador.",
  404: "Grupo não encontrado.",
  409: "Já existe um grupo com esse identificador (slug). Escolha outro.",
  422: "Os dados do grupo são inválidos.",
  500: "Erro ao processar o grupo. Tente novamente.",
};

const FALLBACK_HTTP_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

function toServiceError(status: number): PoolServiceError {
  return new PoolServiceError(
    status,
    HTTP_ERROR_MESSAGES[status] ?? FALLBACK_HTTP_MESSAGE,
  );
}

export interface CreatePoolInput {
  name: string;
  slug: string;
  description?: string;
  photoBase64?: string;
}

/**
 * Cria um pool via POST /api/groups. `adminId` é definido pela sessão no servidor
 * (não enviado pelo client). Retorna o pool criado (`status: "pending"`).
 *
 * @throws PoolServiceError em erro HTTP (401/403/409/422/500).
 */
export async function createPool(input: CreatePoolInput): Promise<Pool> {
  const response = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  if (!response.ok) throw toServiceError(response.status);

  const body = (await response.json()) as { pool: unknown };
  return poolSchema.parse(body.pool);
}

/**
 * Busca pools `active` via GET /api/groups/search. `q` opcional (slug/nome).
 *
 * @throws PoolServiceError em erro HTTP (401/403/500).
 */
export async function searchPools(q?: string): Promise<Pool[]> {
  const suffix = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const response = await fetch(`/api/groups/search${suffix}`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) throw toServiceError(response.status);

  const body = (await response.json()) as { pools: unknown[] };
  return body.pools.map((p) => poolSchema.parse(p));
}

/**
 * Detalha um pool via GET /api/groups/[id]. Retorna o pool + nº de participantes.
 *
 * @throws PoolServiceError em erro HTTP (401/403/404/500).
 */
export async function getPool(
  id: string,
): Promise<{ pool: Pool; memberCount: number }> {
  const response = await fetch(`/api/groups/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) throw toServiceError(response.status);

  const body = (await response.json()) as { pool: unknown; memberCount: unknown };
  // memberCount validado em runtime (gsd H-03) — não confiar no cast.
  return {
    pool: poolSchema.parse(body.pool),
    memberCount: z.number().int().min(0).parse(body.memberCount),
  };
}
