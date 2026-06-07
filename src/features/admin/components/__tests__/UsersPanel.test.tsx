// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UsersPanel } from "@/features/admin/components/UsersPanel";

const { useUserStatusCountsMock, useUsersByStatusMock } = vi.hoisted(() => ({
  useUserStatusCountsMock: vi.fn(),
  useUsersByStatusMock: vi.fn(),
}));

vi.mock("@/features/admin/hooks/useUsers", () => ({
  useUserStatusCounts: useUserStatusCountsMock,
  useUsersByStatus: useUsersByStatusMock,
}));

// UserStatusList→UserActions→useUpdateUserStatus→@/firebase (valida env) — mockar.
vi.mock("@/firebase", () => ({ firestore: {}, firebaseAuth: {} }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("UsersPanel", () => {
  it("T12: badges exibem contagens; Bloqueados é destructive", () => {
    useUserStatusCountsMock.mockReturnValue({
      pending: 3,
      approved: 52,
      blocked: 1,
    });
    useUsersByStatusMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
    });

    render(<UsersPanel />);

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("52")).toBeTruthy();
    const blockedBadge = screen.getByText("1");
    expect(blockedBadge.className).toContain("text-destructive");
  });

  it("T13: 3 tabs com tab default 'Pendentes' selecionada", () => {
    useUserStatusCountsMock.mockReturnValue({
      pending: 0,
      approved: 0,
      blocked: 0,
    });
    useUsersByStatusMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
    });

    render(<UsersPanel />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    const pending = screen.getByRole("tab", { name: /Pendentes/i });
    expect(pending.getAttribute("aria-selected")).toBe("true");
  });
});
