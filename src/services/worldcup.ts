import { groupsResponseSchema, bracketResponseSchema } from "@/schemas/worldcup";
import type { GroupsResponse, BracketResponse } from "@/types/worldcup";

import { API_BASE, buildHttpError } from "./_apiClient";

/**
 * Camada de serviço da Copa do Mundo — grupos e chaveamento (TASK-05).
 *
 * Consome os Route Handlers `/api/worldcup/{groups,bracket}` (TASK-04).
 * O browser NUNCA fala com a fonte externa; tudo passa pelo proxy Next.
 *
 * Cada resposta é REVALIDADA com Zod no client — defesa em profundidade:
 * o servidor já valida, mas não confiamos cegamente na rede.
 *
 * Erros HTTP (status != 2xx) → lança `Error` com mensagem útil (corpo `{ error }`
 * quando presente). Lança `Error` puro — consistente com `matches.ts` vizinho
 * (desvio consciente do plano: não criar classe `WorldcupServiceError`; spec §6.2).
 *
 * Sem `"use client"` — serviço é client-safe (fetch relativo), sem diretiva.
 */

/**
 * Busca a classificação completa dos grupos via `GET /api/worldcup/groups`.
 *
 * @throws Error em falha HTTP (status != 2xx), com status e detalhe do corpo.
 * @throws ZodError se a resposta não casar com `groupsResponseSchema`.
 * @returns `GroupsResponse` validada com `{ groups, hasLiveGroupMatch }`.
 */
export async function getGroups(): Promise<GroupsResponse> {
  const res = await fetch(`${API_BASE}/worldcup/groups`);
  if (!res.ok) {
    throw await buildHttpError(res, "Falha ao carregar a classificação dos grupos");
  }
  return groupsResponseSchema.parse(await res.json());
}

/**
 * Busca o chaveamento do mata-mata via `GET /api/worldcup/bracket`.
 *
 * @throws Error em falha HTTP (status != 2xx), com status e detalhe do corpo.
 * @throws ZodError se a resposta não casar com `bracketResponseSchema`.
 * @returns `BracketResponse` validada (6 buckets: roundOf32…final).
 */
export async function getBracket(): Promise<BracketResponse> {
  const res = await fetch(`${API_BASE}/worldcup/bracket`);
  if (!res.ok) {
    throw await buildHttpError(res, "Falha ao carregar o chaveamento");
  }
  return bracketResponseSchema.parse(await res.json());
}
