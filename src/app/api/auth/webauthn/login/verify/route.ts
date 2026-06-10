import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";

import { getAdminAuth } from "@/server/firebaseAdmin";
import {
  getCredentialById,
  publicKeyFromStorage,
  updateCredentialCounter,
} from "@/server/auth/webauthnCredentialStore";
import { getApprovedUserRole } from "@/server/auth/approvedUserLookup";
import { consumeJti } from "@/server/auth/webauthnChallengeJtiStore";
import { webauthnConfig } from "@/server/auth/webauthnConfig";
import {
  challengeCookieOptions,
  readChallenge,
  CHALLENGE_COOKIE_NAME,
} from "@/server/auth/webauthnChallenge";

/**
 * POST /api/auth/webauthn/login/verify (login biométrico, TASK-07).
 *
 * Ponto mais sensível da feature: verifica a assertion WebAuthn e, só após TODAS
 * as checagens, emite um Firebase custom token. Sem sessão prévia (é o login).
 * Camadas, em ordem inegociável:
 *  1. CSRF: Origin confiável;
 *  2. challenge assinado + `jti` de USO ÚNICO (HR-01) — replay rejeitado server-side;
 *  3. resolve `credentialId → uid` (M5, usernameless);
 *  4. verificação criptográfica (origin/rpID da config, UV obrigatória);
 *  5. counter anti-clonagem (M4): regressão → rejeita;
 *  6. autorização: `status === "approved"` (bloqueia pending/blocked);
 *  7. custom token com claim `role` (M1) — só aqui.
 * O challenge cookie é limpo em QUALQUER desfecho (uso único redundante).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Folga de vida do registro de `jti` (≥ TTL do challenge) para a TTL policy. */
const JTI_TTL_MS = 5 * 60 * 1000;

const bodySchema = z.object({
  // AuthenticationResponseJSON: a validação criptográfica é da lib; aqui só
  // garantimos que `response` é um objeto presente com `id` string.
  response: z.object({ id: z.string().min(1) }).passthrough(),
});

/** Limpa o challenge cookie (uso único) na resposta. */
function clearChallenge(response: NextResponse): NextResponse {
  response.cookies.set({ ...challengeCookieOptions(0), value: "" });
  return response;
}

/** Resposta de falha genérica (anti-enumeração) já com o cookie limpo. */
function fail(message: string, status: number): NextResponse {
  return clearChallenge(NextResponse.json({ error: message }, { status }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. CSRF (HR-02): Origin == origem confiável (sem sessão para ancorar) +
  //    Sec-Fetch-Site=same-origin como defesa em profundidade (quando enviado;
  //    UAs antigos omitem → não barramos por ausência). É o único portão de rede
  //    antes da emissão do token.
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    origin !== webauthnConfig.origin ||
    (fetchSite !== null && fetchSite !== "same-origin")
  ) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  // 2. Challenge cookie: presença + assinatura/expiração + jti.
  const cookieStore = await cookies();
  const token = cookieStore.get(CHALLENGE_COOKIE_NAME)?.value;
  const challengePayload = await readChallenge(token);
  if (!challengePayload || typeof challengePayload.jti !== "string") {
    return fail("Sessão de login inválida ou expirada.", 400);
  }

  // 3. Body (shape). Parseado ANTES de consumir o jti: corpo malformado não é
  //    superfície de replay (a verificação cripto, que é, vem após o consumo) —
  //    não queimar o challenge single-use por um body inválido.
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Corpo inválido.", 422);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Dados de login inválidos.", 422);
  }
  const assertion = parsed.data.response as unknown as AuthenticationResponseJSON;

  // 4. Single-use (HR-01): consome o `jti` ANTES da verificação cripto. Replay →
  //    rejeita; a 2ª tentativa com o mesmo jti falha aqui.
  const expiresAt = new Date(Date.now() + JTI_TTL_MS).toISOString();
  let firstUse: boolean;
  try {
    firstUse = await consumeJti(challengePayload.jti, expiresAt);
  } catch {
    return fail("Não foi possível autenticar.", 500);
  }
  if (!firstUse) {
    return fail("Sessão de login inválida ou expirada.", 400);
  }

  // 5. Resolve a credencial (M5): credentialId → uid. Inexistente → MESMA
  //    resposta da assertion inválida (401, anti-enumeração §6.8): um probe com
  //    credentialId aleatório é indistinguível de id real + assinatura ruim.
  //    `uid` NUNCA vem do body.
  const cred = await getCredentialById(assertion.id);
  if (!cred) {
    return fail("Não foi possível autenticar.", 401);
  }

  // Cópia ArrayBuffer-backed: a lib exige `Uint8Array<ArrayBuffer>`, mas o decode
  // do store devolve `ArrayBufferLike` — copiamos para um buffer concreto.
  const storedKey = publicKeyFromStorage(cred.publicKey);
  const publicKey = new Uint8Array(storedKey.length);
  publicKey.set(storedKey);

  // 4. Verificação criptográfica (origin/rpID da config, UV obrigatória).
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengePayload.challenge,
      expectedOrigin: webauthnConfig.origin,
      expectedRPID: webauthnConfig.rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey,
        counter: cred.counter,
        transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
      },
    });
  } catch {
    return fail("Não foi possível autenticar.", 401);
  }

  if (!verification.verified) {
    return fail("Não foi possível autenticar.", 401);
  }

  // 7. Counter anti-clonagem (M4 — política: REJEITAR regressão). `credentialBackedUp`
  //    distingue os dois regimes:
  //    - single-device (não sincronizado): counter DEVE crescer estritamente
  //      (`next > stored`); reuso de um counter antigo = clone → rejeita;
  //    - passkey sincronizado (multi-device): pode reportar counter 0 estático →
  //      tolera igualdade, rejeita só regressão real (`next < stored`).
  const stored = cred.counter;
  const next = verification.authenticationInfo.newCounter;
  const backedUp = verification.authenticationInfo.credentialBackedUp === true;
  const counterRegressed = backedUp ? next < stored : next <= stored;
  if (counterRegressed) {
    return fail("Não foi possível autenticar.", 401);
  }

  // 6. Autorização: bloqueia não-`approved` mesmo com assertion válida.
  const authz = await getApprovedUserRole(cred.uid);
  if (!authz || !authz.approved) {
    return fail("Acesso não autorizado.", 403);
  }

  // 7. Persiste counter + lastUsedAt e emite o custom token com o claim `role`
  //    (M1) — só após assertion + counter + approved.
  try {
    await updateCredentialCounter(cred.credentialId, next, new Date().toISOString());
  } catch {
    return fail("Não foi possível autenticar.", 500);
  }

  let customToken: string;
  try {
    customToken = await getAdminAuth().createCustomToken(cred.uid, {
      role: authz.role,
    });
  } catch {
    return fail("Não foi possível autenticar.", 500);
  }

  return clearChallenge(
    NextResponse.json({ verified: true, customToken }, { status: 200 }),
  );
}
