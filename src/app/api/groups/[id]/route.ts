import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { isSuperAdminRole, poolSchema, roleSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/groups/[id] — detalhe de um pool (TASK-04).
 *
 * Visibilidade: pool `active` é legível por qualquer aprovado; `pending`/`blocked`
 * só pelo `adminId` dono OU super_admin (dupla-compat `admin`||`super_admin`) —
 * caso contrário 404 (não revela a existência de pool não-ativo a terceiros).
 * `memberCount` = aprovados com `groupId == id` (índice `users(groupId,status)`,
 * TASK-03). Lê via Admin SDK porque as Rules bloqueiam pool `pending` no client.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { uid } = auth.user;

  const { id } = await ctx.params;
  const db = getAdminFirestore();

  const snap = await db.collection("pools").doc(id).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  }

  const parsed = poolSchema.safeParse(snap.data());
  if (!parsed.success) {
    return NextResponse.json({ error: "Erro ao carregar o grupo." }, { status: 500 });
  }
  const pool = parsed.data;

  // Pool não-ativo: só dono ou super_admin enxerga; senão 404 (sem vazar existência).
  if (pool.status !== "active") {
    let allowed = pool.adminId === uid;
    if (!allowed) {
      const userSnap = await db.collection("users").doc(uid).get();
      const role = roleSchema.safeParse(userSnap.exists ? userSnap.data()?.role : undefined);
      allowed = role.success && isSuperAdminRole(role.data);
    }
    if (!allowed) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
  }

  const countSnap = await db
    .collection("users")
    .where("groupId", "==", id)
    .where("status", "==", "approved")
    .count()
    .get();
  const memberCount = countSnap.data().count ?? 0;

  return NextResponse.json({ pool, memberCount }, { status: 200 });
}
