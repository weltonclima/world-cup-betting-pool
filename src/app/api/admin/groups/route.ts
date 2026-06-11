import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { listPoolsByStatus } from "@/server/admin/adminPools";
import { poolStatusSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/groups?status=pending|active|blocked — lista pools por status
 * para as telas PRD11-02/03/04 (PRD-11 TASK-04). Só super_admin/secret.
 *
 * Inclui contagem de participantes por pool (tela de Ativos exibe). Exclui
 * soft-deleted. `status` ausente/ inválido → 422.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const parsed = poolStatusSchema.safeParse(statusParam);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetro 'status' inválido." },
      { status: 422 },
    );
  }

  try {
    const pools = await listPoolsByStatus(parsed.data);
    return NextResponse.json({ pools }, { status: 200 });
  } catch (error) {
    console.error("[admin/groups] erro ao listar pools:", error);
    return NextResponse.json(
      { error: "Erro ao listar os grupos." },
      { status: 500 },
    );
  }
}
