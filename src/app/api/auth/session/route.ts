import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";
import {
  POOL_THEME_COOKIE,
  serializePoolThemeCookie,
} from "@/features/groupAdmin/lib/poolTheme";

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

// SESSION_COOKIE_NAME: importado internamente apenas; não pode ser re-exportado
// em um Route Handler (Next.js rejeita exports que não sejam verbos HTTP ou
// config válidas). Consumidores devem importar direto de
// @/server/auth/sessionCookie.

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
 * Cor de marca do pool do usuário → valor do cookie `pool-primary` (não-httpOnly,
 * lido no root layout p/ SSR sem flash — TASK-03). Best-effort: qualquer falha
 * retorna null (login não pode quebrar por causa da cor). 2 reads (users → pools).
 */
async function resolvePoolThemeCookieValue(uid: string): Promise<string | null> {
  try {
    const db = getAdminFirestore();
    const userSnap = await db.collection("users").doc(uid).get();
    const groupId = userSnap.data()?.["groupId"];
    if (typeof groupId !== "string" || groupId === "") return null;
    const poolSnap = await db.collection("pools").doc(groupId).get();
    const data = poolSnap.data();
    const light = data?.["primaryColorLight"];
    const dark = data?.["primaryColorDark"];
    return serializePoolThemeCookie(
      typeof light === "string" ? light : undefined,
      typeof dark === "string" ? dark : undefined,
    );
  } catch (err) {
    console.warn("[auth/session] falha ao resolver cor do pool (ignorada):", err);
    return null;
  }
}

/** Opções do cookie de cor (NÃO-httpOnly: precisa ser legível no server layout). */
function poolThemeCookieOptions(maxAge: number, value: string) {
  return {
    name: POOL_THEME_COOKIE,
    value,
    httpOnly: false,
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
    const decoded = await auth.verifyIdToken(idToken);

    // Troca o ID token por um session cookie de longa duração.
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ status: "success" }, { status: 200 });
    response.cookies.set({
      ...cookieOptions(SESSION_MAX_AGE_S),
      value: sessionCookie,
    });

    // Cookie de cor do pool p/ SSR sem flash (TASK-03). Best-effort — não bloqueia
    // o login. Ausente → não seta (fallback verde no layout).
    const themeValue = await resolvePoolThemeCookieValue(decoded.uid);
    if (themeValue !== null) {
      response.cookies.set(poolThemeCookieOptions(SESSION_MAX_AGE_S, themeValue));
    }
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
  // Limpa também o cookie de cor do pool (TASK-03).
  response.cookies.set(poolThemeCookieOptions(0, ""));
  return response;
}
