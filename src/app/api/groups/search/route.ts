import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Teto defensivo de resultados ativos (Spark — conjunto pequeno na prática).
const MAX_RESULTS = 50;

/**
 * GET /api/groups/search?q= — lista pools `active` (TASK-04).
 *
 * Retorna SOMENTE pools com `status == "active"` — `pending`/`blocked` nunca
 * vazam para a busca (espelha a intenção da rule TASK-03). `q` (MVP A6) filtra
 * in-memory por slug exato OU `name` contém (case-insensitive). Doc fora do
 * schema é descartado (log), sem derrubar a resposta.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const db = getAdminFirestore();
  const snap = await db.collection("pools").where("status", "==", "active").get();

  const pools = [];
  for (const doc of snap.docs) {
    const parsed = poolSchema.safeParse(doc.data());
    if (parsed.success) pools.push(parsed.data);
    else console.error("Pool corrompido ignorado na busca:", doc.id);
  }

  // `q` normalizado p/ minúsculas (slugs já são minúsculos; name comparado lower).
  // Filtro aplicado sobre TODO o conjunto ativo ANTES do teto — senão um match
  // poderia cair fora do cap pré-filtro (gsd H-01/M-03).
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  const filtered = (
    q ? pools.filter((p) => p.slug === q || p.name.toLowerCase().includes(q)) : pools
  ).slice(0, MAX_RESULTS);

  return NextResponse.json({ pools: filtered }, { status: 200 });
}
