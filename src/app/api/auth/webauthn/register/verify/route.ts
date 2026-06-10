import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import {
  CredentialAlreadyExistsError,
  publicKeyToStorage,
  saveCredential,
} from "@/server/auth/webauthnCredentialStore";
import { webauthnConfig } from "@/server/auth/webauthnConfig";
import { consumeJti } from "@/server/auth/webauthnChallengeJtiStore";
import {
  challengeCookieOptions,
  readChallenge,
  CHALLENGE_COOKIE_NAME,
} from "@/server/auth/webauthnChallenge";

/**
 * POST /api/auth/webauthn/register/verify (login biométrico, TASK-05).
 *
 * Verifica a attestation do passkey e grava a credencial via Admin SDK. Núcleo
 * de segurança:
 *  - exige sessão válida + `approved`;
 *  - challenge assinado de USO ÚNICO (cookie limpo em qualquer desfecho), com
 *    binding `challenge.uid === uid` da sessão;
 *  - `expectedOrigin`/`expectedRPID` vêm da config (nunca do request);
 *  - `requireUserVerification: true` (biometria/PIN do device);
 *  - persiste SOMENTE se `verified`; `uid` SEMPRE da sessão (nunca do body).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Folga de vida do registro de `jti` (≥ TTL do challenge) para a TTL policy. */
const JTI_TTL_MS = 5 * 60 * 1000;

const bodySchema = z.object({
  // RegistrationResponseJSON: a validação criptográfica é da lib; aqui só
  // garantimos que `response` é um objeto presente.
  response: z.record(z.string(), z.unknown()),
  deviceLabel: z.string().optional(),
});

/** Sanitiza o rótulo do dispositivo (trim, limite, fallback). */
function sanitizeLabel(label: string | undefined): string {
  const trimmed = (label ?? "").trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : "Dispositivo";
}

/** Limpa o challenge cookie (uso único) na resposta. */
function clearChallenge(response: NextResponse): NextResponse {
  response.cookies.set({ ...challengeCookieOptions(0), value: "" });
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF (HR-02): além do session cookie, exige Origin == origem confiável.
  // SameSite=Lax não é garantia suficiente para POST cross-site.
  if (request.headers.get("origin") !== webauthnConfig.origin) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { uid } = auth.user;

  // Challenge cookie: presença + assinatura/expiração + binding de uid.
  const cookieStore = await cookies();
  const token = cookieStore.get(CHALLENGE_COOKIE_NAME)?.value;
  const challengePayload = await readChallenge(token);
  if (!challengePayload) {
    return clearChallenge(
      NextResponse.json(
        { error: "Sessão de registro inválida ou expirada." },
        { status: 400 },
      ),
    );
  }
  if (challengePayload.uid !== uid) {
    return clearChallenge(
      NextResponse.json(
        { error: "Sessão de registro inválida." },
        { status: 400 },
      ),
    );
  }

  // Single-use (HR-01): challenge precisa de jti. Helper COMPARTILHADO com o login.
  if (typeof challengePayload.jti !== "string") {
    return clearChallenge(
      NextResponse.json(
        { error: "Sessão de registro inválida ou expirada." },
        { status: 400 },
      ),
    );
  }

  // Body. Parseado ANTES de consumir o jti: corpo malformado não é superfície de
  // replay (a verificação cripto, que é, vem após o consumo) — não queimar o
  // challenge single-use por um body inválido.
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return clearChallenge(
      NextResponse.json({ error: "Corpo inválido." }, { status: 422 }),
    );
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return clearChallenge(
      NextResponse.json(
        { error: "Dados de registro inválidos." },
        { status: 422 },
      ),
    );
  }

  // Consome o `jti` ANTES da verificação cripto. Replay → rejeita antes de
  // verificar/gravar.
  const expiresAt = new Date(Date.now() + JTI_TTL_MS).toISOString();
  let firstUse: boolean;
  try {
    firstUse = await consumeJti(challengePayload.jti, expiresAt);
  } catch {
    return clearChallenge(
      NextResponse.json({ error: "Erro ao registrar a biometria." }, { status: 500 }),
    );
  }
  if (!firstUse) {
    return clearChallenge(
      NextResponse.json(
        { error: "Sessão de registro inválida ou expirada." },
        { status: 400 },
      ),
    );
  }

  // Verificação criptográfica da attestation (origin/rpID da config).
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as unknown as RegistrationResponseJSON,
      expectedChallenge: challengePayload.challenge,
      expectedOrigin: webauthnConfig.origin,
      expectedRPID: webauthnConfig.rpID,
      requireUserVerification: true,
    });
  } catch {
    return clearChallenge(
      NextResponse.json(
        { error: "Não foi possível registrar a biometria." },
        { status: 422 },
      ),
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return clearChallenge(
      NextResponse.json(
        { error: "Não foi possível registrar a biometria." },
        { status: 422 },
      ),
    );
  }

  const { credential } = verification.registrationInfo;
  const deviceLabel = sanitizeLabel(parsed.data.deviceLabel);
  const createdAt = new Date().toISOString();

  // Sanitiza transports (vindos do device) antes da validação `.strict()`:
  // descarta entradas vazias/não-string para não 500 num registro legítimo (MR-01).
  const transports = (credential.transports ?? []).filter(
    (t) => typeof t === "string" && t.trim().length > 0,
  );

  try {
    await saveCredential({
      credentialId: credential.id,
      uid, // SEMPRE da sessão.
      publicKey: publicKeyToStorage(credential.publicKey),
      counter: credential.counter,
      ...(transports.length ? { transports } : {}),
      deviceLabel,
      createdAt,
    });
  } catch (err) {
    // Colisão de credentialId (CR-01): credencial já registrada → 409, não 500.
    if (err instanceof CredentialAlreadyExistsError) {
      return clearChallenge(
        NextResponse.json(
          { error: "Esta credencial já está registrada." },
          { status: 409 },
        ),
      );
    }
    return clearChallenge(
      NextResponse.json(
        { error: "Erro ao salvar a credencial." },
        { status: 500 },
      ),
    );
  }

  return clearChallenge(
    NextResponse.json(
      {
        verified: true,
        credential: { credentialId: credential.id, deviceLabel, createdAt },
      },
      { status: 201 },
    ),
  );
}
