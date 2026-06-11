import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { getDashboardStats } from "@/server/admin/dashboardStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard — KPIs globais da plataforma (PRD-11 TASK-04).
 *
 * Só super_admin/secret (`authorizeGroupAdmin`). Agrega counts de pools por
 * status, usuários, administradores, palpites, jogos do calendário e a última
 * sincronização. Counts via `count()` aggregation (R3 — Spark).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("[admin/dashboard] erro ao agregar KPIs:", error);
    return NextResponse.json(
      { error: "Erro ao carregar o dashboard." },
      { status: 500 },
    );
  }
}
