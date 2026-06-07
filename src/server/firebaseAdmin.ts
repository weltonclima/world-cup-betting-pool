import "server-only";

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

/**
 * Inicialização do Firebase Admin SDK para o servidor Next (Route Handlers) —
 * TASK-09.
 *
 * Server-only: `import "server-only"` garante erro de build se algo do bundle
 * client tentar importar este módulo. O Admin SDK (chaves privadas) NUNCA pode
 * ir para o browser.
 *
 * Credenciais (ordem de resolução):
 *  1. Emulador (`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`): sem service account;
 *     o Admin SDK detecta `FIREBASE_AUTH_EMULATOR_HOST` automaticamente.
 *  2. `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON do service account em UMA linha):
 *     usado em dev/manual e como fallback explícito.
 *  3. `applicationDefault()`: usado no Firebase App Hosting / Cloud Run, onde a
 *     service account é injetada via metadados do runtime (ou via
 *     `GOOGLE_APPLICATION_CREDENTIALS` apontando para um arquivo).
 *
 * Singleton: `getApps().length ? getApp() : initializeApp(...)` evita
 * múltiplas inicializações em cold starts e durante os testes.
 */

/** Campos obrigatórios do service account JSON (validação mínima). */
const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

function buildAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // 1. Emulador: projectId basta; credencial é dispensada.
  if (useEmulators) {
    return initializeApp({ projectId: projectId ?? "demo-bolao-dos-parcas" });
  }

  // 2. Service account JSON explícito via env server-side.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido do service account.",
      );
    }

    const validationResult = serviceAccountSchema.safeParse(parsed);
    if (!validationResult.success) {
      const camposFaltando = validationResult.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ");
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_KEY inválido — campo(s) ausente(s) ou inválido(s): ${camposFaltando}`,
      );
    }

    return initializeApp({ credential: cert(parsed as ServiceAccount) });
  }

  // 3. Application Default Credentials (App Hosting / Cloud Run / GOOGLE_APPLICATION_CREDENTIALS).
  return initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
}

/** App Admin singleton (lazy: só inicializa quando importado server-side). */
export function getAdminApp(): App {
  return buildAdminApp();
}

/** `Auth` do Admin SDK (verifyIdToken / createSessionCookie / verifySessionCookie). */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** `Firestore` do Admin SDK (acesso server-side ao banco). */
export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
