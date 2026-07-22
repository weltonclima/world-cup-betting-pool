import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  type User,
} from "firebase/auth";

import { authPersistenceReady, firebaseAuth } from "@/firebase";

/**
 * Serviço de onboarding auto-serviço (multi-championship TASK-16).
 *
 * Encapsula o fluxo client de "criar grupo": cria a conta no Firebase Auth,
 * chama o Route Handler server-authoritative que cria o pool/usuário/convite e
 * grava os claims, e emite o session cookie httpOnly com o token JÁ portando os
 * claims novos (`getIdToken(true)`). A rota é a ÚNICA autoridade sobre
 * papel/status/identidade — este serviço nunca decide privilégio.
 *
 * Atomicidade (espelha `services/auth.signUp`): se a rota falhar após a conta de
 * Auth ter sido criada, a conta é removida (`deleteUser`) para não deixar um
 * usuário órfão sem grupo. Os erros são propagados tipados (pt-BR) — a UI não vê
 * status HTTP.
 */

const CREATE_GROUP_ENDPOINT = "/api/signup/create-group";
const ACTIVATE_POOL_ENDPOINT = "/api/signup/activate-pool";
const SESSION_ENDPOINT = "/api/auth/session";

/** Entrada do onboarding: dados do usuário + do grupo. */
export interface CreateGroupInput {
  name: string;
  nickname: string;
  email: string;
  password: string;
  groupName: string;
  /** Slug derivado no client (preview); a rota revalida com `poolSlugSchema`. */
  slug: string;
}

/** Resultado do onboarding — o suficiente para a fase de sucesso da UI. */
export interface CreateGroupResult {
  /** Slug do pool criado (= doc-id, = groupId dos claims). */
  slug: string;
  /** Código do convite inicial (link principal). */
  inviteCode: string;
  /**
   * `true` quando o pool nasceu `pending` por e-mail ainda não verificado
   * (TASK-18) — a UI então instrui a verificação e oferece "Já verifiquei".
   */
  pending: boolean;
}

/** Resultado da promoção pós-verificação (`activate-pool`). */
export interface ActivatePoolResult {
  /** `true` se o e-mail já estava verificado no servidor. */
  ok: boolean;
  /** Quantos pools `pending` do caller foram promovidos a `active`. */
  activated: number;
}

/**
 * Falha de submit do onboarding, com um `kind` que a UI usa para decidir a
 * mensagem/foco (sem vazar status HTTP). `slug-taken` → foca `groupName`.
 */
export class OnboardingSubmitError extends Error {
  readonly kind: "slug-taken" | "account-exists" | "generic";
  constructor(
    kind: "slug-taken" | "account-exists" | "generic",
    message: string,
  ) {
    super(message);
    this.name = "OnboardingSubmitError";
    this.kind = kind;
  }
}

/**
 * Emite o session cookie httpOnly a partir do usuário autenticado, forçando o
 * refresh do token (`getIdToken(true)`) para carregar os claims `{role,groupId}`
 * recém-gravados pela rota. Best-effort: falha aqui não desfaz o onboarding (a
 * conta e o grupo já existem); só é logada.
 */
async function mintSessionCookie(): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) return;
  try {
    const idToken = await user.getIdToken(true);
    const response = await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) {
      console.error("Falha ao criar session cookie:", response.status);
    }
  } catch (error) {
    console.error("Erro ao criar session cookie:", error);
  }
}

/**
 * Reverte a conta de Auth recém-criada quando o onboarding falha ANTES do commit
 * do servidor (rede ou resposta não-2xx). Best-effort: falha de reversão é logada
 * e não mascara o erro original. Nunca chamada após um 2xx (deixaria o grupo
 * órfão — ver M1).
 */
async function rollbackAuthAccount(user: User): Promise<void> {
  try {
    await deleteUser(user);
  } catch (rollbackError) {
    console.error(
      "Falha ao reverter a conta de Auth após erro no onboarding:",
      rollbackError,
    );
  }
}

/** Traduz a resposta de erro da rota em `OnboardingSubmitError` tipado. */
async function toSubmitError(response: Response): Promise<OnboardingSubmitError> {
  let message = "";
  try {
    const body = (await response.json()) as { error?: string };
    message = body?.error ?? "";
  } catch {
    // corpo ilegível — cai no genérico.
  }
  if (response.status === 409) {
    // BR2 (TASK-18): a conta já é dona de um pool (1 pool auto-serviço por conta).
    // NÃO é colisão de slug — renomear o grupo nunca resolve. Classifica como
    // `account-exists` (sem foco no campo de grupo) para a UI orientar corretamente.
    const lower = message.toLowerCase();
    if (lower.includes("possui um grupo")) {
      return new OnboardingSubmitError(
        "account-exists",
        "Você já possui um grupo. Acesse-o pelo login.",
      );
    }
    // Conta recém-criada não colide em `users/{uid}`, então 409 é, na prática,
    // colisão de slug. A mensagem da rota diferencia o caso raro de re-execução.
    if (lower.includes("conta")) {
      return new OnboardingSubmitError(
        "account-exists",
        "Esta conta já concluiu o cadastro.",
      );
    }
    return new OnboardingSubmitError(
      "slug-taken",
      "Esse nome de grupo já está em uso.",
    );
  }
  return new OnboardingSubmitError(
    "generic",
    "Não foi possível criar o grupo. Tente novamente.",
  );
}

/**
 * Cria a conta e o grupo em um fluxo atômico do ponto de vista do usuário.
 *
 * 1. `createUserWithEmailAndPassword` (erros Firebase propagam crus, com `.code`
 *    — ex.: `auth/email-already-in-use` — para a UI mapear via `mapAuthError`).
 * 2. `getIdToken()` → `POST /api/signup/create-group` (a rota é a autoridade).
 * 3. Falha da rota → rollback (`deleteUser`) + `OnboardingSubmitError` tipado.
 * 4. Sucesso → `mintSessionCookie` (token fresco c/ claims) e devolve o payload.
 */
export async function createGroupAndAccount(
  input: CreateGroupInput,
): Promise<CreateGroupResult> {
  await authPersistenceReady;
  const { user } = await createUserWithEmailAndPassword(
    firebaseAuth,
    input.email,
    input.password,
  );

  // Região PRÉ-commit: até o servidor confirmar (2xx), qualquer falha significa
  // que o grupo NÃO foi criado — então a conta de Auth órfã é revertida. Depois
  // do 2xx a reversão é proibida (deixaria o grupo órfão, M1).
  let response: Response;
  try {
    const idToken = await user.getIdToken();
    response = await fetch(CREATE_GROUP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        name: input.name,
        nickname: input.nickname,
        groupName: input.groupName,
        slug: input.slug,
      }),
    });
  } catch (error) {
    // Falha de rede antes de qualquer commit do servidor → reverte a conta.
    await rollbackAuthAccount(user);
    throw error;
  }

  if (!response.ok) {
    // Servidor rejeitou (e já desfez qualquer escrita parcial dele) → reverte a conta.
    await rollbackAuthAccount(user);
    throw await toSubmitError(response);
  }

  // 2xx: servidor COMMITOU grupo+usuário+convite+claims. A partir daqui a conta
  // de Auth NUNCA é apagada. Falha ao ler o corpo é degradada (grupo já existe):
  // devolve erro tipado sem rollback, para o usuário reentrar.
  let payload: {
    pool: unknown;
    invite: { code: string; link: string };
    pending?: boolean;
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch (error) {
    console.error(
      "Falha ao ler a resposta do onboarding (grupo já criado):",
      error,
    );
    throw new OnboardingSubmitError(
      "generic",
      "Grupo criado, mas houve uma falha ao carregar os dados. Entre novamente.",
    );
  }

  // Anti-abuso (TASK-18): dispara a verificação de e-mail após o grupo existir.
  // Best-effort — falha NÃO desfaz o onboarding (grupo já criado); só é logada. Um
  // pool criado por conta não verificada nasce `pending` (invisível na busca) até
  // o "Já verifiquei" promovê-lo via `activate-pool`.
  try {
    if (user.emailVerified === false) {
      await sendEmailVerification(user);
    }
  } catch (verifyError) {
    console.error(
      "Falha ao enviar e-mail de verificação (grupo já criado):",
      verifyError,
    );
  }

  // Token fresco com os claims novos → cookie httpOnly (best-effort).
  await mintSessionCookie();

  return {
    slug: input.slug,
    inviteCode: payload.invite.code,
    // Fallback defensivo: sem o flag, deriva do estado local do usuário.
    pending: payload.pending ?? user.emailVerified === false,
  };
}

/**
 * Promove o(s) pool(s) `pending` do usuário atual para `active` após ele
 * confirmar o e-mail (TASK-18). Recarrega o usuário Firebase e força um token
 * fresco (`getIdToken(true)`) para carregar o claim `email_verified` atualizado —
 * o servidor re-verifica esse claim (BR4) antes de promover.
 *
 * Desfechos (todos sem lançar em caso de resposta do servidor):
 * - `{ ok:true, activated:N }` — verificado; N pools promovidos (0 = nada pendente).
 * - `{ ok:false, activated:0 }` — e-mail ainda não verificado; a UI pede para o
 *   usuário clicar no link e tentar de novo.
 *
 * Lança em qualquer resposta não-2xx (inclui 401 token stale / 422 / 5xx) e em
 * falha de rede/parse — a UI trata como toast de erro genérico. Sem usuário
 * autenticado, resolve `{ ok:false, activated:0 }` (no-op).
 */
export async function activateMyPool(): Promise<ActivatePoolResult> {
  const user = firebaseAuth.currentUser;
  if (!user) return { ok: false, activated: 0 };

  // Recarrega o estado do usuário (pode ter verificado em outra aba) e emite um
  // token fresco com o claim `email_verified` atualizado.
  await user.reload();
  const idToken = await user.getIdToken(true);

  const response = await fetch(ACTIVATE_POOL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(`activate-pool falhou: ${response.status}`);
  }
  const body = (await response.json()) as ActivatePoolResult;
  return { ok: body.ok === true, activated: body.activated ?? 0 };
}
