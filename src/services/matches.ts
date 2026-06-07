import { z } from "zod";

import { matchSchema } from "@/schemas";
import type { MatchWithId } from "@/types";

/**
 * Camada de serviço de partidas (integracao-api-football, TASK-05).
 *
 * Consome os Route Handlers `/api/matches` (substitui a leitura direta do
 * Firestore). Os dados da Copa vêm da API-Football via servidor Next
 * (proxy + cache + validação) — o browser NUNCA fala com a API-Football.
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

/** Base relativa — funciona no client (browser resolve contra a origem atual). */
const API_BASE = "/api";

/**
 * Schema do `id` que a rede embute em cada partida (= `String(fixture.id)`).
 *
 * NÃO usamos `z.intersection(matchSchema, …)` nem `matchSchema.and(…)`: o
 * `matchSchema` tem um `.refine` (regra de placares por status) e a interseção em
 * Zod NÃO reaplica o refine do lado esquerdo, abrindo um buraco de validação.
 * Em vez disso validamos `id` separadamente e o restante com o `matchSchema`
 * intacto (refine preservado) — ver `parseMatchWithId`.
 */
const idSchema = z.object({ id: z.string().min(1) });

/**
 * Valida uma partida vinda da rede preservando o refine de placares do
 * `matchSchema`: separa `id` (validado por `idSchema`) do restante (validado por
 * `matchSchema`, que é `.strict()` e não conhece `id`).
 *
 * @throws ZodError se `id` ou o restante violarem o contrato.
 */
function parseMatchWithId(input: unknown): MatchWithId {
  const { id } = idSchema.parse(input);
  // input é objeto (idSchema.parse acima já garantiu); separa id do restante.
  const { id: _omit, ...rest } = input as Record<string, unknown>;
  void _omit;
  return { id, ...matchSchema.parse(rest) };
}

/**
 * Lê o corpo `{ error }` (se houver) e monta uma mensagem útil para o `Error`.
 * Tolera corpo ausente/ inválido sem mascarar o status HTTP.
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
  const scheduled = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  return scheduled[0] ?? null;
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
