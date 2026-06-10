// @vitest-environment jsdom
import { onIdTokenChanged } from "firebase/auth";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionRenewal } from "@/hooks/useSessionRenewal";
import { refreshSessionCookie } from "@/services/auth";

/**
 * Hook headless de renovação de sessão (TASK-02).
 *
 * Assina `onIdTokenChanged` enquanto montado e, a cada evento de token,
 * aciona `refreshSessionCookie` (o throttle vive no serviço). Desassina no
 * unmount.
 */

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn(),
}));

vi.mock("@/firebase", () => ({
  firebaseAuth: { __tag: "auth" },
}));

vi.mock("@/services/auth", () => ({
  refreshSessionCookie: vi.fn(() => Promise.resolve()),
}));

const onIdTokenChangedMock = vi.mocked(onIdTokenChanged);
const refreshMock = vi.mocked(refreshSessionCookie);

beforeEach(() => {
  onIdTokenChangedMock.mockReset();
  refreshMock.mockReset();
  refreshMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSessionRenewal", () => {
  it("assina onIdTokenChanged no mount e desassina no unmount", () => {
    const unsubscribe = vi.fn();
    onIdTokenChangedMock.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useSessionRenewal());

    expect(onIdTokenChangedMock).toHaveBeenCalledTimes(1);
    expect(onIdTokenChangedMock).toHaveBeenCalledWith(
      expect.objectContaining({ __tag: "auth" }),
      expect.any(Function),
    );

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("aciona refreshSessionCookie quando o token muda", () => {
    onIdTokenChangedMock.mockReturnValue(vi.fn());

    renderHook(() => useSessionRenewal());

    // Recupera o callback passado ao onIdTokenChanged e o dispara.
    const callback = onIdTokenChangedMock.mock.calls[0]![1] as () => void;
    callback();

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
