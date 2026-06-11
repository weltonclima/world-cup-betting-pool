import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { fetchAllMatches } from "@/server/copaData";
import { readPersistedMatches } from "@/server/copaData/matchSource";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { matchSchema, syncLogInputSchema, syncLogSchema } from "@/schemas";
import type { MatchWithId } from "@/types/matches";

/**
 * POST /api/admin/worldcup/sync — sincroniza partidas openfootball → Firestore
 * (PRD-11 TASK-02). Persiste cada partida em `matches/{id}`, PRESERVANDO as que
 * têm `isManualOverride === true` (correções manuais nunca são sobrescritas).
 * Grava um resumo em `sync_logs/{id}` (lido nos painéis "Última Sincronização" e
 * "Detalhes do Log") e audita em `system_logs` (best-effort).
 *
 * Só super_admin (ou secret de cron) — via `authorizeGroupAdmin`. Após o sync,
 * invalida o cache `worldcup_cache` para que grupos/bracket recomputem.
 *
 * Seleções/grupos do torneio NÃO são persistidos: seguem derivados ao vivo do
 * openfootball pelas rotas `/api/worldcup/*` (por isso os contadores ficam 0).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Monta o doc de `matches/{id}` a partir da partida-base + override existente. */
function toMatchDoc(
  m: MatchWithId,
  existing: MatchWithId | undefined,
  syncedAt: string,
): Record<string, unknown> {
  // Firestore rejeita `undefined` → normaliza ausências para `null`.
  return matchSchema.parse({
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    kickoffAt: m.kickoffAt,
    stage: m.stage,
    round: m.round ?? null,
    groupId: m.groupId ?? null,
    venue: m.venue ?? null,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    isManualOverride: false,
    // Preserva auditoria de edição anterior (se a partida já fora editada e
    // depois teve o override removido, mantém o rastro).
    editedBy: existing?.editedBy ?? null,
    editedAt: existing?.editedAt ?? null,
    syncedAt,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  let base: MatchWithId[];
  try {
    base = await fetchAllMatches();
  } catch (err) {
    return copaDataErrorResponse(err);
  }

  const db = getAdminFirestore();
  const syncedAt = new Date().toISOString();

  try {
    const persisted = await readPersistedMatches();

    const batch = db.batch();
    let matchesUpdated = 0;
    let matchesSkipped = 0;

    for (const m of base) {
      const existing = persisted.get(m.id);
      if (existing && existing.isManualOverride === true) {
        matchesSkipped += 1; // blindado: correção manual preservada
        continue;
      }
      batch.set(db.collection("matches").doc(m.id), toMatchDoc(m, existing, syncedAt));
      matchesUpdated += 1;
    }

    await batch.commit();

    // Invalida o cache derivado (grupos/bracket) para refletir o sync no próximo GET.
    await Promise.all([
      db.collection("worldcup_cache").doc("groups").delete(),
      db.collection("worldcup_cache").doc("bracket").delete(),
    ]);

    // Resumo auditável da sincronização.
    const logInput = syncLogInputSchema.parse({
      executedBy: auth.actorUid ?? "system",
      executedAt: syncedAt,
      matchesUpdated,
      matchesSkipped,
      teamsUpdated: 0,
      groupsUpdated: 0,
      status: "success",
      message:
        matchesSkipped > 0
          ? `${matchesUpdated} partidas sincronizadas, ${matchesSkipped} preservadas por edição manual.`
          : `${matchesUpdated} partidas sincronizadas.`,
    });
    const logRef = db.collection("sync_logs").doc();
    const log = syncLogSchema.parse({ id: logRef.id, ...logInput });
    await logRef.set(log);

    // Auditoria global (best-effort): inclui o caminho cron/secret — actorUid
    // ausente → ator sentinela "system".
    await writeAuditLog({
      type: "worldcup_synced",
      actorUid: auth.actorUid ?? "system",
      message: log.message,
      level: "info",
    });

    return NextResponse.json(log, { status: 200 });
  } catch (err) {
    console.error("[admin/worldcup/sync] erro inesperado:", err);
    // Registra a FALHA em sync_logs (best-effort). Sem isto, uma falha de sync
    // ficaria invisível: os painéis exibiriam apenas a última sync bem-sucedida,
    // mascarando que a sincronização atual abortou.
    try {
      const logRef = db.collection("sync_logs").doc();
      const failLog = syncLogSchema.parse({
        id: logRef.id,
        executedBy: auth.actorUid ?? "system",
        executedAt: syncedAt,
        matchesUpdated: 0,
        matchesSkipped: 0,
        teamsUpdated: 0,
        groupsUpdated: 0,
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Falha desconhecida na sincronização.",
      });
      await logRef.set(failLog);
      await writeAuditLog({
        type: "worldcup_synced",
        actorUid: auth.actorUid ?? "system",
        message: `Falha na sincronização: ${failLog.message}`,
        level: "error",
      });
    } catch (logErr) {
      console.error(
        "[admin/worldcup/sync] falha ao gravar sync_log de erro:",
        logErr,
      );
    }
    return NextResponse.json(
      { error: "Erro ao sincronizar as partidas." },
      { status: 500 },
    );
  }
}
