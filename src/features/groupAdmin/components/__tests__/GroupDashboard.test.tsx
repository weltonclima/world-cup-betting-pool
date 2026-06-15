// @vitest-environment jsdom

/**
 * Testes de `GroupDashboard` focados no botão de toggle de palpites (TASK-04).
 *
 * Cobertura:
 * - Label dinâmica: "Palpite Liberado" (false/undefined) / "Palpite Bloqueado" (true)
 * - Dialog abre ao clicar no botão
 * - Mutation chamada com valor invertido ao confirmar
 * - Mutation NÃO chamada ao cancelar
 * - Botão Confirmar desabilitado durante isPending
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useGroupDashboardMock, useUpdateGroupSettingsMock } = vi.hoisted(() => ({
  useGroupDashboardMock: vi.fn(),
  useUpdateGroupSettingsMock: vi.fn(),
}));

vi.mock("@/features/groupAdmin/hooks", () => ({
  useGroupDashboard: useGroupDashboardMock,
  useUpdateGroupSettings: useUpdateGroupSettingsMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// Stub Dialog: evita problemas de compatibilidade do @base-ui/react com jsdom.
// Renderiza o conteúdo quando `open=true`; DialogClose repassa `disabled` ao elemento.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({
    render: renderProp,
    disabled,
  }: {
    render?: React.ReactElement<{ disabled?: boolean }>;
    disabled?: boolean;
  }) => (renderProp ? React.cloneElement(renderProp, { disabled }) : null),
}));

import { GroupDashboard } from "@/features/groupAdmin/components/GroupDashboard";
import type { GroupDashboard as GroupDashboardData } from "@/services/group";

function makeDashboard(predictionsLocked?: boolean): GroupDashboardData {
  return {
    pool: {
      id: "pool-1",
      name: "Bolão Teste",
      slug: "bolao-teste",
      status: "active",
      adminId: "uid-admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      predictionsLocked,
    },
    counts: { participants: 10, pending: 2, blocked: 0, activeInvites: 1 },
    recent: [],
  };
}

function renderDashboard(predictionsLocked?: boolean, isPending = false) {
  const mutateMock = vi.fn();
  useGroupDashboardMock.mockReturnValue({
    data: makeDashboard(predictionsLocked),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useUpdateGroupSettingsMock.mockReturnValue({ mutate: mutateMock, isPending });
  render(<GroupDashboard />);
  return { mutateMock };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PredictionsLockAction — label dinâmica", () => {
  it('exibe "Palpite Liberado" quando predictionsLocked é false', () => {
    renderDashboard(false);
    expect(screen.getByRole("button", { name: /palpite liberado/i })).toBeTruthy();
  });

  it('exibe "Palpite Liberado" quando predictionsLocked é undefined (default liberado)', () => {
    renderDashboard(undefined);
    expect(screen.getByRole("button", { name: /palpite liberado/i })).toBeTruthy();
  });

  it('exibe "Palpite Bloqueado" quando predictionsLocked é true', () => {
    renderDashboard(true);
    expect(screen.getByRole("button", { name: /palpite bloqueado/i })).toBeTruthy();
  });
});

describe("PredictionsLockAction — dialog de confirmação", () => {
  it("abre dialog ao clicar no botão de toggle", () => {
    renderDashboard(false);
    fireEvent.click(screen.getByRole("button", { name: /palpite liberado/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("chama mutation com { predictionsLocked: true } ao confirmar no estado liberado", () => {
    const { mutateMock } = renderDashboard(false);
    fireEvent.click(screen.getByRole("button", { name: /palpite liberado/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(mutateMock).toHaveBeenCalledWith(
      { predictionsLocked: true },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("chama mutation com { predictionsLocked: false } ao confirmar no estado bloqueado", () => {
    const { mutateMock } = renderDashboard(true);
    fireEvent.click(screen.getByRole("button", { name: /palpite bloqueado/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(mutateMock).toHaveBeenCalledWith(
      { predictionsLocked: false },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("não chama mutation ao cancelar o dialog", () => {
    const { mutateMock } = renderDashboard(false);
    fireEvent.click(screen.getByRole("button", { name: /palpite liberado/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

describe("PredictionsLockAction — estado de loading", () => {
  it("botão Confirmar fica desabilitado durante isPending", () => {
    renderDashboard(false, true);
    fireEvent.click(screen.getByRole("button", { name: /palpite liberado/i }));
    const confirmarBtn = screen.getByRole("button", { name: /confirmar/i }) as HTMLButtonElement;
    expect(confirmarBtn.disabled).toBe(true);
  });

  it("botão Cancelar fica desabilitado durante isPending", () => {
    renderDashboard(false, true);
    fireEvent.click(screen.getByRole("button", { name: /palpite liberado/i }));
    const cancelarBtn = screen.getByRole("button", { name: /cancelar/i }) as HTMLButtonElement;
    expect(cancelarBtn.disabled).toBe(true);
  });
});
