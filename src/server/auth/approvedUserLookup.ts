import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";

/**
 * Lookup de autorização do login biométrico (TASK-07).
 *
 * No login NÃO há sessão prévia (é o próprio login), então não dá para usar
 * `requireApprovedUser` (que depende do session cookie). Após verificar a
 * assertion e resolver o `uid` pela credencial (M5), este helper lê
 * `users/{uid}` para decidir a emissão do custom token:
 *  - `approved`: só `status === "approved"` autoriza;
 *  - `role`: alimenta o claim do custom token (M1) — sem ele o cookie de sessão
 *    derivado do login biométrico não teria `role` e o middleware edge quebraria
 *    para admins. Default `"user"` se ausente/ inválido.
 *
 * Retorna `null` quando o doc não existe.
 */

export interface ApprovedUserRole {
  approved: boolean;
  role: string;
}

export async function getApprovedUserRole(
  uid: string,
): Promise<ApprovedUserRole | null> {
  const db = getAdminFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;

  const data = snap.data() ?? {};
  const role = typeof data.role === "string" && data.role.length > 0
    ? data.role
    : "user";
  return { approved: data.status === "approved", role };
}
