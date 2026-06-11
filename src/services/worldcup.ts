import { bracketResponseSchema, groupsResponseSchema } from "@/schemas/worldcup";
import type { BracketResponse, GroupsResponse } from "@/types";

import { API_BASE, extractErrorDetail } from "./_apiClient";

/**
 * Camada de serviço da Copa — fase de grupos e chaveamento (grupos-eliminatorias,
 * TASK-05).
 *
 * Consome os Route Handlers `/api/worldcup/groups` e `/api/worldcup/bracket`
 * (TASK-04), que já fazem proxy + cache Firestore + validação no servidor. O
 * browser NUNCA fala com o openfootball — só com as rotas same-origin.
 *
 * Cada resposta é REVALIDADA com Zod no client (`groupsResponseSchema` /
 * `bracketResponseSchema`) — defesa em profundidade: o servidor já valida, mas
 * não confiamos cegamente na rede.
 *
 * Erros HTTP (status != 2xx) → lança `WorldcupServiceError` (status + mensagem
 * pt-BR), espelhando `PredictionServiceError`. A UI nunca lida com códigos HTTP.
 */

/**
 * Erro tipado para respostas HTTP de erro das rotas da Copa.
 * Encapsula o status HTTP e uma mensagem pt-BR pronta para a UI.
 */
export class WorldcupServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WorldcupServiceError";
    this.status = status;
  }
}

/**
 * Monta um `WorldcupServiceError` a partir de uma resposta HTTP de erro,
 * anexando o detalhe `{ error }` do corpo quando presente. Reusa
 * `extractErrorDetail` (`_apiClient`) — sem duplicar o guard de parsing (WR-02).
 *
 * @param res - Resposta HTTP (status != 2xx).
 * @param fallback - Mensagem base pt-BR quando não há detalhe no corpo.
 * @returns `WorldcupServiceError` com status e detalhe do corpo quando presente.
 */
async function httpError(
  res: Response,
  fallback: string,
): Promise<WorldcupServiceError> {
  const detail = await extractErrorDetail(res);
  const suffix = detail ? ` — ${detail}` : "";
  return new WorldcupServiceError(res.status, `${fallback}${suffix}`);
}

/**
 * Busca a classificação da fase de grupos via `GET /api/worldcup/groups`.
 *
 * @throws WorldcupServiceError em falha HTTP (status != 2xx).
 * @throws ZodError se a resposta não casar com `groupsResponseSchema`.
 * @returns `GroupsResponse` validado.
 */
export async function getGroups(): Promise<GroupsResponse> {
  const res = await fetch(`${API_BASE}/worldcup/groups`);
  if (!res.ok) {
    throw await httpError(res, "Não foi possível carregar a classificação dos grupos.");
  }
  const data: unknown = await res.json();
  return groupsResponseSchema.parse(data);
}

/**
 * Busca o chaveamento eliminatório via `GET /api/worldcup/bracket`.
 *
 * @throws WorldcupServiceError em falha HTTP (status != 2xx).
 * @throws ZodError se a resposta não casar com `bracketResponseSchema`.
 * @returns `BracketResponse` validado.
 */
export async function getBracket(): Promise<BracketResponse> {
  const res = await fetch(`${API_BASE}/worldcup/bracket`);
  if (!res.ok) {
    throw await httpError(res, "Não foi possível carregar o chaveamento.");
  }
  const data: unknown = await res.json();
  return bracketResponseSchema.parse(data);
}
