import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { getChampionship } from "@/server/copaData/championshipCatalog";
import {
  archiveChampionship,
  ChampionshipNotFinishedError,
} from "@/server/copaData/archive";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";

/**
 * POST /api/admin/championships/[id]/archive — arquiva um campeonato encerrado
 * (multi-championship-launch TASK-13).
 *
 * Trigger manual/script do pipeline de arquivamento: congela schedule +
 * ranking/estatísticas finais e flipa o status para `archived` (ver
 * `archiveChampionship`). Só super_admin (ou secret cron/script) — mesmo padrão
 * de `admin/matches`. Idempotente: re-arquivar refaz o snapshot.
 *
 * 200 `ArchiveSummary` · 401/403 auth · 404 id desconhecido · 409 não encerrado ·
 * 500 inesperado.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await ctx.params;
  // Valida o path (sem traversal / vazio) antes de tocar catálogo/IO.
  if (!id || id.includes("/") || id.includes("..")) {
    return NextResponse.json({ error: "Campeonato inválido." }, { status: 400 });
  }

  const championship = getChampionship(id);
  if (!championship) {
    return NextResponse.json({ error: "Campeonato não encontrado." }, { status: 404 });
  }

  const db = getAdminFirestore();
  try {
    const summary = await archiveChampionship(db, championship);

    // Auditoria best-effort (inclui caminho secret/cron via ator sentinela). Em
    // try/catch PRÓPRIO: o arquivamento já commitou — falha de log NÃO pode virar
    // 500 (senão o cliente vê erro num arquivamento bem-sucedido e re-tenta à toa).
    try {
      await writeAuditLog({
        type: "championship_archived",
        actorUid: auth.actorUid ?? "system",
        message:
          `Campeonato ${id} arquivado: ${summary.matchesPersisted} partidas, ` +
          `${summary.poolsArchived} bolões, ${summary.historyDocs} snapshots` +
          (summary.alreadyArchived ? " (re-arquivamento)." : "."),
        level: "info",
      });
    } catch (auditErr) {
      console.warn(`[admin/championships/${id}/archive] falha ao gravar auditoria:`, auditErr);
    }

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    if (err instanceof ChampionshipNotFinishedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(`[admin/championships/${id}/archive] erro inesperado:`, err);
    // Mapeia falha de origem (ESPN down/timeout) → status apropriado; genérico → 500.
    return copaDataErrorResponse(err);
  }
}
