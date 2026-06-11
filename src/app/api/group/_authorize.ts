import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  isGroupAdminRole,
  isSuperAdminRole,
  roleSchema,
} from "@/schemas";

/**
 * Autorização escopada ao pool — base de TODAS as rotas `/api/group/*` (PRD-10,
 * TASK-02). NÚCLEO DO ISOLAMENTO MULTI-TENANT.
 *
 * Diferente de `authorizeGroupAdmin` (PRD-09, super_admin global): aqui resolvemos
 * o `groupId` do admin a partir da SESSÃO (`users/{uid}.groupId`) e o devolvemos
 * ao caller para filtrar recursos. O `group_admin` só pode tocar o próprio pool.
 *
 * Regras:
 *  - sessão inválida/não-aprovada → 401/403 (vem de `requireApprovedUser`);
 *  - role normalizado via `roleSchema.safeParse` (preceito WR PRD-09 — nunca
 *    string crua) e exige `isGroupAdminRole || isSuperAdminRole`;
 *  - `group_admin` sem `groupId` no doc → 403 (não há pool para administrar);
 *  - `groupId` SÓ da sessão — NUNCA do body/query (D2). Erro aqui = vazamento
 *    entre pools.
 *
 * super_admin: aceito por conveniência operacional. Se tiver `groupId` no doc,
 * usa-o; senão a rota pode receber `groupId` via param explícito da própria sessão
 * (não há aqui — super_admin sem pool atinge 403, devendo usar os endpoints admin
 * globais da PRD-09). Mantém o caminho simples e fail-closed.
 *
 * Retorna `{ user, groupId, role }` ou `{ errorResponse }` pronto (401/403).
 */
export interface GroupAdminAuth {
  uid: string;
  groupId: string;
  role: ReturnType<typeof roleSchema.parse>;
}

export type GroupAdminAuthResult =
  | { auth: GroupAdminAuth }
  | { errorResponse: NextResponse };

function forbidden(message = "Acesso negado."): { errorResponse: NextResponse } {
  return {
    errorResponse: NextResponse.json({ error: message }, { status: 403 }),
  };
}

export async function authorizeGroupAdminOfPool(): Promise<GroupAdminAuthResult> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return { errorResponse: session.errorResponse };

  const { uid } = session.user;
  const db = getAdminFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return forbidden();

  const data = snap.data();
  // Role normalizado antes dos helpers (fail-closed: valor inesperado nega).
  const role = roleSchema.safeParse(data?.["role"]);
  if (!role.success) return forbidden();
  if (!isGroupAdminRole(role.data) && !isSuperAdminRole(role.data)) {
    return forbidden();
  }

  // `groupId` SEMPRE da sessão (doc do próprio admin), nunca do request (D2).
  const groupId = data?.["groupId"];
  if (typeof groupId !== "string" || groupId.length === 0) {
    return forbidden("Você não administra nenhum grupo.");
  }

  return { auth: { uid, groupId, role: role.data } };
}
