import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { webauthnConfig } from "@/server/auth/webauthnConfig";
import {
  challengeCookieOptions,
  createChallengeCookieValue,
} from "@/server/auth/webauthnChallenge";

/**
 * POST /api/auth/webauthn/login/options (login biométrico, TASK-07).
 *
 * Gera as opções de AUTENTICAÇÃO WebAuthn e devolve um challenge cookie assinado
 * de uso único (jti). É público (não há sessão — é o próprio login). Fluxo
 * USERNAMELESS (M5): não restringe `allowCredentials`; o autenticador de
 * plataforma oferece os passkeys descobertos (residentKey) e o `/verify` resolve
 * `credentialId → uid`. `userVerification: "required"` força a biometria/PIN.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF (HR-02): exige Origin == origem confiável, mesmo sem sessão.
  if (request.headers.get("origin") !== webauthnConfig.origin) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const options = await generateAuthenticationOptions({
    rpID: webauthnConfig.rpID,
    userVerification: "required",
    // Usernameless: SEM allowCredentials (passkey descoberto resolve o usuário).
  });

  // Challenge assinado de uso único (jti embutido pelo helper). Sem binding de
  // uid: no login o usuário ainda é desconhecido (resolvido no /verify via M5).
  const cookieValue = await createChallengeCookieValue({
    challenge: options.challenge,
  });

  const response = NextResponse.json(options, { status: 200 });
  response.cookies.set({ ...challengeCookieOptions(), value: cookieValue });
  return response;
}
