import { describe, expect, it } from "vitest";

import {
  defaultPreferences,
  notificationPreferencesSchema,
} from "@/schemas/notificationPreferences";

/**
 * TASK-05: campo `pushEnabled` (master switch de push) com migração tolerante —
 * default `false` (opt-in explícito), preservando `.strict()` e os opt-outs
 * existentes dos demais campos.
 */
describe("notificationPreferencesSchema — pushEnabled (TASK-05)", () => {
  it("doc legado SEM pushEnabled → parse OK, pushEnabled=false (migração tolerante)", () => {
    const parsed = notificationPreferencesSchema.safeParse({
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pushEnabled).toBe(false);
    }
  });

  it("doc com pushEnabled=true → preserva true", () => {
    const parsed = notificationPreferencesSchema.safeParse({
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
      pushEnabled: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pushEnabled).toBe(true);
    }
  });

  it(".strict() ainda rejeita chave desconhecida", () => {
    const parsed = notificationPreferencesSchema.safeParse({
      userId: "u1",
      system: true,
      games: true,
      ranking: true,
      pushEnabled: false,
      pool: true, // legado removido / desconhecido
    });
    expect(parsed.success).toBe(false);
  });
});

describe("defaultPreferences — pushEnabled (TASK-05)", () => {
  it("default = push desligado (opt-in explícito)", () => {
    expect(defaultPreferences("u1").pushEnabled).toBe(false);
  });

  it("demais categorias seguem ligadas por default", () => {
    const d = defaultPreferences("u1");
    expect(d).toMatchObject({ system: true, games: true, ranking: true });
  });
});
