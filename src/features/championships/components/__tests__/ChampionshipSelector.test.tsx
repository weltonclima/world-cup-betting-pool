// @vitest-environment jsdom

/**
 * Testes de `ChampionshipSelector` (multi-championship TASK-09).
 *
 * Segmented control (radiogroup) do campeonato ATIVO. Mockamos os dois hooks de
 * leitura (`useActiveChampionship`, `useChampionshipsCatalog`) para isolar o
 * comportamento de UI. Cobre: auto-ocultar (≤1 campeonato), render por id habilitado
 * com rótulo do catálogo (fallback = id), clique → setter, e a11y (radiogroup,
 * aria-checked, roving tabindex, setas com wraparound).
 */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActiveChampionshipMock, useChampionshipsCatalogMock } = vi.hoisted(
  () => ({
    useActiveChampionshipMock: vi.fn(),
    useChampionshipsCatalogMock: vi.fn(),
  }),
);

vi.mock("../../useActiveChampionship", () => ({
  useActiveChampionship: useActiveChampionshipMock,
}));
vi.mock("@/features/groupAdmin/hooks/useChampionshipsCatalog", () => ({
  useChampionshipsCatalog: useChampionshipsCatalogMock,
}));

import { ChampionshipSelector } from "@/features/championships/components/ChampionshipSelector";
import type { ChampionshipPublic } from "@/types/championships";

const CATALOG: ChampionshipPublic[] = [
  { id: "fifa.world", name: "Copa do Mundo FIFA", season: "2026", type: "cup", status: "archived" },
  { id: "bra.1-2026", name: "Brasileirão Série A", season: "2026", type: "league", status: "upcoming" },
];

function setActive(over?: Partial<ReturnType<typeof baseActive>>) {
  useActiveChampionshipMock.mockReturnValue({ ...baseActive(), ...over });
}

function baseActive() {
  return {
    activeChampionshipId: "fifa.world",
    enabledChampionships: ["fifa.world", "bra.1-2026"],
    rankingMode: "geral" as const,
    isMultiChampionship: true,
    isLoading: false,
    setActiveChampionship: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useChampionshipsCatalogMock.mockReturnValue({ data: CATALOG });
});

describe("auto-ocultar", () => {
  it("pool com 1 campeonato → não renderiza nada (comportamento legado)", () => {
    setActive({
      enabledChampionships: ["fifa.world"],
      isMultiChampionship: false,
    });
    const { container } = render(<ChampionshipSelector />);
    expect(container.firstChild).toBeNull();
  });
});

describe("render dos chips", () => {
  it("renderiza um radio por campeonato habilitado com rótulo do catálogo", () => {
    setActive();
    render(<ChampionshipSelector />);
    const group = screen.getByRole("radiogroup", { name: /campeonato ativo/i });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Copa do Mundo FIFA/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Brasileirão Série A/i })).toBeTruthy();
  });

  it("id fora do catálogo → rótulo cai para o próprio id", () => {
    setActive({ enabledChampionships: ["fifa.world", "des.conhecido"] });
    render(<ChampionshipSelector />);
    expect(screen.getByRole("radio", { name: "des.conhecido" })).toBeTruthy();
  });
});

describe("seleção", () => {
  it("clique num chip chama setActiveChampionship com o id", () => {
    const active = baseActive();
    useActiveChampionshipMock.mockReturnValue(active);
    render(<ChampionshipSelector />);
    fireEvent.click(screen.getByRole("radio", { name: /Brasileirão/i }));
    expect(active.setActiveChampionship).toHaveBeenCalledWith("bra.1-2026");
  });
});

describe("acessibilidade", () => {
  it("ativo tem aria-checked=true e tabindex 0; inativo -1", () => {
    setActive();
    render(<ChampionshipSelector />);
    const copa = screen.getByRole("radio", { name: /Copa do Mundo FIFA/i });
    const brasil = screen.getByRole("radio", { name: /Brasileirão/i });
    expect(copa.getAttribute("aria-checked")).toBe("true");
    expect(copa.getAttribute("tabindex")).toBe("0");
    expect(brasil.getAttribute("aria-checked")).toBe("false");
    expect(brasil.getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowRight avança a seleção para o próximo id", () => {
    const active = baseActive();
    useActiveChampionshipMock.mockReturnValue(active);
    render(<ChampionshipSelector />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /Copa do Mundo FIFA/i }), {
      key: "ArrowRight",
    });
    expect(active.setActiveChampionship).toHaveBeenCalledWith("bra.1-2026");
  });

  it("ArrowLeft no primeiro faz wraparound para o último", () => {
    const active = baseActive();
    useActiveChampionshipMock.mockReturnValue(active);
    render(<ChampionshipSelector />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /Copa do Mundo FIFA/i }), {
      key: "ArrowLeft",
    });
    expect(active.setActiveChampionship).toHaveBeenCalledWith("bra.1-2026");
  });
});
