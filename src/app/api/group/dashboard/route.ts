import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quantos "últimos cadastros" retornar no dashboard. */
const RECENT_LIMIT = 5;

/**
 * GET /api/group/dashboard — visão geral do pool da sessão (PRD-10, TASK-04).
 *
 * Agrega contadores (participantes/pendentes/bloqueados/convites ativos) +
 * "últimos cadastros" (N usuários recentes do pool). TUDO filtrado por
 * `groupId` da SESSÃO (isolamento — D2). Spark: contagem por leitura de docs
 * `where groupId == ...` (sem `count()` aggregation p/ garantir compat).
 */
export async function GET(): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  const db = getAdminFirestore();

  try {
    const poolSnap = await db.collection("pools").doc(groupId).get();
    if (!poolSnap.exists) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
    const pool = poolSchema.parse(poolSnap.data());

    // Usuários do pool (uma query escopada; contagem + ordenação em memória —
    // espelha listUsersByStatus, evita índice e não descarta docs sem createdAt).
    const usersSnap = await db
      .collection("users")
      .where("groupId", "==", groupId)
      .get();

    let participants = 0;
    let pending = 0;
    let blocked = 0;
    const recentSource: {
      uid: string;
      name: string;
      status: "pending" | "approved" | "blocked";
      createdAt?: string;
      avatarUrl?: string;
    }[] = [];

    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data();
      const status = data["status"];
      if (status === "approved") participants += 1;
      else if (status === "pending") pending += 1;
      else if (status === "blocked") blocked += 1;

      if (status === "pending" || status === "approved" || status === "blocked") {
        const name = typeof data["name"] === "string" ? data["name"] : "";
        const createdAt =
          typeof data["createdAt"] === "string" ? data["createdAt"] : undefined;
        const avatarUrl =
          typeof data["avatarUrl"] === "string" ? data["avatarUrl"] : undefined;
        recentSource.push({
          uid: docSnap.id,
          name,
          status,
          ...(createdAt !== undefined ? { createdAt } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        });
      }
    }

    // Convites ativos do pool (escopado por groupId — isolamento).
    const invitesSnap = await db
      .collection("invites")
      .where("groupId", "==", groupId)
      .where("isActive", "==", true)
      .get();
    const activeInvites = invitesSnap.size;

    // Últimos cadastros: mais recentes primeiro (desc por createdAt; sem data ao fim).
    recentSource.sort((a, b) => {
      if (a.createdAt === b.createdAt) return 0;
      if (a.createdAt === undefined) return 1;
      if (b.createdAt === undefined) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const recent = recentSource.slice(0, RECENT_LIMIT);

    return NextResponse.json({
      pool,
      counts: { participants, pending, blocked, activeInvites },
      recent,
    });
  } catch (err) {
    console.error("[group/dashboard] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao carregar o painel do grupo." },
      { status: 500 },
    );
  }
}
