import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  percentageSchema,
  rankingScopeSchema,
} from "@/schemas/shared";
import { hexColorSchema, rankingModeSchema } from "@/schemas/pools";

// Entrada de ranking (objeto aninhado).
// Pontuação ponderada: `points` === total de PONTOS ponderados (5/10) no escopo,
// não a contagem de acertos exatos (esta é separada no recalc — TASK-03).
// Campos de exibição (name/wrong/accuracy) são OPCIONAIS para compat retroativa com docs
// já gravados no formato antigo {uid,nickname,position,points}; o recalc (TASK-03) passa
// a gravá-los sempre.
export const rankingEntrySchema = z
  .object({
    uid: nonEmptyString, // usuário
    nickname: nonEmptyString, // desnormalizado para exibição
    name: nonEmptyString.optional(), // nome completo desnormalizado (users.name)
    position: z.int().min(1), // posição
    points: z.int().min(0), // total de pontos ponderados (5/10) no escopo
    // Decomposição dos acertos por tipo (exibida na Tela 01 no lugar do %).
    // Opcionais p/ compat retroativa: docs gravados antes deste campo seguem
    // válidos; a UI cai em 0. Preenchidos sempre pelo recalc (geral + pool).
    correct: z.int().min(0).optional(), // placares EXATOS (10 pts)
    winner: z.int().min(0).optional(), // acertou o vencedor sem placar (5 pts)
    draw: z.int().min(0).optional(), // acertou o empate sem placar (5 pts)
    wrong: z.int().min(0).optional(), // palpites errados (partidas finalizadas) no escopo
    accuracy: percentageSchema.optional(), // aproveitamento 0–100
    // Foto de perfil (PRD-06, data URL base64). Aditivo/opcional — propagado pelo
    // recalc (TASK-05) sob orçamento de bytes por doc; omitido quando o orçamento
    // estoura (cai no fallback de iniciais na UI). Docs antigos sem o campo seguem válidos.
    avatarUrl: z.string().optional(),
  })
  .strict();

// Coleção `rankings`: documento por escopo contendo as entradas ordenadas.
export const rankingSchema = z
  .object({
    scope: rankingScopeSchema, // "geral" ou uma das 5 fases
    updatedAt: isoDateTime, // quando foi recalculado
    entries: z.array(rankingEntrySchema), // ranking ordenado
  })
  .strict();

// Doc de ranking POR CAMPEONATO (multi-championship TASK-21, gravado pela recalc §7.5
// da TASK-11). Difere de `rankingSchema` em dois pontos que impedem o reuso: `scope` é
// namespaced (`bra.1-2026-geral`, fora do enum de fases) e há o campo extra
// `championshipId`. Schema DEDICADO — não afrouxar `rankingSchema` (`.strict()` + enum,
// usado pelas rotas legadas da Copa). `entries` reusa `rankingEntrySchema`.
export const championshipRankingSchema = z
  .object({
    scope: nonEmptyString, // doc-scope namespaced, ex.: "bra.1-2026-geral"
    championshipId: nonEmptyString, // id do campeonato dono do doc
    updatedAt: isoDateTime,
    entries: z.array(rankingEntrySchema),
  })
  .strict();

// Payload de resposta de `GET /api/rankings/pool` (split-phase-ranking TASK-02;
// championship-aware TASK-12). NÃO estende mais `rankingSchema`: sob multi-championship
// a rota serve três formas de doc no MESMO endpoint — o `geral`/`agregado` bare do pool
// E o `geral` por campeonato (`?championship=`), cujo `scope` é namespaced (`bra.1-2026-geral`)
// e fora do enum de fases. Por isso `scope` é `nonEmptyString` aqui (aceita "geral",
// "agregado" e "{C}-geral"), diferente de `rankingSchema` (`.strict()` + enum, intocado).
// Antes (TASK-21 MEDIUM-1) o parser client rejeitava a resposta escopada; agora as três
// formas passam. `championshipId` só vem na resposta por campeonato; `rankingMode` informa
// ao client qual UI montar (lista agregada única vs seletor por campeonato). As flags de
// exibição são de nível POOL (não do campeonato) e permanecem opcionais.
export const poolRankingResponseSchema = z
  .object({
    scope: nonEmptyString, // "geral" | "agregado" | "{championshipId}-geral"
    championshipId: nonEmptyString.optional(), // presente só na resposta por campeonato
    rankingMode: rankingModeSchema.optional(), // modo de exibição do pool (default geral)
    updatedAt: isoDateTime,
    entries: z.array(rankingEntrySchema),
    splitPhaseRanking: z.boolean().optional(),
    // Flag de exibição do pool (ignorar-gols-prorrogacao TASK-04): quando true, as
    // telas pontuam palpites de eliminatórias pelo placar de 90min (coerência com o
    // ranking do pool). Ausente = OFF. Fonte única no client via usePoolRanking.
    ignoreOvertimeGoals: z.boolean().optional(),
    // Cores de marca do pool (personalizacao-grupo TASK-03) — usadas pelo
    // PoolThemeVars no client p/ sincronizar as CSS vars do tema por pool.
    // Ausentes = grupo sem cor (fallback verde). Fonte única via usePoolRanking.
    primaryColorLight: hexColorSchema.optional(),
    primaryColorDark: hexColorSchema.optional(),
  })
  .strict();

// Doc de ranking `geral` AGREGADO por pool (multi-championship TASK-12, gravado pela
// recalc §7.6). Difere de `rankingSchema` (`scope` fora do enum: "agregado") e de
// `championshipRankingSchema` (NÃO carrega `championshipId` — é a soma entre campeonatos,
// não um campeonato específico). Schema DEDICADO p/ o parse server do doc armazenado.
export const aggregateRankingSchema = z
  .object({
    scope: nonEmptyString, // "agregado"
    updatedAt: isoDateTime,
    entries: z.array(rankingEntrySchema),
  })
  .strict();

// Ranking por grupo individual (A–L). Doc `rankings/group-{groupId}`.
// Reaproveita `rankingEntrySchema`; identificado por `groupId` (alinhado a match.groupId).
export const groupRankingSchema = z
  .object({
    groupId: nonEmptyString, // id do grupo (ex.: "A"…"L")
    updatedAt: isoDateTime, // quando foi recalculado
    entries: z.array(rankingEntrySchema), // ranking do grupo, ordenado
  })
  .strict();
