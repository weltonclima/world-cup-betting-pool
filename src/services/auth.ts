import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { authPersistenceReady, firebaseAuth, firestore } from "@/firebase";
import type { SignupFormValues } from "@/features/auth/schemas";
import { PasskeyError } from "@/services/webauthn";

/**
 * Camada de serviço de autenticação (PRD-01, TASK-06).
 *
 * Encapsula Firebase Authentication + Firestore para os formulários de Login e
 * Cadastro. Os erros do Firebase são propagados crus (com `error.code`) para a
 * UI traduzir via `mapAuthError` (`@/features/auth/errors`) — esta camada NÃO
 * traduz mensagens.
 */

/**
 * Entrada do cadastro: deriva de `SignupFormValues` (TASK-01) excluindo os
 * campos exclusivos do frontend (`confirmPassword`, `acceptTerms`). Estes nunca
 * vão ao Firebase Auth nem ao Firestore.
 */
export type SignUpInput = Pick<
  SignupFormValues,
  "name" | "nickname" | "email" | "password" | "groupId"
>;

/**
 * Endpoint do session cookie httpOnly (TASK-09). O client troca o ID token por
 * um cookie `__session` verificável no servidor/edge (middleware da TASK-10).
 */
const SESSION_ENDPOINT = "/api/auth/session";

/**
 * Renovação deslizante do session cookie (TASK-02).
 *
 * O cookie `__session` expira fixo em 5 dias (servidor). Para evitar que rotas
 * server-side derrubem o usuário antes do client (que persiste indefinidamente,
 * TASK-01), o cookie é re-emitido periodicamente. `LAST_MINT_STORAGE_KEY` guarda
 * (em `localStorage`, NÃO sensível) o epoch ms da última emissão bem-sucedida;
 * `SESSION_RENEWAL_THROTTLE_MS` é a folga mínima entre re-emissões. Com TTL de
 * 5 dias e janela de 1 dia, qualquer visita dentro de 5 dias mantém a sessão
 * server viva, sem flood de POSTs.
 */
export const SESSION_RENEWAL_THROTTLE_MS = 24 * 60 * 60 * 1000;
export const LAST_MINT_STORAGE_KEY = "bdp.lastSessionMintAt";

// Acesso ao localStorage é best-effort: além do guard de SSR (`window`), o
// próprio acesso pode lançar (iframe sandboxed, storage desabilitado, modo
// privado, quota). Qualquer falha aqui não pode quebrar login/logout/renovação,
// então cada helper engole o erro e degrada para o estado neutro.

/** Lê o timestamp da última emissão. Client-only e tolerante a valor inválido. */
function readLastMintAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_MINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Grava o timestamp da última emissão (epoch ms). Client-only. */
function writeLastMintAt(timestamp: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_MINT_STORAGE_KEY, String(timestamp));
  } catch {
    // Sem persistir o timestamp, a próxima renovação simplesmente re-emite.
  }
}

/** Limpa o timestamp (logout). Client-only. */
function clearLastMintAt(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_MINT_STORAGE_KEY);
  } catch {
    // Ignorado: não pode impedir o sign-out.
  }
}

/**
 * Emite (ou re-emite) o session cookie a partir do usuário autenticado.
 *
 * `getIdToken(true)` força o refresh do token para carregar o custom claim
 * `role` fresco (TASK-08) — o token em cache pode ter o claim antigo por até ~1h.
 *
 * Só avança `LAST_MINT_STORAGE_KEY` em emissão BEM-SUCEDIDA (`response.ok`):
 * falha não consome a janela de throttle, permitindo nova tentativa.
 *
 * Best-effort: falha aqui (rede/servidor) NÃO derruba o login no client (o
 * Firebase Auth já autenticou). A ausência do cookie só bloqueia rotas
 * protegidas por servidor; é logada para diagnóstico.
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
      return;
    }
    writeLastMintAt(Date.now());
  } catch (error) {
    console.error("Erro ao criar session cookie:", error);
  }
}

// Guard de concorrência: uma renovação por vez (evita POSTs paralelos).
let renewalInFlight: Promise<void> | null = null;

/**
 * Renovação deslizante do cookie (TASK-02), disparada pelo client (hook
 * `useSessionRenewal`). Guardas, em ordem:
 *  1. sem `currentUser` → no-op (deslogado);
 *  2. sem `window`/`localStorage` → no-op (SSR/edge);
 *  3. dentro da janela de throttle → no-op;
 *  4. renovação já em andamento → reusa a mesma promise.
 *
 * Anti-imortal: a re-emissão usa `getIdToken(true)` (token fresco) e o endpoint
 * revalida (`verifyIdToken`). Se a sessão Firebase foi revogada/expirada, o
 * token falha → nada é emitido → o cookie expira naturalmente em 5 dias. Nunca
 * estende o cookie sem revalidar.
 */
export async function refreshSessionCookie(): Promise<void> {
  if (!firebaseAuth.currentUser) return;
  if (typeof window === "undefined") return;

  const lastMintAt = readLastMintAt();
  if (
    lastMintAt !== null &&
    Date.now() - lastMintAt < SESSION_RENEWAL_THROTTLE_MS
  ) {
    return;
  }

  if (renewalInFlight) return renewalInFlight;

  renewalInFlight = mintSessionCookie().finally(() => {
    renewalInFlight = null;
  });
  return renewalInFlight;
}

/**
 * Remove o session cookie httpOnly (logout server-side). Best-effort: falha não
 * impede o sign-out client do Firebase Auth.
 */
async function clearSessionCookie(): Promise<void> {
  try {
    await fetch(SESSION_ENDPOINT, { method: "DELETE" });
  } catch (error) {
    console.error("Erro ao limpar session cookie:", error);
  }
}

/**
 * Autentica o usuário com e-mail e senha.
 * Propaga os erros do Firebase Auth (ex.: `auth/invalid-credential`).
 *
 * Após o sign-in, cria o session cookie httpOnly (TASK-09) para que o servidor/
 * edge possa verificar a sessão. A criação do cookie é best-effort.
 *
 * Aguarda `authPersistenceReady` (TASK-01) ANTES de autenticar para garantir que
 * a sessão seja gravada com a persistência local pretendida (manter logado), e
 * não com uma persistência default ainda não aplicada.
 */
export async function signIn(email: string, password: string): Promise<void> {
  await authPersistenceReady;
  await signInWithEmailAndPassword(firebaseAuth, email, password);
  await mintSessionCookie();
}

/**
 * Conclui o login biométrico (TASK-08): troca o custom token emitido pela TASK-07
 * por uma sessão Firebase e emite o session cookie httpOnly.
 *
 * Aguarda `authPersistenceReady` (TASK-01) ANTES de autenticar — mantém o usuário
 * logado com a persistência local pretendida. `signInWithCustomToken` autentica; o
 * `mintSessionCookie` reusado faz `getIdToken(true)`, carregando o claim `role`
 * fresco (M1) para que o middleware edge reconheça admins.
 *
 * NÃO navega: o `AuthLayout` redireciona ao mudar o estado de auth (mesmo contrato
 * de `signIn`). O custom token é de uso único e curtíssima vida — não persistir.
 */
export async function signInWithBiometricToken(
  customToken: string,
): Promise<void> {
  await authPersistenceReady;
  try {
    await signInWithCustomToken(firebaseAuth, customToken);
  } catch {
    // Normaliza falhas do Firebase (token expirado/já consumido, rede, clock skew)
    // em PasskeyError genérico (MD-01) — a UI mostra a mensagem pt-BR explícita em
    // vez de cair por acaso no branch genérico do hook.
    throw new PasskeyError("Não foi possível entrar com biometria.");
  }
  await mintSessionCookie();
}

/**
 * Cria a conta no Firebase Auth e grava o perfil em `users/{uid}`.
 *
 * O cliente grava `role: "participant"` (canônico PRD-09; as Security Rules
 * aceitam tanto `participant` quanto o legado `user`) / `status: "pending"`. A
 * promoção a admin é feita por Cloud Function (TASK-05). O `groupId` (PRD-09,
 * TASK-07) referencia o pool ativo selecionado no cadastro — todo usuário novo
 * nasce associado a um grupo.
 *
 * Atomicidade (R2): se a gravação do doc falhar, a conta de Auth recém-criada
 * é removida via `deleteUser` (rollback) para não deixar conta órfã. Se o
 * próprio rollback falhar, o erro do rollback é logado e o erro ORIGINAL do
 * `setDoc` é relançado (causa-raiz que a UI vai mapear).
 */
export async function signUp({
  name,
  nickname,
  email,
  password,
  groupId,
}: SignUpInput): Promise<void> {
  // Persistência local aplicada antes de criar a conta (TASK-01): o usuário
  // recém-cadastrado já fica autenticado e deve permanecer logado.
  await authPersistenceReady;
  const { user } = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password,
  );

  try {
    await setDoc(doc(firestore, "users", user.uid), {
      uid: user.uid,
      name,
      nickname,
      email,
      role: "participant",
      status: "pending",
      groupId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Rollback: remove a conta de Auth para não deixar perfil órfão.
    try {
      await deleteUser(user);
    } catch (rollbackError) {
      // Estado órfão inevitável: logar para diagnóstico e relançar o erro
      // original do setDoc (não o do rollback).
      console.error(
        "Falha ao reverter a conta de Auth após erro de cadastro:",
        rollbackError,
      );
    }
    throw error;
  }
}

/**
 * Encerra a sessão atual no Firebase Auth e limpa o session cookie httpOnly
 * (TASK-09). A limpeza do cookie é feita antes do sign-out client e é
 * best-effort (não bloqueia o logout local).
 */
export async function signOut(): Promise<void> {
  await clearSessionCookie();
  // Limpa o throttle de renovação (TASK-02): nova sessão recomeça a janela.
  clearLastMintAt();
  await firebaseSignOut(firebaseAuth);
}

/**
 * Envia o e-mail de redefinição de senha (PRD-01.1, perna 1).
 *
 * Anti-enumeração (R3): se o e-mail não existir, o Firebase rejeita com
 * `auth/user-not-found`. Para NÃO revelar a existência (ou não) de uma conta,
 * esse caso é tratado como sucesso silencioso — a UI exibe a mesma tela de
 * confirmação independentemente. Qualquer outro erro (rate limit, rede etc.)
 * propaga cru para a UI traduzir via `mapAuthError`.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(firebaseAuth, email);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/user-not-found") return;
    throw error;
  }
}

/**
 * Valida o `oobCode` do link de redefinição (PRD-01.1, perna 2) e resolve o
 * e-mail associado ao código. Erros (`auth/invalid-action-code`,
 * `auth/expired-action-code`…) propagam para a UI tratar o estado inválido.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(firebaseAuth, oobCode);
}

/**
 * Conclui a redefinição de senha (PRD-01.1, perna 2) com o `oobCode` e a nova
 * senha. Propaga os erros do Firebase (código inválido/expirado, senha fraca).
 */
export async function confirmReset(
  oobCode: string,
  newPassword: string,
): Promise<void> {
  await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
}

/**
 * Altera a senha do usuário autenticado (PRD-06, Alterar Senha).
 *
 * O Firebase exige autenticação RECENTE para `updatePassword`. Por isso a senha
 * atual é exigida e reautenticada (`reauthenticateWithCredential`) ANTES da
 * troca — isso também valida que a senha atual está correta (erro
 * `auth/wrong-password` / `auth/invalid-credential` se não estiver).
 *
 * Erros propagam crus (com `error.code`) para a UI traduzir — esta camada NÃO
 * traduz mensagens (padrão das demais funções deste serviço). Códigos comuns:
 * `auth/wrong-password`, `auth/invalid-credential`, `auth/weak-password`,
 * `auth/requires-recent-login`.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || !user.email) {
    // Sem usuário/e-mail não há como reautenticar — sinaliza sessão inválida.
    throw new Error("auth/no-current-user");
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
