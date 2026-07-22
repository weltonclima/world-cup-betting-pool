// @vitest-environment jsdom

/**
 * Testes de `ActiveChampionshipProvider` (multi-championship TASK-09).
 *
 * Resolução do campeonato ATIVO a partir de `?championship=` contra o conjunto
 * habilitado do pool. Mockamos `next/navigation` (URL como estado) e
 * `usePoolChampionships` (leitura do pool). Cobre a cadeia de resolução:
 *  1. param válido → usa o param;
 *  2. param inválido/ausente → primeiro habilitado (ordem do catálogo);
 *  3. pool vazio/erro → DEFAULT_CHAMPIONSHIP_ID (Copa legado);
 * mais `isMultiChampionship` e o setter reescrevendo a URL sem perder outros params.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, useSearchParamsMock, usePoolChampionshipsMock } = vi.hoisted(
  () => ({
    replaceMock: vi.fn(),
    useSearchParamsMock: vi.fn(),
    usePoolChampionshipsMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/matches",
  useSearchParams: useSearchParamsMock,
}));
vi.mock("../usePoolChampionships", () => ({
  usePoolChampionships: usePoolChampionshipsMock,
}));

import { ActiveChampionshipProvider } from "@/features/championships/ActiveChampionshipProvider";
import { useActiveChampionship } from "@/features/championships/useActiveChampionship";

/** Consumidor que projeta o contexto em atributos data-* para asserção. */
function Probe(): React.JSX.Element {
  const {
    activeChampionshipId,
    isMultiChampionship,
    hasActiveChampionship,
    rankingMode,
    setActiveChampionship,
  } = useActiveChampionship();
  return (
    <button
      data-active={activeChampionshipId}
      data-multi={String(isMultiChampionship)}
      data-hasactive={String(hasActiveChampionship)}
      data-mode={rankingMode}
      onClick={() => setActiveChampionship("bra.1-2026")}
    >
      probe
    </button>
  );
}

function setUrl(query: string): void {
  useSearchParamsMock.mockReturnValue(new URLSearchParams(query));
}

function setPool(data: unknown, isLoading = false): void {
  usePoolChampionshipsMock.mockReturnValue({ data, isLoading });
}

function renderProvider() {
  return render(
    <ActiveChampionshipProvider>
      <Probe />
    </ActiveChampionshipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setUrl("");
  setPool(undefined);
});

describe("resolução do campeonato ativo", () => {
  it("param válido (∈ habilitados) → usa o param", () => {
    setPool({ enabledChampionships: ["fifa.world", "bra.1-2026"], rankingMode: "geral" });
    setUrl("championship=bra.1-2026");
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-active")).toBe("bra.1-2026");
  });

  it("param inválido (∉ habilitados) → primeiro habilitado", () => {
    setPool({ enabledChampionships: ["fifa.world", "bra.1-2026"], rankingMode: "geral" });
    setUrl("championship=des.conhecido");
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-active")).toBe("fifa.world");
  });

  it("sem param → primeiro habilitado", () => {
    setPool({ enabledChampionships: ["bra.1-2026", "fifa.world"], rankingMode: "por-campeonato" });
    setUrl("");
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-active")).toBe("bra.1-2026");
  });

  it("pool ausente (loading/erro) → DEFAULT_CHAMPIONSHIP_ID (Copa)", () => {
    setPool(undefined, true);
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-active")).toBe("fifa.world");
  });
});

describe("isMultiChampionship", () => {
  it("1 campeonato → false", () => {
    setPool({ enabledChampionships: ["fifa.world"], rankingMode: "geral" });
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-multi")).toBe("false");
  });

  it("> 1 campeonato → true", () => {
    setPool({ enabledChampionships: ["fifa.world", "bra.1-2026"], rankingMode: "geral" });
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-multi")).toBe("true");
  });
});

describe("hasActiveChampionship (temporada encerrada — bugfix)", () => {
  it("servidor devolve conjunto VAZIO (pool 100%-arquivado) → false", () => {
    setPool({ enabledChampionships: [], rankingMode: "geral" });
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-hasactive")).toBe("false");
  });

  it("conjunto com ≥1 ativo → true", () => {
    setPool({ enabledChampionships: ["bra.1-2026"], rankingMode: "geral" });
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-hasactive")).toBe("true");
  });

  it("loading/erro (data ausente) → true (degrade-safe, sem flash de encerrado)", () => {
    setPool(undefined, true);
    renderProvider();
    expect(screen.getByText("probe").getAttribute("data-hasactive")).toBe("true");
  });
});

describe("setActiveChampionship (URL como estado)", () => {
  it("reescreve a URL setando ?championship= e preservando outros params", () => {
    setPool({ enabledChampionships: ["fifa.world", "bra.1-2026"], rankingMode: "geral" });
    setUrl("foo=bar");
    renderProvider();
    fireEvent.click(screen.getByText("probe"));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const call = replaceMock.mock.calls[0];
    if (!call) throw new Error("router.replace não foi chamado");
    const [url, opts] = call;
    expect(url).toContain("/matches?");
    expect(url).toContain("foo=bar");
    expect(url).toContain("championship=bra.1-2026");
    expect(opts).toEqual({ scroll: false });
  });
});
