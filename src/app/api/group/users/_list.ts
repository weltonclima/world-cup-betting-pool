import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { rankingSchema, userSchema } from "@/schemas";
import type { UserStatus } from "@/types";

/**
 * Núcleo das listas `/api/group/users/{pending|approved|blocked}` (PRD-10, TASK-05).
 *
 * Lê os usuários do PRÓPRIO pool (groupId da sessão — isolamento) com o status
 * dado. Para `approved`, enriquece com pts/posição lidos do ranking por pool da
 * PRD-09 (`rankings/pool-{groupId}-geral` — D5: LÊ, não recalcula).
 */
export async function handleListUsers(
  status: UserStatus,
): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  const db = getAdminFirestore();

  try {
    const snap = await db
      .collection("users")
      .where("groupId", "==", groupId)
      .where("status", "==", status)
      .get();

    // Ranking por pool (somente para aprovados; melhor-esforço — ausência → "—").
    const rankingByUid = new Map<string, { points: number; position: number }>();
    if (status === "approved") {
      const rankSnap = await db
        .collection("rankings")
        .doc(`pool-${groupId}-geral`)
        .get();
      if (rankSnap.exists) {
        const parsed = rankingSchema.safeParse(rankSnap.data());
        if (parsed.success) {
          for (const entry of parsed.data.entries) {
            rankingByUid.set(entry.uid, {
              points: entry.points,
              position: entry.position,
            });
          }
        }
      }
    }

    const users = snap.docs.map((d) => {
      const user = userSchema.parse(d.data());
      const rank = rankingByUid.get(user.uid);
      return {
        user,
        ...(rank
          ? { rankingPoints: rank.points, rankingPosition: rank.position }
          : {}),
      };
    });

    // Ordenação em memória: aprovados por posição de ranking (asc, sem rank ao fim);
    // demais por createdAt asc (sem data ao fim). Espelha listUsersByStatus.
    users.sort((a, b) => {
      if (status === "approved") {
        const pa = a.rankingPosition ?? Number.MAX_SAFE_INTEGER;
        const pb = b.rankingPosition ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
      }
      const ca = a.user.createdAt;
      const cb = b.user.createdAt;
      if (ca === cb) return 0;
      if (ca === undefined) return 1;
      if (cb === undefined) return -1;
      return ca.localeCompare(cb);
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    console.error(`[group/users/${status}] erro inesperado:`, err);
    return NextResponse.json(
      { error: "Erro ao carregar os usuários do grupo." },
      { status: 500 },
    );
  }
}
