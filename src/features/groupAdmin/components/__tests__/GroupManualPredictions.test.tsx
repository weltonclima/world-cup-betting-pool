// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GroupUser } from "@/services/group";
import type { MatchWithId, TeamWithId } from "@/types";
import { GroupManualPredictions } from "@/features/groupAdmin/components/GroupManualPredictions";

const { useGroupUsersMock, useCreateManualPredictionMock, useMatchesMock, useTeamsMock } =
  vi.hoisted(() => ({
    useGroupUsersMock: vi.fn(),
    useCreateManualPredictionMock: vi.fn(),
    useMatchesMock: vi.fn(),
    useTeamsMock: vi.fn(),
  }));

vi.mock("@/features/groupAdmin/hooks", () => ({
  useGroupUsers: useGroupUsersMock,
  useCreateManualPrediction: useCreateManualPredictionMock,
}));
vi.mock("@/features/matches/hooks", () => ({ useMatches: useMatchesMock }));
vi.mock("@/features/home/hooks", () => ({ useTeams: useTeamsMock }));

// GroupAdminSubHeader usa useRouter() (router.back()) — stub mínimo.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

function fakeMember(uid: string): GroupUser {
  return {
    user: {
      uid,
      name: `Nome ${uid}`,
      nickname: uid,
      email: `${uid}@email.com`,
      role: "participant",
      status: "approved",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
  };
}

// Match `finished` → sempre bloqueado por `selectLockedMatches` (status !== scheduled).
function lockedMatch(id: string): MatchWithId {
  return {
    id,
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    kickoffAt: "2026-06-10T12:00:00.000Z",
    stage: "grupos",
    status: "finished",
    homeScore: 2,
    awayScore: 0,
  };
}

function scheduledMatch(id: string): MatchWithId {
  return {
    id,
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    kickoffAt: "2099-01-01T12:00:00.000Z",
    stage: "grupos",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  };
}

function team(id: string, name: string, code: string): TeamWithId {
  return { id, name, code };
}

const teams: TeamWithId[] = [team("t-home", "Brasil", "BRA"), team("t-away", "Argentina", "ARG")];

function ok<T>(data: T) {
  return { data, isLoading: false, isError: false, refetch: vi.fn() };
}

function mutationStub(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean }> = {}) {
  return { mutate: vi.fn(), isPending: false, ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GroupManualPredictions", () => {
  it("loading → não renderiza o form (sem botão Salvar palpite)", () => {
    useGroupUsersMock.mockReturnValue({ isLoading: true, isError: false });
    // refetch sempre presente no hook real (React Query); o componente o dispara
    // no mount para realinhar o lock com o servidor.
    useMatchesMock.mockReturnValue({ isLoading: true, isError: false, refetch: vi.fn() });
    useTeamsMock.mockReturnValue({ isLoading: true, isError: false });
    useCreateManualPredictionMock.mockReturnValue(mutationStub());

    render(<GroupManualPredictions />);
    expect(screen.queryByRole("button", { name: /Salvar palpite/i })).toBeNull();
  });

  it("error → alert + retry chama refetch das queries com erro", () => {
    const membersRefetch = vi.fn();
    useGroupUsersMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: membersRefetch,
    });
    useMatchesMock.mockReturnValue(ok<MatchWithId[]>([lockedMatch("m1")]));
    useTeamsMock.mockReturnValue(ok(teams));
    useCreateManualPredictionMock.mockReturnValue(mutationStub());

    render(<GroupManualPredictions />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(membersRefetch).toHaveBeenCalledTimes(1);
  });

  it("vazio: sem participantes aprovados → empty state", () => {
    useGroupUsersMock.mockReturnValue(ok<GroupUser[]>([]));
    useMatchesMock.mockReturnValue(ok<MatchWithId[]>([lockedMatch("m1")]));
    useTeamsMock.mockReturnValue(ok(teams));
    useCreateManualPredictionMock.mockReturnValue(mutationStub());

    render(<GroupManualPredictions />);
    expect(screen.getByText("Nenhum participante aprovado no grupo.")).toBeTruthy();
  });

  it("vazio: sem jogos bloqueados → empty state", () => {
    useGroupUsersMock.mockReturnValue(ok<GroupUser[]>([fakeMember("u1")]));
    useMatchesMock.mockReturnValue(ok<MatchWithId[]>([scheduledMatch("m1")]));
    useTeamsMock.mockReturnValue(ok(teams));
    useCreateManualPredictionMock.mockReturnValue(mutationStub());

    render(<GroupManualPredictions />);
    expect(
      screen.getByText("Nenhum jogo bloqueado para lançar palpite."),
    ).toBeTruthy();
  });

  it("mount: refetch dos jogos é disparado (realinha o lock com o servidor)", () => {
    // Regressão: a lista do dropdown vinha de cache (staleTime 30min) e podia
    // ofertar um jogo cujo lock já mudou no servidor → 409 confuso. O refetch no
    // mount realinha a UI à verdade do servidor antes de o admin escolher.
    const matchesRefetch = vi.fn();
    useGroupUsersMock.mockReturnValue(ok<GroupUser[]>([fakeMember("u1")]));
    useMatchesMock.mockReturnValue({
      data: [lockedMatch("m1")],
      isLoading: false,
      isError: false,
      refetch: matchesRefetch,
    });
    useTeamsMock.mockReturnValue(ok(teams));
    useCreateManualPredictionMock.mockReturnValue(mutationStub());

    render(<GroupManualPredictions />);
    expect(matchesRefetch).toHaveBeenCalledTimes(1);
  });

  it("happy: seleciona participante + jogo → confirma → mutate com payload correto", () => {
    const mutate = vi.fn();
    useGroupUsersMock.mockReturnValue(ok<GroupUser[]>([fakeMember("u1")]));
    useMatchesMock.mockReturnValue(ok<MatchWithId[]>([lockedMatch("m1")]));
    useTeamsMock.mockReturnValue(ok(teams));
    useCreateManualPredictionMock.mockReturnValue(mutationStub({ mutate }));

    render(<GroupManualPredictions />);

    const submit = screen.getByRole("button", { name: /Salvar palpite/i });
    // Sem seleção → submit desabilitado.
    expect(submit.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Participante"), {
      target: { value: "u1" },
    });
    fireEvent.change(screen.getByLabelText("Jogo"), {
      target: { value: "m1" },
    });
    expect(submit.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submit);
    // Diálogo de confirmação abre; confirma a sobrescrita.
    fireEvent.click(screen.getByRole("button", { name: /Lançar palpite/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      { targetUid: "u1", matchId: "m1", homeScore: 0, awayScore: 0 },
      expect.anything(),
    );
  });
});
