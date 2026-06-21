import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { fcmTokenSchema } from "@/schemas";

/**
 * Helpers server-side da store de tokens FCM (web-push-pwa TASK-03).
 *
 * Compartilhados com o envio de push (TASK-04): `getUserTokens` alimenta o
 * fan-out por dispositivo; `pruneTokens` remove os tokens reportados mortos
 * (`registration-token-not-registered`) pela poda. Admin SDK (bypassa Rules).
 */

const FCM_TOKENS = "fcm_tokens";

// Limite rígido de operações por WriteBatch do Firestore.
const BATCH_LIMIT = 500;

/**
 * Lista os tokens FCM válidos do usuário. Parse tolerante: descarta docs fora do
 * schema (legado/órfão) em vez de quebrar a leitura inteira (espelha
 * `listNotifications`). Best-effort: erro de leitura → lista vazia + log (não
 * derruba o envio best-effort do TASK-04), simétrico a `pruneTokens`.
 */
export async function getUserTokens(uid: string): Promise<string[]> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(FCM_TOKENS).where("userId", "==", uid).get();
    return snap.docs.flatMap((d) => {
      const parsed = fcmTokenSchema.safeParse(d.data());
      return parsed.success ? [parsed.data.token] : [];
    });
  } catch (err) {
    console.error("[notifications/tokens] falha ao listar tokens:", err);
    return [];
  }
}

/**
 * Apaga os tokens dados (poda de tokens mortos), em lotes de ≤500 (limite do
 * WriteBatch). Lista vazia = no-op. Best-effort: nunca lança — a poda é higiene
 * de custo, não pode derrubar o envio (que já é best-effort).
 */
export async function pruneTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const db = getAdminFirestore();
    for (let i = 0; i < tokens.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const token of tokens.slice(i, i + BATCH_LIMIT)) {
        batch.delete(db.collection(FCM_TOKENS).doc(token));
      }
      await batch.commit();
    }
  } catch (err) {
    console.error("[notifications/tokens] falha ao podar tokens:", err);
  }
}
