import { z } from "zod";

import { teamSchema } from "@/schemas";
import type { TeamWithId } from "@/types";

/**
 * Camada de serviço de seleções (integracao-api-football, TASK-05).
 *
 * Consome o Route Handler `GET /api/teams` (substitui a leitura direta do
 * Firestore). Dados da Copa vêm da API-Football via servidor Next — o browser
 * NUNCA fala com a API-Football.
 *
 * A resposta é REVALIDADA com Zod no client (`teamWithIdSchema`). O `id`
 * (= `String(team.id)` da API) já vem embutido em cada item (não é doc id de
 * Firestore), por isso o schema do client inclui `id` (diferente do `teamSchema`
 * `.strict()` do Firestore, que não tem `id`).
 *
 * Assinatura mantida (`listAllTeams`) para não quebrar `useTeams`.
 */

/** Base relativa — funciona no client (browser resolve contra a origem atual). */
const API_BASE = "/api";

/**
 * Schema do `id` que a rede embute em cada seleção (= `String(team.id)`).
 *
 * `teamSchema` é `.strict()` (não conhece `id`), então validamos `id` separado e o
 * restante com o `teamSchema` intacto — ver `parseTeamWithId`. (Consistente com a
 * abordagem de matches, que evita interseção por causa do refine.)
 */
const idSchema = z.object({ id: z.string().min(1) });

/**
 * Valida uma seleção vinda da rede: separa `id` (validado por `idSchema`) do
 * restante (validado por `teamSchema`, `.strict()`, sem `id`).
 *
 * @throws ZodError se `id` ou o restante violarem o contrato.
 */
function parseTeamWithId(input: unknown): TeamWithId {
  const { id } = idSchema.parse(input);
  const { id: _omit, ...rest } = input as Record<string, unknown>;
  void _omit;
  return { id, ...teamSchema.parse(rest) };
}

/**
 * Lê o corpo `{ error }` (se houver) e monta uma mensagem útil para o `Error`.
 */
async function buildHttpError(
  res: Response,
  fallback: string,
): Promise<Error> {
  let detail = "";
  try {
    const body: unknown = await res.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
    ) {
      detail = (body as { error: string }).error;
    }
  } catch {
    // corpo não-JSON / vazio — ignora, usa só o status.
  }
  const suffix = detail ? ` — ${detail}` : "";
  return new Error(`${fallback} (HTTP ${res.status})${suffix}`);
}

/**
 * Lista todas as seleções via `GET /api/teams`.
 *
 * Coleção pequena (≤ 48 seleções na Copa 2026), buscada de uma vez para uso como
 * cache de join client-side (nome/bandeira por id).
 *
 * @throws Error em falha HTTP (status != 2xx), com status e detalhe do corpo.
 * @throws ZodError se a resposta não casar com o contrato esperado.
 * @returns Array de `TeamWithId` validado (vazio se não houver seleções).
 */
export async function listAllTeams(): Promise<TeamWithId[]> {
  const res = await fetch(`${API_BASE}/teams`);
  if (!res.ok) {
    throw await buildHttpError(res, "Falha ao carregar as seleções");
  }
  const data: unknown = await res.json();
  return z.array(z.unknown()).parse(data).map(parseTeamWithId);
}
