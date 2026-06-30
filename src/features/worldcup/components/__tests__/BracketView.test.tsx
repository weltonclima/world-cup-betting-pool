// @vitest-environment jsdom
/**
 * Testes do BracketView (TASK-08 + TASK-04 v2 — árvore horizontal).
 *
 * Estratégia: mock de useBracket retornando estados controlados.
 * Verifica: pending→skeleton, error→estado de erro+retry, vazio total→empty state,
 * sucesso→colunas de fase na ordem correta com fases vazias omitidas,
 * contagem de jogos no header e 3º lugar fora da árvore.
 */

import { render, screen, within } from "@testing-library/react";
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

// ConnectorLayer usa ResizeObserver (ausente no jsdom) — stub mínimo.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

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

function match(
  id: string,
  phase: KnockoutMatch["phase"],
  home: string,
  away: string,
  status: KnockoutMatch["status"] = "definido",
  parentMatchIds?: [string, string],
): KnockoutMatch {
  return {
    id,
    phase,
    homeTeam: { name: home, code: "AAA", defined: true },
    awayTeam: { name: away, code: "BBB", defined: true },
    status,
    ...(parentMatchIds ? { parentMatchIds } : {}),
  };
}

/** Layout desktop (árvore completa) — escopo p/ evitar duplicação com o mobile. */
function desktop() {
  return within(screen.getByTestId("bracket-desktop"));
}

/** Layout mobile (abas por fase). */
function mobile() {
  return within(screen.getByTestId("bracket-mobile"));
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

describe("BracketView — árvore de fases (desktop)", () => {
  it("T5: renderiza as colunas de fase não vazias com seus rótulos", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(desktop().getByRole("heading", { name: /16-avos/ })).toBeTruthy();
    expect(desktop().getByRole("heading", { name: /Final/ })).toBeTruthy();
    // Variante compact: nomes não são texto visível, ficam no aria-label do card.
    expect(desktop().getByLabelText("Brasil x Uruguai")).toBeTruthy();
    expect(desktop().getByLabelText("Argentina x Espanha")).toBeTruthy();
  });

  it("T6: omite colunas de fases vazias", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(desktop().getByRole("heading", { name: /16-avos/ })).toBeTruthy();
    expect(desktop().queryByRole("heading", { name: /Oitavas/ })).toBeNull();
    expect(desktop().queryByRole("heading", { name: /Quartas/ })).toBeNull();
  });

  it("T7: colunas aparecem na ordem oficial (16-avos antes de Final)", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    const headings = desktop().getAllByRole("heading").map((h) => h.textContent ?? "");
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
    const heading = desktop().getByRole("heading", { name: /Oitavas/ });
    expect(heading.textContent).toContain("2 jogos");
  });

  it("T9: header da coluna usa singular para 1 jogo", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    const heading = desktop().getByRole("heading", { name: /Final/ });
    expect(heading.textContent).toContain("1 jogo");
  });
});

// ---------------------------------------------------------------------------
// Testes — 3º lugar fora da árvore
// ---------------------------------------------------------------------------

describe("BracketView — 3º lugar", () => {
  it("T10: 'Disputa do 3º Lugar' é renderizada no desktop quando há jogo", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      semiFinals: [match("m97", "semifinal", "Brasil", "França")],
      thirdPlace: [match("m103", "terceiro", "Alemanha", "Marrocos")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    expect(desktop().getByRole("heading", { name: /Disputa do 3º Lugar/ })).toBeTruthy();
    expect(desktop().getByLabelText("Alemanha x Marrocos")).toBeTruthy();
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

// ---------------------------------------------------------------------------
// Testes — abas por fase (mobile)
// ---------------------------------------------------------------------------

describe("BracketView — abas por fase (mobile)", () => {
  function multiPhaseData(): BracketResponse {
    return {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai", "encerrado")],
      roundOf16: [match("m80", "oitavas", "Alemanha", "Chile", "em-andamento")],
      quarterFinals: [match("m90", "quartas", "França", "Espanha", "definido")],
    };
  }

  it("M1: renderiza uma aba (role tab) por fase com jogos, rótulo curto", () => {
    mockUseBracket.mockReturnValue({
      isPending: false,
      isError: false,
      data: multiPhaseData(),
      refetch: vi.fn(),
    });
    render(<BracketView />);
    expect(mobile().getByRole("tab", { name: "16-avos" })).toBeTruthy();
    expect(mobile().getByRole("tab", { name: "Oitavas" })).toBeTruthy();
    expect(mobile().getByRole("tab", { name: "Quartas" })).toBeTruthy();
    // Sem fases vazias → sem aba de Semifinais/Final.
    expect(mobile().queryByRole("tab", { name: "Semis" })).toBeNull();
  });

  it("M2: abre na fase em andamento por padrão (aba selecionada)", () => {
    mockUseBracket.mockReturnValue({
      isPending: false,
      isError: false,
      data: multiPhaseData(),
      refetch: vi.fn(),
    });
    render(<BracketView />);
    expect(mobile().getByRole("tab", { name: "Oitavas", selected: true })).toBeTruthy();
    expect(mobile().getByRole("tab", { name: "16-avos", selected: false })).toBeTruthy();
  });

  it("M3: a aba ativa mostra a fase atual + a próxima fase (fase+próxima)", () => {
    mockUseBracket.mockReturnValue({
      isPending: false,
      isError: false,
      data: multiPhaseData(),
      refetch: vi.fn(),
    });
    render(<BracketView />);
    // TASK-09: restaura a visão fase+próxima. Default = Oitavas → painel mostra
    // a coluna de Oitavas E a de Quartas (próxima fase) lado a lado.
    const panel = mobile().getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: /Oitavas/ })).toBeTruthy();
    expect(within(panel).getByRole("heading", { name: /Quartas/ })).toBeTruthy();
    // Card da próxima fase (Quartas) aparece como peek-ahead da árvore.
    expect(within(panel).getByLabelText("França x Espanha")).toBeTruthy();
  });

  it("MN-01: a última aba (sem próxima fase) mostra só a fase atual", async () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      semiFinals: [match("m101", "semifinal", "Brasil", "França", "em-andamento")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    // Trocando p/ Final (última) → só a coluna Final, sem coluna seguinte (Semis).
    await userEvent.click(mobile().getByRole("tab", { name: "Final" }));
    const panel = mobile().getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: /Final/ })).toBeTruthy();
    expect(within(panel).queryByRole("heading", { name: /Semifinais/ })).toBeNull();
  });

  it("MN-02: aba Semis mostra Semis + Final (fase atual + próxima)", async () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      semiFinals: [match("m101", "semifinal", "Brasil", "França", "em-andamento")],
      final: [match("m104", "final", "Argentina", "Espanha")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    // Default = Semis (em-andamento) → painel mostra duas colunas: Semis + Final.
    const panel = mobile().getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: /Semifinais/ })).toBeTruthy();
    expect(within(panel).getByRole("heading", { name: /Final/ })).toBeTruthy();
    expect(within(panel).getByLabelText("Argentina x Espanha")).toBeTruthy();
  });

  it("MN-03: aba 16-avos mostra 16-avos + Oitavas (fase atual + próxima)", async () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Brasil", "Uruguai", "em-andamento")],
      roundOf16: [match("m89", "oitavas", "Alemanha", "Chile", "definido")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    // Default = 16-avos (em-andamento) → painel mostra 16-avos + Oitavas.
    const panel = mobile().getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: /16-avos/ })).toBeTruthy();
    expect(within(panel).getByRole("heading", { name: /Oitavas/ })).toBeTruthy();
    expect(within(panel).getByLabelText("Alemanha x Chile")).toBeTruthy();
  });

  it("M4: trocar para a aba Quartas (última) revela a Disputa do 3º Lugar", async () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf16: [match("m80", "oitavas", "Alemanha", "Chile", "em-andamento")],
      quarterFinals: [match("m90", "quartas", "França", "Espanha", "definido")],
      thirdPlace: [match("m103", "terceiro", "Brasil", "Marrocos")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    await userEvent.click(mobile().getByRole("tab", { name: "Quartas" }));
    const panel = mobile().getByRole("tabpanel");
    expect(within(panel).getByRole("heading", { name: /Disputa do 3º Lugar/ })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Regressão do bug "Brasil na chave errada" (TASK-04)
// ---------------------------------------------------------------------------

describe("BracketView — regressão: sem pareamento posicional", () => {
  it("R1: cada card mostra seus lados reais na fase REAL — nenhum cruzamento de chave", () => {
    // Cenário do bug: Brasil resolvido na sua OITAVA. O pareamento posicional
    // antigo (roundOf16[k] ↔ roundOf32[2k],[2k+1]) sugeria que Brasil pertencia à
    // chave de outro confronto. Agora cada coluna lista só os jogos da própria fase.
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [
        match("m73", "dezesseis-avos", "Canadá", "Bélgica", "definido"),
      ],
      roundOf16: [
        match("m89", "oitavas", "Brasil", "Argentina", "definido"),
      ],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);

    // Brasil aparece SÓ na coluna de Oitavas, com seu adversário real.
    const oitavas = within(desktop().getByRole("region", { name: "Oitavas" }));
    expect(oitavas.getByLabelText("Brasil x Argentina")).toBeTruthy();

    // A coluna de 16-avos NÃO contém Brasil (sem cruzamento posicional p/ outra chave).
    const dezeseisAvos = within(desktop().getByRole("region", { name: "16-avos" }));
    expect(dezeseisAvos.getByLabelText("Canadá x Bélgica")).toBeTruthy();
    expect(dezeseisAvos.queryByLabelText(/Brasil/)).toBeNull();
  });

  it("R3: 3º lugar acessível no mobile quando só ele tem jogos (sem fases de progressão)", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      thirdPlace: [match("m103", "terceiro", "Brasil", "Marrocos")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    render(<BracketView />);
    // Sem abas onde ancorar → renderizado direto no bloco mobile.
    expect(mobile().getByRole("heading", { name: /Disputa do 3º Lugar/ })).toBeTruthy();
    expect(mobile().getByLabelText("Brasil x Marrocos")).toBeTruthy();
  });

});

// ---------------------------------------------------------------------------
// Conectores reais pai→filho (TASK-09)
// ---------------------------------------------------------------------------

describe("BracketView — conectores reais (TASK-09)", () => {
  function bracketWithEdges(): BracketResponse {
    return {
      ...emptyBracket(),
      roundOf32: [
        match("m73", "dezesseis-avos", "Canadá", "Bélgica", "encerrado"),
        match("m75", "dezesseis-avos", "Brasil", "Japão", "encerrado"),
      ],
      // Oitava filha alimentada pelos dois 16-avos (parentMatchIds reais).
      roundOf16: [
        match("m89", "oitavas", "Canadá", "Brasil", "definido", ["m73", "m75"]),
      ],
    };
  }

  it("CN-01: renderiza SVG conector aria-hidden quando há parentMatchIds", () => {
    mockUseBracket.mockReturnValue({
      isPending: false,
      isError: false,
      data: bracketWithEdges(),
      refetch: vi.fn(),
    });
    const { container } = render(<BracketView />);
    const connectors = container.querySelectorAll('[data-testid="bracket-connector"]');
    expect(connectors.length).toBeGreaterThan(0);
    // Decorativo: aria-hidden e fora do fluxo de ponteiro/foco.
    for (const svg of connectors) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("class")).toContain("pointer-events-none");
    }
  });

  it("CN-02: NÃO renderiza conector quando parentMatchIds ausente (degrada)", () => {
    const data: BracketResponse = {
      ...emptyBracket(),
      roundOf32: [match("m73", "dezesseis-avos", "Canadá", "Bélgica")],
      // Oitava SEM parentMatchIds (ambos resolvidos sem mapa) → sem aresta.
      roundOf16: [match("m89", "oitavas", "Brasil", "Argentina")],
    };
    mockUseBracket.mockReturnValue({ isPending: false, isError: false, data, refetch: vi.fn() });
    const { container } = render(<BracketView />);
    // Sem parentMatchIds → ConnectorLayer não desenha paths → retorna null.
    expect(
      container.querySelectorAll('[data-testid="bracket-connector"]'),
    ).toHaveLength(0);
  });

  it("CN-03: cards expõem data-match-id para ancorar os conectores", () => {
    mockUseBracket.mockReturnValue({
      isPending: false,
      isError: false,
      data: bracketWithEdges(),
      refetch: vi.fn(),
    });
    const { container } = render(<BracketView />);
    expect(container.querySelector('[data-match-id="m73"]')).toBeTruthy();
    expect(container.querySelector('[data-match-id="m75"]')).toBeTruthy();
    expect(container.querySelector('[data-match-id="m89"]')).toBeTruthy();
  });
});
