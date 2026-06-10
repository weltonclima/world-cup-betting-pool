import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { webauthnCredentialSchema, type WebauthnCredential } from "@/schemas";

/**
 * Store das credenciais de passkey (login biométrico, TASK-05).
 *
 * Acesso server-only via Admin SDK (bypassa as Security Rules por design — write
 * client é negado, TASK-03). Toda gravação é validada contra
 * `webauthnCredentialSchema`. Doc id = `credentialId`. Compartilhado com o login
 * (TASK-07).
 */

const COLLECTION = "webauthn_credentials";

/** Código gRPC do Firestore para violação de unicidade no `create()`. */
const ALREADY_EXISTS = 6;

/**
 * Credencial já registrada (colisão de `credentialId`). O `credentialId` é
 * escolhido pelo autenticador; `create()` (não `set()`) impede que um registro
 * sobrescreva a credencial de OUTRO usuário (takeover) — write é exclusivo deste
 * store (Rules negam client), então a unicidade precisa ser garantida aqui.
 */
export class CredentialAlreadyExistsError extends Error {
  constructor() {
    super("Credencial já registrada.");
    this.name = "CredentialAlreadyExistsError";
  }
}

/** Converte a chave pública (Uint8Array da lib) para base64url (formato do schema). */
export function publicKeyToStorage(publicKey: Uint8Array): string {
  return Buffer.from(publicKey).toString("base64url");
}

/** Converte a chave pública armazenada (base64url) de volta para Uint8Array (lib). */
export function publicKeyFromStorage(stored: string): Uint8Array {
  return new Uint8Array(Buffer.from(stored, "base64url"));
}

/**
 * Cria a credencial (registro). Valida o schema antes — lança se inválida.
 * Usa `create()` (não `set()`): se o `credentialId` já existir (de qualquer
 * usuário), lança `CredentialAlreadyExistsError` — bloqueia overwrite cross-user
 * (CR-01). Registro nunca reusa um id.
 */
export async function saveCredential(cred: WebauthnCredential): Promise<void> {
  const parsed = webauthnCredentialSchema.parse(cred);
  const db = getAdminFirestore();
  try {
    await db.collection(COLLECTION).doc(parsed.credentialId).create(parsed);
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) {
      throw new CredentialAlreadyExistsError();
    }
    throw err;
  }
}

/** Busca a credencial por id (login usernameless resolve credentialId → uid). */
export async function getCredentialById(
  credentialId: string,
): Promise<WebauthnCredential | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).doc(credentialId).get();
  if (!snap.exists) return null;
  const result = webauthnCredentialSchema.safeParse(snap.data());
  return result.success ? result.data : null;
}

/**
 * Atualiza o counter de assinatura + `lastUsedAt` após um login bem-sucedido
 * (anti-clonagem, TASK-07). Update parcial by-id (não toca nos demais campos).
 * Valida o counter (int ≥ 0) antes de gravar — counter inválido nunca persiste.
 * A política de regressão (rejeitar valores que não cresceram) é do endpoint de
 * login; aqui só persistimos o valor já validado como avanço legítimo.
 */
export async function updateCredentialCounter(
  credentialId: string,
  newCounter: number,
  lastUsedAt: string,
): Promise<void> {
  if (!Number.isInteger(newCounter) || newCounter < 0) {
    throw new Error("counter inválido (esperado inteiro ≥ 0).");
  }
  const db = getAdminFirestore();
  await db
    .collection(COLLECTION)
    .doc(credentialId)
    .update({ counter: newCounter, lastUsedAt });
}

/** Remove uma credencial (revogação, TASK-06). A ownership é checada no endpoint. */
export async function deleteCredential(credentialId: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COLLECTION).doc(credentialId).delete();
}

/** Lista as credenciais de um usuário (gestão + excludeCredentials no registro). */
export async function listCredentialsByUid(
  uid: string,
): Promise<WebauthnCredential[]> {
  const db = getAdminFirestore();
  const query = await db.collection(COLLECTION).where("uid", "==", uid).get();
  const creds: WebauthnCredential[] = [];
  for (const doc of query.docs) {
    const result = webauthnCredentialSchema.safeParse(doc.data());
    if (result.success) creds.push(result.data);
  }
  return creds;
}
