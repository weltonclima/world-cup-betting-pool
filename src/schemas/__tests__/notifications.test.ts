import { describe, expect, it } from "vitest";

import {
  notificationInputSchema,
  notificationSchema,
} from "@/schemas/notifications";
import {
  defaultPreferences,
  notificationPreferencesSchema,
} from "@/schemas/notificationPreferences";

const validNotification = {
  id: "n1",
  userId: "u1",
  type: "ranking" as const,
  title: "Ranking atualizado",
  message: "Você subiu para a posição #4",
  isRead: false,
  createdAt: "2026-06-08T12:00:00+00:00",
};

describe("notificationSchema", () => {
  it("aceita notificação válida", () => {
    expect(notificationSchema.safeParse(validNotification).success).toBe(true);
  });

  it("rejeita tipo desconhecido", () => {
    const r = notificationSchema.safeParse({ ...validNotification, type: "x" });
    expect(r.success).toBe(false);
  });

  it("rejeita campo extra (strict)", () => {
    const r = notificationSchema.safeParse({ ...validNotification, foo: 1 });
    expect(r.success).toBe(false);
  });

  it("rejeita createdAt não-ISO", () => {
    const r = notificationSchema.safeParse({
      ...validNotification,
      createdAt: "ontem",
    });
    expect(r.success).toBe(false);
  });
});

describe("notificationInputSchema", () => {
  it("aceita input sem id/isRead/createdAt", () => {
    const r = notificationInputSchema.safeParse({
      userId: "u1",
      type: "system",
      title: "Cadastro aprovado",
      message: "Bem-vindo!",
    });
    expect(r.success).toBe(true);
  });
});

describe("notificationPreferences", () => {
  it("defaultPreferences liga todas as categorias", () => {
    expect(defaultPreferences("u1")).toEqual({
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
    });
  });

  it("schema aceita preferências válidas", () => {
    expect(
      notificationPreferencesSchema.safeParse(defaultPreferences("u1")).success,
    ).toBe(true);
  });

  it("schema rejeita booleano ausente", () => {
    const r = notificationPreferencesSchema.safeParse({
      userId: "u1",
      system: true,
      games: true,
      // ranking ausente
    });
    expect(r.success).toBe(false);
  });
});
