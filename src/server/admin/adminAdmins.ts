import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolSchema } from "@/schemas";
import type { Pool } from "@/types";

/**
 * Lista de administradores de grupo para a tela Administradores (PRD11-05,
 * TASK-05). Fonte de verdade = `pools.adminId` (cada pool não-deletado tem um
 * admin). Cruza com `users` para nome/avatar e usa `pool.createdAt` como "desde".
 * Admin SDK (super_admin enxerga pools em qualquer status).
 */

export interface AdminEntry {
  uid: string;
  name: string;
  avatarUrl: string | null;
  poolId: string;
  poolName: string;
  since: string | null; // ISO — quando o pool foi criado (proxy de "admin desde")
}

export async function listGroupAdmins(): Promise<AdminEntry[]> {
  const db = getAdminFirestore();
  const snap = await db.collection("pools").get();

  const pools: Pool[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data["deletedAt"] != null) continue; // soft-deleted não tem admin "ativo"
    const parsed = poolSchema.safeParse(data);
    if (parsed.success) pools.push(parsed.data);
  }

  const entries = await Promise.all(
    pools.map(async (pool) => {
      const userSnap = await db.collection("users").doc(pool.adminId).get();
      const user = userSnap.exists ? userSnap.data() : undefined;
      const name =
        typeof user?.["name"] === "string" && user["name"].length > 0
          ? (user["name"] as string)
          : "Administrador";
      const avatarUrl =
        typeof user?.["avatarUrl"] === "string" ? (user["avatarUrl"] as string) : null;
      return {
        uid: pool.adminId,
        name,
        avatarUrl,
        poolId: pool.id,
        poolName: pool.name,
        since: pool.createdAt ?? null,
      };
    }),
  );

  // Ordena por nome (busca client filtra; PNG não define ordenação explícita).
  entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return entries;
}
