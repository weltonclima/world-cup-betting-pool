import { championshipPublicSchema } from "@/schemas/championships";
import type { ChampionshipPublic } from "@/types/championships";

import { buildHttpError } from "./_apiClient";

/**
 * Camada de serviço do catálogo público de campeonatos (multi-championship
 * TASK-08). Lê `GET /api/championships` (projeção pública do registry estático,
 * TASK-06) e valida CADA item por schema (nunca `as`) antes de entregar à UI.
 *
 * Rota pública/estática (sem sessão) — usa o helper genérico `buildHttpError`
 * (mesmo padrão de `matches`/`teams`), não o `GroupServiceError` (que é do
 * domínio autenticado de administração de grupo).
 */
export async function getChampionshipsCatalog(): Promise<ChampionshipPublic[]> {
  const response = await fetch("/api/championships", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw await buildHttpError(response, "Erro ao carregar os campeonatos.");
  }
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new Error("Resposta inválida do catálogo de campeonatos.");
  }
  return body.map((item) => championshipPublicSchema.parse(item));
}
