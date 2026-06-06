import "server-only";

import {
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
 * Schema mínimo para validar os campos obrigatórios do service account JSON.
 * Erros de ausência são reportados com o nome exato do campo faltante.
 */
const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

/**
 * Constrói o app do admin SDK (singleton).
 * - Modo emulador: sem service account; o admin SDK detecta
 *   FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST e ignora credenciais.
 * - Modo real: lê o service account JSON da env server-side (NUNCA NEXT_PUBLIC_*).
 */
function buildAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (useEmulators) {
    // Emulador: projectId basta; credencial é dispensada.
    return initializeApp({ projectId: projectId ?? "demo-bolao-dos-parcas" });
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY ausente. Defina o service account JSON " +
        "(server-side) ou ligue NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido do service account.",
    );
  }

  // Valida campos obrigatórios; reporta explicitamente os campos ausentes.
  const validationResult = serviceAccountSchema.safeParse(parsed);
  if (!validationResult.success) {
    const camposFaltando = validationResult.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_KEY inválido — campo(s) ausente(s) ou inválido(s): ${camposFaltando}`,
    );
  }

  const serviceAccount = parsed as ServiceAccount;

  return initializeApp({ credential: cert(serviceAccount) });
}

const adminApp: App = buildAdminApp();
const adminAuth: Auth = getAuth(adminApp);
const adminFirestore: Firestore = getFirestore(adminApp);

export { adminApp, adminAuth, adminFirestore };
