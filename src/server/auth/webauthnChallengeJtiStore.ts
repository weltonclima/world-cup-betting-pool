import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";

/**
 * Store de `jti` consumidos do challenge WebAuthn (HR-01, TASK-07).
 *
 * O challenge é um JWT jose stateless — replayável dentro do TTL (5min) por quem
 * capturar o cookie. Para torná-lo SINGLE-USE de fato, cada challenge carrega um
 * `jti` único; na verificação (registro E login) o `jti` é "consumido" aqui via
 * `create()` atômico. A segunda tentativa com o mesmo `jti` colide
 * (ALREADY_EXISTS) e é rejeitada → replay bloqueado server-side.
 *
 * `expiresAt` alimenta uma TTL policy do Firestore para limpeza automática
 * (TTL ≥ TTL do challenge). Acesso EXCLUSIVO do Admin SDK (Rules negam o client).
 * Compartilhado por registro e login.
 */

const COLLECTION = "webauthn_challenge_jti";

/** Código gRPC do Firestore para violação de unicidade no `create()`. */
const ALREADY_EXISTS = 6;

/**
 * Consome um `jti` (uso único). Retorna `true` no primeiro consumo, `false` se o
 * `jti` já foi usado (replay). Outros erros do Firestore propagam (não mascarados
 * como replay — falha de infra ≠ replay).
 */
export async function consumeJti(
  jti: string,
  expiresAt: string,
): Promise<boolean> {
  const db = getAdminFirestore();
  try {
    await db.collection(COLLECTION).doc(jti).create({ expiresAt });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) {
      return false;
    }
    throw err;
  }
}
