import { z } from "zod";

import { matchSchema } from "@/schemas";
import type { MatchWithId } from "@/types";

import { API_BASE, buildHttpError, parseWithId } from "./_apiClient";

/**
 * Camada de serviço de partidas (integracao-api-football, TASK-05).
 *
 * Consome os Route Handlers `/api/matches` (substitui a leitura direta do
 * Firestore). Os dados da Copa vêm do openfootball/worldcup.json via servidor
 * Next (proxy + cache + validação) — o browser NUNCA fala com a fonte externa.
 *
 * Cada resposta é REVALIDADA com Zod no client (`matchWithIdSchema`) — defesa
 * em profundidade: o servidor já valida, mas não confiamos cegamente na rede.
 * O `id` (= `String(fixture.id)`) já vem embutido em cada item (não é doc id de
 * Firestore), por isso o schema do client inclui `id` (diferente do `matchSchema`
 * `.strict()` do Firestore, que não tem `id`).
 *
 * Erros HTTP (status != 2xx) → lança `Error` com mensagem útil (corpo `{ error }`
 * quando presente). `getMatchById` trata 404 como `null`.
 *
 * Assinaturas mantidas em relação à versão Firestore para não quebrar os hooks da
 * Home (`useNextMatch`, `useRecentResults`): `getNextScheduledMatch` e
 * `getRecentFinishedMatches` continuam existindo, agora DERIVADAS de `listMatches`
 * client-side (filtro + ordenação), sem endpoints extras.
 */

/**
 * Valida uma partida vinda da rede preservando o refine de placares do
 * `matchSchema`: separa `id` do restante (validado por `matchSchema`, `.strict()`
 * sem `id`). Usa o helper compartilhado `parseWithId`, que evita interseção para
 * não perder o `.refine` (regra de placares por status) — ver `_apiClient.ts`.
 *
 * @throws ZodError se `id` ou o restante violarem o contrato.
 */
function parseMatchWithId(input: unknown): MatchWithId {
  return parseWithId(input, matchSchema);
}

/**
 * Lista TODAS as partidas da Copa via `GET /api/matches`.
 *
 * @throws Error em falha HTTP (status != 2xx), com status e detalhe do corpo.
 * @throws ZodError se a resposta não casar com o contrato esperado.
 * @returns Array de `MatchWithId` validado.
 */
export async function listMatches(): Promise<MatchWithId[]> {
  const res = await fetch(`${API_BASE}/matches`);
  if (!res.ok) {
    throw await buildHttpError(res, "Falha ao carregar as partidas");
  }
  const data: unknown = await res.json();
  return z.array(z.unknown()).parse(data).map(parseMatchWithId);
}

/**
 * Busca uma partida pelo id via `GET /api/matches/:id`.
 *
 * @throws Error em falha HTTP (status != 2xx, exceto 404).
 * @throws ZodError se a resposta não casar com o contrato esperado.
 * @returns `MatchWithId` validado, ou `null` quando 404 (não encontrada).
 */
export async function getMatchById(id: string): Promise<MatchWithId | null> {
  const res = await fetch(`${API_BASE}/matches/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await buildHttpError(res, "Falha ao carregar a partida");
  }
  const data: unknown = await res.json();
  return parseMatchWithId(data);
}

/**
 * Retorna a próxima partida agendada (status "scheduled"), ordenada pelo
 * `kickoffAt` mais próximo (asc). Derivada client-side de `listMatches()`.
 *
 * @throws Error / ZodError (propaga de `listMatches`).
 * @returns `MatchWithId` validado, ou `null` se não houver partidas agendadas.
 */
export async function getNextScheduledMatch(): Promise<MatchWithId | null> {
  const matches = await listMatches();
  const now = Date.now();
  // Apenas jogos AINDA por vir (kickoff no futuro). A fonte openfootball não
  // popula `score.ft` em tempo real, então um jogo já iniciado/encerrado
  // permanece "scheduled" — sem este filtro, `[0]` retornaria a 1ª partida do
  // torneio (já no passado) como "próximo jogo". Comparar via Date trata o
  // offset de fuso embutido no ISO (ex.: 2026-06-11T13:00:00-06:00).
  const upcoming = matches
    .filter(
      (m) => m.status === "scheduled" && new Date(m.kickoffAt).getTime() > now,
    )
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  return upcoming[0] ?? null;
}

/**
 * Retorna as últimas partidas finalizadas (status "finished"), ordenadas por
 * `kickoffAt` decrescente (mais recentes primeiro), limitadas a 5.
 * Derivada client-side de `listMatches()`.
 *
 * @throws Error / ZodError (propaga de `listMatches`).
 * @returns Array de até 5 `MatchWithId` (vazio se não houver finalizadas).
 */
export async function getRecentFinishedMatches(): Promise<MatchWithId[]> {
  const matches = await listMatches();
  return matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt))
    .slice(0, 5);
}
