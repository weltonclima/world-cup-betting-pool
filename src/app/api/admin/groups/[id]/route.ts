import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { FieldValue } from "firebase-admin/firestore";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolEditSchema, poolSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Erro de domínio da edição, carregando o status HTTP a devolver. */
class EditError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EditError";
    this.status = status;
  }
}

/**
 * PATCH /api/admin/groups/[id] — edição dos campos do pool pelo super_admin
 * (PRD-11 — editar grupo). Atualiza só os campos enviados (PATCH parcial):
 * name, description, photoBase64, maxParticipants (null = remove o limite),
 * allowInvites. NÃO toca em slug/status/adminId (rotas próprias). Soft-deleted →
 * 404. Só super_admin/secret.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = poolEditSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { id } = await ctx.params;
  const db = getAdminFirestore();
  const ref = db.collection("pools").doc(id);
  const updatedAt = new Date().toISOString();

  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.["deletedAt"] != null) {
        throw new EditError(404, "Grupo não encontrado.");
      }
      const current = poolSchema.safeParse(snap.data());
      if (!current.success) throw new EditError(500, "Grupo corrompido.");

      // `patch` vai pro Firestore (pode conter FieldValue.delete()); `next` espelha
      // o doc resultante p/ validar e devolver (sem o sentinel de delete).
      const patch: Record<string, unknown> = { updatedAt };
      const next: Record<string, unknown> = { ...current.data, updatedAt };
      const p = parsed.data;
      if (p.name !== undefined) { patch.name = p.name; next.name = p.name; }
      if (p.description !== undefined) {
        patch.description = p.description;
        next.description = p.description;
      }
      if (p.photoBase64 !== undefined) {
        patch.photoBase64 = p.photoBase64;
        next.photoBase64 = p.photoBase64;
      }
      if (p.maxParticipants !== undefined) {
        if (p.maxParticipants === null) {
          patch.maxParticipants = FieldValue.delete();
          delete next.maxParticipants;
        } else {
          patch.maxParticipants = p.maxParticipants;
          next.maxParticipants = p.maxParticipants;
        }
      }
      if (p.allowInvites !== undefined) {
        patch.allowInvites = p.allowInvites;
        next.allowInvites = p.allowInvites;
      }

      const validated = poolSchema.safeParse(next);
      if (!validated.success) throw new EditError(422, "Dados inválidos.");

      tx.update(ref, patch);
      return validated.data;
    });

    if (auth.actorUid) {
      void writeAuditLog({
        type: "group_updated",
        actorUid: auth.actorUid,
        message: `Grupo editado: ${updated.name}`,
        level: "info",
      });
    }

    return NextResponse.json({ pool: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof EditError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/groups/edit] erro ao editar grupo:", error);
    return NextResponse.json({ error: "Erro ao editar o grupo." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/groups/[id] — exclusão (SOFT-DELETE, B2) de pool bloqueado
 * (PRD11-04, TASK-05). Carimba `deletedAt` em vez de apagar o doc: preserva a
 * integridade de `users.groupId` e do ranking. Só super_admin/secret.
 *
 * Regra: só pool com `status === "blocked"` pode ser excluído (a tela só expõe a
 * ação em bloqueados). Já-deletado → 404. Best-effort log `group_blocked` (a
 * exclusão é o fim do ciclo do bloqueio; sem tipo de log dedicado nesta PRD).
 */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await ctx.params;
  const db = getAdminFirestore();
  const ref = db.collection("pools").doc(id);
  const deletedAt = new Date().toISOString();

  try {
    const pool = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new SoftDeleteError(404, "Grupo não encontrado.");
      }
      const data = snap.data();
      if (data?.["deletedAt"] != null) {
        throw new SoftDeleteError(404, "Grupo não encontrado.");
      }
      const current = poolSchema.safeParse(data);
      if (!current.success) {
        throw new SoftDeleteError(500, "Grupo corrompido.");
      }
      if (current.data.status !== "blocked") {
        throw new SoftDeleteError(
          409,
          "Apenas grupos bloqueados podem ser excluídos.",
        );
      }
      tx.update(ref, { deletedAt, updatedAt: deletedAt });
      return current.data;
    });

    if (auth.actorUid) {
      void writeAuditLog({
        type: "group_blocked",
        actorUid: auth.actorUid,
        message: `Grupo excluído: ${pool.name}`,
        level: "warning",
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof SoftDeleteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[admin/groups/delete] erro ao excluir grupo:", error);
    return NextResponse.json(
      { error: "Erro ao excluir o grupo." },
      { status: 500 },
    );
  }
}

class SoftDeleteError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SoftDeleteError";
    this.status = status;
  }
}
