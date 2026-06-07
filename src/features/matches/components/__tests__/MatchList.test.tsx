// @vitest-environment jsdom
/**
 * Testes do componente MatchList (TASK-04).
 *
 * Estratégia: mock de useMatchesList + useAuth (Firebase) no nível do hook.
 * Exercita os estados loading / error / empty / sucesso e o pipeline de filtros.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks declarados antes dos imports do módulo ────────────────────────────

// Firebase precisa ser mockado — client SDK exige env vars
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

// Mock do compositor (TASK-02)
vi.mock("@/features/matches/hooks/useMatchesList");

// ── imports pós-mock ─────────────────────────────────────────────────────────

import { useMatchesList } from "@/features/matches/hooks/useMatchesList";
import type { MatchesListData, MatchListItem, MatchListItemDaySection } from "@/features/matches/hooks/useMatchesList";

import { MatchList } from "@/features/matches/components/MatchList";

// ── helper de tipagem ────────────────────────────────────────────────────────

const mockUseMatchesList = vi.mocked(useMatchesList);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: "match-001",
    kickoffAt: "2026-06-14T16:00:00Z",
    stage: "grupos",
    round: 1,
    groupId: "Grupo C",
    venue: { name: "Estádio Lusail", city: "Lusail" },
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "França", flagUrl: undefined },
    predictionStatus: "pendente",
    ...overrides,
  };
}

const brasilFranca = makeItem({
  id: "match-001",
  homeTeam: { name: "Brasil", flagUrl: undefined },
  awayTeam: { name: "França", flagUrl: undefined },
  predictionStatus: "pendente",
});

const argentinaAlemanha = makeItem({
  id: "match-002",
  kickoffAt: "2026-06-14T19:00:00Z",
  groupId: "Grupo D",
  homeTeam: { name: "Argentina", flagUrl: undefined },
  awayTeam: { name: "Alemanha", flagUrl: undefined },
  predictionStatus: "enviado",
});

const espanhaJapao = makeItem({
  id: "match-003",
  kickoffAt: "2026-06-15T13:00:00Z",
  groupId: "Grupo E",
  homeTeam: { name: "Espanha", flagUrl: undefined },
  awayTeam: { name: "Japão", flagUrl: undefined },
  predictionStatus: "bloqueado",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
});

const todaySection: MatchListItemDaySection = {
  label: "Hoje",
  date: "2026-06-14",
  matches: [brasilFranca, argentinaAlemanha],
};

const tomorrowSection: MatchListItemDaySection = {
  label: "Amanhã",
  date: "2026-06-15",
  matches: [espanhaJapao],
};

function makeSuccessState(overrides: Partial<MatchesListData> = {}): MatchesListData {
  return {
    groups: [todaySection, tomorrowSection],
    flatList: [brasilFranca, argentinaAlemanha, espanhaJapao],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

const loadingState: MatchesListData = {
  groups: [],
  flatList: [],
  isLoading: true,
  isError: false,
  refetch: vi.fn(),
};

const errorState: MatchesListData = {
  groups: [],
  flatList: [],
  isLoading: false,
  isError: true,
  refetch: vi.fn(),
};

const emptyState: MatchesListData = {
  groups: [],
  flatList: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseMatchesList.mockReturnValue(makeSuccessState());
});

// ---------------------------------------------------------------------------
// Testes — estados principais
// ---------------------------------------------------------------------------

describe("MatchList — estado loading", () => {
  beforeEach(() => {
    mockUseMatchesList.mockReturnValue(loadingState);
  });

  it("T1: exibe skeleton de carregamento quando isLoading=true", () => {
    render(<MatchList />);
    // MatchListSkeleton tem role="status" aria-label="Carregando jogos"
    expect(screen.getByRole("status", { name: "Carregando jogos" })).toBeTruthy();
  });

  it("T2: não exibe cards de jogo durante loading", () => {
    render(<MatchList />);
    expect(screen.queryByText("Brasil")).toBeNull();
  });

  it("T3: não exibe empty-state durante loading", () => {
    render(<MatchList />);
    expect(screen.queryByText("Nenhum jogo encontrado")).toBeNull();
  });

  it("T4: não exibe error-state durante loading", () => {
    render(<MatchList />);
    expect(screen.queryByText("Erro ao carregar jogos")).toBeNull();
  });
});

describe("MatchList — estado error", () => {
  beforeEach(() => {
    mockUseMatchesList.mockReturnValue(errorState);
  });

  it("T5: exibe mensagem de erro quando isError=true e isLoading=false", () => {
    render(<MatchList />);
    expect(screen.getByText("Erro ao carregar jogos")).toBeTruthy();
  });

  it("T6: exibe botão 'Tentar novamente'", () => {
    render(<MatchList />);
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });

  it("T7: clicar em 'Tentar novamente' chama refetch", () => {
    const refetchMock = vi.fn();
    mockUseMatchesList.mockReturnValue({ ...errorState, refetch: refetchMock });
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("T8: não exibe skeleton no estado de erro", () => {
    render(<MatchList />);
    expect(screen.queryByRole("status", { name: "Carregando jogos" })).toBeNull();
  });
});

describe("MatchList — estado vazio", () => {
  beforeEach(() => {
    mockUseMatchesList.mockReturnValue(emptyState);
  });

  it("T9: exibe 'Nenhum jogo encontrado' quando lista vazia", () => {
    render(<MatchList />);
    expect(screen.getByText("Nenhum jogo encontrado")).toBeTruthy();
  });

  it("T10: não exibe subtitle de filtros ativos quando lista simplesmente vazia", () => {
    render(<MatchList />);
    expect(screen.queryByText("Tente limpar os filtros")).toBeNull();
  });
});

describe("MatchList — estado de sucesso", () => {
  it("T11: renderiza o título 'Jogos'", () => {
    render(<MatchList />);
    expect(screen.getByRole("heading", { name: "Jogos" })).toBeTruthy();
  });

  it("T12: renderiza seções de dia com labels 'Hoje' e 'Amanhã'", () => {
    render(<MatchList />);
    expect(screen.getByText("Hoje")).toBeTruthy();
    expect(screen.getByText("Amanhã")).toBeTruthy();
  });

  it("T13: renderiza nome dos times nos cards", () => {
    render(<MatchList />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Alemanha")).toBeTruthy();
    expect(screen.getByText("Espanha")).toBeTruthy();
    expect(screen.getByText("Japão")).toBeTruthy();
  });

  it("T14: cards são links com href para /matches/{id}", () => {
    render(<MatchList />);
    const brasilLink = screen.getByRole("link", { name: "Brasil vs França" });
    expect(brasilLink.getAttribute("href")).toBe("/matches/match-001");
  });

  it("T15: card da Argentina tem href correto", () => {
    render(<MatchList />);
    const argLink = screen.getByRole("link", { name: "Argentina vs Alemanha" });
    expect(argLink.getAttribute("href")).toBe("/matches/match-002");
  });

  it("T16: não exibe skeleton no estado de sucesso", () => {
    render(<MatchList />);
    expect(screen.queryByRole("status", { name: "Carregando jogos" })).toBeNull();
  });

  it("T17: não exibe error-state no estado de sucesso", () => {
    render(<MatchList />);
    expect(screen.queryByText("Erro ao carregar jogos")).toBeNull();
  });
});

describe("MatchList — busca por seleção", () => {
  it("T18: busca por 'Brasil' filtra para mostrar apenas Brasil vs França", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Brasil" } });

    // Brasil deve aparecer
    expect(screen.getByText("Brasil")).toBeTruthy();
    // Argentina e Espanha não devem aparecer
    expect(screen.queryByText("Argentina")).toBeNull();
    expect(screen.queryByText("Espanha")).toBeNull();
  });

  it("T19: busca por visitante 'França' mostra o jogo Brasil vs França", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "França" } });

    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    expect(screen.queryByText("Argentina")).toBeNull();
  });

  it("T20: busca case-insensitive — 'brasil' (minúsculo) encontra Brasil", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "brasil" } });
    expect(screen.getByText("Brasil")).toBeTruthy();
  });

  it("T21: busca sem resultado exibe 'Nenhum jogo encontrado' com subtitle", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Zêlandia" } });
    expect(screen.getByText("Nenhum jogo encontrado")).toBeTruthy();
    expect(screen.getByText("Tente limpar os filtros")).toBeTruthy();
  });

  it("T22: limpar busca restaura todos os jogos", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Brasil" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Espanha")).toBeTruthy();
  });
});

describe("MatchList — filtro de fase (Stage)", () => {
  it("T23: selecionar 'Fase de Grupos' não filtra nada (todos são grupos no fixture)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Fase de Grupos" }));
    // Todos os jogos do fixture são stage=grupos
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Espanha")).toBeTruthy();
  });

  it("T24: selecionar 'Oitavas' não retorna nenhum jogo do fixture (todos são grupos)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Oitavas" }));
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.getByText("Nenhum jogo encontrado")).toBeTruthy();
    // Com filtro ativo: exibe subtitle
    expect(screen.getByText("Tente limpar os filtros")).toBeTruthy();
  });

  it("T25: clicar em 'Todas as fases' restaura lista completa após filtrar", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Oitavas" }));
    fireEvent.click(screen.getByRole("button", { name: "Todas as fases" }));
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Espanha")).toBeTruthy();
  });
});

describe("MatchList — filtro de status de palpite", () => {
  it("T26: filtrar por 'Enviados' mostra apenas Argentina (predictionStatus=enviado)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Enviados" }));
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.queryByText("Espanha")).toBeNull();
  });

  it("T27: filtrar por 'Pendentes' mostra apenas Brasil vs França", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Pendentes" }));
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.queryByText("Argentina")).toBeNull();
  });

  it("T28: filtrar por 'Bloqueados' mostra apenas Espanha vs Japão", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Bloqueados" }));
    expect(screen.getByText("Espanha")).toBeTruthy();
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.queryByText("Argentina")).toBeNull();
  });

  it("T29: clicar em 'Todos' restaura lista completa", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Enviados" }));
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Espanha")).toBeTruthy();
  });
});
