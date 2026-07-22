import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `pools` (`pools/{id}`) — grupo de bolão ("pool") da PRD-09.
// Nome `pools` evita colisão com `groups` (grupos do torneio Copa). UI continua dizendo "grupo".

// Status do pool: pending (recém-criado, fora da busca) · active (disponível p/ cadastro)
// · blocked (não aceita novos membros). Transição de status é server-side (TASK-05).
export const poolStatusSchema = z.enum(["pending", "active", "blocked"]);

// Slug: minúsculas, dígitos e hífen. Unicidade é validada no servidor (TASK-04), não aqui.
// O regex já rejeita string vazia.
export const poolSlugSchema = z.string().regex(/^[a-z0-9-]+$/);

// Limite de tamanho da foto inline (base64, compat Firebase Spark — sem Storage).
// ~512 KB binário, bem abaixo do teto de 1 MB do doc Firestore (que ainda carrega os demais campos).
export const MAX_POOL_PHOTO_BASE64_LENGTH = 700_000;

// Limite do LOGO inline (personalizacao-grupo TASK-01). MENOR que a foto para que
// foto + logo caibam sob o teto de 1 MB do doc Firestore. ~225 KB binário.
export const MAX_POOL_LOGO_BASE64_LENGTH = 300_000;

// Cor de marca do grupo (personalizacao-grupo TASK-02): hex `#RRGGBB`
// case-insensitive. Fonte única da regra — reusada na rota e no client.
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
export const hexColorSchema = z.string().regex(HEX_COLOR_REGEX, "Cor inválida.");

// Modo de ranking do pool (multi-championship TASK-07): `geral` = ranking único
// somando todos os campeonatos habilitados · `por-campeonato` = ranking separado
// por campeonato. Fonte única do enum — reusada no schema, na rota e nos helpers.
export const rankingModeSchema = z.enum(["geral", "por-campeonato"]);

// Default de leitura do modo de ranking (nunca `.default()` no schema — ver abaixo).
export const DEFAULT_RANKING_MODE = "geral" as const;

// Teto de campeonatos habilitados por pool (multi-championship TASK-07). Evita que
// um pool habilite dezenas de campeonatos e estoure o custo de recalc/fan-out
// (TASK-11). Piso é 1 (nunca deixar o grupo sem nenhum campeonato).
export const MAX_ENABLED_CHAMPIONSHIPS = 10;

export const poolSchema = z
  .object({
    id: nonEmptyString, // = id do doc
    name: nonEmptyString,
    slug: poolSlugSchema,
    description: z.string().max(160).optional(),
    photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
    // NET-NEW logo do grupo (personalizacao-grupo TASK-01) — aditivo optional,
    // distinto de photoBase64. Teto menor (cabe com a foto sob 1MB do doc).
    logoBase64: z.string().max(MAX_POOL_LOGO_BASE64_LENGTH).optional(),
    // NET-NEW cor primária por tema (personalizacao-grupo TASK-02) — aditivos
    // optional, hex #RRGGBB. Ausente = usa o --primary padrão do app. Aplicação
    // visual é a TASK-03 (aqui só persiste).
    primaryColorLight: hexColorSchema.optional(),
    primaryColorDark: hexColorSchema.optional(),
    status: poolStatusSchema,
    adminId: nonEmptyString, // referência users.uid (criador/admin do pool)
    createdAt: isoDateTime,
    // Auditoria de mutações server-side (status/troca de admin, TASK-05). Opcional:
    // pools criados na TASK-04 nascem sem ele. Aditivo — não quebra parse de docs antigos.
    updatedAt: isoDateTime.optional(),
    // NET-NEW PRD-10 (TASK-01) — aditivos: pools criados na PRD-09 continuam fazendo
    // parse. Defaults aplicados NA LEITURA (não no schema): `maxParticipants` ausente
    // = sem limite; `allowInvites` ausente = `true`.
    maxParticipants: z.int().min(1).optional(), // limite de participantes (PRD10-05)
    allowInvites: z.boolean().optional(), // flag "permitir convites" (PRD10-05)
    // NET-NEW lock de palpites (TASK-01) — aditivo optional. Default NA LEITURA:
    // `undefined` = palpites liberados (sem `.default(false)` no schema). `true` =
    // bloqueado p/ todos os participantes do pool. Enforcement server-side em TASK-02.
    predictionsLocked: z.boolean().optional(),
    // NET-NEW divisão de ranking por fase (split-phase-ranking TASK-01) — aditivo
    // optional. Default NA LEITURA: `undefined` = divisão OFF (sem `.default(false)`
    // no schema). `true` = telas exibem rankings de grupos e eliminatórias separados.
    // Só exibição; sem impacto em scoring/recalc.
    splitPhaseRanking: z.boolean().optional(),
    // NET-NEW ignorar gols de prorrogação (ignorar-gols-prorrogacao TASK-02) —
    // aditivo optional. Default NA LEITURA: `undefined` = OFF (sem `.default(false)`
    // no schema). `true` = nas fases eliminatórias, palpites são pontuados pelo
    // placar do tempo normal (90min), ignorando gols da prorrogação. Efeito na
    // pontuação é aplicado na TASK-03 (aqui só persiste a flag).
    ignoreOvertimeGoals: z.boolean().optional(),
    // NET-NEW multi-championship (TASK-07) — aditivos optional. Defaults NA LEITURA
    // (sem `.default()` no schema, para não reescrever docs legados):
    // `enabledChampionships` ausente/vazio = só Copa (`[DEFAULT_CHAMPIONSHIP_ID]`);
    // `rankingMode` ausente = `"geral"`. Ver `@/lib/poolChampionships`. A validação
    // de domínio (ids ∈ catálogo, piso/teto, duplicados) é enforçada no PATCH de
    // settings, não aqui (o schema só garante a FORMA). Consumo em scoring/ranking
    // é a TASK-11/12.
    enabledChampionships: z.array(z.string()).optional(),
    rankingMode: rankingModeSchema.optional(),
  })
  .strict();

// Input de criação: id/status/createdAt são definidos na escrita pelo servidor (TASK-04).
// Não-strict (espelha notificationInputSchema) — extras são ignorados, não rejeitados.
export const poolInputSchema = z.object({
  name: nonEmptyString,
  slug: poolSlugSchema,
  description: z.string().max(160).optional(),
  photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
  adminId: nonEmptyString,
});

// Input de criação no CLIENT: igual ao acima, sem `adminId` (definido pela sessão
// no servidor). Usado pela camada de serviço p/ revalidar Zod antes do POST
// (review WR-01 — falha cedo, sem round-trip inútil).
export const poolCreateClientSchema = poolInputSchema.omit({ adminId: true });

// PATCH parcial de um pool pelo super_admin (PRD-11 — editar grupo). Todos os
// campos opcionais (envia só o que mudou); `maxParticipants: null` limpa o limite
// (apaga o campo no servidor). Exige ao menos um campo. `slug`/`status`/`adminId`
// NÃO são editáveis aqui (slug = doc-id imutável; status e admin têm rotas próprias).
export const poolEditSchema = z
  .object({
    name: nonEmptyString,
    description: z.string().max(160),
    photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH),
    logoBase64: z.string().max(MAX_POOL_LOGO_BASE64_LENGTH),
    primaryColorLight: hexColorSchema,
    primaryColorDark: hexColorSchema,
    maxParticipants: z.int().min(1).nullable(),
    allowInvites: z.boolean(),
    predictionsLocked: z.boolean(), // toggle lock de palpites (TASK-01); `.partial()` abaixo o torna opcional no patch
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });
