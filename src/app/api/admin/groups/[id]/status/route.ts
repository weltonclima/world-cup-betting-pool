import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  canTransitionPool,
  poolSchema,
  poolStatusSchema,
  type SystemLogType,
} from "@/schemas";
import type { PoolStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: poolStatusSchema });

/**
 * Mapeia a transição de status do pool para o tipo de log de auditoria (PRD-11
 * TASK-05). Rejeitar (pending→blocked) e bloquear (active→blocked) compartilham
 * o destino `blocked`; desambiguamos pela origem.
 */
function logTypeForTransition(
  from: PoolStatus,
  to: PoolStatus,
): SystemLogType | null {
  if (to === "active") {
    return from === "pending" ? "group_approved" : "group_reactivated";
  }
  if (to === "blocked") {
    return from === "pending" ? "group_rejected" : "group_blocked";
  }
  return null;
}

/** Erro de domínio da transição, carregando o status HTTP a devolver. */
class StatusError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StatusError";
    this.status = status;
  }
}

/**
 * PATCH /api/admin/groups/[id]/status — transição de status do pool (TASK-05).
 *
 * Decisão A2 (mecanismo admin mínimo). Só super_admin/secret. Valida a transição
 * contra `ALLOWED_POOL_STATUS_TRANSITIONS` (pending→active/blocked, active↔blocked);
 * inválida → 409. Escreve via Admin SDK (`status` + `updatedAt`).
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const { id } = await ctx.params;
  const db = getAdminFirestore();
  const ref = db.collection("pools").doc(id);
  const updatedAt = new Date().toISOString();

  // Transação: read+validate+write atômico evita TOCTOU entre duas transições
  // concorrentes (ex.: active→blocked e blocked→active pulando o estado blocked).
  try {
    const { updated, previousStatus } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new StatusError(404, "Grupo não encontrado.");

      const current = poolSchema.safeParse(snap.data());
      if (!current.success) throw new StatusError(500, "Grupo corrompido.");

      if (!canTransitionPool(current.data.status, parsed.data.status)) {
        throw new StatusError(
          409,
          "Transição de status do grupo não permitida.",
        );
      }

      tx.update(ref, { status: parsed.data.status, updatedAt });
      // current.data já é um Pool válido (strict) — sem re-parse.
      return {
        updated: { ...current.data, status: parsed.data.status, updatedAt },
        previousStatus: current.data.status,
      };
    });

    // Auditoria best-effort (PRD-11 TASK-05): não derruba a transição.
    const logType = logTypeForTransition(previousStatus, parsed.data.status);
    if (logType && auth.actorUid) {
      void writeAuditLog({
        type: logType,
        actorUid: auth.actorUid,
        message: `Grupo: ${updated.name}`,
        level: logType === "group_blocked" || logType === "group_rejected" ? "warning" : "info",
      });
    }

    return NextResponse.json({ pool: updated }, { status: 200 });
  } catch (err) {
    if (err instanceof StatusError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/groups/status] erro inesperado na transição:", err);
    return NextResponse.json(
      { error: "Erro ao atualizar o status do grupo." },
      { status: 500 },
    );
  }
}
