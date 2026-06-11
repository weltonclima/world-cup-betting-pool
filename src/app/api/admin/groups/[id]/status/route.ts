import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { canTransitionPool, poolSchema, poolStatusSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: poolStatusSchema });

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
    const updated = await db.runTransaction(async (tx) => {
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
      return { ...current.data, status: parsed.data.status, updatedAt };
    });

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
