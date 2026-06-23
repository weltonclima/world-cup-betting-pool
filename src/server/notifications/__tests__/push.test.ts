/**
 * Testes do envio server-side de Web Push (web-push-pwa TASK-04).
 *
 * `sendPushForNotifications(items, now)`:
 *  - gate de preferência (paridade com in-app): system sempre; games/ranking pelo toggle;
 *  - fan-out por token (multi-device), chunk ≤500 por sendEachForMulticast;
 *  - poda tokens mortos (registration-token-not-registered);
 *  - best-effort: nunca lança; sem tokens/itens elegíveis = no-op;
 *  - payload alinhado ao SW da TASK-02: notification{title,body,icon} + data{url,type}.
 *
 * Mocks: server-only, getAdminMessaging/getAdminFirestore, getUserTokens/pruneTokens,
 * fetchPreferencesMap. shouldDeliver REAL (gate de verdade). Schema real.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import type { NotificationCreate } from "@/server/notifications/factory";
import type { NotificationPreferences } from "@/schemas/notificationPreferences";

const { sendMock, getMessagingMock, getFirestoreMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getMessagingMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));
const { getUserTokensMock, pruneTokensMock } = vi.hoisted(() => ({
  getUserTokensMock: vi.fn(),
  pruneTokensMock: vi.fn(),
}));
const { fetchPreferencesMapMock } = vi.hoisted(() => ({
  fetchPreferencesMapMock: vi.fn(),
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminMessaging: getMessagingMock,
  getAdminFirestore: getFirestoreMock,
}));
vi.mock("@/server/notifications/tokens", () => ({
  getUserTokens: getUserTokensMock,
  pruneTokens: pruneTokensMock,
}));
vi.mock("@/server/notifications/preferences", async (orig) => ({
  ...(await orig<typeof import("@/server/notifications/preferences")>()),
  fetchPreferencesMap: fetchPreferencesMapMock,
}));

import { sendPushForNotifications } from "@/server/notifications/push";

const NOW = new Date("2026-06-20T15:00:00.000Z");
const DEAD = "messaging/registration-token-not-registered";

function item(over: Partial<NotificationCreate> = {}): NotificationCreate {
  return { userId: "u1", type: "games", title: "t", message: "m", ...over };
}

function prefs(over: Partial<NotificationPreferences> = {}): NotificationPreferences {
  // TASK-05: push exige `pushEnabled` (master switch). Default true nos fixtures
  // para exercitar fan-out/poda/payload; o gate de master é testado à parte.
  return {
    userId: "u1",
    system: true,
    games: true,
    ranking: true,
    pushEnabled: true,
    ...over,
  };
}

/** BatchResponse onde cada token do índice i tem sucesso, salvo os em `deadIdx`. */
function batchResponse(count: number, deadIdx: number[] = []) {
  const responses = Array.from({ length: count }, (_, i) =>
    deadIdx.includes(i)
      ? { success: false, error: { code: DEAD } }
      : { success: true, messageId: `m-${i}` },
  );
  return {
    responses,
    successCount: responses.filter((r) => r.success).length,
    failureCount: responses.filter((r) => !r.success).length,
  };
}

/** Configura prefs por uid e tokens por uid. */
function setup(opts: {
  prefsByUid?: Record<string, NotificationPreferences>;
  tokensByUid?: Record<string, string[]>;
}) {
  const map = new Map<string, NotificationPreferences>(
    Object.entries(opts.prefsByUid ?? { u1: prefs() }),
  );
  fetchPreferencesMapMock.mockResolvedValue(map);
  getUserTokensMock.mockImplementation(async (uid: string) =>
    (opts.tokensByUid ?? { u1: ["t1"] })[uid] ?? [],
  );
  getMessagingMock.mockReturnValue({ sendEachForMulticast: sendMock });
  getFirestoreMock.mockReturnValue({});
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue(batchResponse(1));
  pruneTokensMock.mockResolvedValue(undefined);
});

describe("sendPushForNotifications — gate de preferência", () => {
  it("games com toggle off → não envia", async () => {
    setup({ prefsByUid: { u1: prefs({ games: false }) }, tokensByUid: { u1: ["t1"] } });
    await sendPushForNotifications([item({ type: "games" })], NOW);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("ranking com toggle off → não envia; on → envia", async () => {
    setup({ prefsByUid: { u1: prefs({ ranking: false }) }, tokensByUid: { u1: ["t1"] } });
    await sendPushForNotifications([item({ type: "ranking" })], NOW);
    expect(sendMock).not.toHaveBeenCalled();

    setup({ prefsByUid: { u1: prefs({ ranking: true }) }, tokensByUid: { u1: ["t1"] } });
    await sendPushForNotifications([item({ type: "ranking" })], NOW);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("system com push ligado envia (ignora toggle system; gated só pelo master)", async () => {
    setup({
      prefsByUid: { u1: prefs({ system: false, games: false, ranking: false }) },
      tokensByUid: { u1: ["t1"] },
    });
    await sendPushForNotifications([item({ type: "system" })], NOW);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("pushEnabled=false → não envia NENHUM tipo (master switch desligado)", async () => {
    setup({
      prefsByUid: { u1: prefs({ pushEnabled: false }) },
      tokensByUid: { u1: ["t1"] },
    });
    await sendPushForNotifications(
      [item({ type: "system" }), item({ type: "games" }), item({ type: "ranking" })],
      NOW,
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("sendPushForNotifications — fan-out por dispositivo", () => {
  it("uid com N tokens → multicast com os N tokens", async () => {
    setup({ tokensByUid: { u1: ["t1", "t2", "t3"] } });
    sendMock.mockResolvedValue(batchResponse(3));
    await sendPushForNotifications([item()], NOW);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]![0].tokens).toEqual(["t1", "t2", "t3"]);
  });

  it(">500 tokens → chunked em ≥2 chamadas (≤500 cada)", async () => {
    const many = Array.from({ length: 600 }, (_, i) => `t${i}`);
    setup({ tokensByUid: { u1: many } });
    sendMock
      .mockResolvedValueOnce(batchResponse(500))
      .mockResolvedValueOnce(batchResponse(100));
    await sendPushForNotifications([item()], NOW);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0]![0].tokens).toHaveLength(500);
    expect(sendMock.mock.calls[1]![0].tokens).toHaveLength(100);
  });

  it("uid sem tokens → não chama o Messaging (no-op)", async () => {
    setup({ tokensByUid: { u1: [] } });
    await sendPushForNotifications([item()], NOW);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("sendPushForNotifications — poda de tokens mortos", () => {
  it("token com registration-token-not-registered → prunado pelo índice", async () => {
    setup({ tokensByUid: { u1: ["t1", "t2", "t3"] } });
    sendMock.mockResolvedValue(batchResponse(3, [1])); // t2 morto
    const stats = await sendPushForNotifications([item()], NOW);
    expect(pruneTokensMock).toHaveBeenCalledWith(["t2"]);
    expect(stats.pruned).toBe(1);
  });

  it("todos sucesso → não poda", async () => {
    setup({ tokensByUid: { u1: ["t1", "t2"] } });
    sendMock.mockResolvedValue(batchResponse(2));
    await sendPushForNotifications([item()], NOW);
    expect(pruneTokensMock).not.toHaveBeenCalled();
  });

  it("erro transitório (não dead-token) → não poda", async () => {
    setup({ tokensByUid: { u1: ["t1"] } });
    sendMock.mockResolvedValue({
      responses: [{ success: false, error: { code: "messaging/internal-error" } }],
      successCount: 0,
      failureCount: 1,
    });
    await sendPushForNotifications([item()], NOW);
    expect(pruneTokensMock).not.toHaveBeenCalled();
  });
});

describe("sendPushForNotifications — best-effort", () => {
  it("Messaging lança → resolve sem lançar (não propaga)", async () => {
    setup({ tokensByUid: { u1: ["t1"] } });
    sendMock.mockRejectedValue(new Error("fcm down"));
    await expect(sendPushForNotifications([item()], NOW)).resolves.toBeDefined();
  });

  it("fetchPreferencesMap lança → resolve sem lançar", async () => {
    setup({ tokensByUid: { u1: ["t1"] } });
    fetchPreferencesMapMock.mockRejectedValue(new Error("firestore down"));
    await expect(sendPushForNotifications([item()], NOW)).resolves.toBeDefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("lista de items vazia → no-op (sem leitura de prefs/tokens)", async () => {
    setup({});
    await sendPushForNotifications([], NOW);
    expect(fetchPreferencesMapMock).not.toHaveBeenCalled();
    expect(getUserTokensMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("sendPushForNotifications — agrupamento e payload", () => {
  it("items de uids diferentes → 1 leitura de tokens por uid", async () => {
    setup({
      prefsByUid: { u1: prefs({ userId: "u1" }), u2: prefs({ userId: "u2" }) },
      tokensByUid: { u1: ["t1"], u2: ["t2"] },
    });
    await sendPushForNotifications(
      [item({ userId: "u1" }), item({ userId: "u1" }), item({ userId: "u2" })],
      NOW,
    );
    expect(getUserTokensMock).toHaveBeenCalledTimes(2);
    expect(getUserTokensMock).toHaveBeenCalledWith("u1");
    expect(getUserTokensMock).toHaveBeenCalledWith("u2");
  });

  it("payload: notification{title,body}, data{url,type} conforme contrato do SW", async () => {
    setup({ tokensByUid: { u1: ["t1"] } });
    await sendPushForNotifications(
      [item({ type: "ranking", title: "Pódio!", message: "1º lugar" })],
      NOW,
    );
    const msg = sendMock.mock.calls[0]![0];
    expect(msg.notification).toMatchObject({ title: "Pódio!", body: "1º lugar" });
    expect(msg.data).toMatchObject({ url: "/rankings", type: "ranking" });
    // `icon` é campo Web Push: vai em webpush.notification, NUNCA no notification
    // top-level (o FCM Admin SDK rejeita com messaging/invalid-argument).
    expect(msg.notification).not.toHaveProperty("icon");
    expect(msg.webpush.notification).toMatchObject({
      title: "Pódio!",
      body: "1º lugar",
      icon: expect.stringContaining("/icons/"),
    });
  });

  it("mapa type→url: games/system→/notifications, ranking→/rankings", async () => {
    setup({ tokensByUid: { u1: ["t1"] } });
    await sendPushForNotifications([item({ type: "games" })], NOW);
    expect(sendMock.mock.calls[0]![0].data.url).toBe("/notifications");

    setup({ tokensByUid: { u1: ["t1"] } });
    await sendPushForNotifications([item({ type: "system" })], NOW);
    expect(sendMock.mock.calls[0]![0].data.url).toBe("/notifications");
  });
});
