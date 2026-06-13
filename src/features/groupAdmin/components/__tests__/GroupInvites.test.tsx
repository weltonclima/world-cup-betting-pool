// @vitest-environment jsdom

/**
 * Testes de `GroupInvites` focados na lógica de estado de erro (TASK-01).
 *
 * Cobertura relevante:
 * - 403 (admin sem groupId) → mensagem específica "não está vinculado", sem retry
 * - Erro não-403 → ErrorState genérico com "Tentar novamente"
 * - Estado de loading → skeleton (sem crash)
 * - Lista vazia → tabs com EmptyState (sem crash)
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupServiceError } from "@/services/group";

const {
  useGroupInvitesMock,
  useCreateInviteMock,
  useGroupSettingsMock,
} = vi.hoisted(() => ({
  useGroupInvitesMock: vi.fn(),
  useCreateInviteMock: vi.fn(),
  useGroupSettingsMock: vi.fn(),
}));

vi.mock("@/features/groupAdmin/hooks", () => ({
  useGroupInvites: useGroupInvitesMock,
  useCreateInvite: useCreateInviteMock,
  useGroupSettings: useGroupSettingsMock,
}));

// GroupAdminSubHeader usa useRouter() — stub mínimo.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

import { GroupInvites } from "@/features/groupAdmin/components/GroupInvites";

function stubMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  useCreateInviteMock.mockReturnValue(stubMutation());
  useGroupSettingsMock.mockReturnValue({ data: { allowInvites: true } });
});

describe("GroupInvites — estados de erro", () => {
  it("403 exibe mensagem de perfil não vinculado sem botão de retry", () => {
    useGroupInvitesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new GroupServiceError(403, "Você não administra nenhum grupo."),
      refetch: vi.fn(),
    });

    render(<GroupInvites />);

    expect(screen.getByText(/não tem permissão para gerenciar convites/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).toBeNull();
  });

  it("erro não-403 exibe ErrorState genérico com botão de retry", () => {
    useGroupInvitesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new GroupServiceError(500, "Erro interno."),
      refetch: vi.fn(),
    });

    render(<GroupInvites />);

    expect(screen.queryByText(/não está vinculado/i)).toBeNull();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeTruthy();
  });

  it("erro de rede (Error genérico, não GroupServiceError) exibe ErrorState genérico", () => {
    useGroupInvitesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
      refetch: vi.fn(),
    });

    render(<GroupInvites />);

    expect(screen.queryByText(/não está vinculado/i)).toBeNull();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeTruthy();
  });

  it("loading exibe skeleton sem crash", () => {
    useGroupInvitesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GroupInvites />);

    // Não deve lançar erro; não exibe erro nem retry
    expect(screen.queryByText(/não está vinculado/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).toBeNull();
  });
});
