import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { firebaseAuth, firestore } from "@/firebase";
import type { SignupFormValues } from "@/features/auth/schemas";

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
  "name" | "nickname" | "email" | "password"
>;

/**
 * Endpoint do session cookie httpOnly (TASK-09). O client troca o ID token por
 * um cookie `__session` verificável no servidor/edge (middleware da TASK-10).
 */
const SESSION_ENDPOINT = "/api/auth/session";

/**
 * Cria/renova o session cookie a partir do usuário recém-autenticado.
 *
 * `getIdToken(true)` força o refresh do token para carregar o custom claim
 * `role` fresco (TASK-08) — o token em cache pode ter o claim antigo por até ~1h.
 *
 * Best-effort: falha aqui (rede/servidor) NÃO derruba o login no client (o
 * Firebase Auth já autenticou). A ausência do cookie só bloqueia rotas
 * protegidas por servidor; é logada para diagnóstico.
 */
async function createSessionCookie(): Promise<void> {
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
      console.error(
        "Falha ao criar session cookie:",
        response.status,
      );
    }
  } catch (error) {
    console.error("Erro ao criar session cookie:", error);
  }
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
 */
export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth, email, password);
  await createSessionCookie();
}

/**
 * Cria a conta no Firebase Auth e grava o perfil em `users/{uid}`.
 *
 * O cliente sempre grava `role: "user"` / `status: "pending"` (as Security
 * Rules exigem). A promoção a admin é feita por Cloud Function (TASK-05).
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
}: SignUpInput): Promise<void> {
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
      role: "user",
      status: "pending",
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
