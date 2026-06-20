/**
 * Testes do helper de disparo `notifyRankingUps` (TASK-05).
 *
 * Regras cobertas: só-subida + baseline definida, pódio top 3, preferência
 * `ranking`, idempotência por `dateKey` (derivado de `now`) e best-effort
 * (nunca lança). `fetchPreferencesMap`/`writeNotifications` são mockados para
 * isolar a regra; `notifyRankingUp`/`shouldDeliver` rodam de verdade.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fetchPreferencesMapMock, writeNotificationsMock } = vi.hoisted(() => ({
  fetchPreferencesMapMock: vi.fn(),
  writeNotificationsMock: vi.fn(),
}));

vi.mock("@/server/notifications/preferences", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/notifications/preferences")>();
  return { ...actual, fetchPreferencesMap: fetchPreferencesMapMock };
});

vi.mock("@/server/notifications/write", () => ({
  writeNotifications: writeNotificationsMock,
}));

import { notifyRankingUps } from "@/server/notifications/ranking";
import type { RankingPositionDelta } from "@/server/rankings/recalc";
import {
  defaultPreferences,
  type NotificationPreferences,
} from "@/schemas/notificationPreferences";

const NOW = new Date("2026-06-20T18:30:00.000Z");
const DATE_KEY = "2026-06-20"; // now.toISOString().slice(0,10)

const db = {} as never; // helper não toca o db direto (delega aos mocks)

/** Map de preferências por uid; uid ausente cai no default (all-true) no helper. */
function prefsMap(entries: Array<[string, NotificationPreferences]>) {
  return new Map(entries);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchPreferencesMapMock.mockResolvedValue(prefsMap([]));
  writeNotificationsMock.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

/** Items efetivamente passados ao writeNotifications (1ª e única chamada). */
function writtenItems(): Array<Record<string, unknown>> {
  expect(writeNotificationsMock).toHaveBeenCalledTimes(1);
  return writeNotificationsMock.mock.calls[0]![1] as Array<Record<string, unknown>>;
}

describe("notifyRankingUps — filtro só-subida + baseline", () => {
  it("gera item para quem SUBIU (newPosition < previousPosition)", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([["u1", defaultPreferences("u1")]]),
    );
    const deltas: RankingPositionDelta[] = [
      { uid: "u1", previousPosition: 5, newPosition: 2 },
    ];
    await notifyRankingUps(db, deltas, NOW);
    const items = writtenItems();
    expect(items).toHaveLength(1);
    expect(items[0]!["userId"]).toBe("u1");
    expect(items[0]!["type"]).toBe("ranking");
  });

  it("NÃO gera item para quem caiu, ficou igual ou não tem baseline", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([
        ["caiu", defaultPreferences("caiu")],
        ["igual", defaultPreferences("igual")],
        ["semBase", defaultPreferences("semBase")],
      ]),
    );
    const deltas: RankingPositionDelta[] = [
      { uid: "caiu", previousPosition: 2, newPosition: 5 },
      { uid: "igual", previousPosition: 4, newPosition: 4 },
      { uid: "semBase", previousPosition: undefined, newPosition: 1 },
    ];
    await notifyRankingUps(db, deltas, NOW);
    // Nenhum elegível → não escreve (ou escreve []).
    if (writeNotificationsMock.mock.calls.length > 0) {
      expect(writtenItems()).toHaveLength(0);
    }
  });
});

describe("notifyRankingUps — pódio vs subida comum", () => {
  it("newPosition <= 3 usa copy de pódio", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([["u1", defaultPreferences("u1")]]),
    );
    await notifyRankingUps(
      db,
      [{ uid: "u1", previousPosition: 7, newPosition: 3 }],
      NOW,
    );
    const items = writtenItems();
    expect(items[0]!["title"]).toBe("Pódio!");
  });

  it("newPosition > 3 usa copy de subida comum", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([["u1", defaultPreferences("u1")]]),
    );
    await notifyRankingUps(
      db,
      [{ uid: "u1", previousPosition: 9, newPosition: 5 }],
      NOW,
    );
    const items = writtenItems();
    expect(items[0]!["title"]).toBe("Você subiu no ranking!");
  });
});

describe("notifyRankingUps — preferência ranking", () => {
  it("ranking:false → não entrega", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([["u1", { userId: "u1", system: true, games: true, ranking: false }]]),
    );
    await notifyRankingUps(
      db,
      [{ uid: "u1", previousPosition: 5, newPosition: 2 }],
      NOW,
    );
    if (writeNotificationsMock.mock.calls.length > 0) {
      expect(writtenItems()).toHaveLength(0);
    }
  });

  it("preferência ausente no map (uid não retornado) → default all-true → entrega", async () => {
    // Map VAZIO de propósito: exercita o branch undefined→default do helper, sem
    // depender do seed do fetchPreferencesMap. Spec §6: doc ausente entrega.
    fetchPreferencesMapMock.mockResolvedValue(prefsMap([]));
    await notifyRankingUps(
      db,
      [{ uid: "u1", previousPosition: 5, newPosition: 2 }],
      NOW,
    );
    expect(writtenItems()).toHaveLength(1);
  });
});

describe("notifyRankingUps — idempotência e injeção de now", () => {
  it("ID determinístico ranking-{uid}-{dateKey} com dateKey derivado de now", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([["u1", defaultPreferences("u1")]]),
    );
    await notifyRankingUps(
      db,
      [{ uid: "u1", previousPosition: 5, newPosition: 2 }],
      NOW,
    );
    const items = writtenItems();
    expect(items[0]!["id"]).toBe(`ranking-u1-${DATE_KEY}`);
    // now repassado ao write (consistência de createdAt).
    expect(writeNotificationsMock.mock.calls[0]![2]).toBe(NOW);
  });
});

describe("notifyRankingUps — best-effort", () => {
  it("erro em fetchPreferencesMap é engolido (não lança)", async () => {
    fetchPreferencesMapMock.mockRejectedValueOnce(new Error("prefs fora"));
    await expect(
      notifyRankingUps(
        db,
        [{ uid: "u1", previousPosition: 5, newPosition: 2 }],
        NOW,
      ),
    ).resolves.toBeUndefined();
  });

  it("erro em writeNotifications é engolido (não lança)", async () => {
    fetchPreferencesMapMock.mockResolvedValue(
      prefsMap([["u1", defaultPreferences("u1")]]),
    );
    writeNotificationsMock.mockRejectedValueOnce(new Error("write fora"));
    await expect(
      notifyRankingUps(
        db,
        [{ uid: "u1", previousPosition: 5, newPosition: 2 }],
        NOW,
      ),
    ).resolves.toBeUndefined();
  });

  it("deltas vazio → não chama writeNotifications (ou chama com [])", async () => {
    await notifyRankingUps(db, [], NOW);
    if (writeNotificationsMock.mock.calls.length > 0) {
      expect(writtenItems()).toHaveLength(0);
    }
  });
});
