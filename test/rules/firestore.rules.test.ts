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

  it("C8b: admin aprova gravando status + updatedAt juntos (PRD-01.2 service)", async () => {
    await assertSucceeds(
      adminDb()
        .doc("users/pendingUser")
        .update({ status: "approved", updatedAt: "2026-06-06T12:00:00.000Z" }),
    );
  });

  it("C21: admin bloqueia usuário aprovado (approved→blocked)", async () => {
    await assertSucceeds(
      adminDb().doc("users/approvedUser").update({ status: "blocked" }),
    );
  });

  it("C22: admin desbloqueia usuário (blocked→approved)", async () => {
    await assertSucceeds(
      adminDb().doc("users/blockedUser").update({ status: "approved" }),
    );
  });

  it("C23: admin rejeita usuário pendente (pending→blocked)", async () => {
    await assertSucceeds(
      adminDb().doc("users/pendingUser").update({ status: "blocked" }),
    );
  });

  it("C24: admin lê doc de terceiro (base da listagem do painel)", async () => {
    await assertSucceeds(adminDb().doc("users/pendingUser").get());
  });

  it("C25: usuário comum não muda status de terceiro (defesa)", async () => {
    await assertFails(
      approvedDb().doc("users/pendingUser").update({ status: "approved" }),
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
  it("C11: write client-direto em predictions é negado (write só via Admin SDK)", async () => {
    // TASK-05: matches fora do Firestore → lock não verificável em rule →
    // write exclusivo do Route Handler /api/predictions (Admin SDK).
    await assertFails(
      approvedDb().doc("predictions/p1").set({
        uid: "approvedUser",
        matchId: "m1",
        homeScore: 2,
        awayScore: 1,
      }),
    );
  });

  it("C11b: update client-direto em predictions é negado (mesmo dono)", async () => {
    // Semeia um doc via Admin SDK (como faria o Route Handler).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("predictions/p_own").set({
        uid: "approvedUser",
        matchId: "m1",
        homeScore: 1,
        awayScore: 0,
      });
    });
    await assertFails(
      approvedDb().doc("predictions/p_own").update({ homeScore: 2 }),
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

  it("C13: approved NÃO lê palpite alheio (leitura privada — PRD-05 A5 reverteu D7)", async () => {
    // A regra de `predictions` é privada (só dono/admin). Comparações sociais
    // usam `rankings`/`statistics`, não palpites alheios. Teste atualizado para
    // refletir a regra vigente (estava obsoleto, herdado do D7 antigo).
    await assertFails(approvedDb().doc("predictions/p_outro").get());
  });

  it("C13b: não autenticado não lê predictions", async () => {
    await assertFails(unauthDb().doc("predictions/p_outro").get());
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

  it("C21+: delete client-direto em predictions é negado (write só via Admin SDK)", async () => {
    // TASK-05: write bloqueado a todos os clientes, incluindo delete.
    await assertFails(approvedDb().doc("predictions/p_approved_own").delete());
  });

  it("C26: admin client-direto não consegue criar palpite em predictions", async () => {
    // Admin SDK bypassa Rules; o cliente autenticado como admin não.
    await assertFails(
      adminDb().doc("predictions/p_admin").set({
        uid: "adminUser",
        matchId: "m1",
        homeScore: 0,
        awayScore: 0,
      }),
    );
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

// ---------------------------------------------------------------------------
// PRD-06 (avatar/perfil) + PRD-07 (system_logs) + PRD-08 (notifications/prefs).
// ---------------------------------------------------------------------------

describe("Firestore Security Rules — perfil editável (PRD-06 D-A2: avatar/nickname)", () => {
  it("C27: dono atualiza avatarUrl + nickname mantendo role/status", async () => {
    await assertSucceeds(
      approvedDb().doc("users/approvedUser").update({
        avatarUrl: "data:image/jpeg;base64,AAAA",
        nickname: "ana-nova",
      }),
    );
  });

  it("C28: dono não muda role junto com avatarUrl (escalada barrada)", async () => {
    await assertFails(
      approvedDb().doc("users/approvedUser").update({
        avatarUrl: "data:image/jpeg;base64,AAAA",
        role: "admin",
      }),
    );
  });
});

describe("Firestore Security Rules — system_logs (PRD-07: admin-only, imutável)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("system_logs/log1").set({
        id: "log1",
        type: "user_approved",
        actorUid: "adminUser",
        targetUid: "pendingUser",
        message: "Usuário aprovado",
        level: "info",
        createdAt: "2026-06-08T12:00:00+00:00",
      });
    });
  });

  it("C29: admin cria log", async () => {
    await assertSucceeds(
      adminDb().doc("system_logs/log2").set({
        id: "log2",
        type: "login_admin",
        actorUid: "adminUser",
        message: "Login admin",
        level: "info",
        createdAt: "2026-06-08T12:05:00+00:00",
      }),
    );
  });

  it("C30: admin lê logs", async () => {
    await assertSucceeds(adminDb().doc("system_logs/log1").get());
  });

  it("C31: usuário comum não cria log", async () => {
    await assertFails(
      approvedDb().doc("system_logs/log3").set({
        id: "log3",
        type: "login_admin",
        actorUid: "approvedUser",
        message: "forjado",
        level: "info",
        createdAt: "2026-06-08T12:06:00+00:00",
      }),
    );
  });

  it("C32: usuário comum não lê logs", async () => {
    await assertFails(approvedDb().doc("system_logs/log1").get());
  });

  it("C33: admin não atualiza nem deleta log (append-only)", async () => {
    await assertFails(
      adminDb().doc("system_logs/log1").update({ message: "alterado" }),
    );
    await assertFails(adminDb().doc("system_logs/log1").delete());
  });
});

describe("Firestore Security Rules — notifications (PRD-08: dono lê; admin cria p/ terceiros)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc("notifications/n_appr").set({
        id: "n_appr",
        userId: "approvedUser",
        type: "system",
        title: "Cadastro aprovado",
        message: "Bem-vindo",
        isRead: false,
        createdAt: "2026-06-08T12:00:00+00:00",
      });
      await db.doc("notifications/n_admin").set({
        id: "n_admin",
        userId: "adminUser",
        type: "system",
        title: "x",
        message: "y",
        isRead: false,
        createdAt: "2026-06-08T12:00:00+00:00",
      });
    });
  });

  it("C34: dono lê a própria notificação", async () => {
    await assertSucceeds(approvedDb().doc("notifications/n_appr").get());
  });

  it("C35: usuário não lê notificação de terceiro", async () => {
    await assertFails(approvedDb().doc("notifications/n_admin").get());
  });

  it("C36: admin cria notificação no doc de terceiro (evento de Sistema)", async () => {
    await assertSucceeds(
      adminDb().doc("notifications/n_new").set({
        id: "n_new",
        userId: "approvedUser",
        type: "system",
        title: "Conta bloqueada",
        message: "...",
        isRead: false,
        createdAt: "2026-06-08T12:10:00+00:00",
      }),
    );
  });

  it("C37: usuário comum não cria notificação para terceiro", async () => {
    await assertFails(
      approvedDb().doc("notifications/n_evil").set({
        id: "n_evil",
        userId: "adminUser",
        type: "system",
        title: "spam",
        message: "...",
        isRead: false,
        createdAt: "2026-06-08T12:11:00+00:00",
      }),
    );
  });

  it("C38: dono marca a própria como lida (update isRead)", async () => {
    await assertSucceeds(
      approvedDb().doc("notifications/n_appr").update({ isRead: true }),
    );
  });

  it("C39: dono não troca o destinatário (userId imutável)", async () => {
    await assertFails(
      approvedDb().doc("notifications/n_appr").update({ userId: "adminUser" }),
    );
  });

  it("C40: ninguém deleta notificação (nem admin)", async () => {
    await assertFails(adminDb().doc("notifications/n_admin").delete());
  });
});

describe("Firestore Security Rules — notificationPreferences (PRD-08: só o dono)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("notificationPreferences/adminUser").set({
        userId: "adminUser",
        system: true,
        games: true,
        ranking: true,
        pool: true,
      });
    });
  });

  it("C41: dono grava as próprias preferências (userId == uid)", async () => {
    await assertSucceeds(
      approvedDb().doc("notificationPreferences/approvedUser").set({
        userId: "approvedUser",
        system: false,
        games: true,
        ranking: true,
        pool: false,
      }),
    );
  });

  it("C42: dono lê as próprias preferências", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("notificationPreferences/approvedUser").set({
        userId: "approvedUser",
        system: true,
        games: true,
        ranking: true,
        pool: true,
      });
    });
    await assertSucceeds(
      approvedDb().doc("notificationPreferences/approvedUser").get(),
    );
  });

  it("C43: usuário não lê preferências de terceiro", async () => {
    await assertFails(
      approvedDb().doc("notificationPreferences/adminUser").get(),
    );
  });

  it("C44: gravar preferências com userId divergente do doc é negado", async () => {
    await assertFails(
      approvedDb().doc("notificationPreferences/approvedUser").set({
        userId: "adminUser",
        system: true,
        games: true,
        ranking: true,
        pool: true,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Login biométrico (TASK-03): webauthn_credentials — leitura própria,
// escrita exclusiva do Admin SDK (write client negado, como predictions).
// ---------------------------------------------------------------------------

describe("Firestore Security Rules — webauthn_credentials (TASK-03)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc("webauthn_credentials/cred_approved").set({
        credentialId: "cred_approved",
        uid: "approvedUser",
        publicKey: "pk-approved",
        counter: 0,
        createdAt: "2026-06-09T12:00:00.000Z",
      });
      await db.doc("webauthn_credentials/cred_admin").set({
        credentialId: "cred_admin",
        uid: "adminUser",
        publicKey: "pk-admin",
        counter: 0,
        createdAt: "2026-06-09T12:00:00.000Z",
      });
      await db.doc("webauthn_credentials/cred_pending").set({
        credentialId: "cred_pending",
        uid: "pendingUser",
        publicKey: "pk-pending",
        counter: 0,
        createdAt: "2026-06-09T12:00:00.000Z",
      });
      await db.doc("webauthn_credentials/cred_blocked").set({
        credentialId: "cred_blocked",
        uid: "blockedUser",
        publicKey: "pk-blocked",
        counter: 0,
        createdAt: "2026-06-09T12:00:00.000Z",
      });
    });
  });

  it("C45: approved lê a própria credencial", async () => {
    await assertSucceeds(
      approvedDb().doc("webauthn_credentials/cred_approved").get(),
    );
  });

  it("C46: approved NÃO lê credencial de terceiro", async () => {
    await assertFails(
      approvedDb().doc("webauthn_credentials/cred_admin").get(),
    );
  });

  it("C47: pending não lê a própria credencial (não-approved)", async () => {
    await assertFails(
      pendingDb().doc("webauthn_credentials/cred_pending").get(),
    );
  });

  it("C47b: blocked não lê a própria credencial (não-approved)", async () => {
    await assertFails(
      blockedDb().doc("webauthn_credentials/cred_blocked").get(),
    );
  });

  it("C48: não autenticado não lê credencial", async () => {
    await assertFails(
      unauthDb().doc("webauthn_credentials/cred_approved").get(),
    );
  });

  it("C49: admin lê credencial de terceiro", async () => {
    await assertSucceeds(
      adminDb().doc("webauthn_credentials/cred_approved").get(),
    );
  });

  it("C50: write client-direto (create) é negado — só Admin SDK", async () => {
    await assertFails(
      approvedDb().doc("webauthn_credentials/cred_new").set({
        credentialId: "cred_new",
        uid: "approvedUser",
        publicKey: "pk-new",
        counter: 0,
        createdAt: "2026-06-09T12:00:00.000Z",
      }),
    );
  });

  it("C51: update client-direto (counter) é negado, mesmo do dono", async () => {
    await assertFails(
      approvedDb()
        .doc("webauthn_credentials/cred_approved")
        .update({ counter: 99 }),
    );
  });

  it("C52: delete client-direto é negado (revogação só via Admin SDK)", async () => {
    await assertFails(
      approvedDb().doc("webauthn_credentials/cred_approved").delete(),
    );
  });

  it("C53: admin client-direto também não escreve (write exclusivo do Admin SDK)", async () => {
    await assertFails(
      adminDb().doc("webauthn_credentials/cred_admin").update({ counter: 5 }),
    );
  });

  // --- Caminho LIST/query (o que a Tela 06 realmente executa: listMyPasskeys
  // faz `where("uid","==",uid).get()`, não get() de doc único). Gap que deixou
  // passar o bug "erro ao consultar os dados" — C45–C53 só cobriam get().
  it("C59: approved faz query das PRÓPRIAS credenciais (where uid == self)", async () => {
    await assertSucceeds(
      approvedDb()
        .collection("webauthn_credentials")
        .where("uid", "==", "approvedUser")
        .get(),
    );
  });

  it("C60: query da coleção inteira (sem where) é negada — rules não são filtro", async () => {
    await assertFails(approvedDb().collection("webauthn_credentials").get());
  });

  it("C61: query filtrando uid de terceiro é negada (ownership)", async () => {
    await assertFails(
      approvedDb()
        .collection("webauthn_credentials")
        .where("uid", "==", "adminUser")
        .get(),
    );
  });

  it("C62: pending não faz query nem das próprias (não-approved)", async () => {
    await assertFails(
      pendingDb()
        .collection("webauthn_credentials")
        .where("uid", "==", "pendingUser")
        .get(),
    );
  });

  it("C63: admin faz query das credenciais de terceiro (lê todas)", async () => {
    await assertSucceeds(
      adminDb()
        .collection("webauthn_credentials")
        .where("uid", "==", "approvedUser")
        .get(),
    );
  });
});

// ---------------------------------------------------------------------------
// Login biométrico (TASK-07): webauthn_challenge_jti — store de jti consumidos
// (HR-01). Acesso EXCLUSIVO do Admin SDK: read e write client negados a todos.
// ---------------------------------------------------------------------------

describe("Firestore Security Rules — webauthn_challenge_jti (TASK-07)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("webauthn_challenge_jti/jti-1")
        .set({ expiresAt: "2026-06-09T12:05:00.000Z" });
    });
  });

  it("C54: read client é negado (approved)", async () => {
    await assertFails(approvedDb().doc("webauthn_challenge_jti/jti-1").get());
  });

  it("C55: read client é negado (admin)", async () => {
    await assertFails(adminDb().doc("webauthn_challenge_jti/jti-1").get());
  });

  it("C56: read não autenticado é negado", async () => {
    await assertFails(unauthDb().doc("webauthn_challenge_jti/jti-1").get());
  });

  it("C57: create client é negado (só Admin SDK)", async () => {
    await assertFails(
      approvedDb()
        .doc("webauthn_challenge_jti/jti-novo")
        .set({ expiresAt: "2026-06-09T12:05:00.000Z" }),
    );
  });

  it("C58: delete client é negado", async () => {
    await assertFails(approvedDb().doc("webauthn_challenge_jti/jti-1").delete());
  });
});
