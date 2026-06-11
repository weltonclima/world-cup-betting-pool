import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { listGroupAdmins } from "@/server/admin/adminAdmins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/admins — administradores de grupo (PRD11-05, TASK-05).
 * Nome, grupo e "desde". Só super_admin/secret.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const admins = await listGroupAdmins();
    return NextResponse.json({ admins }, { status: 200 });
  } catch (error) {
    console.error("[admin/admins] erro ao listar administradores:", error);
    return NextResponse.json(
      { error: "Erro ao listar os administradores." },
      { status: 500 },
    );
  }
}
