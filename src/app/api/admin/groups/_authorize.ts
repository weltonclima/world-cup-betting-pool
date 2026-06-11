import "server-only";

import { NextResponse } from "next/server";

import { safeSecretEqual } from "@/app/api/_lib/secret";
import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { isSuperAdminRole, roleSchema } from "@/schemas";

/**
 * Autorização das rotas admin de grupo (TASK-05). Dois caminhos (espelha
 * `rankings/recalc`): (1) secret header `x-admin-secret` == `GROUPS_ADMIN_SECRET`
 * (cron/seed/script), comparado em tempo constante; (2) sessão de **super_admin**
 * (`requireApprovedUser` + `isSuperAdminRole`, dupla-compat `admin`||`super_admin`).
 *
 * Retorna `{ authorized: true }` ou `{ errorResponse }` pronto (401/403).
 */
export type AdminAuthResult =
  | { authorized: true }
  | { errorResponse: NextResponse };

export async function authorizeGroupAdmin(
  request: Request,
): Promise<AdminAuthResult> {
  const secret = process.env["GROUPS_ADMIN_SECRET"];
  if (safeSecretEqual(secret, request.headers.get("x-admin-secret"))) {
    return { authorized: true };
  }

  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return { errorResponse: auth.errorResponse };

  const db = getAdminFirestore();
  const snap = await db.collection("users").doc(auth.user.uid).get();
  const role = roleSchema.safeParse(snap.exists ? snap.data()?.role : undefined);
  if (!role.success || !isSuperAdminRole(role.data)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 },
      ),
    };
  }

  return { authorized: true };
}
