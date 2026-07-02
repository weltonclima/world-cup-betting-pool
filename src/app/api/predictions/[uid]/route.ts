import "server-only"; // garante que não vaza para o bundle client

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { isSuperAdminRole, predictionSchema, roleSchema } from "@/schemas";
import { copaDataErrorResponse } from "../../_lib/copaDataError";

// firebase-admin + cookies() exigem Node runtime; lê Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/predictions/[uid] — palpites de OUTRO participante (anti-cola, TASK-02).
 *
 * Barreira de segurança: expõe SOMENTE palpites de jogos `status === "finished"`.
 * As Firestore Rules não conseguem aplicar esse filtro (partidas não vivem no
 * Firestore — vêm de Route Handler), então a leitura cruzada acontece aqui via
 * Admin SDK (bypassa Rules por design) e o filtro server-side é a ÚNICA proteção
 * contra copiar aposta de jogo aberto. A Rule A5 de `predictions` permanece
 * `read: if isApproved() && (isOwner || isAdmin)` — o caminho Client SDK segue
 * bloqueado.
 *
 * Fluxo:
 * 1. `requireApprovedUser()` → 401 sem sessão, 403 se o LEITOR não for approved.
 * 2. Lê palpites do `uid` alvo (path param) via Admin SDK.
 * 3. Cruza com `getEffectiveMatches()` (fonte autoritativa de status).
 * 4. Retorna só palpites de jogos `finished`, validados por `predictionSchema`.
 *
 * O `uid` alvo vem SEMPRE do path; o `uid` da sessão só autoriza o leitor.
 * Auto-consulta (uid alvo === leitor) também aplica o filtro `finished` por
 * consistência — o caminho "próprio perfil completo" usa o Client SDK direto
 * (TASK-03), não este handler.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ uid: string }> },
): Promise<NextResponse> {
  // ─── 1. Autenticação + autorização do leitor ──────────────────────────────
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  const readerUid = session.user.uid;
  const { uid: targetUid } = await ctx.params;

  const db = getAdminFirestore();

  // ─── 1b. Isolamento de pool (S1) ──────────────────────────────────────────
  // O leitor só pode ver palpites de membros do PRÓPRIO pool (mesmo `groupId`).
  // super_admin é global (bypass). Auto-consulta (target === leitor) é sempre
  // permitida. `groupId` SEMPRE do doc do usuário (Admin SDK), nunca do request.
  // Sem esta barreira, um participante do pool A lê os palpites finished de um
  // membro do pool B (as Rules não conseguem aplicar — palpites cross-usuário
  // passam por Admin SDK). Fail-closed: leitura falha → 500; sem groupId → 403.
  if (targetUid !== readerUid) {
    try {
      const readerSnap = await db.collection("users").doc(readerUid).get();
      const readerData = readerSnap.data();
      const readerRole = roleSchema.safeParse(readerData?.["role"]);
      const readerIsSuper = readerRole.success && isSuperAdminRole(readerRole.data);

      if (!readerIsSuper) {
        const readerGroupId = readerData?.["groupId"];
        const targetSnap = await db.collection("users").doc(targetUid).get();
        const targetGroupId = targetSnap.data()?.["groupId"];
        if (
          typeof readerGroupId !== "string" ||
          readerGroupId.length === 0 ||
          readerGroupId !== targetGroupId
        ) {
          return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }
      }
    } catch (err) {
      console.error("[predictions/[uid]] falha na checagem de pool:", err);
      return NextResponse.json(
        { error: "Erro ao carregar os palpites." },
        { status: 500 },
      );
    }
  }

  // ─── 2. Palpites do alvo via Admin SDK (bypassa Rules por design) ─────────
  // Fail-closed: falha de leitura → 500 pt-BR controlado (nunca página de erro
  // default do Next, que poderia vazar internals numa rota sensível).
  let snap: Awaited<ReturnType<ReturnType<typeof db.collection>["get"]>>;
  try {
    snap = await db
      .collection("predictions")
      .where("uid", "==", targetUid)
      .get();
  } catch (err) {
    console.error("[predictions/[uid]] falha ao ler palpites:", err);
    return NextResponse.json(
      { error: "Erro ao carregar os palpites." },
      { status: 500 },
    );
  }

  // ─── 3. Fonte autoritativa de status das partidas ─────────────────────────
  let matches: Awaited<ReturnType<typeof getEffectiveMatches>>;
  try {
    matches = await getEffectiveMatches();
  } catch (err) {
    return copaDataErrorResponse(err);
  }

  // Só jogos encerrados entram no filtro anti-cola; o resto sequer é considerado.
  const finishedMatchIds = new Set(
    matches.filter((m) => m.status === "finished").map((m) => m.id),
  );

  // ─── 4. Filtro finished + validação de schema ─────────────────────────────
  const predictions: Array<ReturnType<typeof predictionSchema.parse>> = [];
  for (const doc of snap.docs) {
    const parsed = predictionSchema.safeParse(doc.data());
    if (!parsed.success) {
      console.warn(
        "[predictions/[uid]] palpite fora do schema ignorado:",
        doc.id,
        parsed.error.issues,
      );
      continue;
    }
    // Anti-cola: matchId órfão (sem partida efetiva) ou jogo não-encerrado é
    // descartado — nunca há prova de que está finished.
    if (!finishedMatchIds.has(parsed.data.matchId)) continue;
    predictions.push(parsed.data);
  }

  return NextResponse.json(predictions, { status: 200 });
}
