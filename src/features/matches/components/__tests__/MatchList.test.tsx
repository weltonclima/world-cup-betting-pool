// @vitest-environment jsdom
/**
 * Testes do componente MatchList (TASK-04 + TASK-03).
 *
 * Estratégia: mock de useMatchesList + useAuth (Firebase) no nível do hook.
 * Exercita os estados loading / error / empty / sucesso, pipeline de filtros
 * e tabs temporais (TASK-03).
 *
 * Faketime fixado em 2026-06-14T12:00:00Z para determinar todayKey de forma
 * estável. Isso alinha com as fixtures cujas datas são 2026-06-13/14/15.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Fixa o relógio para que toUtcDateKey(new Date()) retorne "2026-06-14" determinísticamente.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-14T12:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

// ── mocks declarados antes dos imports do módulo ────────────────────────────

// Firebase precisa ser mockado — client SDK exige env vars
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

// Mock do compositor (TASK-02)
vi.mock("@/features/matches/hooks/useMatchesList");

// Mock do MatchFiltersSheet (TASK-05) — evita portal/jsdom issues do Base UI
vi.mock("@/features/matches/components/MatchFiltersSheet", () => ({
  MatchFiltersSheet: () => null,
}));

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
    homeTeamId: "team-bra",
    awayTeamId: "team-fra",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "França", flagUrl: undefined },
    predictionStatus: "pendente",
    userPrediction: null,
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
  homeTeamId: "team-arg",
  awayTeamId: "team-ger",
  homeTeam: { name: "Argentina", flagUrl: undefined },
  awayTeam: { name: "Alemanha", flagUrl: undefined },
  predictionStatus: "enviado",
});

const espanhaJapao = makeItem({
  id: "match-003",
  kickoffAt: "2026-06-15T13:00:00Z",
  groupId: "Grupo E",
  homeTeamId: "team-esp",
  awayTeamId: "team-jpn",
  homeTeam: { name: "Espanha", flagUrl: undefined },
  awayTeam: { name: "Japão", flagUrl: undefined },
  predictionStatus: "bloqueado",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
});

// Jogo de ontem (bucket "anteriores" com todayKey="2026-06-14")
const paraguaiPortugal = makeItem({
  id: "match-000",
  kickoffAt: "2026-06-13T16:00:00Z",
  groupId: "Grupo A",
  homeTeamId: "team-par",
  awayTeamId: "team-por",
  homeTeam: { name: "Paraguai", flagUrl: undefined },
  awayTeam: { name: "Portugal", flagUrl: undefined },
  predictionStatus: "bloqueado",
  status: "finished",
  homeScore: 1,
  awayScore: 3,
});

const yesterdaySection: MatchListItemDaySection = {
  label: "13 de junho de 2026",
  date: "2026-06-13",
  matches: [paraguaiPortugal],
};

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

/** Fixture com itens nos três buckets temporais (ontem + hoje + amanhã). */
function makeSuccessStateWithAllBuckets(overrides: Partial<MatchesListData> = {}): MatchesListData {
  return {
    groups: [yesterdaySection, todaySection, tomorrowSection],
    flatList: [paraguaiPortugal, brasilFranca, argentinaAlemanha, espanhaJapao],
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

  it("T9: exibe mensagem de empty-state por aba quando lista vazia (default='anteriores' sem dados)", () => {
    render(<MatchList />);
    // flatList=[] → defaultTab="anteriores" → mensagem do bucket
    expect(screen.getByText("Nenhum jogo anterior")).toBeTruthy();
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

  it("T12: na aba 'Hoje' (default) renderiza seção 'Hoje' mas não 'Amanhã'", () => {
    render(<MatchList />);
    // "Hoje" aparece tanto na aba quanto no cabeçalho de seção — getAll
    const hojeOccurrences = screen.getAllByText("Hoje");
    expect(hojeOccurrences.length).toBeGreaterThanOrEqual(1);
    // "Amanhã" só aparece na aba "proximos" — invisível por default
    expect(screen.queryByText("Amanhã")).toBeNull();
  });

  it("T13a: na aba 'Hoje' (default) renderiza times do dia corrente", () => {
    render(<MatchList />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Alemanha")).toBeTruthy();
    // Times de amanhã não aparecem na aba hoje
    expect(screen.queryByText("Espanha")).toBeNull();
    expect(screen.queryByText("Japão")).toBeNull();
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

  it("T21: busca sem resultado exibe mensagem da aba atual com subtitle", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Zêlandia" } });
    // Default tab "hoje" → "Nenhum jogo hoje"
    expect(screen.getByText("Nenhum jogo hoje")).toBeTruthy();
    expect(screen.getByText("Tente limpar os filtros")).toBeTruthy();
  });

  it("T22: limpar busca restaura todos os jogos da aba ativa (hoje)", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Brasil" } });
    fireEvent.change(input, { target: { value: "" } });
    // Aba "hoje": Brasil + Argentina visíveis; Espanha é "proximos"
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.queryByText("Espanha")).toBeNull();
  });
});

describe("MatchList — filtro de fase (Stage)", () => {
  it("T23: selecionar 'Fase de Grupos' não filtra nada (todos são grupos na aba hoje)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Fase de Grupos" }));
    // Todos os jogos do fixture são stage=grupos; aba "hoje" tem Brasil + Argentina
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    // Espanha é aba "proximos" — não aparece aqui
    expect(screen.queryByText("Espanha")).toBeNull();
  });

  it("T24: selecionar 'Oitavas' não retorna nenhum jogo do fixture (todos são grupos)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Oitavas" }));
    expect(screen.queryByText("Brasil")).toBeNull();
    // Mensagem é por aba (default "hoje")
    expect(screen.getByText("Nenhum jogo hoje")).toBeTruthy();
    // Com filtro ativo: exibe subtitle
    expect(screen.getByText("Tente limpar os filtros")).toBeTruthy();
  });

  it("T25: clicar em 'Todas as fases' restaura jogos da aba ativa (hoje)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Oitavas" }));
    fireEvent.click(screen.getByRole("button", { name: "Todas as fases" }));
    // Aba "hoje" ativa: Brasil + Argentina visíveis
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    // Espanha é da aba "proximos" — não aparece aqui
    expect(screen.queryByText("Espanha")).toBeNull();
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

  it("T28: filtrar por 'Bloqueados' na aba Próximos mostra Espanha vs Japão", () => {
    render(<MatchList />);
    // Espanha está no bucket "proximos"; troca de aba primeiro (limpa filtros)
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    // Agora aplica filtro Bloqueados
    fireEvent.click(screen.getByRole("button", { name: "Bloqueados" }));
    expect(screen.getByText("Espanha")).toBeTruthy();
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.queryByText("Argentina")).toBeNull();
  });

  it("T29: clicar em 'Todos' na aba Próximos restaura Espanha", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloqueados" }));
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("Espanha")).toBeTruthy();
    // Brasil/Argentina são da aba "hoje", não aparecem em "proximos"
    expect(screen.queryByText("Brasil")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TASK-03 — Tabs temporais
// ---------------------------------------------------------------------------

describe("MatchList — TASK-03: tabs temporais renderizadas", () => {
  it("T30: renderiza as três abas (Anteriores, Hoje, Próximos)", () => {
    render(<MatchList />);
    expect(screen.getByRole("tab", { name: "Anteriores" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Próximos" })).toBeTruthy();
  });

  it("T31: tabs visíveis no estado de loading", () => {
    mockUseMatchesList.mockReturnValue(loadingState);
    render(<MatchList />);
    expect(screen.getByRole("tab", { name: "Hoje" })).toBeTruthy();
  });

  it("T32: tabs visíveis no estado de erro", () => {
    mockUseMatchesList.mockReturnValue(errorState);
    render(<MatchList />);
    expect(screen.getByRole("tab", { name: "Anteriores" })).toBeTruthy();
  });
});

describe("MatchList — TASK-03: default tab derivado dos dados", () => {
  it("T33: default 'hoje' quando há jogos no dia corrente", () => {
    // makeSuccessState tem jogos em 2026-06-14 (=today) e 2026-06-15
    render(<MatchList />);
    // Aba "hoje" ativa por default → Brasil visível
    expect(screen.getByText("Brasil")).toBeTruthy();
    // Espanha (proximos) não visível
    expect(screen.queryByText("Espanha")).toBeNull();
  });

  it("T34: default 'proximos' quando não há jogos hoje mas há futuros", () => {
    mockUseMatchesList.mockReturnValue({
      groups: [tomorrowSection],
      flatList: [espanhaJapao],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MatchList />);
    // defaultTab="proximos" → Espanha visível
    expect(screen.getByText("Espanha")).toBeTruthy();
  });

  it("T35: default 'anteriores' como fallback final (sem hoje nem proximos)", () => {
    mockUseMatchesList.mockReturnValue({
      groups: [yesterdaySection],
      flatList: [paraguaiPortugal],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MatchList />);
    // defaultTab="anteriores" → Paraguai visível
    expect(screen.getByText("Paraguai")).toBeTruthy();
  });
});

describe("MatchList — TASK-03: filtro temporal por aba", () => {
  beforeEach(() => {
    mockUseMatchesList.mockReturnValue(makeSuccessStateWithAllBuckets());
  });

  it("T36: aba 'Hoje' exibe apenas jogos do dia corrente", () => {
    render(<MatchList />);
    // Default já é "hoje" (flatList tem itens hoje)
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    // Itens de outros buckets não aparecem
    expect(screen.queryByText("Paraguai")).toBeNull();
    expect(screen.queryByText("Espanha")).toBeNull();
  });

  it("T37: aba 'Próximos' exibe apenas jogos futuros", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    expect(screen.getByText("Espanha")).toBeTruthy();
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.queryByText("Paraguai")).toBeNull();
  });

  it("T38: aba 'Anteriores' exibe apenas jogos passados", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("tab", { name: "Anteriores" }));
    expect(screen.getByText("Paraguai")).toBeTruthy();
    expect(screen.queryByText("Brasil")).toBeNull();
    expect(screen.queryByText("Espanha")).toBeNull();
  });

  it("T39: seção de dia correta aparece por aba (Amanhã na aba Próximos)", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    expect(screen.getByText("Amanhã")).toBeTruthy();
  });
});

describe("MatchList — TASK-03: troca de aba limpa filtros", () => {
  it("T40: trocar aba limpa busca", () => {
    render(<MatchList />);
    const input = screen.getByLabelText("Buscar jogos por seleção");
    fireEvent.change(input, { target: { value: "Brasil" } });
    expect((input as HTMLInputElement).value).toBe("Brasil");

    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("T41: trocar aba limpa filtro de fase", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Fase de Grupos" }));
    // Filtro ativo: filtersCount > 0
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    // Após troca, filtro de fase limpo — Espanha (grupos) aparece em proximos
    expect(screen.getByText("Espanha")).toBeTruthy();
  });

  it("T42: trocar aba limpa filtro de predictionStatus", () => {
    render(<MatchList />);
    fireEvent.click(screen.getByRole("button", { name: "Enviados" }));
    // Na aba "hoje" com Enviados: só Argentina
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.queryByText("Brasil")).toBeNull();

    // Trocar aba limpa filtro → "Próximos" sem filtro mostra Espanha
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    expect(screen.getByText("Espanha")).toBeTruthy();
  });
});

describe("MatchList — TASK-03: empty-state por aba", () => {
  it("T43: empty-state 'Nenhum jogo hoje' na aba Hoje sem jogos", () => {
    mockUseMatchesList.mockReturnValue({
      groups: [tomorrowSection],
      flatList: [espanhaJapao], // apenas jogos futuros
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MatchList />);
    // Default: "hoje" (não há itens hoje → "proximos" → mas vamos checar aba hoje explicitamente)
    // Na verdade: defaultTab="proximos" aqui, então clicamos em "Hoje"
    fireEvent.click(screen.getByRole("tab", { name: "Hoje" }));
    expect(screen.getByText("Nenhum jogo hoje")).toBeTruthy();
  });

  it("T44: empty-state 'Nenhum jogo próximo' na aba Próximos sem jogos", () => {
    mockUseMatchesList.mockReturnValue({
      groups: [yesterdaySection],
      flatList: [paraguaiPortugal], // apenas jogos passados
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MatchList />);
    // Default: "anteriores"; clica em "Próximos"
    fireEvent.click(screen.getByRole("tab", { name: "Próximos" }));
    expect(screen.getByText("Nenhum jogo próximo")).toBeTruthy();
  });

  it("T45: empty-state mostra subtitle quando há filtro ativo na aba vazia", () => {
    render(<MatchList />);
    // Na aba "hoje", filtrar por "Oitavas" → nenhum jogo hoje é oitavas
    fireEvent.click(screen.getByRole("button", { name: "Oitavas" }));
    expect(screen.getByText("Nenhum jogo hoje")).toBeTruthy();
    expect(screen.getByText("Tente limpar os filtros")).toBeTruthy();
  });
});

describe("MatchList — TASK-03: userPrediction passado ao MatchCard", () => {
  it("T46: exibe palpite do usuário no card quando userPrediction está preenchido", () => {
    const itemComPalpite = makeItem({
      id: "match-palpite",
      kickoffAt: "2026-06-14T20:00:00Z", // hoje
      status: "scheduled",
      predictionStatus: "enviado",
      userPrediction: { homeScore: 2, awayScore: 1 },
      homeTeam: { name: "Uruguai", flagUrl: undefined },
      awayTeam: { name: "Itália", flagUrl: undefined },
    });
    const section: MatchListItemDaySection = {
      label: "Hoje",
      date: "2026-06-14",
      matches: [itemComPalpite],
    };
    mockUseMatchesList.mockReturnValue({
      groups: [section],
      flatList: [itemComPalpite],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MatchList />);
    // MatchCard renderiza "Seu palpite: 2 x 1" para jogos não-encerrados com palpite
    expect(screen.getByText(/Seu palpite/)).toBeTruthy();
    expect(screen.getByText(/2.*x.*1/)).toBeTruthy();
  });

  it("T47: não exibe palpite quando userPrediction é null", () => {
    render(<MatchList />);
    // brasilFranca tem userPrediction: null
    expect(screen.queryByText(/Seu palpite/)).toBeNull();
  });
});
