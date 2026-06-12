import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
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
    maxParticipants: z.int().min(1).nullable().optional(),
    allowInvites: z.boolean().optional(),
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
  const { name, description, photoBase64, maxParticipants, allowInvites } =
    parsed.data;
  if (name !== undefined) patch["name"] = name;
  if (description !== undefined) patch["description"] = description;
  if (photoBase64 !== undefined) patch["photoBase64"] = photoBase64;
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

  const db = getAdminFirestore();
  const poolRef = db.collection("pools").doc(groupId);

  try {
    const snap = await poolRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }

    await poolRef.update(patch);
    const updatedSnap = await poolRef.get();
    return NextResponse.json({ pool: poolSchema.parse(updatedSnap.data()) });
  } catch (err) {
    console.error("[group/settings PATCH] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao salvar as configurações." },
      { status: 500 },
    );
  }
}
