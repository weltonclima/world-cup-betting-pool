import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import {
  notifyJoinRequest,
  sendPushForNotifications,
  writeNotifications,
} from "@/server/notifications";
import { inviteCodeSchema, inviteSchema } from "@/schemas";

/**
 * POST /api/invite/[code]/redeem — registra o consumo de um convite (PRD-10, A2).
 *
 * O resgate em si (associar o usuário ao pool) acontece no `signUp` client-side,
 * que grava `users/{uid}.groupId = invite.groupId`. Esta rota fecha o laço de
 * contabilidade: re-valida o convite e incrementa `usedCount` de forma ATÔMICA,
 * respeitando `maxUses`/`expiresAt`/`isActive`.
 *
 * Autenticação: ID token do Firebase (`{ idToken }`) verificado via Admin SDK —
 * funciona para o usuário recém-criado (`pending`), que ainda NÃO tem session
 * cookie. O `usedCount` só é incrementado se o `groupId` do doc do usuário
 * coincidir com o `groupId` do convite (vincula o incremento a um ingresso real,
 * impedindo inflar a contagem sem efetivamente entrar no grupo).
 *
 * Best-effort no client: uma falha aqui NÃO desfaz o cadastro (o usuário já
 * nasceu `pending` e será aprovado manualmente pelo group_admin).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ idToken: z.string().min(1) });

/** Erro de domínio do resgate, carregando o status HTTP a devolver. */
class RedeemError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RedeemError";
    this.status = status;
  }
}

/**
 * Notifica o admin do pool sobre um novo pedido de entrada (TASK-17). Resolve o
 * destino via `pools/{groupId}.adminId` (admin único por pool). Best-effort: erros
 * são logados e nunca propagam — o resgate já efetivou. Skip silencioso quando o
 * pool não tem admin resolvível ou o próprio resgatante é o admin (auto-notificação).
 */
async function notifyJoinRequestBestEffort(
  db: ReturnType<typeof getAdminFirestore>,
  ctx: { uid: string; groupId: string; applicantName: string; now: number },
): Promise<void> {
  try {
    const poolSnap = await db.collection("pools").doc(ctx.groupId).get();
    const poolData = poolSnap.exists ? poolSnap.data() : undefined;
    const adminUid = poolData?.["adminId"];
    // Admin ausente/inválido → nada a notificar. Nunca auto-notifica o resgatante.
    if (typeof adminUid !== "string" || adminUid.length === 0) {
      return;
    }
    if (adminUid === ctx.uid) {
      return;
    }
    const rawPoolName = poolData?.["name"];
    const poolName = typeof rawPoolName === "string" ? rawPoolName : "seu bolão";

    const notification = notifyJoinRequest({
      adminUid,
      applicantName: ctx.applicantName,
      poolName,
      groupId: ctx.groupId,
      applicantUid: ctx.uid,
    });
    const created = await writeNotifications(db, [notification], new Date(ctx.now));
    await sendPushForNotifications(created, new Date(ctx.now));
  } catch (error) {
    console.error("[invite/redeem] falha ao notificar pedido de entrada:", error);
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await ctx.params;
  // Código do path normalizado pelo schema canônico (nunca confiar no cru).
  const parsedCode = inviteCodeSchema.safeParse(code);
  if (!parsedCode.success) {
    return NextResponse.json({ error: "Convite inválido." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsedBody = bodySchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  // Identifica o chamador pelo ID token (funciona para usuário `pending`).
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(parsedBody.data.idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = getAdminFirestore();
  const inviteRef = db.collection("invites").doc(parsedCode.data);
  const userRef = db.collection("users").doc(uid);
  // Subdoc de resgate por uid (S2 perf-hardening): torna o incremento IDEMPOTENTE.
  // Sem isso, o mesmo usuário podia chamar em loop e inflar `usedCount` até
  // `maxUses`, desativando o convite ativo (DoS de integridade sobre o convite).
  const redemptionRef = inviteRef.collection("redemptions").doc(uid);
  const now = Date.now();

  // Capturas para a notificação de pedido de entrada (TASK-17), preenchidas na
  // transação e consumidas APÓS o commit. `newRedemption` só fica true no run que
  // efetivamente grava o resgate (re-run do Firestore reavalia e sobrescreve).
  let newRedemption = false;
  let joinGroupId = "";
  let applicantName = "";

  try {
    await db.runTransaction(async (tx) => {
      // Todas as leituras ANTES de qualquer escrita (regra do Firestore).
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new RedeemError(404, "Convite não encontrado.");
      }
      const invite = inviteSchema.parse(inviteSnap.data());

      if (!invite.isActive) {
        throw new RedeemError(409, "Este convite não está mais ativo.");
      }
      if (Date.parse(invite.expiresAt) <= now) {
        throw new RedeemError(409, "Este convite expirou.");
      }

      // Vincula o incremento a um ingresso real: o usuário precisa já pertencer
      // ao pool do convite (gravado pelo signUp). Sem isso, qualquer ID token
      // válido poderia inflar `usedCount` de um pool alheio.
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : undefined;
      const userGroupId = userData?.["groupId"];
      if (userGroupId !== invite.groupId) {
        throw new RedeemError(403, "Convite não corresponde ao seu grupo.");
      }

      // Idempotência: se este uid já resgatou, é no-op — NÃO incrementa de novo.
      const redemptionSnap = await tx.get(redemptionRef);
      if (redemptionSnap.exists) {
        newRedemption = false;
        return; // já contabilizado; resposta ok sem inflar usedCount
      }

      // Só resgates NOVOS checam o limite (um uid já resgatado passa mesmo cheio).
      if (invite.usedCount >= invite.maxUses) {
        throw new RedeemError(409, "Este convite atingiu o limite de usos.");
      }

      tx.set(redemptionRef, { redeemedAt: now });
      tx.update(inviteRef, { usedCount: invite.usedCount + 1 });

      // Dados para notificar o admin do pool após o commit (TASK-17).
      newRedemption = true;
      joinGroupId = invite.groupId;
      const rawName = userData?.["name"];
      applicantName = typeof rawName === "string" ? rawName : "";
    });

    // Notificação de pedido de entrada ao admin do pool (TASK-17) — só em resgate
    // NOVO. Best-effort: qualquer falha é logada e NÃO afeta o resgate (o convidado
    // já está `pending` e será aprovado pelo console). Fora da transação.
    if (newRedemption) {
      await notifyJoinRequestBestEffort(db, {
        uid,
        groupId: joinGroupId,
        applicantName,
        now,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof RedeemError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[invite/redeem] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao processar o convite." },
      { status: 500 },
    );
  }
}
