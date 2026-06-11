// @vitest-environment jsdom
/**
 * Testes do BracketView (TASK-08).
 *
 * Estratégia: mock de useBracket retornando estados controlados.
 * Verifica: pending→skeleton, error→estado de erro+retry, vazio total→empty state,
 * sucesso→fases na ordem correta com seções vazias omitidas.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BracketView } from "@/features/worldcup/components/BracketView";
import type { BracketResponse, KnockoutMatch } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Mock do hook useBracket
// ---------------------------------------------------------------------------

const mockUseBracket = vi.fn();

vi.mock("@/features/worldcup/hooks/useBracket", () => ({
  useBracket: () => mockUseBracket(),
}));

// ---------------------------------------------------------------------------
// Helpers de fixture
// ---------------------------------------------------------------------------

function emptyBracket(): BracketResponse {
  return {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
  };
}

function match(id: string, phase: KnockoutMatch["phase"], home: string, away: string): KnockoutMatch {
  return {
    id,
    phase,
    homeTeam: { name: home, code: "AAA", defined: true },
    awayTeam: { name: away, code: "BBB", defined: true },
    status: "definido",
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("BracketView — pending", () => {
  it("T1: exibe skeleton quando isPending=true", () => {
    mockUseBracket.mockReturnValue({ isPending: true, isError: false, data: undefined, refetch: vi.fn() });
    render(<BracketView />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });
});

describe("BracketView — error", () => {
  it("T2: exibe estado de erro com mensagem do PRD", () => {
    mockUseBracket.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByText("Erro ao carregar informações.")).toBeTruthy();
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T3: clicar em 'Tentar novamente' chama refetch", async () => {
    const refetch = vi.fn();
    mockUseBracket.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch });
    render(<BracketView />);
    await userEvent.click(screen.getByText("Tentar novamente"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("BracketView — vazio total", () => {
  it("T4: exibe empty state quando todos os buckets estão vazios", () => {
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data: emptyBracket(), refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByText("Nenhuma informação disponível.")).toBeTruthy();
  });
});

describe("BracketView — sucesso", () => {
  it("T5: renderiza as fases não vazias com seus rótulos", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByRole("heading", { name: "Dezesseis-avos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Final" })).toBeTruthy();
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
  });

  it("T6: omite seções de fases vazias", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByRole("heading", { name: "Dezesseis-avos" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Final" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Quartas de Final" })).toBeNull();
  });

  it("T7: fases aparecem na ordem oficial (Dezesseis-avos antes de Final)", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings.indexOf("Dezesseis-avos")).toBeLessThan(headings.indexOf("Final"));
  });
});
