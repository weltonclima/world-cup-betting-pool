import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAdminAuth } from "@/server/firebaseAdmin";

/**
 * Route Handler de sessão (TASK-09) — troca o ID token do client por um session
 * cookie httpOnly verificável no servidor/edge.
 *
 * Roda em Node (não edge): o `firebase-admin` exige runtime Node. Em App Hosting
 * isso roda no Cloud Run com a service account do projeto.
 *
 * POST  /api/auth/session  → { idToken } → valida + cria session cookie `__session`.
 * DELETE /api/auth/session → limpa o cookie (logout).
 */

// Node runtime explícito: firebase-admin não roda no edge.
export const runtime = "nodejs";
// Nunca cachear respostas de auth.
export const dynamic = "force-dynamic";

/**
 * Nome do cookie de sessão. `__session` é o ÚNICO cookie repassado pelo CDN do
 * Firebase Hosting / App Hosting ao backend — por isso o nome é fixo.
 */
export const SESSION_COOKIE_NAME = "__session";

/** Validade do session cookie: 5 dias (em ms para o Admin SDK, em s para o cookie). */
const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_S = SESSION_EXPIRES_IN_MS / 1000;

const postBodySchema = z.object({
  idToken: z.string().min(1, "idToken é obrigatório"),
});

/** Atributos de segurança do cookie. `secure` só fora de dev (HTTP local). */
function cookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * POST: recebe `{ idToken }`, valida o token, cria o session cookie e o seta na
 * resposta. Token inválido/expirado → 401. Body malformado → 400.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)." },
      { status: 400 },
    );
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "idToken ausente ou inválido." },
      { status: 400 },
    );
  }

  const { idToken } = parsed.data;
  const auth = getAdminAuth();

  try {
    // Valida o ID token (assinatura + expiração + revogação opcional).
    await auth.verifyIdToken(idToken);

    // Troca o ID token por um session cookie de longa duração.
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ status: "success" }, { status: 200 });
    response.cookies.set({
      ...cookieOptions(SESSION_MAX_AGE_S),
      value: sessionCookie,
    });
    return response;
  } catch {
    // Token inválido/expirado/revogado → não autorizado. Mensagem genérica.
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    );
  }
}

/**
 * DELETE: logout — limpa o cookie de sessão (maxAge 0 → expira imediatamente).
 * Idempotente: sempre 200, mesmo sem cookie presente.
 */
export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ status: "success" }, { status: 200 });
  response.cookies.set({
    ...cookieOptions(0),
    value: "",
  });
  return response;
}
