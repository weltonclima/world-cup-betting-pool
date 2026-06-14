// @vitest-environment jsdom

/**
 * Testes de `AdminGroupInviteDialog` (TASK-05) — geração de convite pelo super_admin.
 *
 * Cobertura relevante:
 * - allowInvites=false → aviso, sem inputs de geração nem botão Gerar
 * - validação live → valores inválidos exibem erro inline e desabilitam Gerar
 * - submit válido → mutate chamado com { validityDays, maxUses } corretos
 * - pós-geração (onSuccess) → exibe link (/invite/<code>) e código via InviteValue
 * - erro de mutation → mensagem pt-BR em role="alert"
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Invite } from "@/types/invites";

const { useCreateAdminGroupInviteMock } = vi.hoisted(() => ({
  useCreateAdminGroupInviteMock: vi.fn(),
}));

vi.mock("@/features/superAdmin/hooks", () => ({
  useCreateAdminGroupInvite: useCreateAdminGroupInviteMock,
}));

import { AdminGroupInviteDialog } from "@/features/superAdmin/components/AdminGroupInviteDialog";

const INVITE: Invite = {
  id: "AB12CD",
  groupId: "pool-1",
  code: "AB12CD",
  maxUses: 100,
  usedCount: 0,
  expiresAt: "2026-07-14T00:00:00.000Z",
  isActive: true,
  createdBy: "admin-1",
  createdAt: "2026-06-14T00:00:00.000Z",
};

function stubMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

function renderDialog(props: Partial<{ allowInvites: boolean }> = {}) {
  return render(
    <AdminGroupInviteDialog
      open
      onOpenChange={vi.fn()}
      poolId="pool-1"
      poolName="Bolão da Firma"
      allowInvites={props.allowInvites ?? true}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useCreateAdminGroupInviteMock.mockReturnValue(stubMutation());
});

describe("AdminGroupInviteDialog", () => {
  it("allowInvites=false exibe aviso e oculta o formulário", () => {
    renderDialog({ allowInvites: false });

    expect(screen.getByText(/convites estão desativados/i)).toBeTruthy();
    expect(screen.queryByLabelText(/validade/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^gerar$/i })).toBeNull();
  });

  it("renderiza o formulário com defaults quando allowInvites=true", () => {
    renderDialog();

    expect((screen.getByLabelText(/validade/i) as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText(/limite de usos/i) as HTMLInputElement).value).toBe("100");
    expect(screen.getByRole("button", { name: /^gerar$/i })).toBeTruthy();
  });

  it("validade fora de 1..365 mostra erro inline e desabilita Gerar", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/validade/i), { target: { value: "400" } });

    expect(screen.getByText(/validade entre 1 e 365 dias/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^gerar$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("limite de usos < 1 desabilita Gerar", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/limite de usos/i), { target: { value: "0" } });

    expect((screen.getByRole("button", { name: /^gerar$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submit válido chama mutate com validityDays e maxUses", () => {
    const mutate = vi.fn();
    useCreateAdminGroupInviteMock.mockReturnValue(stubMutation({ mutate }));
    renderDialog();

    fireEvent.change(screen.getByLabelText(/validade/i), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/limite de usos/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /^gerar$/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ validityDays: 7, maxUses: 5 });
  });

  it("pós-geração exibe link e código do convite", () => {
    const mutate = vi.fn((_input, opts: { onSuccess: (i: Invite) => void }) => {
      opts.onSuccess(INVITE);
    });
    useCreateAdminGroupInviteMock.mockReturnValue(stubMutation({ mutate }));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /^gerar$/i }));

    expect(screen.getByText("Convite gerado")).toBeTruthy();
    // origin do jsdom + path → link completo do convite (independe da porta/host).
    expect(screen.getByText(new RegExp(`/invite/${INVITE.code}$`))).toBeTruthy();
    expect(screen.getByText(INVITE.code)).toBeTruthy();
  });

  it("erro de mutation exibe mensagem pt-BR em role=alert", () => {
    useCreateAdminGroupInviteMock.mockReturnValue(
      stubMutation({ isError: true, error: new Error("Grupo não encontrado.") }),
    );
    renderDialog();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Grupo não encontrado.");
  });
});
