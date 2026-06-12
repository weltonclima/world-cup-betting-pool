import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolSchema, poolStatusSchema } from "@/schemas";
import type { Pool } from "@/types";

/**
 * Leitura server-side de pools para a área global do Super Admin (PRD-11 TASK-04).
 * Admin SDK (bypassa as Rules) — o super_admin enxerga pools em QUALQUER status
 * (pending/blocked não vazam ao cliente comum). Exclui soft-deleted (B2).
 */

export interface AdminPoolRow extends Pool {
  participantCount: number;
}

/** Conta participantes (users.groupId == poolId) via aggregation. */
async function countParticipants(poolId: string): Promise<number> {
  const db = getAdminFirestore();
  try {
    const snap = await db
      .collection("users")
      .where("groupId", "==", poolId)
      .count()
      .get();
    return snap.data().count;
  } catch (error) {
    console.error(`[admin/adminPools] falha ao contar participantes de ${poolId}:`, error);
    return 0;
  }
}

/**
 * Lista pools por status, com contagem de participantes. Ordena por `createdAt`
 * desc em memória (evita exigir índice composto além do já previsto e tolera docs
 * sem `createdAt`). `deletedAt` presente = soft-deleted → excluído da listagem.
 */
export async function listPoolsByStatus(
  status: "pending" | "active" | "blocked",
): Promise<AdminPoolRow[]> {
  const parsedStatus = poolStatusSchema.parse(status);
  const db = getAdminFirestore();
  const snap = await db
    .collection("pools")
    .where("status", "==", parsedStatus)
    .get();

  const pools: Pool[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    // Soft-delete (B2): docs com deletedAt não aparecem nas listagens.
    if (data["deletedAt"] != null) continue;
    const parsed = poolSchema.safeParse(data);
    if (parsed.success) pools.push(parsed.data);
  }

  pools.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const rows = await Promise.all(
    pools.map(async (pool) => ({
      ...pool,
      participantCount: await countParticipants(pool.id),
    })),
  );
  return rows;
}
