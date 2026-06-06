/**
 * Inicialização do Firebase Admin SDK — singleton.
 *
 * initializeApp() sem argumentos: o runtime do Firebase injeta as credenciais
 * automaticamente em produção (via GOOGLE_APPLICATION_CREDENTIALS ou metadados do Cloud Run).
 * No emulador local, FIRESTORE_EMULATOR_HOST redireciona as escritas automaticamente.
 *
 * Guard getApps().length === 0 evita múltiplas inicializações em cold starts
 * e durante importações em ambiente de teste.
 */

import { initializeApp, getApps, getApp } from "firebase-admin/app";

// Inicializa o app Admin apenas uma vez (singleton)
export const adminApp =
  getApps().length === 0 ? initializeApp() : getApp();
