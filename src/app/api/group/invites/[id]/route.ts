import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoga o convite: `isActive = false`. Valida `groupId` da sessão (isolamento). */
async function revoke(id: string): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  if (!id || id.length === 0) {
    return NextResponse.json({ error: "Convite inválido." }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection("invites").doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    }
    // Isolamento: só revoga convite do PRÓPRIO pool.
    if (snap.data()?.["groupId"] !== groupId) {
      return NextResponse.json({ error: "Convite não pertence ao seu grupo." }, { status: 403 });
    }
    await ref.update({ isActive: false });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[group/invites/[id]] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao revogar o convite." },
      { status: 500 },
    );
  }
}

/** PATCH /api/group/invites/[id] — revoga o convite (PRD-10, TASK-08). */
export async function PATCH(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return revoke(id);
}

/** DELETE /api/group/invites/[id] — revoga o convite (PRD-10, TASK-08). */
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return revoke(id);
}
