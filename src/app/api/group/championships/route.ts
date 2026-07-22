import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupMemberOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  getEnabledChampionships,
  getRankingMode,
  filterActiveChampionships,
} from "@/lib/poolChampionships";
import { loadChampionshipStatuses } from "@/server/copaData/championshipState";
import { poolSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/group/championships — campeonatos habilitados do pool da sessão, para
 * QUALQUER membro (multi-championship TASK-09).
 *
 * Diferente de `GET /api/group/settings` (admin-only): esta rota é escopada a
 * membro (`authorizeGroupMemberOfPool`) porque o seletor de campeonato precisa
 * funcionar para todos os participantes, não só admins. Devolve só a projeção
 * mínima (`enabledChampionships`, `rankingMode`) — nunca o pool inteiro (evita
 * vazar campos de admin/tema para membros comuns).
 *
 * Defaults-na-leitura via `@/lib/poolChampionships` (pools legados sem os campos →
 * só Copa, modo geral); ids fora do catálogo curado são filtrados na origem.
 */
export async function GET(): Promise<NextResponse> {
  const result = await authorizeGroupMemberOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  const db = getAdminFirestore();
  try {
    const snap = await db.collection("pools").doc(groupId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
    const pool = poolSchema.parse(snap.data());
    // Segmentação (TASK-15 §6.5): a área ativa (seletor/jogos/palpites) só opera
    // sobre campeonatos NÃO-arquivados; arquivados vivem só no Histórico. BUGFIX:
    // NÃO há mais proteção anti-vazio — um pool 100%-arquivado (ex.: legado só-Copa
    // após o fim do torneio) devolve `[]`, e o cliente exibe "temporada encerrada →
    // Histórico" (SeasonEndedNotice) via `hasActiveChampionship`. Restaurar o
    // fallback anti-vazio reintroduziria o bug (Copa encerrada em ranking/palpite).
    // `loadChampionshipStatuses` aplica overrides de runtime sobre o default do catálogo.
    const statuses = await loadChampionshipStatuses(db);
    const active = filterActiveChampionships(
      getEnabledChampionships(pool),
      statuses,
    );
    return NextResponse.json({
      enabledChampionships: active,
      rankingMode: getRankingMode(pool),
    });
  } catch (err) {
    console.error("[group/championships GET] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao carregar os campeonatos." },
      { status: 500 },
    );
  }
}
