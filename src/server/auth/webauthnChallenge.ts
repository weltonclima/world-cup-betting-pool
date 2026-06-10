import "server-only";

import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Challenge cookie assinado do WebAuthn (login biométrico, TASK-04).
 *
 * O challenge NÃO pode ser definido pelo cliente: o servidor o gera, assina
 * (jose HS256) e o devolve num cookie httpOnly de curta duração. Na verificação
 * (TASK-05/07) o cookie é lido, a assinatura/expiração conferidas e o cookie
 * limpo (uso único). Token forjado/alterado/expirado é rejeitado.
 *
 * Server-only: o segredo nunca vai ao bundle do browser.
 */

const isProduction = process.env.NODE_ENV === "production";

/** Nome do cookie do challenge (Vercel repassa todos os cookies ao backend). */
export const CHALLENGE_COOKIE_NAME = "webauthn_challenge";

/** Validade do challenge: curta (anti-replay). */
const CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * Segredo de assinatura do challenge. Obrigatório em produção (falha cedo se
 * ausente). Em dev/test usa um fallback inseguro explícito para não travar o DX.
 */
function getChallengeSecret(): Uint8Array {
  const secret = process.env.WEBAUTHN_CHALLENGE_SECRET;
  if (!secret || secret.length === 0) {
    if (isProduction) {
      throw new Error(
        "WEBAUTHN_CHALLENGE_SECRET ausente em produção (obrigatório para assinar o challenge).",
      );
    }
    return new TextEncoder().encode("dev-only-insecure-webauthn-challenge-secret");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Payload do challenge: o challenge em si + auxiliares (ex.: `uid` no registro).
 * `readChallenge` garante apenas que `challenge` é string não-vazia; os Route
 * Handlers (TASK-05/07) DEVEM validar campos auxiliares (`uid` etc.) antes de
 * confiar neles — não assumir presença/tipo.
 */
export interface ChallengePayload {
  challenge: string;
  /**
   * Identificador único do challenge (HR-01). Embutido automaticamente por
   * `createChallengeCookieValue` e consumido como uso único na verificação
   * (registro/login) via `webauthnChallengeJtiStore`. Stateless por si só não
   * impede replay dentro do TTL; o `jti` + store server-side impede.
   */
  jti?: string;
  [key: string]: unknown;
}

/**
 * Cria o valor assinado do cookie de challenge (JWT HS256, exp curto). Embute um
 * `jti` único (single-use, HR-01) — a verificação consome o `jti` e rejeita
 * replays. Um `jti` explícito no payload é sobrescrito pelo gerado aqui.
 */
export async function createChallengeCookieValue(
  payload: ChallengePayload,
): Promise<string> {
  return new SignJWT({ ...payload, jti: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(getChallengeSecret());
}

/**
 * Lê e valida o cookie de challenge. Retorna o payload (com `challenge`
 * string) ou `null` para token ausente/forjado/alterado/expirado. Nunca lança.
 */
export async function readChallenge(
  token: string | undefined | null,
): Promise<ChallengePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getChallengeSecret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.challenge !== "string" || payload.challenge.length === 0) {
      return null;
    }
    return payload as ChallengePayload;
  } catch {
    return null;
  }
}

/** Atributos do cookie do challenge (httpOnly, `secure` fora de dev, curto). */
export function challengeCookieOptions(maxAge: number = CHALLENGE_TTL_SECONDS) {
  return {
    name: CHALLENGE_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
