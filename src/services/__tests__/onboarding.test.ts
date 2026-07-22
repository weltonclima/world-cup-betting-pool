import type { User as FirebaseUser, UserCredential } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
} from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGroupAndAccount,
  OnboardingSubmitError,
  type CreateGroupInput,
} from "@/services/onboarding";

// --- Mocks de Firebase (sem rede), espelhando services/auth.test.ts ---
vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  sendEmailVerification: vi.fn(async () => undefined),
}));

// Hoisted: referenciados pela fábrica de vi.mock("@/firebase") (içada ao topo).
const { currentUserRef, persistenceRef } = vi.hoisted(() => ({
  currentUserRef: { value: null } as {
    value: { getIdToken: ReturnType<typeof vi.fn> } | null;
  },
  persistenceRef: { value: Promise.resolve() as Promise<void> },
}));

vi.mock("@/firebase", () => ({
  firebaseAuth: {
    __tag: "auth",
    get currentUser() {
      return currentUserRef.value;
    },
  },
  get authPersistenceReady() {
    return persistenceRef.value;
  },
}));

const createUserMock = vi.mocked(createUserWithEmailAndPassword);
const deleteUserMock = vi.mocked(deleteUser);
const sendEmailVerificationMock = vi.mocked(sendEmailVerification);

const CREATE_GROUP_ENDPOINT = "/api/signup/create-group";
const SESSION_ENDPOINT = "/api/auth/session";

const input: CreateGroupInput = {
  name: "Fulano de Tal",
  nickname: "Fulano",
  email: "fulano@example.com",
  password: "secret123",
  groupName: "Bolão da Firma",
  slug: "bolao-da-firma",
};

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

// Registra as respostas por endpoint; o mock de fetch resolve pela URL.
function stubFetch(handlers: Record<string, FakeResponse>) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const handler = handlers[url];
    if (!handler) throw new Error(`fetch inesperado: ${url}`);
    return handler as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let getIdTokenMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  deleteUserMock.mockResolvedValue(undefined);
  persistenceRef.value = Promise.resolve();

  getIdTokenMock = vi.fn(async () => "fake-id-token");
  // Conta recém-criada nasce NÃO verificada (TASK-18): dispara e-mail de
  // verificação e o pool nasce `pending`.
  const fakeUser = {
    uid: "uid-123",
    emailVerified: false,
    getIdToken: getIdTokenMock,
  } as unknown as FirebaseUser;
  createUserMock.mockResolvedValue({ user: fakeUser } as UserCredential);
  currentUserRef.value = { getIdToken: getIdTokenMock };
  sendEmailVerificationMock.mockReset();
  sendEmailVerificationMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("createGroupAndAccount", () => {
  it("cria conta, chama a rota e devolve {slug, inviteCode}; sem rollback", async () => {
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: true,
        status: 201,
        json: async () => ({
          pool: {},
          invite: { code: "ABC123", link: "http://x/invite/ABC123" },
        }),
      },
      [SESSION_ENDPOINT]: { ok: true, status: 200, json: async () => ({}) },
    });

    const result = await createGroupAndAccount(input);

    // Conta não verificada → pool nasce pending; e-mail de verificação disparado
    // (best-effort) após o commit do servidor (TASK-18).
    expect(result).toEqual({
      slug: "bolao-da-firma",
      inviteCode: "ABC123",
      pending: true,
    });
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(sendEmailVerificationMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("falha ao enviar e-mail de verificação NÃO quebra o onboarding (best-effort)", async () => {
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: true,
        status: 201,
        json: async () => ({
          pool: {},
          invite: { code: "ABC123", link: "http://x/invite/ABC123" },
          pending: true,
        }),
      },
      [SESSION_ENDPOINT]: { ok: true, status: 200, json: async () => ({}) },
    });
    sendEmailVerificationMock.mockRejectedValue(new Error("smtp down"));

    const result = await createGroupAndAccount(input);

    expect(result.slug).toBe("bolao-da-firma");
    expect(result.pending).toBe(true);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("não envia email/adminId/groupId no corpo da chamada à rota (identidade é server-side)", async () => {
    const fetchMock = stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: true,
        status: 201,
        json: async () => ({
          pool: {},
          invite: { code: "ABC123", link: "http://x/invite/ABC123" },
        }),
      },
      [SESSION_ENDPOINT]: { ok: true, status: 200, json: async () => ({}) },
    });

    await createGroupAndAccount(input);

    const routeCall = fetchMock.mock.calls.find(
      (c) => c[0] === CREATE_GROUP_ENDPOINT,
    );
    expect(routeCall).toBeDefined();
    const body = JSON.parse(
      (routeCall![1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      idToken: "fake-id-token",
      name: input.name,
      nickname: input.nickname,
      groupName: input.groupName,
      slug: input.slug,
    });
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("adminId");
    expect(body).not.toHaveProperty("groupId");
    expect(body).not.toHaveProperty("password");
  });

  it("mapeia 409 com 'conta' para kind account-exists e faz rollback da conta", async () => {
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: false,
        status: 409,
        json: async () => ({ error: "Esta conta já concluiu o cadastro." }),
      },
    });

    await expect(createGroupAndAccount(input)).rejects.toMatchObject({
      name: "OnboardingSubmitError",
      kind: "account-exists",
    });
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
  });

  it("mapeia 409 'Você já possui um grupo' (BR2) para account-exists, NÃO slug-taken", async () => {
    // Regressão: a mensagem de BR2 não contém "conta" nem é colisão de slug —
    // classificá-la como slug-taken mandaria o usuário renomear o grupo (beco sem
    // saída). Deve virar account-exists (a UI não foca o campo de grupo).
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: false,
        status: 409,
        json: async () => ({ error: "Você já possui um grupo." }),
      },
    });

    const error = await createGroupAndAccount(input).catch((e) => e);
    expect(error).toBeInstanceOf(OnboardingSubmitError);
    expect((error as OnboardingSubmitError).kind).toBe("account-exists");
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
  });

  it("mapeia 409 genérico para kind slug-taken e faz rollback da conta", async () => {
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: false,
        status: 409,
        json: async () => ({
          error: "Este endereço de grupo já está em uso.",
        }),
      },
    });

    const error = await createGroupAndAccount(input).catch((e) => e);
    expect(error).toBeInstanceOf(OnboardingSubmitError);
    expect((error as OnboardingSubmitError).kind).toBe("slug-taken");
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
  });

  it("mapeia 500 para kind generic e faz rollback da conta", async () => {
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: false,
        status: 500,
        json: async () => ({ error: "Erro ao criar o grupo." }),
      },
    });

    const error = await createGroupAndAccount(input).catch((e) => e);
    expect(error).toBeInstanceOf(OnboardingSubmitError);
    expect((error as OnboardingSubmitError).kind).toBe("generic");
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
  });

  it("NÃO apaga a conta quando o servidor já retornou 201 mas o corpo falha ao parsear (grupo não fica órfão)", async () => {
    // O servidor commitou (201) grupo+usuário+convite+claims; um parse falho do
    // corpo (conexão instável após headers) não pode disparar deleteUser — isso
    // deixaria o grupo órfão apontando para uma conta apagada (M1).
    stubFetch({
      [CREATE_GROUP_ENDPOINT]: {
        ok: true,
        status: 201,
        json: async () => {
          throw new Error("Unexpected end of JSON input");
        },
      },
      [SESSION_ENDPOINT]: { ok: true, status: 200, json: async () => ({}) },
    });

    await expect(createGroupAndAccount(input)).rejects.toBeInstanceOf(
      OnboardingSubmitError,
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("propaga erro do Firebase Auth cru (sem rollback: a conta não chegou a existir)", async () => {
    const authError = Object.assign(new Error("email in use"), {
      code: "auth/email-already-in-use",
    });
    createUserMock.mockRejectedValue(authError);
    stubFetch({});

    await expect(createGroupAndAccount(input)).rejects.toBe(authError);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
