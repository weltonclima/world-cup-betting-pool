import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` no-op sob vitest.
vi.mock("server-only", () => ({}));

const { verifySessionCookieMock, getFirestoreMock, cookiesMock } = vi.hoisted(
  () => ({
    verifySessionCookieMock: vi.fn(),
    getFirestoreMock: vi.fn(),
    cookiesMock: vi.fn(),
  }),
);

vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
  getAdminFirestore: getFirestoreMock,
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookie";

const MOCK_UID = "uid-1";
const SESSION = "session-cookie";

function setup({
  hasCookie = true,
  cookieValid = true,
  userStatus = "approved" as "approved" | "pending" | "blocked" | null,
  email = "ana@x.com",
  nickname = "ana",
}: {
  hasCookie?: boolean;
  cookieValid?: boolean;
  userStatus?: "approved" | "pending" | "blocked" | null;
  email?: string;
  nickname?: string;
} = {}) {
  cookiesMock.mockResolvedValue({
    get: vi.fn(() =>
      hasCookie ? { name: SESSION_COOKIE_NAME, value: SESSION } : undefined,
    ),
  });
  if (cookieValid) {
    verifySessionCookieMock.mockResolvedValue({ uid: MOCK_UID });
  } else {
    verifySessionCookieMock.mockRejectedValue(new Error("invalid"));
  }
  const userGet =
    userStatus === null
      ? vi.fn().mockResolvedValue({ exists: false })
      : vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: userStatus, email, nickname }),
        });
  getFirestoreMock.mockReturnValue({
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: userGet })) })),
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("requireApprovedUser", () => {
  it("401 quando não há cookie de sessão", async () => {
    setup({ hasCookie: false });
    const result = await requireApprovedUser();
    expect("errorResponse" in result).toBe(true);
    if ("errorResponse" in result) {
      expect(result.errorResponse.status).toBe(401);
    }
  });

  it("401 quando o cookie é inválido", async () => {
    setup({ cookieValid: false });
    const result = await requireApprovedUser();
    expect("errorResponse" in result && result.errorResponse.status).toBe(401);
  });

  it("401 quando o doc do usuário não existe", async () => {
    setup({ userStatus: null });
    const result = await requireApprovedUser();
    expect("errorResponse" in result && result.errorResponse.status).toBe(401);
  });

  it("403 quando o usuário é pending", async () => {
    setup({ userStatus: "pending" });
    const result = await requireApprovedUser();
    expect("errorResponse" in result && result.errorResponse.status).toBe(403);
  });

  it("403 quando o usuário é blocked", async () => {
    setup({ userStatus: "blocked" });
    const result = await requireApprovedUser();
    expect("errorResponse" in result && result.errorResponse.status).toBe(403);
  });

  it("retorna user {uid,email,nickname} quando approved", async () => {
    setup({ userStatus: "approved" });
    const result = await requireApprovedUser();
    expect("user" in result).toBe(true);
    if ("user" in result) {
      expect(result.user.uid).toBe(MOCK_UID);
      expect(result.user.email).toBe("ana@x.com");
      expect(result.user.nickname).toBe("ana");
    }
  });
});
