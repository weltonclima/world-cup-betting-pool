import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { getEnabledChampionships } from "@/lib/poolChampionships";
import { getChampionship } from "@/server/copaData/championshipCatalog";
import { loadChampionshipStatuses } from "@/server/copaData/championshipState";
import { championshipStateSchema } from "@/schemas/championships";
import {
  archivedChampionshipsResponseSchema,
  historySnapshotSchema,
  type ArchivedChampionshipSummary,
} from "@/schemas/history";
import type { Pool } from "@/types/pools";

// firebase-admin + cookies() exigem Node runtime; lê Firestore por request → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/history — Seção Histórico (TASK-15): lista campeonatos `archived`
 * habilitados no pool do usuário logado, com ranking/estatísticas congeladas
 * em `history/*` (nunca ao vivo).
 *
 * Isolamento multi-tenant: `groupId` SEMPRE da sessão (`users/{uid}.groupId`),
 * nunca do request — senão um usuário veria o histórico de outro grupo.
 * Usuário sem pool → `items: []` (mesmo contrato deny-by-default de
 * `rankings/pool/route.ts`).
 *
 * Um campeonato só entra na lista se tiver AO MENOS UM snapshot gravado
 * (`__geral` ou `__{groupId}`) — evita listar um `archived` do catálogo sem
 * nenhum dado congelado ainda (arquivamento em andamento/falho).
 */
export async function GET(): Promise<NextResponse> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const db = getAdminFirestore();

  const userSnap = await db.collection("users").doc(session.user.uid).get();
  const groupId = userSnap.data()?.["groupId"];
  if (typeof groupId !== "string" || groupId.length === 0) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const poolSnap = await db.collection("pools").doc(groupId).get();
  const enabled = getEnabledChampionships((poolSnap.data() ?? {}) as Pool);

  const statuses = await loadChampionshipStatuses(db);
  const archivedIds = enabled.filter((id) => statuses.get(id) === "archived");

  if (archivedIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  // Batch: 3 docs por campeonato (`__geral`, `__{groupId}`, override de estado)
  // numa única ida ao Firestore, em vez de N leituras sequenciais.
  const refs = archivedIds.flatMap((id) => [
    db.collection("history").doc(`${id}__geral`),
    db.collection("history").doc(`${id}__${groupId}`),
    db.collection("championships").doc(id),
  ]);
  const snaps = await db.getAll(...refs);

  const items: ArchivedChampionshipSummary[] = [];

  archivedIds.forEach((id, i) => {
    const champ = getChampionship(id);
    if (!champ) return; // catálogo é a fonte da verdade; id fora dele não deveria ocorrer

    const geralSnap = snaps[i * 3];
    const poolSnapDoc = snaps[i * 3 + 1];
    const stateSnap = snaps[i * 3 + 2];

    const geral = geralSnap?.exists
      ? historySnapshotSchema.safeParse(geralSnap.data())
      : undefined;
    const poolSnapshot = poolSnapDoc?.exists
      ? historySnapshotSchema.safeParse(poolSnapDoc.data())
      : undefined;
    // Baseado no parse (não na existência crua): a lista e o detalhe têm que
    // concordar sobre haver um snapshot de pool USÁVEL. Um doc corrompido não
    // deve anunciar `hasPoolSnapshot` que o detalhe depois rejeitaria.
    const hasPoolSnapshot = poolSnapshot?.success === true;
    const state = stateSnap?.exists
      ? championshipStateSchema.safeParse(stateSnap.data())
      : undefined;

    // Sem NENHUM snapshot válido (nem geral, nem do pool) → nada a exibir.
    if (geral?.success !== true && !hasPoolSnapshot) return;

    // Preferência de `archivedAt`: snapshot `__geral` > snapshot do pool >
    // override de estado (`championships/{id}`).
    const archivedAt =
      geral?.success === true
        ? geral.data.archivedAt
        : poolSnapshot?.success === true
          ? poolSnapshot.data.archivedAt
          : state?.success === true
            ? state.data.archivedAt
            : undefined;
    if (!archivedAt) return;

    items.push({
      championshipId: id,
      name: champ.name,
      season: champ.season,
      type: champ.type,
      archivedAt,
      hasPoolSnapshot,
    });
  });

  items.sort((a, b) =>
    a.archivedAt < b.archivedAt ? 1 : a.archivedAt > b.archivedAt ? -1 : 0,
  );

  const parsed = archivedChampionshipsResponseSchema.parse({ items });
  return NextResponse.json(parsed, { status: 200 });
}
