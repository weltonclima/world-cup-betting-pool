// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "@/providers/AuthProvider";
import { useAuth } from "@/hooks/useAuth";

// AuthProvider importa o barrel @/firebase (client SDK, exige env). Nos testes
// de unidade só precisamos do AuthContext, então mockamos o barrel.
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

describe("useAuth", () => {
  it("lança erro quando usado fora do <AuthProvider>", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth deve ser usado dentro de <AuthProvider>.",
    );
  });

  it("retorna o valor do contexto quando dentro do provider", () => {
    const value: AuthContextValue = {
      firebaseUser: null,
      profile: null,
      status: null,
      role: null,
      loading: false,
      error: null,
      refreshProfile: () => Promise.resolve(),
    };

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      );
    }

    function Consumer() {
      const ctx = useAuth();
      return <span data-testid="loading">{String(ctx.loading)}</span>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
