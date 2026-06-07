// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "@/providers/AuthProvider";
import type { Role } from "@/types";
import { AdminGuard } from "@/components/layout/AdminGuard";

interface AuthState {
  loading: boolean;
  role: Role | null;
}

const { replaceMock, authState } = vi.hoisted(() => ({
  replaceMock: vi.fn<(href: string) => void>(),
  authState: { loading: false, role: "admin" } as AuthState,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (): Pick<AuthContextValue, "loading" | "role"> => ({
    loading: authState.loading,
    role: authState.role,
  }),
}));

beforeEach(() => {
  authState.loading = false;
  authState.role = "admin";
  replaceMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminGuard", () => {
  it("T1: loading → LoadingScreen, sem redirect nem children", () => {
    authState.loading = true;
    authState.role = null;

    render(
      <AdminGuard>
        <div>PAINEL</div>
      </AdminGuard>,
    );

    expect(screen.queryByText("PAINEL")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("T2: role admin → renderiza children, sem redirect", () => {
    authState.role = "admin";

    render(
      <AdminGuard>
        <div>PAINEL</div>
      </AdminGuard>,
    );

    expect(screen.getByText("PAINEL")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("T3: role user → replace(/home), children ausente", async () => {
    authState.role = "user";

    render(
      <AdminGuard>
        <div>PAINEL</div>
      </AdminGuard>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home"));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("PAINEL")).toBeNull();
  });

  it("T4: role null → replace(/home), children ausente", async () => {
    authState.role = null;

    render(
      <AdminGuard>
        <div>PAINEL</div>
      </AdminGuard>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home"));
    expect(screen.queryByText("PAINEL")).toBeNull();
  });
});
