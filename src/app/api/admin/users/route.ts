import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { listUsersForAssignment } from "@/server/admin/adminUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users?filter=without-group|all — lista usuários para atribuição
 * de grupo pelo super_admin. `without-group` (default) traz os órfãos (sem
 * `groupId`, herança da transição PRD-09); `all` traz todos (com nome do grupo
 * atual) para realocação. Só super_admin/secret.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter");
  if (filter !== null && filter !== "without-group" && filter !== "all") {
    return NextResponse.json(
      { error: "Parâmetro 'filter' inválido." },
      { status: 422 },
    );
  }
  const withoutGroupOnly = filter !== "all";

  try {
    const users = await listUsersForAssignment({ withoutGroupOnly });
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("[admin/users] erro ao listar usuários:", error);
    return NextResponse.json(
      { error: "Erro ao listar os usuários." },
      { status: 500 },
    );
  }
}
