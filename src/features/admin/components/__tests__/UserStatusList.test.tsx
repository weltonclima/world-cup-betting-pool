// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/types";
import { UserStatusList } from "@/features/admin/components/UserStatusList";

const { useUsersByStatusMock } = vi.hoisted(() => ({
  useUsersByStatusMock: vi.fn(),
}));

vi.mock("@/features/admin/hooks/useUsers", () => ({
  useUsersByStatus: useUsersByStatusMock,
}));

// Stub de UserActions: evita puxar useUpdateUserStatus/QueryClient neste teste
// de estados. Marca presença das ações por usuário.
vi.mock("@/features/admin/components/UserActions", () => ({
  UserActions: ({ status }: { status: string }) => (
    <button>acao-{status}</button>
  ),
}));

function fakeUser(uid: string): User {
  return {
    uid,
    name: `Nome ${uid}`,
    nickname: uid,
    email: `${uid}@email.com`,
    role: "user",
    status: "pending",
    createdAt: "2026-06-15T14:32:00.000Z",
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("UserStatusList", () => {
  it("T8: isPending → skeleton (role=status)", () => {
    useUsersByStatusMock.mockReturnValue({ isPending: true, isError: false });

    render(<UserStatusList status="pending" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Carregando usuários",
    );
  });

  it("T9: isError → erro (role=alert) e retry chama refetch", () => {
    const refetch = vi.fn();
    useUsersByStatusMock.mockReturnValue({
      isPending: false,
      isError: true,
      refetch,
    });

    render(<UserStatusList status="pending" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("T10: data vazia → empty com texto contextual", () => {
    useUsersByStatusMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
    });

    render(<UserStatusList status="blocked" />);
    expect(screen.getByText("Nenhum usuário bloqueado.")).toBeTruthy();
  });

  it("T11: data com itens → lista com ações injetadas por usuário", () => {
    useUsersByStatusMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [fakeUser("a"), fakeUser("b")],
    });

    render(<UserStatusList status="approved" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Cada item recebe UserActions (stub) com o status da tab.
    expect(screen.getAllByRole("button", { name: "acao-approved" })).toHaveLength(
      2,
    );
  });
});
