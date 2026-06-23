/**
 * Testes do Route Handler GET /api/push/test — endpoint de DIAGNÓSTICO de push.
 *
 * Dispara push de teste aos tokens do PRÓPRIO usuário, bypassando o gate de
 * preferência (isola a cadeia de entrega VAPID→token→FCM→SW). Gate sessão→
 * approved via requireApprovedUser. `uid` SEMPRE da sessão (getUserTokens(uid)).
 * Poda token morto como o envio de produção. Best-effort: erro → 500.
 *
 * Mocks: server-only, requireApprovedUser, getAdminMessaging, tokens helpers.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const {
  requireApprovedUserMock,
  getMessagingMock,
  getUserTokensMock,
  pruneTokensMock,
  sendEachForMulticastMock,
} = vi.hoisted(() => ({
  requireApprovedUserMock: vi.fn(),
  getMessagingMock: vi.fn(),
  getUserTokensMock: vi.fn(),
  pruneTokensMock: vi.fn(),
  sendEachForMulticastMock: vi.fn(),
}));

vi.mock("@/server/auth/requireApprovedUser", () => ({
  requireApprovedUser: requireApprovedUserMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminMessaging: getMessagingMock }));
vi.mock("@/server/notifications/tokens", () => ({
  getUserTokens: getUserTokensMock,
  pruneTokens: pruneTokensMock,
}));

import { GET } from "@/app/api/push/test/route";

const UID = "uid-1";
const TOKEN_A = "fcm-token-aaaaaaaaaaaa-1111-tailAAA";
const TOKEN_B = "fcm-token-bbbbbbbbbbbb-2222-tailBBB";

beforeEach(() => {
  vi.clearAllMocks();
  requireApprovedUserMock.mockResolvedValue({
    user: { uid: UID, email: "a@x.com", nickname: "a" },
  });
  getMessagingMock.mockReturnValue({ sendEachForMulticast: sendEachForMulticastMock });
  pruneTokensMock.mockResolvedValue(undefined);
});

describe("GET /api/push/test", () => {
  it("401 quando sem sessão — não toca FCM", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getUserTokensMock).not.toHaveBeenCalled();
    expect(sendEachForMulticastMock).not.toHaveBeenCalled();
  });

  it("403 quando usuário não-approved", async () => {
    requireApprovedUserMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(sendEachForMulticastMock).not.toHaveBeenCalled();
  });

  it("usa o uid da sessão para ler tokens (escopo ao dono)", async () => {
    getUserTokensMock.mockResolvedValue([]);
    await GET();
    expect(getUserTokensMock).toHaveBeenCalledWith(UID);
  });

  it("tokens=0: ok:false com reason e NÃO dispara FCM", async () => {
    getUserTokensMock.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false);
    expect(body["tokens"]).toBe(0);
    expect(typeof body["reason"]).toBe("string");
    expect(sendEachForMulticastMock).not.toHaveBeenCalled();
  });

  it("sucesso: envia aos tokens do usuário e reporta success + perToken mascarado", async () => {
    getUserTokensMock.mockResolvedValue([TOKEN_A, TOKEN_B]);
    sendEachForMulticastMock.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [
        { success: true, messageId: "msg-a" },
        { success: true, messageId: "msg-b" },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);

    // Endereçou exatamente os tokens do usuário com payload de teste válido.
    const arg = sendEachForMulticastMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg["tokens"]).toEqual([TOKEN_A, TOKEN_B]);
    const data = arg["data"] as Record<string, unknown>;
    expect(data["type"]).toBe("system");
    expect(data["url"]).toBe("/notifications");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
    expect(body["tokens"]).toBe(2);
    expect(body["success"]).toBe(2);
    expect(body["failure"]).toBe(0);
    expect(body["pruned"]).toBe(0);

    // perToken não vaza o token cru (mascarado) e carrega messageId no sucesso.
    const perToken = body["perToken"] as Array<Record<string, unknown>>;
    expect(perToken).toHaveLength(2);
    expect(perToken[0]!["ok"]).toBe(true);
    expect(perToken[0]!["messageId"]).toBe("msg-a");
    expect(perToken[0]!["token"]).not.toBe(TOKEN_A);
    expect(String(perToken[0]!["token"])).toContain("…");
    expect(pruneTokensMock).not.toHaveBeenCalled();
  });

  it("token morto: poda só os mortos e reporta código + pruned", async () => {
    getUserTokensMock.mockResolvedValue([TOKEN_A, TOKEN_B]);
    sendEachForMulticastMock.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true, messageId: "msg-a" },
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered", message: "gone" },
        },
      ],
    });

    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;

    expect(body["ok"]).toBe(true); // teve ao menos 1 sucesso
    expect(body["success"]).toBe(1);
    expect(body["failure"]).toBe(1);
    expect(body["pruned"]).toBe(1);

    // Poda APENAS o token morto (cru), não o que entregou.
    expect(pruneTokensMock).toHaveBeenCalledWith([TOKEN_B]);

    const perToken = body["perToken"] as Array<Record<string, unknown>>;
    expect(perToken[1]!["ok"]).toBe(false);
    expect(perToken[1]!["code"]).toBe("messaging/registration-token-not-registered");
  });

  it("falha sem código de token morto: reporta failure, NÃO poda", async () => {
    getUserTokensMock.mockResolvedValue([TOKEN_A]);
    sendEachForMulticastMock.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [
        { success: false, error: { code: "messaging/internal-error", message: "boom" } },
      ],
    });

    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false); // 0 sucessos
    expect(body["pruned"]).toBe(0);
    expect(pruneTokensMock).not.toHaveBeenCalled();
    const perToken = body["perToken"] as Array<Record<string, unknown>>;
    expect(perToken[0]!["code"]).toBe("messaging/internal-error");
  });

  it("500 quando o envio FCM lança (best-effort, não vaza detalhe)", async () => {
    getUserTokensMock.mockResolvedValue([TOKEN_A]);
    sendEachForMulticastMock.mockRejectedValue(new Error("fcm down"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false);
    expect(String(body["error"] ?? "")).not.toContain("fcm down");
  });
});
