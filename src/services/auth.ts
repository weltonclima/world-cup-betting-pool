import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
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
 * Autentica o usuário com e-mail e senha.
 * Propaga os erros do Firebase Auth (ex.: `auth/invalid-credential`).
 */
export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth, email, password);
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

/** Encerra a sessão atual no Firebase Auth. */
export async function signOut(): Promise<void> {
  await firebaseSignOut(firebaseAuth);
}
