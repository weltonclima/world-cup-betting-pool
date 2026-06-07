// @vitest-environment jsdom
/**
 * Testes do componente HomeDashboard (TASK-10).
 *
 * Estratégia: mock de useHomeDashboard e useAuth no nível do hook,
 * exercendo os 3 estados da página — loading, error, sucesso.
 *
 * Padrão alinhado com useHomeDashboard.test.ts (TASK-05):
 * vi.mock antes dos imports; vi.mocked para tipagem.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks declarados antes dos imports do módulo ────────────────────────────

// Firebase precisa ser mockado — client SDK exige env vars
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

// Mockar os hooks consumidos pelo HomeDashboard
vi.mock("@/hooks/useAuth");
vi.mock("@/features/home/hooks/useHomeDashboard");

// ── imports pós-mock ─────────────────────────────────────────────────────────

import type { AuthContextValue } from "@/providers/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { useHomeDashboard } from "@/features/home/hooks/useHomeDashboard";
import type { HomeDashboardData } from "@/features/home/hooks/useHomeDashboard";

import { HomeDashboard } from "../HomeDashboard";

// ── helpers de tipagem ───────────────────────────────────────────────────────

const mockUseAuth = vi.mocked(useAuth);
const mockUseDashboard = vi.mocked(useHomeDashboard);

// ── fixtures base ────────────────────────────────────────────────────────────

/**
 * AuthContextValue mínimo para os testes.
 * Fornece apenas os campos lidos por HomeDashboard (profile.name, firebaseUser.uid).
 */
const baseAuth: AuthContextValue = {
  firebaseUser: { uid: "uid-test-01" } as AuthContextValue["firebaseUser"],
  profile: {
    uid: "uid-test-01",
    name: "Ana Lima",
    nickname: "ana",
    email: "ana@example.com",
    role: "user",
    status: "approved",
  },
  status: "approved",
  role: "user",
  loading: false,
  error: null,
  refreshProfile: vi.fn(),
};

/**
 * HomeDashboardData mínimo para o estado de sucesso.
 * Todos os campos opcionais são nulos/vazios — os cards tratam seus próprios empty states.
 */
const baseDashboardSuccess: HomeDashboardData = {
  ranking: { position: 3, totalParticipants: 20, points: 8 },
  performance: { totalCorrect: 4, accuracy: 25, gamesPredicted: null, wrong: null },
  nextMatch: null,
  recentResults: [],
  currentStage: { stage: null, roundLabel: null },
  notices: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

/** Estado de loading: isLoading=true, tudo else padrão. */
const dashboardLoading: HomeDashboardData = {
  ...baseDashboardSuccess,
  ranking: null,
  performance: { totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null },
  isLoading: true,
  isError: false,
};

/** Estado de erro: isError=true, isLoading=false. */
const dashboardError: HomeDashboardData = {
  ...baseDashboardSuccess,
  ranking: null,
  performance: { totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null },
  isLoading: false,
  isError: true,
};

// ── configuração por suite ───────────────────────────────────────────────────

beforeEach(() => {
  // Configuração padrão — sobrescrita por cenário quando necessário
  mockUseAuth.mockReturnValue(baseAuth);
  mockUseDashboard.mockReturnValue(baseDashboardSuccess);
});

// ── suítes de teste ──────────────────────────────────────────────────────────

describe("HomeDashboard — estado loading", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(dashboardLoading);
  });

  it("T1: exibe skeletons (role='status') quando isLoading é true", () => {
    render(<HomeDashboard />);
    // Pelo menos um skeleton deve estar presente
    const skeletons = screen.getAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("T2: não exibe o HomeHeader real durante loading", () => {
    render(<HomeDashboard />);
    // "Olá, Ana Lima 👋" não deve aparecer enquanto carrega
    expect(screen.queryByText(/Olá, Ana Lima/)).toBeNull();
  });

  it("T3: skeletons com aria-busy='true'", () => {
    render(<HomeDashboard />);
    const skeletons = screen.getAllByRole("status");
    // Todos devem ter aria-busy=true
    for (const sk of skeletons) {
      expect(sk.getAttribute("aria-busy")).toBe("true");
    }
  });

  it("T4: não exibe mensagem de erro durante loading", () => {
    render(<HomeDashboard />);
    expect(screen.queryByText("Erro ao carregar dashboard")).toBeNull();
  });

  it("T4b: exibe HomeHeaderSkeleton (data-testid) durante loading e ausência do greeting real", () => {
    render(<HomeDashboard />);
    expect(screen.getByTestId("home-header-skeleton")).toBeTruthy();
    expect(screen.queryByText(/Olá, Ana Lima/)).toBeNull();
  });
});

describe("HomeDashboard — estado error", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(dashboardError);
  });

  it("T5: exibe 'Erro ao carregar dashboard' quando isError=true", () => {
    render(<HomeDashboard />);
    expect(screen.getByText("Erro ao carregar dashboard")).toBeTruthy();
  });

  it("T6: exibe botão 'Tentar Novamente'", () => {
    render(<HomeDashboard />);
    expect(screen.getByRole("button", { name: "Tentar Novamente" })).toBeTruthy();
  });

  it("T7: clicar em 'Tentar Novamente' chama refetch", () => {
    const refetchMock = vi.fn();
    mockUseDashboard.mockReturnValue({ ...dashboardError, refetch: refetchMock });

    render(<HomeDashboard />);
    const btn = screen.getByRole("button", { name: "Tentar Novamente" });
    fireEvent.click(btn);

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("T8: container de erro tem role='alert'", () => {
    render(<HomeDashboard />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("T9: não exibe skeletons no estado de erro", () => {
    render(<HomeDashboard />);
    expect(screen.queryAllByRole("status").length).toBe(0);
  });

  it("T10: não exibe HomeHeader no estado de erro", () => {
    render(<HomeDashboard />);
    expect(screen.queryByText(/Olá/)).toBeNull();
  });
});

describe("HomeDashboard — estado de sucesso", () => {
  it("T11: exibe o HomeHeader com o nome do usuário", () => {
    render(<HomeDashboard />);
    // HomeHeader renderiza "Olá, {name} 👋"
    expect(screen.getByText("Olá, Ana Lima 👋")).toBeTruthy();
  });

  it("T12: exibe o subtítulo 'Bem-vindo ao bolão'", () => {
    render(<HomeDashboard />);
    expect(screen.getByText("Bem-vindo ao bolão")).toBeTruthy();
  });

  it("T13: não exibe skeletons no estado de sucesso", () => {
    render(<HomeDashboard />);
    // Nenhum skeleton deve estar presente no estado de sucesso
    expect(screen.queryAllByRole("status").length).toBe(0);
  });

  it("T14: não exibe mensagem de erro no estado de sucesso", () => {
    render(<HomeDashboard />);
    expect(screen.queryByText("Erro ao carregar dashboard")).toBeNull();
  });

  it("T15: exibe RankingCard com dados (posição #3)", () => {
    render(<HomeDashboard />);
    expect(screen.getByText("#3")).toBeTruthy();
  });

  it("T16: exibe CorrectScoresCard com totalCorrect", () => {
    render(<HomeDashboard />);
    // CorrectScoresCard exibe "4" (totalCorrect do baseDashboardSuccess)
    // Pode haver múltiplos "4" — apenas verificar que existe
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("T17: exibe AccuracyCard com percentual de aproveitamento", () => {
    render(<HomeDashboard />);
    // AccuracyCard e PerformanceCard ambos exibem "25%" — usar getAllByText
    const percentElements = screen.getAllByText("25%");
    expect(percentElements.length).toBeGreaterThan(0);
  });

  it("T18: exibe card Últimos Resultados (empty state quando results vazio)", () => {
    render(<HomeDashboard />);
    expect(screen.getByRole("article", { name: "Últimos Resultados" })).toBeTruthy();
  });

  it("T19: exibe card Meu Desempenho", () => {
    render(<HomeDashboard />);
    expect(screen.getByRole("article", { name: "Meu Desempenho" })).toBeTruthy();
  });

  it("T20: exibe card Avisos (empty state quando notices vazio)", () => {
    render(<HomeDashboard />);
    expect(screen.getByRole("region", { name: "Avisos do sistema" })).toBeTruthy();
  });
});

describe("HomeDashboard — estado sucesso sem dados (tudo null/vazio)", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      ...baseDashboardSuccess,
      ranking: null,
      performance: { totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null },
    });
  });

  it("T21: renderiza sem crash quando ranking é null", () => {
    render(<HomeDashboard />);
    // RankingCard exibe "--" quando summary é null
    expect(screen.getAllByText("--").length).toBeGreaterThan(0);
  });

  it("T22: HomeHeader exibe fallback quando profile.name não é fornecido pelo auth", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, profile: null });
    render(<HomeDashboard />);
    // HomeHeader: name=null → "Olá 👋"
    expect(screen.getByText("Olá 👋")).toBeTruthy();
  });

  it("T23: exibe empty-state de NextMatchCard ('Nenhum jogo disponível') quando nextMatch é null", () => {
    render(<HomeDashboard />);
    // nextMatch is null in this suite's beforeEach setup (inherited from baseDashboardSuccess)
    expect(screen.getByText("Nenhum jogo disponível")).toBeTruthy();
  });

  it("T24: exibe empty-state de LastResultsCard ('Nenhum resultado disponível') quando results é vazio", () => {
    render(<HomeDashboard />);
    // recentResults is [] in baseDashboardSuccess
    expect(screen.getByText("Nenhum resultado disponível")).toBeTruthy();
  });

  it("T25: exibe empty-state de CurrentStageCard ('Fase não definida') quando stage é null", () => {
    render(<HomeDashboard />);
    // currentStage.stage is null in baseDashboardSuccess
    expect(screen.getByText("Fase não definida")).toBeTruthy();
  });

  it("T26: exibe empty-state de NoticesCard ('Nenhum aviso no momento') quando notices é vazio", () => {
    render(<HomeDashboard />);
    // notices is [] in baseDashboardSuccess
    expect(screen.getByText("Nenhum aviso no momento")).toBeTruthy();
  });

  it("T27: renderiza os 4 card empty-states simultâneamente sem crash (cobertura integrada)", () => {
    render(<HomeDashboard />);
    expect(screen.getByText("Nenhum jogo disponível")).toBeTruthy();
    expect(screen.getByText("Nenhum resultado disponível")).toBeTruthy();
    expect(screen.getByText("Fase não definida")).toBeTruthy();
    expect(screen.getByText("Nenhum aviso no momento")).toBeTruthy();
  });
});
