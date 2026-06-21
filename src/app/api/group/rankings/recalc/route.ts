import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { recalcPoolRanking } from "@/server/rankings/recalc";
import { notifyRankingUps } from "@/server/notifications";
import { copaDataErrorResponse } from "../../../_lib/copaDataError";

// firebase-admin + leitura de partidas efetivas → Node runtime, sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/group/rankings/recalc — reprocessa o ranking do PRÓPRIO pool.
 *
 * Gatilho do botão "Reprocessar ranking" na Tela 01 (group_admin). Recomputa só o
 * doc `rankings/pool-{groupId}-geral` via `recalcPoolRanking`, sem o custo do recalc
 * global. O `groupId` vem da SESSÃO (`authorizeGroupAdminOfPool`), NUNCA do request —
 * isolamento multi-tenant (D2). Autorizado a group_admin/super_admin; demais → 403.
 */
export async function POST(): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  const db = getAdminFirestore();
  try {
    const summary = await recalcPoolRanking(db, groupId);
    // TASK-05: disparo best-effort das notificações `ranking` do PRÓPRIO pool
    // (delta relativo ao pool). Nunca lança; deltas fora do payload de resposta.
    await notifyRankingUps(db, summary.deltas, new Date());
    const { deltas: _deltas, ...rest } = summary;
    return NextResponse.json(rest, { status: 200 });
  } catch (err) {
    // Falha de fonte de dados (partidas efetivas) → 502/504; demais → genérico.
    return copaDataErrorResponse(err);
  }
}
