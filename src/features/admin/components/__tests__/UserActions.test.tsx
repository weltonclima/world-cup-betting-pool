// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FirebaseError } from "firebase/app";

import type { User } from "@/types";
import { InvalidStatusTransitionError } from "@/features/admin/hooks/useUpdateUserStatus";
import { UserActions } from "@/features/admin/components/UserActions";

const { mutateAsyncMock, isPendingRef, toastSuccessMock, toastErrorMock } =
  vi.hoisted(() => ({
    mutateAsyncMock: vi.fn(),
    isPendingRef: { value: false },
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

// A cadeia de import alcança @/firebase (client valida env no load) — mockar.
vi.mock("@/firebase", () => ({ firestore: {}, firebaseAuth: {} }));

vi.mock("@/features/admin/hooks/useUpdateUserStatus", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/admin/hooks/useUpdateUserStatus")
    >();
  return {
    ...actual, // mantém InvalidStatusTransitionError real
    useUpdateUserStatus: () => ({
      mutateAsync: mutateAsyncMock,
      isPending: isPendingRef.value,
    }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

function fakeUser(): User {
  return {
    uid: "u1",
    name: "João da Silva",
    nickname: "joao",
    email: "joao@email.com",
    role: "user",
    status: "pending",
    createdAt: "2026-06-15T14:32:00.000Z",
  };
}

beforeEach(() => {
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue(undefined);
  isPendingRef.value = false;
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("UserActions — botões por tab", () => {
  it("T13: pending→Aprovar+Rejeitar; approved→Bloquear; blocked→Desbloquear", () => {
    const { rerender } = render(
      <UserActions user={fakeUser()} status="pending" />,
    );
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rejeitar" })).toBeTruthy();

    rerender(<UserActions user={fakeUser()} status="approved" />);
    expect(screen.getByRole("button", { name: "Bloquear" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();

    rerender(<UserActions user={fakeUser()} status="blocked" />);
    expect(screen.getByRole("button", { name: "Desbloquear" })).toBeTruthy();
  });
});

describe("UserActions — Aprovar (success-flow)", () => {
  it("T6: dispara direto e abre ApprovedDialog, sem toast", async () => {
    render(<UserActions user={fakeUser()} status="pending" />);

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        uid: "u1",
        from: "pending",
        to: "approved",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Usuário aprovado!")).toBeTruthy(),
    );
    expect(screen.getByText(/João da Silva foi aprovado/i)).toBeTruthy();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});

describe("UserActions — confirm-flow", () => {
  it("T7: Rejeitar confirma antes; cancelar não muta; confirmar muta+toast", async () => {
    render(<UserActions user={fakeUser()} status="pending" />);

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    // Abre o diálogo, sem mutar ainda.
    expect(screen.getByRole("dialog", { name: "Rejeitar usuário?" })).toBeTruthy();
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull(),
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    // Reabre e confirma.
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Rejeitar", hidden: false }),
    );
    // dois botões "Rejeitar": o da linha e o do diálogo; clica o do diálogo
    // (último na ordem do DOM = dentro do dialog footer).
    const rejectButtons = screen.getAllByRole("button", { name: "Rejeitar" });
    fireEvent.click(rejectButtons[rejectButtons.length - 1]!);

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        uid: "u1",
        from: "pending",
        to: "blocked",
      }),
    );
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Usuário rejeitado."),
    );
  });

  it("T8: Bloquear (approved→blocked) + toast", async () => {
    render(<UserActions user={fakeUser()} status="approved" />);
    fireEvent.click(screen.getByRole("button", { name: "Bloquear" }));
    const confirm = screen
      .getAllByRole("button", { name: "Bloquear" })
      .at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        uid: "u1",
        from: "approved",
        to: "blocked",
      }),
    );
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Usuário bloqueado."),
    );
  });

  it("T9: Desbloquear (blocked→approved) + toast", async () => {
    render(<UserActions user={fakeUser()} status="blocked" />);
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
    const confirm = screen
      .getAllByRole("button", { name: "Desbloquear" })
      .at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        uid: "u1",
        from: "blocked",
        to: "approved",
      }),
    );
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Usuário desbloqueado."),
    );
  });
});

describe("UserActions — erros", () => {
  it("T10: permission-denied → toast de permissão; ApprovedDialog não abre", async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new FirebaseError("permission-denied", "denied"),
    );

    render(<UserActions user={fakeUser()} status="pending" />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Você não tem permissão para esta ação.",
      ),
    );
    expect(screen.queryByText("Usuário aprovado!")).toBeNull();
  });

  it("T11: InvalidStatusTransitionError → toast de transição", async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new InvalidStatusTransitionError("approved", "pending"),
    );

    render(<UserActions user={fakeUser()} status="pending" />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não é possível alterar o status deste usuário.",
      ),
    );
  });
});

describe("UserActions — disabled durante submit", () => {
  it("T12: isPending → botões da linha disabled", () => {
    isPendingRef.value = true;
    render(<UserActions user={fakeUser()} status="pending" />);

    expect(
      screen.getByRole("button", { name: "Aprovar" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Rejeitar" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
