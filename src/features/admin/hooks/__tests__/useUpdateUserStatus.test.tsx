// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateUserStatus } from "@/services/users";
import {
  InvalidStatusTransitionError,
  useUpdateUserStatus,
} from "@/features/admin/hooks/useUpdateUserStatus";
import { usersKeys } from "@/features/admin/hooks/usersKeys";

vi.mock("@/services/users", () => ({
  listUsersByStatus: vi.fn(),
  updateUserStatus: vi.fn(),
}));

const updateMock = vi.mocked(updateUserStatus);

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result } = renderHook(() => useUpdateUserStatus(), {
    wrapper: Wrapper,
  });
  return { result, invalidateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUpdateUserStatus", () => {
  it("T5: transição válida chama o service com (uid, to)", async () => {
    updateMock.mockResolvedValueOnce(undefined);
    const { result } = setup();

    await result.current.mutateAsync({
      uid: "u1",
      from: "pending",
      to: "approved",
    });

    expect(updateMock).toHaveBeenCalledWith("u1", "approved");
  });

  it("T6: invalida origem + destino (pending→approved e approved→blocked)", async () => {
    updateMock.mockResolvedValue(undefined);
    const { result, invalidateSpy } = setup();

    await result.current.mutateAsync({
      uid: "u1",
      from: "pending",
      to: "approved",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: usersKeys.byStatus("pending"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: usersKeys.byStatus("approved"),
    });

    invalidateSpy.mockClear();

    await result.current.mutateAsync({
      uid: "u2",
      from: "approved",
      to: "blocked",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: usersKeys.byStatus("approved"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: usersKeys.byStatus("blocked"),
    });
  });

  it("T7: transição inválida rejeita sem tocar service nem invalidar", async () => {
    const { result, invalidateSpy } = setup();

    await expect(
      result.current.mutateAsync({
        uid: "u1",
        from: "approved",
        to: "pending",
      }),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);

    expect(updateMock).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("T8: no-op (from === to) é barrado", async () => {
    const { result } = setup();

    await expect(
      result.current.mutateAsync({
        uid: "u1",
        from: "approved",
        to: "approved",
      }),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("T9: erro do service propaga cru e não invalida", async () => {
    const err = Object.assign(new Error("denied"), {
      code: "permission-denied",
    });
    updateMock.mockRejectedValueOnce(err);
    const { result, invalidateSpy } = setup();

    await expect(
      result.current.mutateAsync({
        uid: "u1",
        from: "pending",
        to: "approved",
      }),
    ).rejects.toBe(err);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
