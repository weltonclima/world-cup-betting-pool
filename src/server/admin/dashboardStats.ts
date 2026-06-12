import "server-only";

import { fetchAllMatches } from "@/server/copaData";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { syncLogSchema, type SyncLog } from "@/schemas/syncLogs";

/**
 * Agregação de estatísticas globais do dashboard do Super Admin (PRD-11 TASK-04).
 * Server-only (Admin SDK). Usa `count()` aggregation queries (R3 — Spark) em vez
 * de varrer coleções inteiras: o agregador roda no servidor do Firestore e cobra
 * 1 leitura por lote de 1000 docs, muito mais barato que ler doc-a-doc.
 *
 * Jogos vêm do openfootball ao vivo (`fetchAllMatches`) — a coleção `matches`
 * persistida só existe após o 1º sync; o card "Jogos" reflete o calendário real.
 */

export interface DashboardStats {
  groups: { active: number; pending: number; blocked: number; total: number };
  users: number;
  admins: number;
  predictions: number;
  matches: number;
  lastSync: SyncLog | null;
}

/** Conta docs de uma coleção aplicando filtros `where` opcionais. */
async function countCollection(
  collection: string,
  filters: { field: string; value: string }[] = [],
): Promise<number> {
  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = db.collection(collection);
  for (const f of filters) {
    query = query.where(f.field, "==", f.value);
  }
  try {
    const snap = await query.count().get();
    return snap.data().count;
  } catch (error) {
    console.error(`[admin/dashboardStats] falha ao contar ${collection}:`, error);
    return 0;
  }
}

/** Lê o `sync_logs` mais recente (painel "Última Sincronização"). null se nunca houve sync. */
async function readLastSync(): Promise<SyncLog | null> {
  const db = getAdminFirestore();
  try {
    const snap = await db
      .collection("sync_logs")
      .orderBy("executedAt", "desc")
      .limit(1)
      .get();
    const doc = snap.docs[0];
    if (!doc) return null;
    const parsed = syncLogSchema.safeParse(doc.data());
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error("[admin/dashboardStats] falha ao ler última sync:", error);
    return null;
  }
}

/** Total de jogos do calendário (openfootball ao vivo). 0 se a fonte falhar. */
async function countMatches(): Promise<number> {
  try {
    const matches = await fetchAllMatches();
    return matches.length;
  } catch (error) {
    console.error("[admin/dashboardStats] falha ao buscar jogos:", error);
    return 0;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    active,
    pending,
    blocked,
    poolsTotal,
    users,
    groupAdmins,
    legacyAdmins,
    superAdmins,
    predictions,
    matches,
    lastSync,
  ] = await Promise.all([
    countCollection("pools", [{ field: "status", value: "active" }]),
    countCollection("pools", [{ field: "status", value: "pending" }]),
    countCollection("pools", [{ field: "status", value: "blocked" }]),
    countCollection("pools"),
    countCollection("users"),
    countCollection("users", [{ field: "role", value: "group_admin" }]),
    countCollection("users", [{ field: "role", value: "admin" }]),
    countCollection("users", [{ field: "role", value: "super_admin" }]),
    countCollection("predictions"),
    countMatches(),
    readLastSync(),
  ]);

  return {
    groups: { active, pending, blocked, total: poolsTotal },
    users,
    // "Administradores" = admins de grupo + admins globais (dupla-compat legado).
    admins: groupAdmins + legacyAdmins + superAdmins,
    predictions,
    matches,
    lastSync,
  };
}
