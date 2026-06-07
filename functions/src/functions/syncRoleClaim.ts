/**
 * Sincronização do custom claim `role` no Firebase Auth (TASK-08).
 *
 * Por quê: o middleware do edge (TASK-10) e o session cookie (TASK-09) decidem
 * acesso a `/admin/*` lendo o claim `role` do ID/session token — sem I/O no
 * Firestore a cada request. Para isso o token precisa carregar `role`, que NÃO
 * existe por padrão; é um custom claim que só o Admin SDK pode gravar.
 *
 * Fonte de verdade: o campo `users/{uid}.role` no Firestore. Este módulo apenas
 * REFLETE esse valor no token. As duas formas de o `role` mudar server-side são
 * cobertas:
 *  - promoção do primeiro admin (`promoteFirstAdmin`, trigger onCreate);
 *  - qualquer alteração posterior de `role` (`syncRoleClaimOnUserUpdate`,
 *    trigger onUpdate) — promoção ou rebaixamento via futuro fluxo admin.
 *
 * Convenção do claim:
 *  - role === "admin"  → setCustomUserClaims(uid, { role: "admin" })
 *  - role === "user"   → setCustomUserClaims(uid, { role: null })  (remove/zera)
 *
 * `null` é usado (em vez de `{}`) para REMOVER explicitamente o claim admin no
 * rebaixamento — `setCustomUserClaims(uid, null)` zeraria TODOS os claims, mas
 * preferimos um shape estável `{ role: <valor|null> }` para o verificador de
 * token sempre ler a mesma chave.
 *
 * Importante (client): após a mudança, o ID token em cache no client continua
 * com o claim antigo até expirar (~1h). O client precisa forçar refresh com
 * `getIdToken(true)` para o claim novo valer imediatamente — ver TASK-09/10.
 */

import { getAuth } from "firebase-admin/auth";
import "../firebase/admin"; // garante inicialização (singleton) do Admin SDK

/** Papéis válidos (espelha `roleSchema` do front: "user" | "admin"). */
export type Role = "user" | "admin";

/**
 * Reflete `role` no custom claim do usuário `uid`.
 *
 * - admin → `{ role: "admin" }`
 * - user  → `{ role: null }` (remove o privilégio do token)
 *
 * Idempotente: regravar o mesmo valor é seguro. Lança se o usuário não existir
 * no Auth ou em falha de I/O — o chamador (trigger) decide logar/retentar.
 */
export async function syncRoleClaim(uid: string, role: Role): Promise<void> {
  const claimValue = role === "admin" ? "admin" : null;
  await getAuth().setCustomUserClaims(uid, { role: claimValue });
}
