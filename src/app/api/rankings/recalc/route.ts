import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import { recalcRankings } from "@/server/rankings/recalc";
import { notifyRankingUps } from "@/server/notifications";
import { copaDataErrorResponse } from "../../_lib/copaDataError";
import { safeSecretEqual } from "../../_lib/secret";

// firebase-admin + cookies() exigem Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/rankings/recalc — recálculo manual/cron de rankings e estatísticas.
 *
 * A agregação em si vive em `@/server/rankings/recalc` (`recalcRankings`), também
 * disparada on-read pelo guard de frescor (`ensureRankingsFresh`). Esta rota é só
 * a casca autenticada: header secret (cron) OU sessão admin.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Autorização: header secret (cron) OU sessão admin ──────────────────
  const cronSecret = process.env["RANKINGS_SECRET"];
  const headerSecret = request.headers.get("x-cron-secret");

  let authorized = safeSecretEqual(cronSecret, headerSecret);

  const db = getAdminFirestore();

  if (!authorized) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (userSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    authorized = true;
  }

  // ─── 2. Recálculo (fonte de dados pode lançar → 502/504) ───────────────────
  try {
    const summary = await recalcRankings(db);
    // TASK-05: disparo best-effort das notificações `ranking` (subida/pódio). Este
    // é o caminho automático (cron → /score → chainRecalc → este route). Nunca lança
    // (try/catch interno) — não expõe os deltas na resposta (payload limpo).
    await notifyRankingUps(db, summary.deltas, new Date());
    const { deltas: _deltas, ...rest } = summary;
    return NextResponse.json(rest, { status: 200 });
  } catch (err) {
    return copaDataErrorResponse(err);
  }
}
