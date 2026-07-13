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
  validateLogoInput: vi.fn(),
  AvatarImageError: class AvatarImageError extends Error {},
}));

// ImageCropModal usa Canvas/Pointer — mock leve que expõe confirm/cancel.
vi.mock("@/components/media/ImageCropModal", () => ({
  ImageCropModal: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: (d: string) => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Ajustar logo">
        <button type="button" onClick={() => onConfirm("data:image/jpeg;base64,LOGO")}>
          mock-confirm-crop
        </button>
        <button type="button" onClick={onCancel}>
          mock-cancel-crop
        </button>
      </div>
    ) : null,
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

function getOvertimeSwitch(): HTMLElement {
  return screen.getByRole("switch", { name: /ignorar gols da prorrogação/i });
}

function clickSave(): void {
  fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
}

function getLogoButton(): HTMLElement {
  return screen.getByRole("button", { name: /alterar logo/i });
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

describe("Switch 'Ignorar gols da prorrogação' — estado inicial", () => {
  it("renderiza desligado quando ignoreOvertimeGoals está ausente (undefined)", () => {
    setup(makePool());
    expect(getOvertimeSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("renderiza desligado quando ignoreOvertimeGoals é false", () => {
    setup(makePool({ ignoreOvertimeGoals: false }));
    expect(getOvertimeSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("renderiza ligado quando ignoreOvertimeGoals é true", () => {
    setup(makePool({ ignoreOvertimeGoals: true }));
    expect(getOvertimeSwitch().getAttribute("aria-checked")).toBe("true");
  });
});

describe("Switch 'Ignorar gols da prorrogação' — PATCH parcial", () => {
  it("inclui ignoreOvertimeGoals: true no PATCH ao ativar e salvar", () => {
    const { mutateMock } = setup(makePool({ ignoreOvertimeGoals: false }));
    fireEvent.click(getOvertimeSwitch());
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { ignoreOvertimeGoals: true },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("inclui ignoreOvertimeGoals: false no PATCH ao desativar e salvar", () => {
    const { mutateMock } = setup(makePool({ ignoreOvertimeGoals: true }));
    fireEvent.click(getOvertimeSwitch());
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { ignoreOvertimeGoals: false },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("não chama mutate quando ignoreOvertimeGoals não foi alterado", () => {
    const { mutateMock } = setup(makePool({ ignoreOvertimeGoals: false }));
    clickSave();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

describe("Switch 'Ignorar gols da prorrogação' — loading", () => {
  it("switch fica desabilitado durante update.isPending", () => {
    setup(makePool(), true);
    expect((getOvertimeSwitch() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Seção 'Logo do Grupo' (TASK-01 personalizacao-grupo)", () => {
  it("mostra o botão 'Alterar logo'", () => {
    setup(makePool());
    expect(getLogoButton()).toBeTruthy();
  });

  it("renderiza o preview quando o pool tem logoBase64", () => {
    setup(makePool({ logoBase64: "data:image/jpeg;base64,/9j/EXISTENTE" }));
    const img = screen.getByAltText("Logo do grupo") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("data:image/jpeg;base64,/9j/EXISTENTE");
  });

  it("não renderiza preview quando o pool não tem logo", () => {
    setup(makePool());
    expect(screen.queryByAltText("Logo do grupo")).toBeNull();
  });

  it("confirmar o crop inclui logoBase64 no PATCH ao salvar", () => {
    const { mutateMock } = setup(makePool());
    // Abre o modal (mock) selecionando um arquivo válido.
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="webp"]');
    expect(input).toBeTruthy();
    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(input!, { target: { files: [file] } });
    // Modal aberto → confirma o crop (mock devolve data URL).
    fireEvent.click(screen.getByRole("button", { name: /mock-confirm-crop/i }));
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { logoBase64: "data:image/jpeg;base64,LOGO" },
      expect.any(Object),
    );
  });
});

describe("Seção 'Cores do Grupo' (TASK-02 personalizacao-grupo)", () => {
  function getColorLight(): HTMLInputElement {
    return screen.getByLabelText("Tema claro — seletor visual") as HTMLInputElement;
  }
  function getColorDark(): HTMLInputElement {
    return screen.getByLabelText("Tema escuro — seletor visual") as HTMLInputElement;
  }
  function getHexLight(): HTMLInputElement {
    return screen.getByLabelText("Tema claro — código hexadecimal") as HTMLInputElement;
  }

  it("renderiza os 2 seletores; fallback #000000 quando ausentes", () => {
    setup(makePool());
    expect(getColorLight().value).toBe("#000000");
    expect(getColorDark().value).toBe("#000000");
  });

  it("reflete as cores do pool quando presentes (picker + hex)", () => {
    setup(makePool({ primaryColorLight: "#1a2b3c", primaryColorDark: "#abcdef" }));
    expect(getColorLight().value).toBe("#1a2b3c");
    expect(getColorDark().value).toBe("#abcdef");
    expect(getHexLight().value).toBe("#1a2b3c");
  });

  it("mudar a cor do claro pelo picker inclui só primaryColorLight no PATCH", () => {
    const { mutateMock } = setup(makePool({ primaryColorLight: "#111111" }));
    fireEvent.change(getColorLight(), { target: { value: "#22ff88" } });
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { primaryColorLight: "#22ff88" },
      expect.any(Object),
    );
  });

  it("digitar um HEX válido no campo de texto atualiza a cor", () => {
    const { mutateMock } = setup(makePool({ primaryColorLight: "#111111" }));
    fireEvent.change(getHexLight(), { target: { value: "#3B82F6" } });
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { primaryColorLight: "#3B82F6" },
      expect.any(Object),
    );
  });

  it("HEX inválido mostra erro e não persiste", () => {
    const { mutateMock } = setup(makePool({ primaryColorLight: "#111111" }));
    fireEvent.change(getHexLight(), { target: { value: "#12" } });
    expect(screen.getByText(/formato #RRGGBB/i)).toBeTruthy();
    clickSave();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("prefixa '#' automaticamente ao digitar sem o cerquilha", () => {
    const { mutateMock } = setup(makePool({ primaryColorLight: "#111111" }));
    fireEvent.change(getHexLight(), { target: { value: "ff8800" } });
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { primaryColorLight: "#ff8800" },
      expect.any(Object),
    );
  });

  it("clicar num swatch da paleta define a cor", () => {
    const { mutateMock } = setup(makePool({ primaryColorLight: "#111111" }));
    // O swatch tem aria-label = o próprio hex; pega o do tema claro (1ª ocorrência).
    fireEvent.click(screen.getAllByRole("button", { name: "#2563eb" })[0]!);
    clickSave();
    expect(mutateMock).toHaveBeenCalledWith(
      { primaryColorLight: "#2563eb" },
      expect.any(Object),
    );
  });

  it("não chama mutate quando as cores não mudam", () => {
    const { mutateMock } = setup(
      makePool({ primaryColorLight: "#111111", primaryColorDark: "#222222" }),
    );
    clickSave();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
