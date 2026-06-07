// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";

function setup(overrides: { pending?: boolean } = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title="Rejeitar usuário?"
      description="João será bloqueado."
      confirmLabel="Rejeitar"
      confirmVariant="destructive"
      pending={overrides.pending ?? false}
      onConfirm={onConfirm}
    />,
  );
  return { onOpenChange, onConfirm };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ConfirmActionDialog", () => {
  it("T15: dialog acessível (role/nome) com título e descrição", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Rejeitar usuário?" });
    expect(dialog).toBeTruthy();
    expect(screen.getByText("João será bloqueado.")).toBeTruthy();
  });

  it("T14a: pending=false → Cancelar habilitado fecha; confirmar dispara onConfirm", () => {
    const { onOpenChange, onConfirm } = setup({ pending: false });

    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelar);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("T14b: pending=true → Cancelar disabled, sem botão Fechar, confirmar aria-busy", () => {
    setup({ pending: true });

    expect(
      screen.getByRole("button", { name: "Cancelar" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Rejeitar" })
        .getAttribute("aria-busy"),
    ).toBe("true");
  });
});
