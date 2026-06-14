import { describe, expect, it } from "vitest";

import { systemLogInputSchema, systemLogSchema } from "@/schemas/systemLogs";

const validLog = {
  id: "l1",
  type: "user_approved" as const,
  actorUid: "admin1",
  targetUid: "user1",
  message: "Usuário aprovado",
  level: "info" as const,
  createdAt: "2026-06-08T12:00:00+00:00",
};

describe("systemLogSchema", () => {
  it("aceita log válido", () => {
    expect(systemLogSchema.safeParse(validLog).success).toBe(true);
  });

  it("aceita targetUid nulo", () => {
    expect(
      systemLogSchema.safeParse({ ...validLog, targetUid: null }).success,
    ).toBe(true);
  });

  it("rejeita type inválido", () => {
    expect(systemLogSchema.safeParse({ ...validLog, type: "x" }).success).toBe(
      false,
    );
  });

  it("rejeita level inválido", () => {
    expect(
      systemLogSchema.safeParse({ ...validLog, level: "debug" }).success,
    ).toBe(false);
  });

  it("aceita type 'group_admin_manual_prediction' (PRD-12)", () => {
    expect(
      systemLogSchema.safeParse({
        ...validLog,
        type: "group_admin_manual_prediction",
      }).success,
    ).toBe(true);
  });

  it("aceita type 'group_invite_created' (superadmin-invite-generator)", () => {
    expect(
      systemLogSchema.safeParse({
        ...validLog,
        type: "group_invite_created",
      }).success,
    ).toBe(true);
  });
});

describe("systemLogInputSchema", () => {
  it("aplica default level=info", () => {
    const r = systemLogInputSchema.safeParse({
      type: "login_admin",
      actorUid: "admin1",
      message: "Login admin",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.level).toBe("info");
  });
});
