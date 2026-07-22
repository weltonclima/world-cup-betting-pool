import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";

/**
 * POST /api/signup/activate-pool — promoção pós-verificação de e-mail (TASK-18).
 *
 * Um bolão criado por conta ainda não verificada nasce `status:"pending"`
 * (invisível na busca — ver `create-group`). Depois que o caller confirma o
 * e-mail e recarrega o token (`reload()` + `getIdToken(true)`), esta rota
 * re-verifica `email_verified` NO SERVIDOR (BR4 — nunca confia em input do
 * cliente) e promove para `active` os pools `pending` administrados por ele.
 *
 * Regras:
 * - BR3: só toca pools cujo `adminId === caller uid` E `status === "pending"`.
 *   A query já filtra ambos — nunca promove pool de outro dono nem pool `blocked`.
 * - Idempotente: sem pool pending → `activated: 0` (no-op). Rechamar não duplica.
 * - Não verificado ainda → **200** `{ ok:false, activated:0 }` (não é erro do
 *   cliente; ele só precisa confirmar o e-mail e tentar de novo).
 *
 * Autenticação: bare ID token no body (mesmo padrão de `create-group`) — o caller
 * pode ainda não ter session cookie.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  // Identidade + verificação SEMPRE do token (BR4). Token inválido → 401.
  let uid: string;
  let emailVerified = false;
  try {
    const decoded = await getAdminAuth().verifyIdToken(parsed.data.idToken);
    uid = decoded.uid;
    emailVerified = decoded.email_verified === true;
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Ainda não verificou: não é erro — apenas nada a promover. A UI mostra um
  // aviso ("clique no link que enviamos e tente de novo").
  if (!emailVerified) {
    return NextResponse.json({ ok: false, activated: 0 }, { status: 200 });
  }

  try {
    const db = getAdminFirestore();
    // BR3: filtra por dono E status pending — nunca alcança outro dono/blocked.
    const snap = await db
      .collection("pools")
      .where("adminId", "==", uid)
      .where("status", "==", "pending")
      .get();

    const updatedAt = new Date().toISOString();
    // Sequencial: N é minúsculo (pools de uma conta) e mantém o erro simples de
    // propagar. Cada update é idempotente (status já vira active).
    for (const doc of snap.docs) {
      await doc.ref.update({ status: "active", updatedAt });
    }

    return NextResponse.json(
      { ok: true, activated: snap.docs.length },
      { status: 200 },
    );
  } catch (err) {
    console.error("[signup/activate-pool] falha ao promover pool:", err);
    return NextResponse.json(
      { error: "Não foi possível ativar o grupo agora." },
      { status: 500 },
    );
  }
}
