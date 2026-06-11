import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
