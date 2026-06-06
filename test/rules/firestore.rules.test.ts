import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Suíte de testes das Security Rules do Firestore (TASK-08).
// Roda contra o emulador real do Firestore (porta 8080) via
// `firebase emulators:exec`. Cada caso (C1–C20) exercita um ponto
// do modelo de acesso descrito na spec (status × role + ownership).

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-bolao-dos-parcas",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Semeia os docs users/{uid} (role/status) e dados de apoio usando o
  // contexto privilegiado, para que getUserData() encontre o perfil do
  // requisitante e os cenários de leitura/escrita tenham estado inicial.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await db.doc("users/approvedUser").set({
      uid: "approvedUser",
      name: "Ana",
      nickname: "ana",
      email: "ana@x.com",
      role: "user",
      status: "approved",
    });
    await db.doc("users/pendingUser").set({
      uid: "pendingUser",
      name: "Beto",
      nickname: "beto",
      email: "beto@x.com",
      role: "user",
      status: "pending",
    });
    await db.doc("users/blockedUser").set({
      uid: "blockedUser",
      name: "Dudu",
      nickname: "dudu",
      email: "dudu@x.com",
      role: "user",
      status: "blocked",
    });
    await db.doc("users/adminUser").set({
      uid: "adminUser",
      name: "Cida",
      nickname: "cida",
      email: "cida@x.com",
      role: "admin",
      status: "approved",
    });

    // Dados internos de apoio.
    await db.doc("matches/m1").set({ matchId: "m1", status: "scheduled" });
    // Palpite de terceiro para C13 (leitura ampla entre approved — D7).
    await db.doc("predictions/p_outro").set({
      uid: "adminUser",
      matchId: "m1",
      homeScore: 1,
      awayScore: 0,
    });
  });
});

// Atalhos de contexto por ator.
const approvedDb = () =>
  testEnv.authenticatedContext("approvedUser").firestore();
const pendingDb = () =>
  testEnv.authenticatedContext("pendingUser").firestore();
const blockedDb = () =>
  testEnv.authenticatedContext("blockedUser").firestore();
const adminDb = () => testEnv.authenticatedContext("adminUser").firestore();
const unauthDb = () => testEnv.unauthenticatedContext().firestore();

describe("Firestore Security Rules — leitura de áreas internas", () => {
  it("C1: approved lê coleção interna (matches/m1)", async () => {
    await assertSucceeds(approvedDb().doc("matches/m1").get());
  });

  it("C2: pending é negado em área interna (matches/m1)", async () => {
    await assertFails(pendingDb().doc("matches/m1").get());
  });

  it("C3: blocked é negado em área interna (matches/m1)", async () => {
    await assertFails(blockedDb().doc("matches/m1").get());
  });

  it("C4: não autenticado é negado em área interna (matches/m1)", async () => {
    await assertFails(unauthDb().doc("matches/m1").get());
  });
});

describe("Firestore Security Rules — perfil users (role/status)", () => {
  it("C5: dono atualiza o próprio perfil em campo neutro (nickname)", async () => {
    await assertSucceeds(
      approvedDb().doc("users/approvedUser").update({ nickname: "ana2" }),
    );
  });

  it("C6: escalonamento de role no próprio doc é negado", async () => {
    await assertFails(
      approvedDb().doc("users/approvedUser").update({ role: "admin" }),
    );
  });

  it("C7: auto-aprovação de status é negada", async () => {
    await assertFails(
      pendingDb().doc("users/pendingUser").update({ status: "approved" }),
    );
  });

  it("C8: admin aprova usuário (muda status de terceiro)", async () => {
    await assertSucceeds(
      adminDb().doc("users/pendingUser").update({ status: "approved" }),
    );
  });

  it("C19: perfil de terceiro não vaza (approved lendo users/adminUser)", async () => {
    await assertFails(approvedDb().doc("users/adminUser").get());
  });
});

describe("Firestore Security Rules — auto-cadastro (signup)", () => {
  it("C9: signup força pending/user (próprio uid)", async () => {
    const newUser = testEnv.authenticatedContext("newUser").firestore();
    await assertSucceeds(
      newUser.doc("users/newUser").set({
        uid: "newUser",
        name: "Eva",
        nickname: "eva",
        email: "eva@x.com",
        role: "user",
        status: "pending",
      }),
    );
  });

  it("C10: signup tentando admin/approved é negado", async () => {
    const newUser = testEnv.authenticatedContext("newUser").firestore();
    await assertFails(
      newUser.doc("users/newUser").set({
        uid: "newUser",
        name: "Eva",
        nickname: "eva",
        email: "eva@x.com",
        role: "admin",
        status: "approved",
      }),
    );
  });
});

describe("Firestore Security Rules — predictions (ownership)", () => {
  it("C11: cria o próprio palpite", async () => {
    await assertSucceeds(
      approvedDb().doc("predictions/p1").set({
        uid: "approvedUser",
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
      }),
    );
  });

  it("C12: cria palpite de terceiro (cross-user) é negado", async () => {
    await assertFails(
      approvedDb().doc("predictions/p2").set({
        uid: "adminUser",
        matchId: "m1",
        homeScore: 0,
        awayScore: 0,
      }),
    );
  });

  it("C13: approved lê palpite alheio (D7)", async () => {
    await assertSucceeds(approvedDb().doc("predictions/p_outro").get());
  });

  it("C14: pending não cria palpite", async () => {
    await assertFails(
      pendingDb().doc("predictions/p3").set({
        uid: "pendingUser",
        matchId: "m1",
        homeScore: 1,
        awayScore: 1,
      }),
    );
  });
});

describe("Firestore Security Rules — coleções do torneio (admin escreve)", () => {
  it("C15: usuário comum não escreve em matches", async () => {
    await assertFails(
      approvedDb().doc("matches/m9").set({ matchId: "m9", status: "scheduled" }),
    );
  });

  it("C16: admin escreve em matches", async () => {
    await assertSucceeds(
      adminDb().doc("matches/m9").set({ matchId: "m9", status: "scheduled" }),
    );
  });
});

describe("Firestore Security Rules — bonus_predictions (ownership)", () => {
  it("C17: cria só o próprio bônus", async () => {
    await assertSucceeds(
      approvedDb().doc("bonus_predictions/b1").set({
        uid: "approvedUser",
        champion: "BRA",
      }),
    );
  });

  it("C18: bônus cross-user é negado", async () => {
    await assertFails(
      approvedDb().doc("bonus_predictions/b2").set({
        uid: "adminUser",
        champion: "ARG",
      }),
    );
  });
});

describe("Firestore Security Rules — deny-by-default", () => {
  it("C20: path desconhecido é negado (até para admin)", async () => {
    await assertFails(adminDb().doc("foo/bar").get());
  });
});

// Novos casos — cobertura dos BLOCKERs B1 e B2 (revisão TASK-08).

describe("Firestore Security Rules — delete de predictions (B1: isApproved obrigatório)", () => {
  beforeEach(async () => {
    // Semeia palpites para cada usuário não-aprovado e para o approved
    // usando o contexto privilegiado, para que o delete tenha um doc real.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc("predictions/p_pending").set({
        uid: "pendingUser",
        matchId: "m1",
        homeScore: 0,
        awayScore: 0,
      });
      await db.doc("predictions/p_blocked").set({
        uid: "blockedUser",
        matchId: "m1",
        homeScore: 1,
        awayScore: 1,
      });
      await db.doc("predictions/p_approved_own").set({
        uid: "approvedUser",
        matchId: "m1",
        homeScore: 2,
        awayScore: 0,
      });
    });
  });

  it("C21: usuário pending não consegue deletar o próprio palpite", async () => {
    // B1: pending é dono do doc mas não é approved — deve ser negado.
    await assertFails(pendingDb().doc("predictions/p_pending").delete());
  });

  it("C22: usuário blocked não consegue deletar o próprio palpite", async () => {
    // B1: blocked é dono do doc mas não é approved — deve ser negado.
    await assertFails(blockedDb().doc("predictions/p_blocked").delete());
  });

  it("C23: approved não consegue deletar palpite de outro usuário", async () => {
    // p_outro pertence a adminUser; approvedUser não é dono.
    await assertFails(approvedDb().doc("predictions/p_outro").delete());
  });

  it("C21+: approved consegue deletar o próprio palpite (caminho feliz)", async () => {
    // Confirma que a correção B1 não bloqueou o caso legítimo.
    await assertSucceeds(approvedDb().doc("predictions/p_approved_own").delete());
  });
});

describe("Firestore Security Rules — update de users sem campos role/status (B2)", () => {
  it("C24: dono não injeta role/status em doc que não possui esses campos", async () => {
    // Semeia um doc sem role/status via Admin SDK (simula dado legado ou
    // criado incorretamente fora do fluxo normal de signup).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("users/bareUser")
        .set({ uid: "bareUser", name: "Zé" });
    });
    const bareDb = testEnv.authenticatedContext("bareUser").firestore();
    // Tentativa de injetar role: null + status: null explora o vetor de B2
    // (null == null → true antes da correção). Após a correção deve falhar.
    await assertFails(
      bareDb
        .doc("users/bareUser")
        .update({ role: null, status: null }),
    );
  });
});
