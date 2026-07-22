/**
 * Testes do Route Handler POST /api/signup/create-group (multi-championship TASK-16).
 *
 * Onboarding auto-serviço: um visitante recém-autenticado cria um grupo e nasce
 * `group_admin` de um pool que já nasce `active`, com claims (`role` + `groupId`)
 * e um convite inicial pronto para compartilhar. Server-authoritative: identidade
 * (`email`) vem SEMPRE do token verificado; `adminId`/`groupId` são derivados do
 * servidor, nunca do body.
 *
 * Casos:
 *  1. 400 — JSON malformado
 *  2. 422 — body sem campos obrigatórios
 *  3. 401 — ID token inválido
 *  4. 201 — happy path: pool active + user group_admin/approved + claims + invite
 *  5. email vem SEMPRE do token (ignora o do body)
 *  6. adminId/groupId derivados do servidor (nunca do body)
 *  7. 409 — slug em uso (pool.create colide → ALREADY_EXISTS)
 *  8. 409 — conta já onboarded (users/{uid} já existe)
 *  9. rollback — falha ao criar users após pool criado → pool apagado + erro propagado
 *
 * Mocks: server-only, getAdminAuth (verifyIdToken + setCustomUserClaims) e
 * getAdminFirestore. Schemas (pool/user/invite) REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdTokenMock, setCustomUserClaimsMock, getFirestoreMock } =
  vi.hoisted(() => ({
    verifyIdTokenMock: vi.fn(),
    setCustomUserClaimsMock: vi.fn(),
    getFirestoreMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
    setCustomUserClaims: setCustomUserClaimsMock,
  }),
  getAdminFirestore: getFirestoreMock,
}));

import { POST } from "@/app/api/signup/create-group/route";

type PostParams = Parameters<typeof POST>;

const UID = "user-1";
const TOKEN_EMAIL = "dono@token.com";
const SLUG = "meu-grupo";

const okBody = {
  idToken: "tok",
  name: "Fulano de Tal",
  nickname: "fulano",
  groupName: "Meu Grupo",
  slug: SLUG,
};

function makeReq(opts: { body?: unknown; badJson?: boolean }): PostParams[0] {
  return {
    url: "https://bolao.app/api/signup/create-group",
    nextUrl: new URL("https://bolao.app/api/signup/create-group"),
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PostParams[0];
}

/** Operação de escrita registrada pelo mock (para inspeção). */
interface DocOp {
  collection: string;
  id: string;
  op: "create" | "set" | "delete";
  data?: unknown;
}

const ALREADY_EXISTS = { code: 6 };

/**
 * Firestore fake: cada `collection(name).doc(id)` expõe get/create/set/delete
 * espionáveis. `get().exists` é true só para users/{uid} quando `userExists`.
 * Colisões e falhas de IO são injetáveis por coleção.
 */
function mockDb(opts: {
  userExists?: boolean;
  userData?: Record<string, unknown>;
  poolCreateThrows?: unknown;
  userCreateThrows?: unknown;
} = {}): { ops: DocOp[] } {
  const ops: DocOp[] = [];
  const docCache = new Map<string, unknown>();

  const makeDoc = (collection: string, id: string) => ({
    get: vi.fn(async () => ({
      exists: collection === "users" ? opts.userExists === true : false,
      data: () =>
        collection === "users" && opts.userExists ? opts.userData : undefined,
    })),
    create: vi.fn(async (data: unknown) => {
      if (collection === "pools" && opts.poolCreateThrows) {
        throw opts.poolCreateThrows;
      }
      if (collection === "users") {
        // Doc já existente → colisão (rerun negado), independente da estratégia
        // (pre-read ou create-collision) usada pela rota.
        if (opts.userExists) throw ALREADY_EXISTS;
        if (opts.userCreateThrows) throw opts.userCreateThrows;
      }
      ops.push({ collection, id, op: "create", data });
    }),
    set: vi.fn(async (data: unknown) => {
      ops.push({ collection, id, op: "set", data });
    }),
    delete: vi.fn(async () => {
      ops.push({ collection, id, op: "delete" });
    }),
  });

  const getDoc = (collection: string, id: string) => {
    const key = `${collection}/${id}`;
    const existing = docCache.get(key);
    if (existing) return existing;
    const doc = makeDoc(collection, id);
    docCache.set(key, doc);
    return doc;
  };

  getFirestoreMock.mockReturnValue({
    collection: (name: string) => ({ doc: (id: string) => getDoc(name, id) }),
  });

  return { ops };
}

function opsFor(ops: DocOp[], collection: string, op: DocOp["op"]): DocOp[] {
  return ops.filter((o) => o.collection === collection && o.op === op);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: conta verificada (pool nasce active). Casos TASK-18 sobrescrevem
  // `email_verified: false` para exercer o gate de status.
  verifyIdTokenMock.mockResolvedValue({
    uid: UID,
    email: TOKEN_EMAIL,
    email_verified: true,
  });
  setCustomUserClaimsMock.mockResolvedValue(undefined);
});

describe("POST /api/signup/create-group", () => {
  it("400 JSON malformado", async () => {
    mockDb();
    const res = await POST(makeReq({ badJson: true }));
    expect(res.status).toBe(400);
  });

  it("422 body sem campos obrigatórios", async () => {
    mockDb();
    const res = await POST(makeReq({ body: { idToken: "tok" } }));
    expect(res.status).toBe(422);
  });

  it("401 ID token inválido", async () => {
    mockDb();
    verifyIdTokenMock.mockRejectedValue(new Error("bad token"));
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(401);
  });

  it("201 happy path: pool active + user group_admin/approved + claims + invite", async () => {
    const { ops } = mockDb();
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      pool: { id: string; status: string; adminId: string; rankingMode?: string; enabledChampionships?: string[] };
      invite: { code: string; link: string };
    };

    // Pool nasce active, doc-id = slug, com defaults de campeonato/ranking.
    expect(body.pool.status).toBe("active");
    expect(body.pool.id).toBe(SLUG);
    expect(body.pool.adminId).toBe(UID);
    expect(body.pool.rankingMode).toBe("geral");
    expect(Array.isArray(body.pool.enabledChampionships)).toBe(true);
    expect(body.pool.enabledChampionships!.length).toBeGreaterThanOrEqual(1);

    // Convite inicial retornado com código canônico e link contendo o código.
    expect(body.invite.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(body.invite.link).toContain(body.invite.code);

    // Escritas: pool + user + invite criados.
    const poolCreate = opsFor(ops, "pools", "create");
    const userWrite = [...opsFor(ops, "users", "create"), ...opsFor(ops, "users", "set")];
    const inviteCreate = opsFor(ops, "invites", "create");
    expect(poolCreate).toHaveLength(1);
    expect(userWrite).toHaveLength(1);
    expect(inviteCreate).toHaveLength(1);

    // Usuário nasce group_admin/approved com groupId = slug.
    const user = userWrite[0]!.data as Record<string, unknown>;
    expect(user.role).toBe("group_admin");
    expect(user.status).toBe("approved");
    expect(user.groupId).toBe(SLUG);

    // Convite vinculado ao pool e ativo.
    const invite = inviteCreate[0]!.data as Record<string, unknown>;
    expect(invite.groupId).toBe(SLUG);
    expect(invite.isActive).toBe(true);

    // Claims gravados: role + groupId (1ª gravação real de groupId no token).
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith(UID, {
      role: "group_admin",
      groupId: SLUG,
    });
  });

  it("email vem SEMPRE do token (ignora o do body)", async () => {
    const { ops } = mockDb();
    const res = await POST(
      makeReq({ body: { ...okBody, email: "spoof@evil.com" } }),
    );
    expect(res.status).toBe(201);

    const userWrite = [...opsFor(ops, "users", "create"), ...opsFor(ops, "users", "set")];
    const user = userWrite[0]!.data as Record<string, unknown>;
    expect(user.email).toBe(TOKEN_EMAIL);
    expect(user.email).not.toBe("spoof@evil.com");
  });

  it("adminId/groupId derivados do servidor (nunca do body)", async () => {
    const { ops } = mockDb();
    const res = await POST(
      makeReq({
        body: { ...okBody, adminId: "hacker", groupId: "outro-pool" },
      }),
    );
    expect(res.status).toBe(201);

    const pool = opsFor(ops, "pools", "create")[0]!.data as Record<string, unknown>;
    expect(pool.adminId).toBe(UID);
    const userWrite = [...opsFor(ops, "users", "create"), ...opsFor(ops, "users", "set")];
    const user = userWrite[0]!.data as Record<string, unknown>;
    expect(user.groupId).toBe(SLUG);
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith(UID, {
      role: "group_admin",
      groupId: SLUG,
    });
  });

  it("409 slug em uso (pool.create colide)", async () => {
    const { ops } = mockDb({ poolCreateThrows: ALREADY_EXISTS });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(409);
    // Sem cascata: nenhum user/claim criado.
    expect(opsFor(ops, "users", "create")).toHaveLength(0);
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
  });

  it("409 conta já onboarded (users/{uid} já existe)", async () => {
    const { ops } = mockDb({ userExists: true });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(409);
    // Rerun negado sem promover claims.
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    // Se o pool chegou a ser criado antes da colisão de user, deve ser desfeito.
    const poolCreated = opsFor(ops, "pools", "create").length;
    const poolDeleted = opsFor(ops, "pools", "delete").length;
    expect(poolDeleted).toBe(poolCreated);
  });

  it("rollback: falha ao criar users após pool criado → pool apagado + erro propagado", async () => {
    const { ops } = mockDb({ userCreateThrows: new Error("firestore down") });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(500);

    // Compensação: o pool criado é apagado (reverte a escrita parcial).
    expect(opsFor(ops, "pools", "create")).toHaveLength(1);
    expect(opsFor(ops, "pools", "delete")).toHaveLength(1);
    // Claims nunca gravados numa falha.
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
  });
});

// TASK-18 — anti-abuso do cadastro público: gate de verificação de e-mail +
// limite de 1 pool por conta.
describe("POST /api/signup/create-group — gate de verificação (TASK-18)", () => {
  it("e-mail NÃO verificado → pool nasce status:pending (fora da busca)", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: UID,
      email: TOKEN_EMAIL,
      email_verified: false,
    });
    const { ops } = mockDb();
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(201);

    const pool = opsFor(ops, "pools", "create")[0]!.data as Record<
      string,
      unknown
    >;
    expect(pool.status).toBe("pending");

    // A UI recebe o flag pending (aditivo) para ajustar a copy.
    const body = (await res.json()) as { pending?: boolean };
    expect(body.pending).toBe(true);
  });

  it("e-mail verificado → pool nasce status:active + pending:false", async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: UID,
      email: TOKEN_EMAIL,
      email_verified: true,
    });
    const { ops } = mockDb();
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(201);

    const pool = opsFor(ops, "pools", "create")[0]!.data as Record<
      string,
      unknown
    >;
    expect(pool.status).toBe("active");

    const body = (await res.json()) as { pending?: boolean };
    expect(body.pending).toBe(false);
  });

  it("caller já possui grupo (users/{uid} com groupId) → 409, NENHUMA escrita", async () => {
    const { ops } = mockDb({
      userExists: true,
      userData: { uid: UID, groupId: "outro-grupo", role: "group_admin" },
    });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(409);

    // BR2: rejeição precoce — pool NÃO chega a ser criado (sem escrita/rollback).
    expect(opsFor(ops, "pools", "create")).toHaveLength(0);
    expect(opsFor(ops, "invites", "create")).toHaveLength(0);
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();

    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/já possui um grupo/i);
  });
});
