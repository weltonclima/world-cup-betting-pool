// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovedDialog } from "@/features/admin/components/ApprovedDialog";

afterEach(() => {
  vi.clearAllMocks();
});

describe("ApprovedDialog", () => {
  it("T16: exibe sucesso, botão OK fecha, sem botão Fechar", () => {
    const onOpenChange = vi.fn();
    render(
      <ApprovedDialog
        open
        onOpenChange={onOpenChange}
        userName="João da Silva"
      />,
    );

    expect(screen.getByText("Usuário aprovado!")).toBeTruthy();
    expect(screen.getByText(/João da Silva foi aprovado com sucesso/i)).toBeTruthy();
    expect(
      screen.getByText("O usuário receberá acesso imediatamente."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    // Base UI passa (open, eventDetails) — basta o 1º arg ser false.
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
