import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

// Coleção/domínio `championship` — campeonato de futebol servido pela ESPN.
// Fundação do épico multi-championship-launch (TASK-02). Slug inglês/estável para
// storage; `name` em pt-BR para a UI. Catálogo estático vive em
// `src/server/copaData/championshipCatalog.ts` (valida contra este schema).

// Tipo do campeonato: `league` = pontos corridos (sem chaveamento) ·
// `cup` = mata-mata / grupos+mata-mata (tem fases/bracket). Vem SEMPRE do catálogo,
// nunca inferido da API (achado do spike TASK-01).
export const championshipTypeSchema = z.enum(["league", "cup"]);

// Status do campeonato: `upcoming` (ainda não começou) · `live` (em andamento) ·
// `archived` (encerrado, servido do banco — TASK-13/14). No catálogo é placeholder
// estático; a transição real é da TASK-13.
export const championshipStatusSchema = z.enum(["upcoming", "live", "archived"]);

export const championshipSchema = z
  .object({
    // Id interno estável. Convenção: `fifa.world` mantém id BARE (compat com o
    // default legado que a TASK-05 assume); campeonatos novos usam `{espnSlug}-{season}`
    // (ex.: `bra.1-2026`) para distinguir temporadas ao arquivar.
    id: nonEmptyString,
    // Segmento de path da ESPN (`soccer/{espnSlug}/scoreboard`), ex.: `bra.1`.
    // Separado do `id` porque um mesmo slug tem várias temporadas.
    espnSlug: nonEmptyString,
    // Nome de exibição em pt-BR.
    name: nonEmptyString,
    // Temporada, ex.: `2026` | `2025-26`.
    season: nonEmptyString,
    type: championshipTypeSchema,
    status: championshipStatusSchema,
    // Se o schedule pode exceder 100 eventos/chamada (cap ESPN) e exige paginação
    // por ranges disjuntos na TASK-04. Regra segura: `true` p/ toda liga + copas
    // de temporada longa.
    needsPagination: z.boolean(),
    // `true` APENAS para `fifa.world` — sinaliza à TASK-03 que este campeonato
    // emite matchId legado (sem namespace). Ausente/false nos demais.
    legacyMatchId: z.boolean().optional(),
  })
  .strict();
