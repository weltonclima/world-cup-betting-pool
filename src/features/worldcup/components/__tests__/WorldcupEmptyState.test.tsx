// @vitest-environment jsdom
/**
 * Testes do WorldcupEmptyState (TASK-07).
 *
 * Verifica: mensagem default exata do PRD, message customizada, role="status".
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorldcupEmptyState } from "@/features/worldcup/components/WorldcupEmptyState";

describe("WorldcupEmptyState", () => {
  it("T1: exibe mensagem default exata 'Nenhuma informação disponível.'", () => {
    render(<WorldcupEmptyState />);
    expect(screen.getByText("Nenhuma informação disponível.")).toBeTruthy();
  });

  it("T2: aceita message customizada", () => {
    render(<WorldcupEmptyState message="Sem grupos disponíveis." />);
    expect(screen.getByText("Sem grupos disponíveis.")).toBeTruthy();
  });

  it("T3: tem role='status'", () => {
    render(<WorldcupEmptyState />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("T4: não exibe a mensagem default quando message customizada fornecida", () => {
    render(<WorldcupEmptyState message="Sem grupos disponíveis." />);
    expect(screen.queryByText("Nenhuma informação disponível.")).toBeNull();
  });
});
