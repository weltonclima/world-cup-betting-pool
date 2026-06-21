import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  notifyPromotion,
  sendPushForNotifications,
  writeNotifications,
} from "@/server/notifications";
import {
  isGroupAdminRole,
  isParticipantRole,
  isSuperAdminRole,
  poolSchema,
  roleSchema,
  userStatusSchema,
} from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ uid: z.string().min(1) });

// Parse defensivo do doc do alvo (noUncheckedIndexedAccess). Só o necessário.
const targetUserSchema = z.object({
  status: z.string().optional(),
  groupId: z.string().optional(),
  role: z.string().optional(),
});

/** Erro de domínio da promoção, carregando o status HTTP a devolver. */
class PromoteError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PromoteError";
    this.status = status;
  }
}

/**
 * POST /api/group/users/promote — promove um participante aprovado do PRÓPRIO pool
 * a admin do grupo (PRD-10, TASK-06; D3: troca — 1 admin/pool, anterior → participant).
 *
 * Wrapper escopado sobre a transação de troca da PRD-09 (`/api/admin/groups/[id]/admin`),
 * mas iniciado pelo `group_admin` (não super_admin) e com `id` FORÇADO ao
 * `groupId` da SESSÃO. MAIOR RISCO DE ESCALONAMENTO — guardas:
 *  - alvo deve ser membro APROVADO do MESMO pool (isolamento — D2);
 *  - alvo NUNCA pode ser super_admin (proteção de papel);
 *  - transação reads-before-writes (espelha o swap PRD-09).
 *
 * A propagação da claim continua em `syncRoleClaimOnUserUpdate` (PRD-09 TASK-06) —
 * aqui só o campo `users/{uid}.role`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth; // id FORÇADO da sessão (nunca do body)

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
  const newAdminId = parsed.data.uid;

  const db = getAdminFirestore();
  const poolRef = db.collection("pools").doc(groupId);
  const newRef = db.collection("users").doc(newAdminId);
  const updatedAt = new Date().toISOString();

  try {
    const updatedPool = await db.runTransaction(async (tx) => {
      const poolSnap = await tx.get(poolRef);
      if (!poolSnap.exists) throw new PromoteError(404, "Grupo não encontrado.");
      const pool = poolSchema.parse(poolSnap.data());

      const newSnap = await tx.get(newRef);
      const newUser = targetUserSchema.safeParse(
        newSnap.exists ? newSnap.data() : undefined,
      );
      const newStatus = userStatusSchema.safeParse(
        newUser.success ? newUser.data.status : undefined,
      );
      // Alvo precisa existir, estar aprovado e ser do MESMO pool.
      if (!newUser.success || !newStatus.success || newStatus.data !== "approved") {
        throw new PromoteError(409, "Usuário inválido para admin do grupo.");
      }
      if (newUser.data.groupId !== groupId) {
        throw new PromoteError(403, "Usuário não pertence ao seu grupo.");
      }

      // Super admin nunca é "promovido"/tocado por esta via (proteção de papel).
      const newRole = roleSchema.safeParse(newUser.data.role);
      if (newRole.success && isSuperAdminRole(newRole.data)) {
        throw new PromoteError(403, "Não é possível alterar este usuário.");
      }

      // Reads-before-writes: ler o admin anterior ANTES de qualquer escrita.
      const oldAdminId = pool.adminId;
      let demoteOld = false;
      if (oldAdminId !== newAdminId) {
        const oldSnap = await tx.get(db.collection("users").doc(oldAdminId));
        const oldRole = roleSchema.safeParse(
          oldSnap.exists ? oldSnap.data()?.["role"] : undefined,
        );
        // Só rebaixa quem era group_admin (não toca super_admin/legado admin).
        demoteOld = oldRole.success && isGroupAdminRole(oldRole.data);
      }

      tx.update(poolRef, { adminId: newAdminId, updatedAt });
      // Promove a group_admin apenas participante (self-promote idempotente: quem
      // já é group_admin não recebe escrita espúria).
      const shouldPromote = !newRole.success || isParticipantRole(newRole.data);
      if (shouldPromote) {
        tx.update(newRef, { role: "group_admin", updatedAt });
      }
      if (demoteOld) {
        tx.update(db.collection("users").doc(oldAdminId), {
          role: "participant",
          updatedAt,
        });
      }

      return { ...pool, adminId: newAdminId, updatedAt };
    });

    // S5 (PRD §6.2): notifica o promovido `system`, server-side, FORA da
    // transação. Best-effort — falha loga e não derruba a promoção já efetivada.
    try {
      const now = new Date(updatedAt);
      const notification = notifyPromotion({
        uid: newAdminId,
        poolName: updatedPool.name,
      });
      // TASK-07: auto-id (sem ID determinístico) → sempre recém-criado → sempre
      // pusha (promote→demote→promote é repeat legítimo).
      const created = await writeNotifications(db, [notification], now);
      await sendPushForNotifications(created, now);
    } catch (error) {
      console.error("[group/users/promote] falha ao notificar promoção:", error);
    }

    return NextResponse.json({ pool: updatedPool }, { status: 200 });
  } catch (err) {
    if (err instanceof PromoteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[group/users/promote] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao promover o usuário." },
      { status: 500 },
    );
  }
}
