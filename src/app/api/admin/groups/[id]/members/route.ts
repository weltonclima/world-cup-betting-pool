import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/groups/[id]/members — membros approved de um pool (PRD-11
 * TASK-05). Alimenta o seletor de novo admin em "Alterar Admin"/"Substituir"/
 * "Transferir Grupo". Só super_admin/secret. Retorna uid + nome + avatar.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await ctx.params;
  const db = getAdminFirestore();

  try {
    const snap = await db
      .collection("users")
      .where("groupId", "==", id)
      .where("status", "==", "approved")
      .get();

    const members = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        name:
          typeof data["name"] === "string" && data["name"].length > 0
            ? (data["name"] as string)
            : "Membro",
        avatarUrl: typeof data["avatarUrl"] === "string" ? (data["avatarUrl"] as string) : null,
      };
    });

    members.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return NextResponse.json({ members }, { status: 200 });
  } catch (error) {
    console.error("[admin/groups/members] erro ao listar membros:", error);
    return NextResponse.json(
      { error: "Erro ao listar os membros do grupo." },
      { status: 500 },
    );
  }
}
