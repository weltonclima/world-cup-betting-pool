// @vitest-environment jsdom
/**
 * Testes do GroupSelector (TASK-07).
 *
 * Verifica: chips renderizados, rótulo "Grupo X", aria-pressed, callback onChange.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupSelector } from "@/features/worldcup/components/GroupSelector";

// ---------------------------------------------------------------------------
// Dados de fixture
// ---------------------------------------------------------------------------

const GROUPS = ["A", "B", "C", "D"];

describe("GroupSelector", () => {
  it("T1: renderiza um chip para cada grupo com rótulo 'Grupo X'", () => {
    render(<GroupSelector groups={GROUPS} value="A" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Grupo A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grupo B" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grupo C" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grupo D" })).toBeTruthy();
  });

  it("T2: chip ativo tem aria-pressed=true", () => {
    render(<GroupSelector groups={GROUPS} value="B" onChange={vi.fn()} />);
    const activeChip = screen.getByRole("button", { name: "Grupo B" });
    expect(activeChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("T3: chips inativos têm aria-pressed=false", () => {
    render(<GroupSelector groups={GROUPS} value="A" onChange={vi.fn()} />);
    const inactiveChip = screen.getByRole("button", { name: "Grupo B" });
    expect(inactiveChip.getAttribute("aria-pressed")).toBe("false");
  });

  it("T4: clique em chip inativo chama onChange com o id correto", async () => {
    const handleChange = vi.fn();
    render(<GroupSelector groups={GROUPS} value="A" onChange={handleChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Grupo C" }));
    expect(handleChange).toHaveBeenCalledWith("C");
  });

  it("T5: clique no chip ativo também chama onChange com o mesmo id", async () => {
    const handleChange = vi.fn();
    render(<GroupSelector groups={GROUPS} value="A" onChange={handleChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Grupo A" }));
    expect(handleChange).toHaveBeenCalledWith("A");
  });

  it("T6: renderiza exatamente o número de grupos fornecidos", () => {
    render(<GroupSelector groups={GROUPS} value="A" onChange={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(GROUPS.length);
  });

  it("T7: lista vazia não renderiza chips", () => {
    render(<GroupSelector groups={[]} value="" onChange={vi.fn()} />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });
});
