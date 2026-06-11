import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ adminId: z.string().min(1) });

// Parse defensivo do doc do novo admin — evita acesso cru a `unknown`
// (noUncheckedIndexedAccess). Campos tolerantes: só o que a troca precisa.
const newUserSchema = z.object({
  status: z.string().optional(),
  groupId: z.string().optional(),
  role: z.string().optional(),
});

/** Erro de domínio da troca, carregando o status HTTP a devolver. */
class SwapError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SwapError";
    this.status = status;
  }
}

/**
 * PATCH /api/admin/groups/[id]/admin — troca o admin do pool (PRD §2.9, TASK-05).
 *
 * Transação atômica (pool↔users): `pools.adminId ← novo`; promove o novo a
 * `group_admin`; rebaixa o admin anterior a `participant` se ainda era `group_admin`.
 * Reads-before-writes (exigência do Firestore). Só super_admin/secret.
 *
 * Nota: a propagação da claim `group_admin` nas custom claims é da TASK-06 — aqui
 * só o campo `users/{uid}.role` é escrito.
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

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const newAdminId = parsed.data.adminId;

  const { id } = await ctx.params;
  const db = getAdminFirestore();
  const poolRef = db.collection("pools").doc(id);
  const newRef = db.collection("users").doc(newAdminId);
  const updatedAt = new Date().toISOString();

  try {
    const updatedPool = await db.runTransaction(async (tx) => {
      const poolSnap = await tx.get(poolRef);
      if (!poolSnap.exists) throw new SwapError(404, "Grupo não encontrado.");
      const pool = poolSchema.parse(poolSnap.data());

      const newSnap = await tx.get(newRef);
      const newUser = newUserSchema.safeParse(
        newSnap.exists ? newSnap.data() : undefined,
      );
      if (!newUser.success || newUser.data.status !== "approved") {
        throw new SwapError(409, "Usuário inválido para admin do grupo.");
      }
      // `groupId` ausente é aceito (dupla-compat: opcional até TASK-07/12). Presente
      // e divergente → rejeita (membro de outro pool).
      if (newUser.data.groupId !== undefined && newUser.data.groupId !== id) {
        throw new SwapError(409, "Usuário pertence a outro grupo.");
      }

      // Reads-before-writes: ler o admin anterior ANTES de qualquer escrita.
      const oldAdminId = pool.adminId;
      let demoteOld = false;
      if (oldAdminId !== newAdminId) {
        const oldSnap = await tx.get(db.collection("users").doc(oldAdminId));
        demoteOld = oldSnap.exists && oldSnap.data()?.["role"] === "group_admin";
      }

      tx.update(poolRef, { adminId: newAdminId, updatedAt });
      // Promove só se ainda não for group_admin (evita escrita espúria no self-swap).
      if (newUser.data.role !== "group_admin") {
        tx.update(newRef, { role: "group_admin", updatedAt });
      }
      if (demoteOld) {
        tx.update(db.collection("users").doc(oldAdminId), {
          role: "participant",
          updatedAt,
        });
      }

      return { ...pool, adminId: newAdminId, updatedAt };
    });

    return NextResponse.json({ pool: updatedPool }, { status: 200 });
  } catch (err) {
    if (err instanceof SwapError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/groups/admin] erro inesperado na troca:", err);
    return NextResponse.json(
      { error: "Erro ao trocar o admin do grupo." },
      { status: 500 },
    );
  }
}
