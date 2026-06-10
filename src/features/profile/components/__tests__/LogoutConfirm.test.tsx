// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogoutConfirm } from "@/features/profile/components/LogoutConfirm";
import { markPasskeyRegistered } from "@/features/passkeys/lib/passkeyHint";

const { signOutMock, replaceMock, queryClearMock } = vi.hoisted(() => ({
  signOutMock: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  replaceMock: vi.fn(),
  queryClearMock: vi.fn(),
}));

vi.mock("@/services/auth", () => ({ signOut: signOutMock }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, back: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: queryClearMock }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  signOutMock.mockResolvedValue(undefined);
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

function clickLogout(): void {
  fireEvent.click(screen.getByRole("button", { name: /encerrar sessão/i }));
}

describe("LogoutConfirm", () => {
  it("regressão: preserva o passkey-hint ao limpar o localStorage no logout", async () => {
    // Dispositivo com biometria cadastrada (hint presente) + cache qualquer.
    markPasskeyRegistered();
    window.localStorage.setItem("bolao:cache-qualquer", "x");

    render(<LogoutConfirm />);
    clickLogout();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));

    // Cache/preferências da sessão foram limpos…
    expect(window.localStorage.getItem("bolao:cache-qualquer")).toBeNull();
    expect(queryClearMock).toHaveBeenCalledTimes(1);
    // …mas o sinal de confiança do DISPOSITIVO sobrevive → botão de biometria
    // volta a aparecer no próximo login.
    expect(window.localStorage.getItem("bolao:passkey-hint")).toBe("1");
  });

  it("sem hint: logout limpa tudo e não recria o hint", async () => {
    window.localStorage.setItem("bolao:cache-qualquer", "x");

    render(<LogoutConfirm />);
    clickLogout();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));

    expect(window.localStorage.getItem("bolao:cache-qualquer")).toBeNull();
    expect(window.localStorage.getItem("bolao:passkey-hint")).toBeNull();
  });

  it("falha no signOut: mantém na tela e exibe erro (não navega)", async () => {
    signOutMock.mockRejectedValueOnce(new Error("network"));

    render(<LogoutConfirm />);
    clickLogout();

    await waitFor(() =>
      expect(
        (screen.getByRole("button", {
          name: /encerrar sessão/i,
        }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
