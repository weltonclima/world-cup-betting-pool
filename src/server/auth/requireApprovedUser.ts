import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

/**
 * Guarda de sessão + autorização para Route Handlers (login biométrico, TASK-05).
 *
 * Encapsula as duas primeiras camadas server-side da defesa-em-profundidade:
 *  1. session cookie httpOnly verificado via Admin SDK (`verifySessionCookie`);
 *  2. `users/{uid}.status === "approved"` no Firestore.
 *
 * Retorna o usuário aprovado (`uid` + dados de perfil para os campos WebAuthn)
 * ou um `NextResponse` de erro pronto (401/403). `uid` SEMPRE vem da sessão,
 * nunca do request.
 */

export interface ApprovedUser {
  uid: string;
  email: string | null;
  nickname: string | null;
}

export type RequireApprovedResult =
  | { user: ApprovedUser }
  | { errorResponse: NextResponse };

function unauthorized(): { errorResponse: NextResponse } {
  return {
    errorResponse: NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 },
    ),
  };
}

export async function requireApprovedUser(): Promise<RequireApprovedResult> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return unauthorized();

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      false,
    );
    uid = decoded.uid;
  } catch {
    return unauthorized();
  }

  const db = getAdminFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return unauthorized();

  const data = snap.data();
  if (data?.status !== "approved") {
    return {
      errorResponse: NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 403 },
      ),
    };
  }

  return {
    user: {
      uid,
      email: typeof data.email === "string" ? data.email : null,
      nickname: typeof data.nickname === "string" ? data.nickname : null,
    },
  };
}
