import { describe, expect, it } from "vitest";

import {
  moderationLog,
  moderationNotification,
  type ModerationContext,
} from "@/features/admin/lib/notificationFactory";

const base: ModerationContext = {
  uid: "u1",
  from: "pending",
  to: "approved",
  actorUid: "admin1",
};

describe("moderationLog", () => {
  it("aprovação (pending→approved) → user_approved/info", () => {
    const log = moderationLog(base);
    expect(log.type).toBe("user_approved");
    expect(log.targetUid).toBe("u1");
    expect(log.actorUid).toBe("admin1");
    expect(log.level).toBe("info");
  });

  it("reativação (blocked→approved) → user_unblocked", () => {
    expect(moderationLog({ ...base, from: "blocked" }).type).toBe(
      "user_unblocked",
    );
  });

  it("bloqueio (approved→blocked) → user_blocked/warning", () => {
    const log = moderationLog({ ...base, from: "approved", to: "blocked" });
    expect(log.type).toBe("user_blocked");
    expect(log.level).toBe("warning");
  });

  it("rejeição (pending→blocked) → user_blocked com mensagem de rejeição", () => {
    const log = moderationLog({ ...base, from: "pending", to: "blocked" });
    expect(log.type).toBe("user_blocked");
    expect(log.message).toContain("rejeitado");
  });
});

describe("moderationNotification", () => {
  it("aprovação → notif Sistema 'Cadastro aprovado'", () => {
    const n = moderationNotification(base);
    expect(n).not.toBeNull();
    expect(n!.type).toBe("system");
    expect(n!.userId).toBe("u1");
    expect(n!.title).toBe("Cadastro aprovado");
  });

  it("reativação → 'Conta reativada'", () => {
    expect(moderationNotification({ ...base, from: "blocked" })!.title).toBe(
      "Conta reativada",
    );
  });

  it("bloqueio de aprovado → 'Conta bloqueada'", () => {
    expect(
      moderationNotification({ ...base, from: "approved", to: "blocked" })!.title,
    ).toBe("Conta bloqueada");
  });

  it("rejeição de pendente → 'Cadastro não aprovado'", () => {
    expect(
      moderationNotification({ ...base, from: "pending", to: "blocked" })!.title,
    ).toBe("Cadastro não aprovado");
  });
});
