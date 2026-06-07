// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listUsersByStatus } from "@/services/users";
import type { User } from "@/types";
import {
  useUserStatusCounts,
  useUsersByStatus,
} from "@/features/admin/hooks/useUsers";
import { usersKeys } from "@/features/admin/hooks/usersKeys";

vi.mock("@/services/users", () => ({
  listUsersByStatus: vi.fn(),
  updateUserStatus: vi.fn(),
}));

const listMock = vi.mocked(listUsersByStatus);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function fakeUser(uid: string, status: User["status"]): User {
  return {
    uid,
    name: `Nome ${uid}`,
    nickname: uid,
    email: `${uid}@email.com`,
    role: "user",
    status,
    createdAt: "2026-06-01T10:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usersKeys", () => {
  it("T2: byStatus retorna chave estável e correta", () => {
    expect(usersKeys.byStatus("approved")).toEqual([
      "users",
      "by-status",
      "approved",
    ]);
    expect(usersKeys.byStatus("pending")).toEqual(
      usersKeys.byStatus("pending"),
    );
  });
});

describe("useUsersByStatus", () => {
  it("T1: monta a query com a chave/status certos e resolve os dados", async () => {
    listMock.mockResolvedValueOnce([fakeUser("u1", "pending")]);

    const { result } = renderHook(() => useUsersByStatus("pending"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith("pending");
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.uid).toBe("u1");
  });
});

describe("useUserStatusCounts", () => {
  it("T3: conta corretamente as 3 tabs", async () => {
    listMock.mockImplementation((status) => {
      if (status === "pending")
        return Promise.resolve([
          fakeUser("a", "pending"),
          fakeUser("b", "pending"),
        ]);
      if (status === "approved")
        return Promise.resolve([
          fakeUser("c", "approved"),
          fakeUser("d", "approved"),
          fakeUser("e", "approved"),
        ]);
      return Promise.resolve([fakeUser("f", "blocked")]);
    });

    const { result } = renderHook(() => useUserStatusCounts(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current).toEqual({ pending: 2, approved: 3, blocked: 1 }),
    );
  });

  it("T4: contadores default 0 enquanto carrega (sem NaN/undefined)", () => {
    listMock.mockReturnValue(new Promise<User[]>(() => {}));

    const { result } = renderHook(() => useUserStatusCounts(), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toEqual({ pending: 0, approved: 0, blocked: 0 });
  });
});
