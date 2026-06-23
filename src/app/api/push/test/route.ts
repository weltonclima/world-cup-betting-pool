import "server-only";

import { NextResponse } from "next/server";

import { getAdminMessaging } from "@/server/firebaseAdmin";
import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getUserTokens, pruneTokens } from "@/server/notifications/tokens";

// Node runtime: firebase-admin + cookies() (via requireApprovedUser) exigem Node.
export const runtime = "nodejs";
// Force dynamic: lê sessão e dispara FCM — sem cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/push/test — endpoint de DIAGNÓSTICO de Web Push.
 *
 * Dispara um push de teste para os dispositivos do PRÓPRIO usuário logado e
 * devolve o resultado por token. Diferente do envio de produção
 * (`sendPushForNotifications`), aqui o gate de preferência é DELIBERADAMENTE
 * pulado: o objetivo é provar a cadeia de entrega ponta a ponta
 * (VAPID → token registrado → FCM → service worker → banner) isolada do
 * master switch / toggles por-tipo. Escopado ao dono (só os próprios tokens).
 *
 * Leitura do resultado:
 *  - `tokens: 0`            → opt-in não gravou token. Causa típica: VAPID
 *                            ausente no build, permissão negada, ou toggle de
 *                            push nunca habilitado na tela Preferências.
 *  - `success > 0`          → FCM aceitou. Banner deve aparecer (app fechado/
 *                            background; foreground é suprimido por design).
 *  - `failure > 0` + códigos → FCM rejeitou; o código por token aponta a causa
 *                            (token morto é podado automaticamente, como em prod).
 */

const PUSH_ICON = "/icons/icon-192.png";

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export async function GET(): Promise<NextResponse> {
  const authResult = await requireApprovedUser();
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { uid } = authResult.user;

  const tokens = await getUserTokens(uid);
  if (tokens.length === 0) {
    return NextResponse.json({
      ok: false,
      tokens: 0,
      reason:
        "Nenhum token FCM registrado para este usuário. Habilite o push na tela Preferências (exige VAPID no build + permissão concedida).",
    });
  }

  try {
    const messaging = getAdminMessaging();
    // `icon` é campo Web Push — NÃO existe em `notification` do FCM Admin SDK
    // (que só aceita title/body/imageUrl); colocá-lo lá faz o FCM rejeitar com
    // `messaging/invalid-argument`. Vai em `webpush.notification`, lido pelo SW.
    const notification = {
      title: "Teste de push ✅",
      body: "Se você está vendo isto, a entrega de push está funcionando.",
    };
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification,
      data: { url: "/notifications", type: "system" },
      webpush: { notification: { ...notification, icon: PUSH_ICON } },
    });

    // Diagnóstico por token: índice ↔ token (mascarado), messageId ou código de erro.
    const dead: string[] = [];
    const perToken = res.responses.map((r, i) => {
      const token = tokens[i] ?? "";
      const masked = `${token.slice(0, 12)}…${token.slice(-6)}`;
      if (r.success) return { token: masked, ok: true, messageId: r.messageId };
      const code = r.error?.code;
      if (code !== undefined && DEAD_TOKEN_CODES.has(code)) dead.push(token);
      return { token: masked, ok: false, code: code ?? "unknown", message: r.error?.message };
    });

    // Poda tokens mortos (mesma higiene do envio de produção).
    let pruned = 0;
    if (dead.length > 0) {
      await pruneTokens(dead);
      pruned = dead.length;
    }

    return NextResponse.json({
      ok: res.successCount > 0,
      tokens: tokens.length,
      success: res.successCount,
      failure: res.failureCount,
      pruned,
      perToken,
    });
  } catch (err) {
    console.error("[push/test] falha ao disparar push de teste:", err);
    return NextResponse.json(
      { ok: false, tokens: tokens.length, error: "Falha ao disparar o push de teste." },
      { status: 500 },
    );
  }
}
