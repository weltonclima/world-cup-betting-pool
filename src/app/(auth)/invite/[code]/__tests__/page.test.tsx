// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InvitePage from "../page";

// Mock do Admin SDK: a page valida o convite server-side antes de renderizar.
// Os dois cenários cobertos (expirado, não-encontrado) retornam ANTES do lookup
// de pool, então basta controlar `invites/{code}.get()`.
const getInvite = vi.fn();

// A page resolve o convite via util `@/server/invites/resolveInvite`, que importa
// `server-only` — neutralizado aqui para rodar em jsdom (o controle do lookup
// continua via mock de `getAdminFirestore` abaixo).
vi.mock("server-only", () => ({}));

// SignupForm só renderiza no caminho de sucesso (não exercido aqui) e puxa o
// firebase client env via import estático — mock evita o boot do SDK no teste.
vi.mock("@/features/auth/SignupForm", () => ({
  SignupForm: () => null,
}));

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => ({
      doc: () => ({
        get: () =>
          name === "invites"
            ? getInvite()
            : Promise.resolve({ exists: false }),
      }),
    }),
  }),
}));

/** Doc de convite válido exceto pelo que cada teste sobrescreve. */
function inviteDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "ABC123",
    groupId: "pool-1",
    code: "ABC123",
    maxUses: 10,
    usedCount: 0,
    expiresAt: "2030-01-01T00:00:00.000Z",
    isActive: true,
    createdBy: "admin-1",
    createdAt: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderInvite(code = "ABC123") {
  // InvitePage é Server Component assíncrono: resolve o JSX e renderiza.
  return InvitePage({ params: Promise.resolve({ code }) }).then((ui) =>
    render(ui),
  );
}

describe("InvitePage — estados de falha", () => {
  beforeEach(() => {
    getInvite.mockReset();
  });

  it("convite expirado → UI dedicada 'Este link expirou', sem link para /signup", async () => {
    getInvite.mockResolvedValue({
      exists: true,
      data: () => inviteDoc({ expiresAt: "2020-01-01T00:00:00.000Z" }),
    });

    await renderInvite();

    expect(
      screen.getByRole("heading", { name: "Este link expirou" }),
    ).toBeTruthy();
    // Estado expirado não oferece caminho de cadastro.
    expect(screen.queryByRole("link", { name: /criar sua conta/i })).toBeNull();
    expect(document.querySelector('a[href="/signup"]')).toBeNull();
    // Mas oferece login.
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe(
      "/login",
    );
  });

  it("convite não encontrado → UI genérica 'Convite indisponível'", async () => {
    getInvite.mockResolvedValue({ exists: false });

    await renderInvite();

    expect(
      screen.getByRole("heading", { name: "Convite indisponível" }),
    ).toBeTruthy();
    // Genérico preserva o caminho de cadastro atual.
    expect(
      screen.getByRole("link", { name: /criar sua conta/i }).getAttribute("href"),
    ).toBe("/signup");
  });
});
