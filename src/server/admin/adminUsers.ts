import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { isSuperAdminRole, roleSchema, userStatusSchema } from "@/schemas";
import type { Role, UserStatus } from "@/types";

/**
 * Leitura server-side de usuários para a atribuição de grupo pelo super_admin.
 * Admin SDK (bypassa as Rules). Alimenta a tela "Usuários sem grupo" — limpeza da
 * base de usuários órfãos (sem `groupId`) herdados da transição PRD-09, com opção
 * de listar todos para realocação.
 *
 * super_admin é EXCLUÍDO da lista: opera globalmente e não precisa pertencer a um
 * pool — incluí-lo só convidaria a uma auto-atribuição acidental.
 */

export interface AdminUserRow {
  uid: string;
  name: string;
  nickname: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  role: Role;
  groupId: string | null;
  groupName: string | null;
  createdAt: string | null;
}

/** Lê um campo string do doc com fallback — tolera docs legados/parciais. */
function str(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Lista usuários para atribuição de grupo. `withoutGroupOnly` (default) restringe
 * aos órfãos (sem `groupId`); `false` traz todos (com o nome do grupo atual) para
 * realocação. Exclui super_admin. Ordena por nome (pt-BR).
 *
 * Lê os campos defensivamente (sem `userSchema.parse` strict) para não descartar
 * docs com campos legados — o objetivo da tela é justamente sanear esses casos.
 */
export async function listUsersForAssignment(opts: {
  withoutGroupOnly: boolean;
}): Promise<AdminUserRow[]> {
  const db = getAdminFirestore();
  const snap = await db.collection("users").get();

  // Mapa poolId → nome, só quando vamos exibir o grupo atual (modo "todos").
  let poolNames: Map<string, string> | null = null;
  if (!opts.withoutGroupOnly) {
    const poolsSnap = await db.collection("pools").get();
    poolNames = new Map();
    for (const doc of poolsSnap.docs) {
      const name = str(doc.data(), "name");
      if (name) poolNames.set(doc.id, name);
    }
  }

  const rows: AdminUserRow[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();

    // super_admin opera globalmente — fora da lista de atribuição.
    const role = roleSchema.safeParse(data["role"]);
    if (role.success && isSuperAdminRole(role.data)) continue;

    const groupId = str(data, "groupId");
    if (opts.withoutGroupOnly && groupId !== null) continue;

    const status = userStatusSchema.safeParse(data["status"]);
    rows.push({
      uid: doc.id,
      name: str(data, "name") ?? "Usuário",
      nickname: str(data, "nickname") ?? "",
      email: str(data, "email") ?? "",
      avatarUrl: str(data, "avatarUrl"),
      status: status.success ? status.data : "pending",
      role: role.success ? role.data : "participant",
      groupId,
      groupName: groupId ? (poolNames?.get(groupId) ?? null) : null,
      createdAt: str(data, "createdAt"),
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return rows;
}
