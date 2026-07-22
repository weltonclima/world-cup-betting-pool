import {
  archivedChampionshipSummarySchema,
  championshipHistoryResponseSchema,
  type ArchivedChampionshipSummary,
  type ChampionshipHistoryResponse,
} from "@/schemas/history";
import { matchSchema } from "@/schemas";
import type { MatchWithId } from "@/types";

import { API_BASE, buildHttpError, parseWithId } from "./_apiClient";

/**
 * Camada de serviço da Seção Histórico (multi-championship TASK-15). Lê
 * `GET /api/history` (lista) e `GET /api/history/[id]` (detalhe) — snapshots
 * congelados de campeonatos `archived`, nunca ranking ao vivo. Cada resposta é
 * REVALIDADA com Zod no client (defesa em profundidade), nunca `as`.
 *
 * Rotas autenticadas (sessão via cookie httpOnly) — `credentials: "same-origin"`
 * garante o cookie na chamada, mesmo padrão de `services/championships.ts`.
 */

/** Detalhe do histórico já com `matches` validados (resposta completa da rota). */
export interface ChampionshipHistory extends ChampionshipHistoryResponse {
  matches: MatchWithId[];
}

/**
 * Lista de campeonatos arquivados habilitados no pool do usuário logado,
 * ordenada `archivedAt` desc pelo servidor.
 *
 * @throws Error em falha HTTP (status != 2xx), com status e detalhe do corpo.
 * @throws ZodError se a resposta não casar com o contrato esperado.
 */
export async function getArchivedChampionships(): Promise<
  ArchivedChampionshipSummary[]
> {
  const res = await fetch(`${API_BASE}/history`, {
    method: "GET",
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw await buildHttpError(res, "Erro ao carregar o histórico de campeonatos.");
  }
  const body: unknown = await res.json();
  const items =
    typeof body === "object" && body !== null && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : undefined;
  if (!items) {
    throw new Error("Resposta inválida do histórico de campeonatos.");
  }
  return items.map((item) => archivedChampionshipSummarySchema.parse(item));
}

/**
 * Detalhe de um campeonato arquivado: ranking congelado (+ estatísticas do
 * pool quando existirem) e jogos. `matches` é validado à parte (mesmo padrão
 * de `services/matches.ts`, `matchSchema` tem `.refine` que não sobrevive a
 * composição num schema maior — ver `championshipHistoryResponseSchema`).
 *
 * @throws Error em falha HTTP (status != 2xx, exceto 404).
 * @throws ZodError se a resposta não casar com o contrato esperado.
 * @returns `ChampionshipHistory` validado, ou `null` quando 404 (não encontrado/não-arquivado).
 */
export async function getChampionshipHistory(
  championshipId: string,
): Promise<ChampionshipHistory | null> {
  const res = await fetch(
    `${API_BASE}/history/${encodeURIComponent(championshipId)}`,
    { method: "GET", credentials: "same-origin" },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await buildHttpError(res, "Erro ao carregar o campeonato no histórico.");
  }
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null) {
    throw new Error("Resposta inválida do detalhe do histórico.");
  }
  const { matches, ...rest } = body as Record<string, unknown>;
  const validated = championshipHistoryResponseSchema.parse(rest);
  const parsedMatches = Array.isArray(matches)
    ? matches.map((item) => parseWithId(item, matchSchema))
    : [];
  return { ...validated, matches: parsedMatches };
}
