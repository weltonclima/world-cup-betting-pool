// @vitest-environment jsdom

/**
 * Testes de `GroupSettingsForm` focados no toggle "Dividir ranking por fase" (TASK-03).
 *
 * Cobertura:
 * - Switch desligado quando splitPhaseRanking ausente/false (default OFF)
 * - Switch ligado quando splitPhaseRanking: true
 * - PATCH inclui splitPhaseRanking quando alterado
 * - PATCH não inclui splitPhaseRanking quando sem mudança
 * - Switch desabilitado durante isPending
 * - Reset ao refetch (pool muda de ON para OFF)
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useGroupSettingsMock, useUpdateGroupSettingsMock } = vi.hoisted(() => ({
  useGroupSettingsMock: vi.fn(),
  useUpdateGroupSettingsMock: vi.fn(),
}));

vi.mock("@/features/groupAdmin/hooks", () => ({
  useGroupSettings: useGroupSettingsMock,
  useUpdateGroupSettings: useUpdateGroupSettingsMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// Switch simplificado: Radix UI requer ambiente real para onCheckedChange via click.
// Mock determinístico preserva aria-checked, disabled e o callback.
vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    id,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
    id?: string;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      id={id}
      onClick={() => onCheckedChange(!checked)}
    />
  ),
}));

// fileToCompressedDataUrl usa Canvas API ausente no jsdom.
vi.mock("@/features/profile/lib/imageToDataUrl", () => ({
  fileToCompressedDataUrl: vi.fn(),
  AvatarImageError: class AvatarImageError extends Error {},
}));

import { GroupSettingsForm } from "@/features/groupAdmin/components/GroupSettingsForm";
import type { Pool } from "@/types/pools";

function makePool(overrides?: Partial<Pool>): Pool {
  return {
    id: "pool-1",
    name: "Bolão Teste",
    slug: "bolao-teste",
    status: "active",
    adminId: "uid-admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup(pool: Pool, isPending = false) {
  const mutateMock = vi.fn();
  useGroupSettingsMock.mockReturnValue({
    data: pool,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useUpdateGroupSettingsMock.mockReturnValue({
    mutate: mutateMock,
    isPending,
    isError: false,
    error: null,
  });
  const result = render(<GroupSettingsForm />);
  return { mutateMock, ...result };
}

function getSplitSwitch(): HTMLElement {
  return screen.getByRole("switch", { name: /dividir ranking por fase/i });
}

function clickSave(): void {
  fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Switch 'Dividir ranking por fase' — estado inicial", () => {
  it("renderiza desligado quando splitPhaseRanking está ausente (undefined)", () => {
    setup(makePool());
    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("renderiza desligado quando splitPhaseRanking é false", () => {
    setup(makePool({ splitPhaseRanking: false }));
    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("renderiza ligado quando splitPhaseRanking é true", () => {
    setup(makePool({ splitPhaseRanking: true }));
    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("true");
  });
});

describe("Switch 'Dividir ranking por fase' — PATCH parcial", () => {
  it("inclui splitPhaseRanking: true no PATCH ao ativar e salvar", () => {
    const { mutateMock } = setup(makePool({ splitPhaseRanking: false }));
    fireEvent.click(getSplitSwitch());
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { splitPhaseRanking: true },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("inclui splitPhaseRanking: false no PATCH ao desativar e salvar", () => {
    const { mutateMock } = setup(makePool({ splitPhaseRanking: true }));
    fireEvent.click(getSplitSwitch());
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { splitPhaseRanking: false },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("não chama mutate quando splitPhaseRanking não foi alterado (sem mudança)", () => {
    // Pool com splitPhaseRanking: false; switch não alterado → patch vazio → mutate não chamado.
    const { mutateMock } = setup(makePool({ splitPhaseRanking: false }));
    clickSave();
    expect(mutateMock).not.toHaveBeenCalled();
  });

});

describe("Switch 'Dividir ranking por fase' — estado de loading", () => {
  it("switch fica desabilitado durante update.isPending", () => {
    setup(makePool(), true);
    expect((getSplitSwitch() as HTMLButtonElement).disabled).toBe(true);
  });

  it("switch responde normalmente quando isPending é false", () => {
    setup(makePool(), false);
    expect((getSplitSwitch() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Switch 'Dividir ranking por fase' — reset ao refetch", () => {
  it("reseta para desligado quando pool refetchado tem splitPhaseRanking: false", () => {
    const { rerender } = setup(makePool({ splitPhaseRanking: true }));
    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("true");

    const mutateMock = vi.fn();
    useGroupSettingsMock.mockReturnValue({
      data: makePool({ splitPhaseRanking: false }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useUpdateGroupSettingsMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    });
    rerender(<GroupSettingsForm />);

    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("reseta para ligado quando pool refetchado tem splitPhaseRanking: true", () => {
    const { rerender } = setup(makePool({ splitPhaseRanking: false }));
    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("false");

    const mutateMock = vi.fn();
    useGroupSettingsMock.mockReturnValue({
      data: makePool({ splitPhaseRanking: true }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useUpdateGroupSettingsMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    });
    rerender(<GroupSettingsForm />);

    expect(getSplitSwitch().getAttribute("aria-checked")).toBe("true");
  });
});
