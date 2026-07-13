import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  POOL_THEME_COOKIE,
  serializePoolThemeCookie,
} from "@/features/groupAdmin/lib/poolTheme";
import { recalcRankingsBestEffort } from "@/server/rankings/recalc";
import {
  hexColorSchema,
  MAX_POOL_LOGO_BASE64_LENGTH,
  MAX_POOL_PHOTO_BASE64_LENGTH,
  poolSchema,
} from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Campos editáveis do pool (PRD-10, TASK-07). `slug`/`status`/`adminId`/`id` são
 * IMUTÁVEIS aqui (slug impacta links existentes; status/admin têm fluxos próprios).
 * `maxParticipants` aceita `null` para LIMPAR o limite (= sem limite).
 */
const settingsSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().max(160).optional(),
    photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
    // Defense-in-depth (review M1): além do teto, exige data URL de imagem RASTER
    // (o compressor sempre gera JPEG; png/webp aceitos por robustez). Fecha a
    // porta a `data:image/svg+xml,...`/`data:text/html,...` persistidos por um
    // client malicioso e servidos a membros no futuro (XSS armazenado).
    logoBase64: z
      .string()
      .max(MAX_POOL_LOGO_BASE64_LENGTH)
      .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Logo inválido.")
      .optional(),
    primaryColorLight: hexColorSchema.optional(),
    primaryColorDark: hexColorSchema.optional(),
    maxParticipants: z.int().min(1).nullable().optional(),
    allowInvites: z.boolean().optional(),
    predictionsLocked: z.boolean().optional(),
    splitPhaseRanking: z.boolean().optional(),
    ignoreOvertimeGoals: z.boolean().optional(),
  })
  .strict();

/** GET /api/group/settings — lê o pool da sessão (para o form). */
export async function GET(): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  const db = getAdminFirestore();
  try {
    const snap = await db.collection("pools").doc(groupId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ pool: poolSchema.parse(snap.data()) });
  } catch (err) {
    console.error("[group/settings GET] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao carregar as configurações." },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/group/settings — atualiza campos editáveis do PRÓPRIO pool. Partial
 * update; rejeita campos imutáveis via `.strict()`. `groupId` da sessão (D2).
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    // Não vaza `parsed.error.issues` (estrutura interna do schema) — "minimize
    // sensitive data in errors". O client valida os mesmos limites.
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const updatedAt = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt };
  const {
    name,
    description,
    photoBase64,
    logoBase64,
    primaryColorLight,
    primaryColorDark,
    maxParticipants,
    allowInvites,
    predictionsLocked,
    splitPhaseRanking,
    ignoreOvertimeGoals,
  } = parsed.data;
  if (name !== undefined) patch["name"] = name;
  if (description !== undefined) patch["description"] = description;
  if (photoBase64 !== undefined) patch["photoBase64"] = photoBase64;
  if (logoBase64 !== undefined) patch["logoBase64"] = logoBase64;
  if (primaryColorLight !== undefined) patch["primaryColorLight"] = primaryColorLight;
  if (primaryColorDark !== undefined) patch["primaryColorDark"] = primaryColorDark;
  // null → limpa o limite (FieldValue.delete direto, sem sentinela ""); número →
  // define. Decidido na MONTAGEM do patch (review BR-01): sem o intermediário ""
  // não há janela em que um valor inválido possa ser persistido por reordenação.
  if (maxParticipants !== undefined) {
    if (maxParticipants === null) {
      const { FieldValue } = await import("firebase-admin/firestore");
      patch["maxParticipants"] = FieldValue.delete();
    } else {
      patch["maxParticipants"] = maxParticipants;
    }
  }
  if (allowInvites !== undefined) patch["allowInvites"] = allowInvites;
  if (predictionsLocked !== undefined) patch["predictionsLocked"] = predictionsLocked;
  if (splitPhaseRanking !== undefined) patch["splitPhaseRanking"] = splitPhaseRanking;
  if (ignoreOvertimeGoals !== undefined) patch["ignoreOvertimeGoals"] = ignoreOvertimeGoals;

  const db = getAdminFirestore();
  const poolRef = db.collection("pools").doc(groupId);

  try {
    const snap = await poolRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }

    // Mudança da flag `ignoreOvertimeGoals` altera a PONTUAÇÃO dos docs de ranking
    // do pool (geral, fases e eliminatórias), mas não muda o placar final nem o
    // shape — logo o gate de frescor (`ensureRankingsFresh`) não recomputa sozinho.
    // Dispara um recalc global best-effort quando o valor efetivamente muda, para
    // manter TODOS os docs do pool coerentes (o botão de recalc do pool só cobre o
    // doc `geral`). Best-effort: nunca derruba o save.
    const flagChanged =
      ignoreOvertimeGoals !== undefined &&
      ((snap.data() as { ignoreOvertimeGoals?: unknown }).ignoreOvertimeGoals === true) !==
        ignoreOvertimeGoals;

    await poolRef.update(patch);
    const updatedSnap = await poolRef.get();
    if (flagChanged) {
      await recalcRankingsBestEffort(db);
    }
    const updatedPool = poolSchema.parse(updatedSnap.data());
    const response = NextResponse.json({ pool: updatedPool });

    // Refresca o cookie de cor do pool (TASK-03) quando o admin muda uma cor, para
    // o SSR sem flash refletir imediatamente (sem re-login). Best-effort.
    if (primaryColorLight !== undefined || primaryColorDark !== undefined) {
      const value = serializePoolThemeCookie(
        updatedPool.primaryColorLight,
        updatedPool.primaryColorDark,
      );
      if (value !== null) {
        response.cookies.set({
          name: POOL_THEME_COOKIE,
          value,
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 5 * 24 * 60 * 60,
        });
      }
    }
    return response;
  } catch (err) {
    console.error("[group/settings PATCH] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao salvar as configurações." },
      { status: 500 },
    );
  }
}
