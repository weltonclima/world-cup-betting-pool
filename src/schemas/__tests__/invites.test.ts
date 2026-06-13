import { describe, expect, it } from "vitest";

import {
  inviteCodeSchema,
  inviteSchema,
  MAX_INVITE_LABEL_LENGTH,
  MAX_INVITE_MAX_USES,
} from "@/schemas/invites";

const valid = {
  id: "ABC123",
  groupId: "pool-1",
  code: "ABC123",
  maxUses: 10,
  usedCount: 0,
  expiresAt: "2099-01-01T00:00:00Z",
  isActive: true,
  createdBy: "uid-admin",
  createdAt: "2026-06-01T00:00:00Z",
} as const;

describe("invites › inviteCodeSchema", () => {
  it("aceita 6 chars maiúsculos alfanuméricos", () => {
    for (const code of ["ABC123", "XYZ789", "AAAAAA"]) {
      expect(inviteCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("rejeita menos de 6 chars", () => {
    expect(inviteCodeSchema.safeParse("AB123").success).toBe(false);
  });

  it("rejeita mais de 6 chars", () => {
    expect(inviteCodeSchema.safeParse("ABC1234").success).toBe(false);
  });

  it("rejeita minúsculas", () => {
    expect(inviteCodeSchema.safeParse("abc123").success).toBe(false);
  });

  it("rejeita caracteres especiais", () => {
    expect(inviteCodeSchema.safeParse("ABC-23").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABC 23").success).toBe(false);
  });

  it("rejeita vazio", () => {
    expect(inviteCodeSchema.safeParse("").success).toBe(false);
  });
});

describe("invites › inviteSchema", () => {
  it("faz parse de um convite válido mínimo", () => {
    expect(inviteSchema.safeParse(valid).success).toBe(true);
  });

  it("faz parse com label opcional presente", () => {
    expect(inviteSchema.safeParse({ ...valid, label: "Link principal" }).success).toBe(true);
  });

  it("rejeita label acima do limite", () => {
    expect(
      inviteSchema.safeParse({ ...valid, label: "a".repeat(MAX_INVITE_LABEL_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it("rejeita maxUses acima do limite", () => {
    expect(
      inviteSchema.safeParse({ ...valid, maxUses: MAX_INVITE_MAX_USES + 1 }).success,
    ).toBe(false);
  });

  it("rejeita maxUses menor que 1", () => {
    expect(inviteSchema.safeParse({ ...valid, maxUses: 0 }).success).toBe(false);
  });

  it("rejeita usedCount negativo", () => {
    expect(inviteSchema.safeParse({ ...valid, usedCount: -1 }).success).toBe(false);
  });

  it("refine: rejeita usedCount > maxUses", () => {
    expect(
      inviteSchema.safeParse({ ...valid, maxUses: 5, usedCount: 6 }).success,
    ).toBe(false);
  });

  it("rejeita code fora do formato canônico", () => {
    expect(inviteSchema.safeParse({ ...valid, code: "abc123" }).success).toBe(false);
  });

  it("rejeita expiresAt não-ISO", () => {
    expect(inviteSchema.safeParse({ ...valid, expiresAt: "ontem" }).success).toBe(false);
  });

  it("rejeita campo extra (.strict)", () => {
    expect(inviteSchema.safeParse({ ...valid, campoNovo: "x" }).success).toBe(false);
  });

  it("strip() descarta campos extras e faz parse com sucesso (regressão TASK-01 — resolveInvite no Firestore)", () => {
    // Docs Firestore podem ter campos adicionais de versões anteriores do schema;
    // .strip() na leitura garante que o parse não rejeita por campos desconhecidos.
    const result = inviteSchema.strip().safeParse({ ...valid, campoLegado: "ignorar" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("campoLegado");
      expect(result.data.code).toBe(valid.code);
    }
  });

  it("strip() preserva o refine de usedCount > maxUses mesmo com campos extras", () => {
    const result = inviteSchema.strip().safeParse({
      ...valid,
      maxUses: 3,
      usedCount: 5,
      campoExtra: "ignorar",
    });
    expect(result.success).toBe(false);
  });
});
