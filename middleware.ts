import { NextResponse, type NextRequest } from "next/server";

import { fetchGoogleCerts } from "@/server/auth/googleCerts";
import { verifySession } from "@/server/auth/verifySession";

/**
 * Middleware de proteção de `/admin/*` (TASK-10) — PRIMEIRO portão server-side.
 *
 * Lê o session cookie `__session` (TASK-09), verifica assinatura + claims com
 * `jose` (firebase-admin NÃO roda no edge) e decide pelo claim `role`:
 *  - cookie ausente/inválido/expirado/forjado → redirect `/login`;
 *  - cookie válido mas `role !== "admin"`     → redirect `/home`;
 *  - cookie válido e admin                     → segue (`NextResponse.next()`).
 *
 * Defense-in-depth (este middleware é só a 1ª camada): o enforcement REAL
 * continua em:
 *  - API Routes (Admin SDK `verifyIdToken`/`verifySessionCookie` em runtime Node);
 *  - Firestore Security Rules (autorização no banco);
 *  - `AdminGuard` client (`src/components/layout/AdminGuard.tsx`), que esconde o
 *    painel no browser.
 * O middleware no edge faz verificação criptográfica completa do cookie, mas o
 * `role` pode estar até ~1h defasado (claim no cookie é congelado na emissão);
 * por isso a autorização sensível NÃO depende só dele.
 *
 * Nome do cookie alinhado a `SESSION_COOKIE_NAME` em
 * `src/app/api/auth/session/route.ts` (`__session` é o único cookie repassado
 * pelo CDN do Firebase App Hosting ao backend).
 */

const SESSION_COOKIE_NAME = "__session";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const result = await verifySession(token, {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    fetchCerts: fetchGoogleCerts,
  });

  // Cookie ausente/inválido/expirado/forjado → manda autenticar.
  if (!result.valid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Autenticado mas sem privilégio de admin → área comum.
  if (result.role !== "admin") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Cookie válido e admin → segue.
  return NextResponse.next();
}

/** Aplica o middleware apenas às rotas administrativas. */
export const config = {
  matcher: ["/admin/:path*"],
};
