import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { getEnabledChampionships } from "@/lib/poolChampionships";
import { getChampionship } from "@/server/copaData/championshipCatalog";
import { getChampionshipStatus } from "@/server/copaData/championshipState";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import {
  championshipHistoryResponseSchema,
  historySnapshotSchema,
} from "@/schemas/history";
import type { MatchWithId } from "@/types";
import type { Pool } from "@/types/pools";

// firebase-admin + cookies() exigem Node runtime; lê Firestore por request → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = NextResponse.json(
  { error: "Campeonato não encontrado no histórico." },
  { status: 404 },
);

/**
 * GET /api/history/[championshipId] — detalhe de um campeonato arquivado
 * (TASK-15): ranking final congelado (+ estatísticas do pool quando existirem)
 * e jogos, tudo servido do banco.
 *
 * Escopo do ranking: `history/{cid}__{groupId}` (com `statistics`) quando
 * existir; senão fallback `history/{cid}__geral` (sem `statistics`). Nenhum
 * dos dois → 404. `groupId` SEMPRE da sessão — nunca do request.
 *
 * `championshipId` validado contra o catálogo curado (`getChampionship`) —
 * rejeita ids desconhecidos/forjados (inclusive traversal, já que só ids
 * literais do catálogo passam) antes de tocar o Firestore.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ championshipId: string }> },
): Promise<NextResponse> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const { championshipId } = await ctx.params;

  // Guarda defensiva de traversal (getChampionship já rejeitaria via lookup no
  // Map, mas o guard explícito documenta a intenção de segurança na rota).
  if (
    !championshipId ||
    championshipId.includes("/") ||
    championshipId.includes("..")
  ) {
    return NOT_FOUND;
  }

  const champ = getChampionship(championshipId);
  if (!champ) return NOT_FOUND;

  const db = getAdminFirestore();

  // Gate de habilitação por pool (mesmo escopo da lista `/api/history`): o
  // detalhe só serve campeonatos habilitados no pool do usuário. Sem isso, um
  // membro do pool A poderia deep-linkar um campeonato habilitado só no pool B
  // e receber o snapshot `__geral` (ranking agregado cross-pool). `groupId`
  // SEMPRE da sessão — nunca do request.
  const userSnap = await db.collection("users").doc(session.user.uid).get();
  const groupId = userSnap.data()?.["groupId"];
  if (typeof groupId !== "string" || groupId.length === 0) return NOT_FOUND;

  const poolSnap0 = await db.collection("pools").doc(groupId).get();
  const enabled = getEnabledChampionships((poolSnap0.data() ?? {}) as Pool);
  if (!enabled.includes(championshipId)) return NOT_FOUND;

  const status = await getChampionshipStatus(db, championshipId);
  if (status !== "archived") return NOT_FOUND;

  // Tenta o snapshot do pool primeiro (traz `statistics`); só lê `__geral` se
  // o doc do pool não existir.
  const poolSnap = await db
    .collection("history")
    .doc(`${championshipId}__${groupId}`)
    .get();
  const poolParsed = poolSnap?.exists
    ? historySnapshotSchema.safeParse(poolSnap.data())
    : undefined;

  let ranking;
  let statistics;
  let rankingScope: "pool" | "geral";
  let archivedAt: string;

  if (poolParsed?.success === true) {
    ranking = poolParsed.data.ranking;
    statistics = poolParsed.data.statistics;
    rankingScope = "pool";
    archivedAt = poolParsed.data.archivedAt;
  } else {
    const geralSnap = await db
      .collection("history")
      .doc(`${championshipId}__geral`)
      .get();
    const geralParsed = geralSnap.exists
      ? historySnapshotSchema.safeParse(geralSnap.data())
      : undefined;
    if (geralParsed?.success !== true) return NOT_FOUND;
    ranking = geralParsed.data.ranking;
    statistics = undefined;
    rankingScope = "geral";
    archivedAt = geralParsed.data.archivedAt;
  }

  // Jogos congelados (banco-first para liga arquivada; cup arquivado segue
  // ESPN — limitação documentada §4 do spec). Falha aqui NÃO derruba o
  // detalhe (ranking/estatísticas continuam válidos) — degrada para vazio.
  let matches: MatchWithId[] = [];
  try {
    matches = await getEffectiveMatches(championshipId);
  } catch (err) {
    console.error(
      `[history] falha ao carregar jogos congelados de "${championshipId}":`,
      err,
    );
  }

  // Zod-parse de saída (sem `matches` — o client valida jogos separadamente,
  // ver docstring de `championshipHistoryResponseSchema`).
  const validated = championshipHistoryResponseSchema.parse({
    championship: {
      id: champ.id,
      name: champ.name,
      season: champ.season,
      type: champ.type,
      status: "archived",
    },
    ranking,
    rankingScope,
    statistics,
    archivedAt,
  });

  return NextResponse.json({ ...validated, matches }, { status: 200 });
}
