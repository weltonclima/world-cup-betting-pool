import { describe, expect, it } from "vitest";

import {
  canTransition,
  statusTransitionSchema,
} from "@/schemas/userStatusTransition";

// TASK-02 (PRD-01.2): schema de transição de status.
// Transições permitidas (A1 rejeitar=blocked, A5 desbloquear):
//   pending→approved, pending→blocked, approved→blocked, blocked→approved.

describe("statusTransitionSchema — transições válidas", () => {
  const valid = [
    ["pending", "approved"],
    ["pending", "blocked"],
    ["approved", "blocked"],
    ["blocked", "approved"],
  ] as const;

  it.each(valid)("T1: %s→%s é aceita", (from, to) => {
    expect(statusTransitionSchema.safeParse({ from, to }).success).toBe(true);
  });
});

describe("statusTransitionSchema — transições inválidas", () => {
  const invalid = [
    ["approved", "pending"],
    ["blocked", "pending"],
    ["approved", "approved"],
    ["pending", "pending"],
    ["blocked", "blocked"],
  ] as const;

  it.each(invalid)("T2: %s→%s é rejeitada", (from, to) => {
    expect(statusTransitionSchema.safeParse({ from, to }).success).toBe(false);
  });

  it("T3: status fora do enum é rejeitado", () => {
    expect(
      statusTransitionSchema.safeParse({ from: "deleted", to: "approved" })
        .success,
    ).toBe(false);
  });
});

describe("canTransition", () => {
  it("T4: espelha o safeParse para casos válidos e inválidos", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("blocked", "approved")).toBe(true);
    expect(canTransition("approved", "pending")).toBe(false);
    expect(canTransition("pending", "pending")).toBe(false);
  });
});
