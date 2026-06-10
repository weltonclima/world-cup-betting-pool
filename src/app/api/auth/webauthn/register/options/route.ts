import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { listCredentialsByUid } from "@/server/auth/webauthnCredentialStore";
import {
  webauthnAuthenticatorSelection,
  webauthnConfig,
  webauthnSupportedAlgorithmIDs,
} from "@/server/auth/webauthnConfig";
import {
  challengeCookieOptions,
  createChallengeCookieValue,
} from "@/server/auth/webauthnChallenge";

/**
 * POST /api/auth/webauthn/register/options (login biométrico, TASK-05).
 *
 * Gera as opções de REGISTRO de passkey para o usuário autenticado e aprovado e
 * devolve um challenge cookie assinado (uso único, verificado no /verify). Exige
 * sessão válida + `approved` (TASK-05). `excludeCredentials` evita registrar o
 * mesmo autenticador duas vezes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF (HR-02): exige Origin == origem confiável.
  if (request.headers.get("origin") !== webauthnConfig.origin) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { uid, email, nickname } = auth.user;

  let existing;
  try {
    existing = await listCredentialsByUid(uid);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível iniciar o registro." },
      { status: 500 },
    );
  }

  const options = await generateRegistrationOptions({
    rpName: webauthnConfig.rpName,
    rpID: webauthnConfig.rpID,
    userName: email ?? uid,
    userDisplayName: nickname ?? email ?? uid,
    // userID estável = uid Firebase → consistência entre credenciais do usuário.
    userID: new TextEncoder().encode(uid),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: webauthnAuthenticatorSelection,
    supportedAlgorithmIDs: webauthnSupportedAlgorithmIDs,
  });

  // Challenge assinado com binding de uid (verificado no /verify).
  const cookieValue = await createChallengeCookieValue({
    challenge: options.challenge,
    uid,
  });

  const response = NextResponse.json(options, { status: 200 });
  response.cookies.set({ ...challengeCookieOptions(), value: cookieValue });
  return response;
}
