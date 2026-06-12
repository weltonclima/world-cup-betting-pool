import { z } from "zod";

import {
  isoDateTime,
  nonEmptyString,
  predictionStatusSchema,
  roleSchema,
  scoreSchema,
} from "@/schemas/shared";

// ---------------------------------------------------------------------------
// Schema completo do doc Firestore (coleção `predictions`).
// Os campos `status` e `points` são gravados EXCLUSIVAMENTE pelo servidor
// (Route Handler com Admin SDK). O cliente NUNCA os envia.
// ---------------------------------------------------------------------------
export const predictionSchema = z
  .object({
    uid: nonEmptyString,           // autor do palpite — referência users.uid
    matchId: nonEmptyString,       // partida alvo — API-Football fixture id
    homeScore: scoreSchema,        // placar previsto mandante (inteiro ≥ 0)
    awayScore: scoreSchema,        // placar previsto visitante (inteiro ≥ 0)
    createdAt: isoDateTime.optional(),
    updatedAt: isoDateTime.optional(),
    // Gravados somente pelo Route Handler de pontuação (Admin SDK):
    status: predictionStatusSchema.optional(),
    points: z.literal(0).or(z.literal(1)).optional(),
    // Origem manual (PRD-12) — gravados SÓ pelo Route Handler de palpite manual
    // do admin de grupo (`POST /api/group/predictions`). Opcionais: palpite
    // normal não os carrega. ⚠️ DEVEM estar declarados aqui: `predictionSchema`
    // é `.strict()` e o recalc faz `safeParse(doc.data())` — um campo não
    // declarado faria o doc ser descartado e o palpite sumir do ranking.
    editedBy: nonEmptyString.optional(),       // uid do admin que lançou
    editedByRole: roleSchema.optional(),       // papel do autor (enum, não string solta)
    editedAt: isoDateTime.optional(),          // quando foi lançado/sobrescrito
  })
  .strict();

// ---------------------------------------------------------------------------
// Schema de input do cliente — body do POST /api/predictions.
// `uid` é omitido (vem da sessão no servidor, não do body).
// `status` e `points` são omitidos (nunca aceitos do cliente).
// ---------------------------------------------------------------------------
export const predictionInputSchema = z.object({
  matchId: nonEmptyString,
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});

// ---------------------------------------------------------------------------
// Schema de input do admin de grupo — body do POST /api/group/predictions (PRD-12).
// Diferente de `predictionInputSchema`: `targetUid` é EXPLÍCITO no body (o alvo é
// outro usuário, validado/escopado no servidor), não derivado da sessão. O servidor
// nunca confia neste uid para autorização — só para identificar o palpite alvo.
// ---------------------------------------------------------------------------
export const groupManualPredictionInputSchema = z.object({
  targetUid: nonEmptyString,
  matchId: nonEmptyString,
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});

// ---------------------------------------------------------------------------
// Schema da resposta do POST /api/group/predictions (objeto `saved`). Parse
// defensivo no client (não `as`): o serviço valida o retorno do Route Handler
// antes de entregar à UI. Reflete o payload de `route.ts` (id = `${uid}_${matchId}`).
// ---------------------------------------------------------------------------
export const groupManualPredictionSavedSchema = z.object({
  id: nonEmptyString,
  uid: nonEmptyString,
  matchId: nonEmptyString,
  homeScore: scoreSchema,
  awayScore: scoreSchema,
  editedBy: nonEmptyString,
  editedByRole: roleSchema,
  editedAt: isoDateTime,
});

// ---------------------------------------------------------------------------
// Schema do formulário (TASK-07) — sem matchId (injetado antes do submit).
// Usado pelo React Hook Form + zodResolver no PredictionForm.
// ---------------------------------------------------------------------------
export const predictionFormSchema = z.object({
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});

export type PredictionFormValues = z.infer<typeof predictionFormSchema>;
