import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { isSuperAdminRole, roleSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ groupId: z.string().min(1) });

/** Erro de domínio da atribuição, carregando o status HTTP a devolver. */
class AssignError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AssignError";
    this.status = status;
  }
}

/**
 * PATCH /api/admin/users/[uid]/group — adiciona/realoca um usuário a um grupo pelo
 * super_admin. Vincula `users/{uid}.groupId` ao pool e deixa o usuário já
 * `approved` (super_admin é a autoridade máxima — pula a moderação do group_admin).
 * Limpa `removedFromGroupAt` (caso o usuário tivesse sido removido antes).
 *
 * Transação (user↔pool): valida que o usuário existe e não é super_admin, e que o
 * pool-alvo existe, está `active` e não foi soft-deleted. Só super_admin/secret.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ uid: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const { groupId } = parsed.data;

  const { uid } = await ctx.params;
  if (!uid || uid.length === 0) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 422 });
  }

  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(uid);
  const poolRef = db.collection("pools").doc(groupId);
  const updatedAt = new Date().toISOString();

  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    const poolName = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new AssignError(404, "Usuário não encontrado.");
      const userData = userSnap.data() ?? {};

      // super_admin opera globalmente — seu grupo não é gerenciado por aqui.
      const role = roleSchema.safeParse(userData["role"]);
      if (role.success && isSuperAdminRole(role.data)) {
        throw new AssignError(409, "Não é possível alterar o grupo deste usuário.");
      }

      const poolSnap = await tx.get(poolRef);
      // Leitura defensiva (sem strict parse): pools soft-deleted carregam
      // `deletedAt` — fora do `poolSchema` strict — e não devem receber membros.
      const poolData = poolSnap.exists ? (poolSnap.data() ?? {}) : null;
      if (!poolData || poolData["deletedAt"] != null) {
        throw new AssignError(404, "Grupo não encontrado.");
      }
      if (poolData["status"] !== "active") {
        throw new AssignError(409, "O grupo não está ativo.");
      }

      // approved direto (decisão de produto): super_admin adiciona já aprovado.
      // `removedFromGroupAt` é limpo para não deixar marca de soft-delete antiga.
      tx.update(userRef, {
        groupId,
        status: "approved",
        removedFromGroupAt: FieldValue.delete(),
        updatedAt,
      });

      const name = poolData["name"];
      return typeof name === "string" && name.length > 0 ? name : groupId;
    });

    if (auth.actorUid) {
      void writeAuditLog({
        type: "user_group_assigned",
        actorUid: auth.actorUid,
        targetUid: uid,
        message: `Usuário adicionado ao grupo: ${poolName}`,
        level: "info",
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AssignError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/users/group] erro ao atribuir grupo:", err);
    return NextResponse.json(
      { error: "Erro ao adicionar o usuário ao grupo." },
      { status: 500 },
    );
  }
}
