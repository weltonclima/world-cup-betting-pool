import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { listAdminMatches, type AdminMatchesFilters } from "@/server/admin/adminMatches";
import { matchStatusSchema, stageSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/matches?group=&stage=&status= — lista filtrada de partidas
 * (PRD11-07, TASK-11). READ-ONLY: lê do openfootball ao vivo (a coleção `matches`
 * persistida e a edição manual são DEFERIDAS neste slice). Só super_admin/secret.
 *
 * 3 filtros server-side (B4): group/stage/status. Parâmetros inválidos → 422.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(request.url);
  const groupParam = url.searchParams.get("group");
  const stageParam = url.searchParams.get("stage");
  const statusParam = url.searchParams.get("status");

  const filters: AdminMatchesFilters = {};
  if (groupParam) filters.groupId = groupParam;
  if (stageParam) {
    const parsed = stageSchema.safeParse(stageParam);
    if (!parsed.success) {
      return NextResponse.json({ error: "Filtro 'stage' inválido." }, { status: 422 });
    }
    filters.stage = parsed.data;
  }
  if (statusParam) {
    const parsed = matchStatusSchema.safeParse(statusParam);
    if (!parsed.success) {
      return NextResponse.json({ error: "Filtro 'status' inválido." }, { status: 422 });
    }
    filters.status = parsed.data;
  }

  try {
    const matches = await listAdminMatches(filters);
    return NextResponse.json({ matches }, { status: 200 });
  } catch (error) {
    return copaDataErrorResponse(error);
  }
}
