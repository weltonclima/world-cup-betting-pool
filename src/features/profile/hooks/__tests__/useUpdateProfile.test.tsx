// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateProfileMock, refreshProfileMock } = vi.hoisted(() => ({
  updateProfileMock: vi.fn(),
  refreshProfileMock: vi.fn(),
}));

vi.mock("@/services/users", () => ({ updateProfile: updateProfileMock }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ profile: { uid: "u1" }, refreshProfile: refreshProfileMock }),
}));

import { useUpdateProfile } from "@/features/profile/hooks/useUpdateProfile";

function wrapper(client: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateProfileMock.mockResolvedValue(undefined);
});

describe("useUpdateProfile", () => {
  it("no sucesso: relê o perfil E invalida os caches de ranking (foto nova aparece)", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ avatarUrl: "data:image/jpeg;base64,NEW" });

    await waitFor(() => expect(refreshProfileMock).toHaveBeenCalledTimes(1));
    expect(updateProfileMock).toHaveBeenCalledWith("u1", {
      avatarUrl: "data:image/jpeg;base64,NEW",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ranking"] });
  });
});
