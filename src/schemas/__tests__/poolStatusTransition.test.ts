/**
 * Testes TDD (red-first) das transições de status de pool (TASK-05).
 * Espelha userStatusTransition. Matriz permitida:
 *   pending → active, blocked
 *   active  → blocked
 *   blocked → active
 */

import { describe, expect, it } from "vitest";

import { canTransitionPool } from "@/schemas/poolStatusTransition";

describe("canTransitionPool", () => {
  it("permite pending → active", () => {
    expect(canTransitionPool("pending", "active")).toBe(true);
  });
  it("permite pending → blocked", () => {
    expect(canTransitionPool("pending", "blocked")).toBe(true);
  });
  it("permite active → blocked", () => {
    expect(canTransitionPool("active", "blocked")).toBe(true);
  });
  it("permite blocked → active", () => {
    expect(canTransitionPool("blocked", "active")).toBe(true);
  });

  it("nega active → pending", () => {
    expect(canTransitionPool("active", "pending")).toBe(false);
  });
  it("nega active → active (no-op não é transição)", () => {
    expect(canTransitionPool("active", "active")).toBe(false);
  });
  it("nega blocked → pending", () => {
    expect(canTransitionPool("blocked", "pending")).toBe(false);
  });
  it("nega pending → pending", () => {
    expect(canTransitionPool("pending", "pending")).toBe(false);
  });
});
