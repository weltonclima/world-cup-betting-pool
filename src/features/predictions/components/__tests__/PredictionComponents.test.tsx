// @vitest-environment jsdom
/**
 * Testes dos componentes da tela de palpite (TASK-07).
 *
 * Cobre:
 * - ScoreInput: stepper acessível (valor, +/-, limites, aria, touch targets)
 * - PredictionLockedState: estado bloqueado (mensagem, placar read-only, sem botões +/-)
 * - PredictionSuccess: estado de sucesso (mensagem, role=status, aria-live, botão de volta)
 * - PredictionForm: modos create/edit, locked guard, submit, loading/error/404
 *
 * Padrão: espelha src/features/matches/components/__tests__/MatchDetail.test.tsx
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult, UseMutationResult } from "@tanstack/react-query";

// ── Mocks declarados ANTES dos imports de módulo (hoisting) ─────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    firebaseUser: { uid: "user-01" },
    profile: null,
    status: null,
    role: null,
    loading: false,
    error: null,
    refreshProfile: vi.fn(),
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/matches/match-001/predict",
}));

// Mock do useMatchDetail — PredictionForm usa este compositor
vi.mock("@/features/matches/hooks/useMatchDetail");

// Mock dos hooks de predictions
vi.mock("@/features/predictions/hooks", () => ({
  usePredictions: vi.fn(),
  useUpsertPrediction: vi.fn(),
  predictionsKeys: { all: () => ["predictions"] },
}));

// Mock de isPredictionLocked para controlar o estado "locked" nos testes
vi.mock("@/features/predictions/lib", () => ({
  isPredictionLocked: vi.fn(() => false),
}));

// ── Importações após mock ────────────────────────────────────────────────────

import { useMatchDetail } from "@/features/matches/hooks/useMatchDetail";
import type { MatchDetailData } from "@/features/matches/hooks/useMatchDetail";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";
import { usePredictions, useUpsertPrediction } from "@/features/predictions/hooks";
import type { UpsertPredictionInput } from "@/services/predictions";
import { isPredictionLocked } from "@/features/predictions/lib";
import type { Prediction } from "@/types";

import { ScoreInput } from "../ScoreInput";
import { PredictionLockedState } from "../PredictionLockedState";
import { PredictionSuccess } from "../PredictionSuccess";
import { PredictionForm } from "../PredictionForm";

// ── Typed mocks ─────────────────────────────────────────────────────────────

const mockedUseMatchDetail = vi.mocked(useMatchDetail);
const mockedUsePredictions = vi.mocked(usePredictions);
const mockedUseUpsertPrediction = vi.mocked(useUpsertPrediction);
const mockedIsPredictionLocked = vi.mocked(isPredictionLocked);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const matchFixture: MatchListItem = {
  id: "match-001",
  kickoffAt: "2026-12-14T20:00:00Z",
  stage: "grupos",
  round: 1,
  groupId: "Grupo C",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  venue: { name: "Estádio Lusail", city: "Lusail" },
  homeTeamId: "team-bra",
  awayTeamId: "team-fra",
  homeTeam: { name: "Brasil", flagUrl: "https://example.com/br.png" },
  awayTeam: { name: "França", flagUrl: "https://example.com/fr.png" },
  predictionStatus: "pendente",
  userPrediction: null,
};

const predictionFixture: Prediction = {
  uid: "user-01",
  matchId: "match-001",
  homeScore: 2,
  awayScore: 1,
};

function makeMatchDetailData(overrides: Partial<MatchDetailData> = {}): MatchDetailData {
  return {
    match: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function makeMutationResult(
  overrides: Partial<UseMutationResult<void, Error, UpsertPredictionInput>> = {},
): UseMutationResult<void, Error, UpsertPredictionInput> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    error: null,
    data: undefined,
    variables: undefined,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: "idle",
    submittedAt: 0,
    reset: vi.fn(),
    ...overrides,
  } as UseMutationResult<void, Error, UpsertPredictionInput>;
}

function makePredictionsQuery(
  data: Prediction[] | undefined = [],
): UseQueryResult<Prediction[]> {
  return {
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: false,
    isRefetching: false,
    isPaused: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    errorUpdateCount: 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    status: "success",
    refetch: vi.fn(),
    promise: Promise.resolve(data),
  } as unknown as UseQueryResult<Prediction[]>;
}

// ── Setup padrão para PredictionForm ────────────────────────────────────────

function setupDefaultMocks() {
  mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ match: matchFixture }));
  mockedUsePredictions.mockReturnValue(makePredictionsQuery([]));
  mockedUseUpsertPrediction.mockReturnValue(makeMutationResult());
  mockedIsPredictionLocked.mockReturnValue(false);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ===========================================================================
// ScoreInput
// ===========================================================================

describe("ScoreInput — renderização e acessibilidade", () => {
  it("T1: renderiza o valor inicial corretamente", () => {
    render(<ScoreInput label="Gols Mandante" value={3} onChange={vi.fn()} />);
    const output = screen.getByRole("status", { hidden: true }) ?? document.querySelector("output");
    // A <output> contém o valor
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("T2: botão + incrementa o valor ao clicar", () => {
    let value = 0;
    const onChange = vi.fn((v: number) => { value = v; });
    render(<ScoreInput label="Gols Mandante" value={value} onChange={onChange} />);
    const plusBtn = screen.getByRole("button", { name: "Aumentar Gols Mandante" });
    fireEvent.click(plusBtn);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("T3: botão - decrementa o valor ao clicar", () => {
    const onChange = vi.fn();
    render(<ScoreInput label="Gols Mandante" value={2} onChange={onChange} />);
    const minusBtn = screen.getByRole("button", { name: "Diminuir Gols Mandante" });
    fireEvent.click(minusBtn);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("T4: não desce abaixo de 0 (botão - desabilitado em 0)", () => {
    const onChange = vi.fn();
    render(<ScoreInput label="Gols Mandante" value={0} onChange={onChange} />);
    const minusBtn = screen.getByRole("button", { name: "Diminuir Gols Mandante" }) as HTMLButtonElement;
    expect(minusBtn.disabled).toBe(true);
    fireEvent.click(minusBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("T5: aria-label do grupo está presente (role=group)", () => {
    render(<ScoreInput label="Gols Mandante" value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Gols Mandante" })).toBeTruthy();
  });

  it("T6: aria-label do botão + está presente", () => {
    render(<ScoreInput label="Gols Mandante" value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Aumentar Gols Mandante" })).toBeTruthy();
  });

  it("T7: aria-label do botão - está presente", () => {
    render(<ScoreInput label="Gols Mandante" value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Diminuir Gols Mandante" })).toBeTruthy();
  });

  it("T8: <output> com aria-live=polite reflete o valor", () => {
    render(<ScoreInput label="Gols Mandante" value={5} onChange={vi.fn()} />);
    const output = document.querySelector("output");
    expect(output).not.toBeNull();
    expect(output?.getAttribute("aria-live")).toBe("polite");
    expect(output?.textContent).toBe("5");
  });

  it("T9: botões têm min-h-[44px] (touch targets)", () => {
    render(<ScoreInput label="Gols Mandante" value={1} onChange={vi.fn()} />);
    const plusBtn = screen.getByRole("button", { name: "Aumentar Gols Mandante" });
    const minusBtn = screen.getByRole("button", { name: "Diminuir Gols Mandante" });
    expect(plusBtn.className).toContain("min-h-[44px]");
    expect(minusBtn.className).toContain("min-h-[44px]");
  });

  it("T10: botão + desabilitado quando valor >= max", () => {
    render(<ScoreInput label="Gols Mandante" value={20} onChange={vi.fn()} max={20} />);
    const plusBtn = screen.getByRole("button", { name: "Aumentar Gols Mandante" }) as HTMLButtonElement;
    expect(plusBtn.disabled).toBe(true);
  });

  it("T11: disabled=true desabilita ambos os botões", () => {
    render(<ScoreInput label="Gols Mandante" value={2} onChange={vi.fn()} disabled />);
    const plusBtn = screen.getByRole("button", { name: "Aumentar Gols Mandante" }) as HTMLButtonElement;
    const minusBtn = screen.getByRole("button", { name: "Diminuir Gols Mandante" }) as HTMLButtonElement;
    expect(plusBtn.disabled).toBe(true);
    expect(minusBtn.disabled).toBe(true);
  });
});

// ===========================================================================
// PredictionLockedState
// ===========================================================================

describe("PredictionLockedState — estado bloqueado", () => {
  it("T12: exibe mensagem 'O prazo para este jogo foi encerrado.'", () => {
    render(<PredictionLockedState match={matchFixture} />);
    expect(screen.getByText(/O prazo para este jogo foi encerrado\./)).toBeTruthy();
  });

  it("T13: exibe título 'Palpite bloqueado'", () => {
    render(<PredictionLockedState match={matchFixture} />);
    expect(screen.getByText("Palpite bloqueado")).toBeTruthy();
  });

  it("T14: exibe placar do palpite quando prediction está presente", () => {
    render(<PredictionLockedState match={matchFixture} prediction={predictionFixture} />);
    // homeScore=2, awayScore=1
    const allTwos = screen.getAllByText("2");
    expect(allTwos.length).toBeGreaterThan(0);
    const allOnes = screen.getAllByText("1");
    expect(allOnes.length).toBeGreaterThan(0);
  });

  it("T15: NÃO renderiza botões +/- (placar read-only)", () => {
    render(<PredictionLockedState match={matchFixture} prediction={predictionFixture} />);
    const plusBtns = screen.queryAllByRole("button", { name: /Aumentar/i });
    const minusBtns = screen.queryAllByRole("button", { name: /Diminuir/i });
    expect(plusBtns).toHaveLength(0);
    expect(minusBtns).toHaveLength(0);
  });

  it("T16: sem prediction — exibe mensagem adicional sobre impossibilidade de palpitar", () => {
    render(<PredictionLockedState match={matchFixture} />);
    expect(screen.getByText(/Não foi possível criar ou alterar seu palpite\./)).toBeTruthy();
  });

  it("T17: exibe link 'Voltar para Jogos' apontando para /matches", () => {
    render(<PredictionLockedState match={matchFixture} />);
    const link = screen.getByText("Voltar para Jogos").closest("a");
    expect(link?.getAttribute("href")).toBe("/matches");
  });

  it("T18: exibe nomes dos times no header do jogo", () => {
    render(<PredictionLockedState match={matchFixture} />);
    expect(screen.getAllByText("Brasil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("França").length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// PredictionSuccess
// ===========================================================================

describe("PredictionSuccess — estado de confirmação", () => {
  it("T19: exibe 'Seu palpite foi salvo com sucesso.'", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={2} awayScore={1} />);
    expect(screen.getByText("Seu palpite foi salvo com sucesso.")).toBeTruthy();
  });

  it("T20: container tem role=status", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={2} awayScore={1} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("T21: container tem aria-live=polite", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={2} awayScore={1} />);
    const statusEl = screen.getByRole("status");
    expect(statusEl.getAttribute("aria-live")).toBe("polite");
  });

  it("T22: botão 'Voltar para Jogos' navega para /matches", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={2} awayScore={1} />);
    const link = screen.getByText("Voltar para Jogos").closest("a");
    expect(link?.getAttribute("href")).toBe("/matches");
  });

  it("T23: exibe 'Palpite registrado!' como título", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={2} awayScore={1} />);
    expect(screen.getByText("Palpite registrado!")).toBeTruthy();
  });

  it("T24: exibe os scores passados como props", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={3} awayScore={0} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("T25: NÃO exibe texto de pontuação '3', '1' ou '0 pontos' de sistema", () => {
    render(<PredictionSuccess match={matchFixture} homeScore={2} awayScore={1} />);
    // Não deve haver menção a pontos do sistema (apenas placar)
    expect(screen.queryByText(/pontos/i)).toBeNull();
    expect(screen.queryByText(/\+3/)).toBeNull();
    expect(screen.queryByText(/\+1/)).toBeNull();
  });
});

// ===========================================================================
// PredictionForm — modo CREATE
// ===========================================================================

describe("PredictionForm — modo CREATE (sem palpite existente)", () => {
  it("T26: exibe título 'Enviar Palpite'", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Enviar Palpite")).toBeTruthy();
  });

  it("T27: exibe botão 'Salvar palpite'", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Salvar palpite")).toBeTruthy();
  });

  it("T28: renderiza os steppers de placar (Gols Mandante e Gols Visitante)", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByRole("group", { name: "Gols Mandante" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Gols Visitante" })).toBeTruthy();
  });

  it("T29: scores iniciam em 0", () => {
    render(<PredictionForm matchId="match-001" />);
    const outputs = document.querySelectorAll("output");
    expect(outputs.length).toBeGreaterThanOrEqual(2);
    outputs.forEach((o) => expect(o.textContent).toBe("0"));
  });

  it("T30: NÃO exibe aviso de edição no modo create", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(
      screen.queryByText("Alterações são permitidas até o horário oficial de início do jogo."),
    ).toBeNull();
  });
});

// ===========================================================================
// PredictionForm — modo EDIT (palpite existente)
// ===========================================================================

describe("PredictionForm — modo EDIT (palpite existente)", () => {
  beforeEach(() => {
    mockedUsePredictions.mockReturnValue(makePredictionsQuery([predictionFixture]));
  });

  it("T31: exibe título 'Editar Palpite'", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Editar Palpite")).toBeTruthy();
  });

  it("T32: exibe botão 'Atualizar palpite'", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Atualizar palpite")).toBeTruthy();
  });

  it("T33: pré-preenche scores com valores do palpite existente (homeScore=2, awayScore=1)", async () => {
    render(<PredictionForm matchId="match-001" />);
    // useEffect dispara o form.reset com os valores da fixture (homeScore=2, awayScore=1)
    await waitFor(() => {
      const outputs = document.querySelectorAll("output");
      const values = Array.from(outputs).map((o) => o.textContent);
      expect(values).toContain("2");
      expect(values).toContain("1");
    });
  });

  it("T34: exibe aviso de edição no modo edit", async () => {
    render(<PredictionForm matchId="match-001" />);
    await waitFor(() => {
      expect(
        screen.getByText("Alterações são permitidas até o horário oficial de início do jogo."),
      ).toBeTruthy();
    });
  });
});

// ===========================================================================
// PredictionForm — estado LOCKED
// ===========================================================================

describe("PredictionForm — quando isPredictionLocked=true", () => {
  beforeEach(() => {
    mockedIsPredictionLocked.mockReturnValue(true);
  });

  it("T35: renderiza PredictionLockedState (mensagem bloqueado)", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText(/O prazo para este jogo foi encerrado\./)).toBeTruthy();
  });

  it("T36: NÃO renderiza o formulário de palpite", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.queryByText("Salvar palpite")).toBeNull();
    expect(screen.queryByText("Atualizar palpite")).toBeNull();
  });

  it("T37: com prediction existente — mostra placar no estado bloqueado", () => {
    mockedUsePredictions.mockReturnValue(makePredictionsQuery([predictionFixture]));
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Palpite bloqueado")).toBeTruthy();
  });
});

// ===========================================================================
// PredictionForm — SUBMIT
// ===========================================================================

describe("PredictionForm — submit", () => {
  it("T38: submit chama mutation.mutateAsync com {matchId, homeScore, awayScore} corretos", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockedUseUpsertPrediction.mockReturnValue(
      makeMutationResult({ mutateAsync }),
    );

    render(<PredictionForm matchId="match-001" />);

    // Incrementa homeScore para 1
    const plusBtns = screen.getAllByRole("button", { name: /Aumentar/i });
    fireEvent.click(plusBtns[0]!); // homeScore = 1

    // Submete o form
    const submitBtn = screen.getByText("Salvar palpite");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        matchId: "match-001",
        homeScore: 1,
        awayScore: 0,
      });
    });
  });

  it("T39: onSuccess → renderiza PredictionSuccess com 'Palpite registrado!'", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockedUseUpsertPrediction.mockReturnValue(
      makeMutationResult({ mutateAsync }),
    );

    render(<PredictionForm matchId="match-001" />);

    const submitBtn = screen.getByText("Salvar palpite");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Palpite registrado!")).toBeTruthy();
    });
  });

  it("T40: onSuccess → exibe 'Seu palpite foi salvo com sucesso.'", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockedUseUpsertPrediction.mockReturnValue(
      makeMutationResult({ mutateAsync }),
    );

    render(<PredictionForm matchId="match-001" />);

    const submitBtn = screen.getByText("Salvar palpite");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Seu palpite foi salvo com sucesso.")).toBeTruthy();
    });
  });

  it("T41: NÃO exibe texto de pontuação '3', '1', '0 pontos' na tela de palpite", () => {
    render(<PredictionForm matchId="match-001" />);
    expect(screen.queryByText(/pontos/i)).toBeNull();
    expect(screen.queryByText(/\+3/)).toBeNull();
    expect(screen.queryByText(/\+1/)).toBeNull();
  });
});

// ===========================================================================
// PredictionForm — estados loading / error / 404
// ===========================================================================

describe("PredictionForm — estado loading", () => {
  it("T42: renderiza skeleton com aria-busy quando isLoading=true", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ isLoading: true }));
    render(<PredictionForm matchId="match-001" />);
    const skeleton = screen.getByRole("status", { name: "Carregando formulário de palpite" });
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
  });

  it("T43: NÃO renderiza o formulário durante loading", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ isLoading: true }));
    render(<PredictionForm matchId="match-001" />);
    expect(screen.queryByText("Salvar palpite")).toBeNull();
    expect(screen.queryByText("Enviar Palpite")).toBeNull();
  });
});

describe("PredictionForm — estado error", () => {
  it("T44: renderiza mensagem de erro quando isError=true", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ isError: true }));
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Erro ao carregar o jogo")).toBeTruthy();
  });

  it("T45: exibe botão 'Tentar novamente'", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ isError: true }));
    render(<PredictionForm matchId="match-001" />);
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T46: chama refetch ao clicar em 'Tentar novamente'", () => {
    const refetch = vi.fn();
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ isError: true, refetch }));
    render(<PredictionForm matchId="match-001" />);
    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("PredictionForm — estado 404 (match=null)", () => {
  it("T47: exibe 'Jogo não encontrado' quando match=null e não loading/error", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ match: null }));
    render(<PredictionForm matchId="match-xxx" />);
    expect(screen.getByText("Jogo não encontrado")).toBeTruthy();
  });

  it("T48: exibe mensagem descritiva no 404", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ match: null }));
    render(<PredictionForm matchId="match-xxx" />);
    expect(screen.getByText("Não foi possível encontrar este jogo.")).toBeTruthy();
  });

  it("T49: exibe link 'Voltar para Jogos' apontando para /matches no 404", () => {
    mockedUseMatchDetail.mockReturnValue(makeMatchDetailData({ match: null }));
    render(<PredictionForm matchId="match-xxx" />);
    const link = screen.getByText("Voltar para Jogos").closest("a");
    expect(link?.getAttribute("href")).toBe("/matches");
  });
});
