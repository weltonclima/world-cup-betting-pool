import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

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
    // Janela real da temporada (`YYYYMMDD`), TASK-05 / fix WR-02. Para temporada
    // europeia partida (ago–mai) que atravessa DOIS anos-calendário, `season` YYYY
    // não basta. Quando presentes, `deriveRanges` deriva ranges MENSAIS dessa
    // janela em vez de jan–dez. Ausentes → comportamento por `season` (jan–dez).
    seasonStart: z.string().regex(/^\d{8}$/).optional(),
    seasonEnd: z.string().regex(/^\d{8}$/).optional(),
  })
  .strict();

// Estado dinâmico de campeonato (multi-championship-launch TASK-13). Doc
// `championships/{id}` gravado SÓ pelo Admin SDK (pipeline de arquivamento) — é o
// override de runtime que sobrepõe o `status` estático/frozen do catálogo. O
// catálogo segue autoritativo para metadados imutáveis (`type`, `espnSlug`…) e
// como default de `status` quando não há doc. `.strict()`.
export const championshipStateSchema = z
  .object({
    status: championshipStatusSchema, // status observável em runtime
    archivedAt: isoDateTime, // carimbo do flip → archived
    finishedSignature: nonEmptyString, // computeFinishedSignature(matches) no arquivamento
  })
  .strict();

// Projeção PÚBLICA do catálogo servida por `GET /api/championships` (TASK-06) e
// consumida no cliente (TASK-08). Só os campos que a UI precisa — NÃO inclui
// `espnSlug`/`needsPagination`/`legacyMatchId`/janela de temporada (internos de
// fetch/compat/provedor). O cliente valida cada item contra este schema (nunca
// `as`). `.strict()` rejeita campos extras inesperados no contrato.
export const championshipPublicSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    season: nonEmptyString,
    type: championshipTypeSchema,
    status: championshipStatusSchema,
  })
  .strict();
