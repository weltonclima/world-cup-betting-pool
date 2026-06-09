import { describe, expect, it } from "vitest";

import { paginate } from "@/features/rankings/lib";

const items = Array.from({ length: 45 }, (_, i) => i + 1);

describe("paginate", () => {
  it("fatia 20 por página", () => {
    const r = paginate(items, 1, 20);
    expect(r.items).toHaveLength(20);
    expect(r.items[0]).toBe(1);
    expect(r.totalPages).toBe(3);
  });

  it("segunda página continua do item 21", () => {
    expect(paginate(items, 2, 20).items[0]).toBe(21);
  });

  it("última página traz o resto", () => {
    const r = paginate(items, 3, 20);
    expect(r.items).toHaveLength(5);
    expect(r.page).toBe(3);
  });

  it("clampa página acima do total", () => {
    expect(paginate(items, 99, 20).page).toBe(3);
  });

  it("clampa página abaixo de 1", () => {
    expect(paginate(items, 0, 20).page).toBe(1);
  });

  it("lista vazia → 1 página, items vazio", () => {
    const r = paginate([], 1, 20);
    expect(r.items).toHaveLength(0);
    expect(r.totalPages).toBe(1);
  });
});
