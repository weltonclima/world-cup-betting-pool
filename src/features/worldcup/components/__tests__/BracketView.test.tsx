// @vitest-environment jsdom
/**
 * Testes do BracketView (TASK-08 + TASK-04 v2 — árvore horizontal).
 *
 * Estratégia: mock de useBracket retornando estados controlados.
 * Verifica: pending→skeleton, error→estado de erro+retry, vazio total→empty state,
 * sucesso→colunas de fase na ordem correta com fases vazias omitidas,
 * contagem de jogos no header e 3º lugar fora da árvore.
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
// Testes — estados de ciclo de vida
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

// ---------------------------------------------------------------------------
// Testes — árvore (colunas por fase)
// ---------------------------------------------------------------------------

describe("BracketView — árvore de fases", () => {
  it("T5: renderiza as colunas de fase não vazias com seus rótulos", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByRole("heading", { name: /16-avos/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Final/ })).toBeTruthy();
    // Variante compact: nomes não são texto visível, ficam no aria-label do card.
    expect(screen.getByLabelText("Brasil x Uruguai")).toBeTruthy();
    expect(screen.getByLabelText("Argentina x Espanha")).toBeTruthy();
  });

  it("T6: omite colunas de fases vazias", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByRole("heading", { name: /16-avos/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Oitavas/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Quartas/ })).toBeNull();
  });

  it("T7: colunas aparecem na ordem oficial (16-avos antes de Final)", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
    const dezeIndex = headings.findIndex((h) => h.startsWith("16-avos"));
    const finalIndex = headings.findIndex((h) => h.startsWith("Final"));
    expect(dezeIndex).toBeGreaterThanOrEqual(0);
    expect(finalIndex).toBeGreaterThan(dezeIndex);
  });

  it("T8: header da coluna exibe contagem (plural)", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf16: [
        match("m80", "oitavas", "Alemanha", "Chile"),
        match("m81", "oitavas", "França", "Espanha"),
      ],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    const heading = screen.getByRole("heading", { name: /Oitavas/ });
    expect(heading.textContent).toContain("2 jogos");
  });

  it("T9: header da coluna usa singular para 1 jogo", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    const heading = screen.getByRole("heading", { name: /Final/ });
    expect(heading.textContent).toContain("1 jogo");
  });
});

// ---------------------------------------------------------------------------
// Testes — 3º lugar fora da árvore
// ---------------------------------------------------------------------------

describe("BracketView — 3º lugar", () => {
  it("T10: 'Disputa do 3º Lugar' é renderizada quando há jogo", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      semiFinals: [match("m97", "semifinal", "Brasil", "França")],
      thirdPlace: [match("m103", "terceiro", "Alemanha", "Marrocos")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.getByRole("heading", { name: /Disputa do 3º Lugar/ })).toBeTruthy();
    expect(screen.getByLabelText("Alemanha x Marrocos")).toBeTruthy();
  });

  it("T11: 3º lugar é omitido quando não há jogo", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(screen.queryByRole("heading", { name: /Disputa do 3º Lugar/ })).toBeNull();
  });
});
