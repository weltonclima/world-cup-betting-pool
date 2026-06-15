import "server-only";

import { NextResponse } from "next/server";

/**
 * POST /api/admin/worldcup/sync — DESCONTINUADO (PRD-13).
 *
 * A pipeline de dados de partidas foi invertida: ESPN passou a ser a fonte
 * primária servida em tempo real por `getEffectiveMatches()` (openfootball como
 * fallback, overrides manuais por cima). O sync openfootball → Firestore não tem
 * mais função e foi removido para não enganar o admin sobre o estado do sistema.
 *
 * Edições manuais de partida continuam em `PUT /api/admin/matches/[id]`.
 *
 * Responde 410 Gone direto, sem auth nem I/O (o endpoint não existe mais
 * semanticamente).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GONE_MESSAGE =
  "Endpoint descontinuado. Dados de partidas agora são servidos em tempo real via ESPN (PRD-13). Use /api/admin/matches/[id] para edições manuais.";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: GONE_MESSAGE }, { status: 410 });
}
