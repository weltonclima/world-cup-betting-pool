import { z } from "zod";

import { teamSchema } from "@/schemas";
import { DEFAULT_CHAMPIONSHIP_ID } from "@/server/copaData/championshipCatalog";
import type { TeamWithId } from "@/types";

import { API_BASE, buildHttpError, parseWithId } from "./_apiClient";

/**
 * Camada de serviço de seleções (TASK-05).
 *
 * Consome o Route Handler `GET /api/teams` (substitui a leitura direta do
 * Firestore). Dados da Copa vêm do openfootball/worldcup.json via servidor Next
 * — o browser NUNCA fala com a fonte externa.
 *
 * A resposta é REVALIDADA com Zod no client (`teamWithIdSchema`). O `id`
 * (= `String(team.id)`) já vem embutido em cada item (não é doc id de
 * Firestore), por isso o schema do client inclui `id` (diferente do `teamSchema`
 * `.strict()` do Firestore, que não tem `id`).
 *
 * Assinatura mantida (`listAllTeams`) para não quebrar `useTeams`.
 */

/**
 * Valida uma seleção vinda da rede: separa `id` do restante (validado por
 * `teamSchema`, `.strict()`, sem `id`). Usa o helper compartilhado `parseWithId`
 * (consistente com matches; evita interseção por causa do refine) — ver
 * `_apiClient.ts`.
 *
 * @throws ZodError se `id` ou o restante violarem o contrato.
 */
function parseTeamWithId(input: unknown): TeamWithId {
  return parseWithId(input, teamSchema);
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
export async function listAllTeams(
  championshipId: string = DEFAULT_CHAMPIONSHIP_ID,
): Promise<TeamWithId[]> {
  // Multi-championship (TASK-09): forward-compatible. `GET /api/teams` ainda NÃO
  // segmenta por campeonato server-side (registry estático só-Copa — foundation
  // gap fora do escopo desta task). O default não envia o param (compat + testes);
  // outros campeonatos já enviam `?championship=` para quando o servidor passar a
  // honrá-lo. Enquanto isso, a resposta é a mesma (só-Copa) — aceito e documentado.
  const url =
    championshipId === DEFAULT_CHAMPIONSHIP_ID
      ? `${API_BASE}/teams`
      : `${API_BASE}/teams?championship=${encodeURIComponent(championshipId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw await buildHttpError(res, "Falha ao carregar as seleções");
  }
  const data: unknown = await res.json();
  return z.array(z.unknown()).parse(data).map(parseTeamWithId);
}
