import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { writeAuditLog } from "@/server/admin/auditLog";
import { recalcRankingsBestEffort } from "@/server/rankings/recalc";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { matchSchema, matchStatusSchema, scoreSchema } from "@/schemas";
import type { MatchWithId } from "@/types/matches";

/**
 * PUT /api/admin/matches/[id] — edição manual de partida (PRD-11 TASK-04).
 *
 * Persiste placar/status corrigidos em `matches/{id}` marcando
 * `isManualOverride: true` — a partida passa a ser BLINDADA do sync openfootball
 * (ver `getEffectiveMatches`/sync). Os demais campos (seleções, fase, grupo,
 * estádio, kickoff) vêm da partida efetiva atual; só placar/status são editáveis.
 *
 * O `matchSchema` (refine) valida a coerência placar↔status: `finished` exige
 * ambos os placares; `scheduled/postponed/canceled` exigem ambos null. Body
 * incoerente → 422. Após gravar, invalida o cache e audita em `system_logs`.
 *
 * Só super_admin (ou secret) — via `authorizeGroupAdmin`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const editSchema = z
  .object({
    status: matchStatusSchema,
    homeScore: scoreSchema.nullable(),
    awayScore: scoreSchema.nullable(),
  })
  .strict();

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Partida inválida." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  // Partida-base (estado efetivo atual: openfootball + overrides) para herdar os
  // campos não-editáveis. Sem isso não há como montar um doc válido.
  let current: MatchWithId | undefined;
  try {
    const effective = await getEffectiveMatches();
    current = effective.find((m) => m.id === id);
  } catch (err) {
    return copaDataErrorResponse(err);
  }
  if (!current) {
    return NextResponse.json({ error: "Partida não encontrada." }, { status: 404 });
  }

  const editedAt = new Date().toISOString();
  const merged = matchSchema.safeParse({
    homeTeamId: current.homeTeamId,
    awayTeamId: current.awayTeamId,
    kickoffAt: current.kickoffAt,
    stage: current.stage,
    round: current.round ?? null,
    groupId: current.groupId ?? null,
    venue: current.venue ?? null,
    status: parsed.data.status,
    homeScore: parsed.data.homeScore,
    awayScore: parsed.data.awayScore,
    isManualOverride: true,
    editedBy: auth.actorUid ?? null,
    editedAt,
    ...(current.syncedAt ? { syncedAt: current.syncedAt } : {}),
  });
  if (!merged.success) {
    // Incoerência placar↔status (refine) cai aqui.
    return NextResponse.json(
      { error: "Placar incompatível com o status informado." },
      { status: 422 },
    );
  }

  const db = getAdminFirestore();
  try {
    await db.collection("matches").doc(id).set(merged.data);

    // Invalida o cache derivado (grupos/bracket) para refletir a edição.
    await Promise.all([
      db.collection("worldcup_cache").doc("groups").delete(),
      db.collection("worldcup_cache").doc("bracket").delete(),
    ]);

    // Auditoria (best-effort): inclui o caminho secret/cron (actorUid ausente →
    // ator sentinela "system"), garantindo trilha mesmo em execução automatizada.
    await writeAuditLog({
      type: "match_edited",
      actorUid: auth.actorUid ?? "system",
      message: `Partida ${id} editada: ${parsed.data.status} ${parsed.data.homeScore ?? "-"}x${parsed.data.awayScore ?? "-"}.`,
      level: "info",
    });

    // Gatilho do ranking (PRD-11): o placar manual é a ÚNICA fonte de resultado —
    // recalcula na hora (best-effort; falha não derruba o save).
    await recalcRankingsBestEffort(db);

    return NextResponse.json({ id, ...merged.data }, { status: 200 });
  } catch (err) {
    console.error(`[admin/matches/${id}] erro inesperado:`, err);
    return NextResponse.json(
      { error: "Erro ao salvar a edição da partida." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/matches/[id] — remove a edição manual (un-protect, PRD-11).
 *
 * Apaga o doc `matches/{id}`, retirando o `isManualOverride` que blindava a
 * partida do sync openfootball. A partida volta a ser derivada AO VIVO da base
 * (o próximo `/api/worldcup/*` ou sync reflete os dados oficiais). Sem este
 * caminho, uma correção manual ficaria permanente — se o resultado oficial
 * mudasse depois, a partida nunca mais receberia a atualização.
 *
 * 404 quando não há override (nada a remover). Só super_admin (ou secret).
 */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Partida inválida." }, { status: 400 });
  }

  const db = getAdminFirestore();
  try {
    const ref = db.collection("matches").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Partida não possui edição manual." },
        { status: 404 },
      );
    }

    await ref.delete();

    // Invalida o cache derivado (grupos/bracket) para refletir a remoção.
    await Promise.all([
      db.collection("worldcup_cache").doc("groups").delete(),
      db.collection("worldcup_cache").doc("bracket").delete(),
    ]);

    await writeAuditLog({
      type: "match_edited",
      actorUid: auth.actorUid ?? "system",
      message: `Partida ${id}: edição manual removida (volta ao sync oficial).`,
      level: "info",
    });

    // Remoção do override muda o resultado efetivo → recalcula (best-effort).
    await recalcRankingsBestEffort(db);

    return NextResponse.json({ id, cleared: true }, { status: 200 });
  } catch (err) {
    console.error(`[admin/matches/${id}] erro ao remover override:`, err);
    return NextResponse.json(
      { error: "Erro ao remover a edição da partida." },
      { status: 500 },
    );
  }
}
