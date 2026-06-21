import { describe, expect, it } from "vitest";

import {
  actionFor,
  NOTIFICATION_META,
  relativeTime,
} from "@/features/notifications/lib/notificationMeta";

describe("NOTIFICATION_META", () => {
  it("cobre as 3 categorias", () => {
    expect(Object.keys(NOTIFICATION_META).sort()).toEqual([
      "games",
      "ranking",
      "system",
    ]);
  });
});

describe("actionFor", () => {
  it("ranking → Ver Ranking", () => {
    expect(actionFor("ranking")).toEqual({
      label: "Ver Ranking",
      href: "/rankings",
    });
  });
  it("games → Ver Jogo", () => {
    expect(actionFor("games")?.href).toBe("/matches");
  });
  it("system → sem ação", () => {
    expect(actionFor("system")).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-06-08T12:00:00+00:00");

  it("hoje → HH:mm", () => {
    expect(relativeTime("2026-06-08T09:30:00+00:00", now)).toMatch(/^\d{2}:\d{2}$/);
  });
  it("ontem → 'Ontem'", () => {
    expect(relativeTime("2026-06-07T09:30:00+00:00", now)).toBe("Ontem");
  });
  it("dias atrás → sufixo relativo", () => {
    expect(relativeTime("2026-06-04T09:30:00+00:00", now)).toContain("dias");
  });
});
