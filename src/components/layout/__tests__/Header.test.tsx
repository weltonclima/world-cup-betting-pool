// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "@/providers/AuthProvider";
import type { Role } from "@/types";
import { Header } from "@/components/layout/Header";

const { authState, pathnameState } = vi.hoisted(() => ({
  authState: { role: "admin" as Role | null },
  pathnameState: { value: "/home" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (): Pick<AuthContextValue, "role"> => ({ role: authState.role }),
}));

// Isola o teste do Header: o sino (PRD-08) tem suas próprias deps (React Query)
// cobertas em testes próprios. Aqui o foco é a entrada admin role-gated.
vi.mock("@/features/notifications/components/NotificationBell", () => ({
  NotificationBell: () => null,
}));

beforeEach(() => {
  authState.role = "admin";
  pathnameState.value = "/home";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Header — logo de identidade", () => {
  it("renderiza o logo como link para /home, acessível e sem distorção", () => {
    render(<Header />);

    const link = screen.getByRole("link", {
      name: "Bolão dos Parças — página inicial",
    });
    expect(link.getAttribute("href")).toBe("/home");

    const img = screen.getByAltText("Bolão dos Parças");
    expect(img.getAttribute("src")).toContain("logo-login.png");
    expect(img.className).toContain("object-contain");
  });

  it("exibe o logo independentemente do role (usuário comum também vê)", () => {
    authState.role = "user";

    render(<Header />);

    expect(
      screen.getByRole("link", { name: "Bolão dos Parças — página inicial" }),
    ).toBeTruthy();
  });
});

describe("Header — entrada admin role-gated", () => {
  it("T6: admin vê o item 'Painel admin' apontando para /admin/dashboard", () => {
    authState.role = "admin";

    render(<Header />);

    const link = screen.getByRole("link", { name: "Painel admin" });
    expect(link.getAttribute("href")).toBe("/admin/dashboard");
  });

  it("T7: usuário comum não vê o item (ausente do DOM)", () => {
    authState.role = "user";

    render(<Header />);

    expect(screen.queryByRole("link", { name: "Painel admin" })).toBeNull();
  });

  it("T8: role null não vê o item", () => {
    authState.role = null;

    render(<Header />);

    expect(screen.queryByRole("link", { name: "Painel admin" })).toBeNull();
  });

  it("T9: aria-current='page' quando em /admin, ausente fora", () => {
    authState.role = "admin";
    pathnameState.value = "/admin";

    const { rerender } = render(<Header />);
    expect(
      screen
        .getByRole("link", { name: "Painel admin" })
        .getAttribute("aria-current"),
    ).toBe("page");

    pathnameState.value = "/home";
    rerender(<Header />);
    expect(
      screen
        .getByRole("link", { name: "Painel admin" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});
