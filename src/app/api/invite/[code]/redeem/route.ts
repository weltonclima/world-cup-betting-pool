import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
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
  const now = Date.now();

  try {
    await db.runTransaction(async (tx) => {
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
      if (invite.usedCount >= invite.maxUses) {
        throw new RedeemError(409, "Este convite atingiu o limite de usos.");
      }

      // Vincula o incremento a um ingresso real: o usuário precisa já pertencer
      // ao pool do convite (gravado pelo signUp). Sem isso, qualquer ID token
      // válido poderia inflar `usedCount` de um pool alheio.
      const userSnap = await tx.get(userRef);
      const userGroupId = userSnap.exists
        ? userSnap.data()?.["groupId"]
        : undefined;
      if (userGroupId !== invite.groupId) {
        throw new RedeemError(403, "Convite não corresponde ao seu grupo.");
      }

      tx.update(inviteRef, { usedCount: invite.usedCount + 1 });
    });

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
