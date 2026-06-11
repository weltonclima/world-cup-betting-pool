/**
 * Seed idempotente do pool-semente "Bolão dos Parças" (PRD-09 A3, TASK-05).
 *
 * Destrava a testabilidade fim-a-fim (R5): garante ao menos um pool `active` para
 * a busca/detalhe (TASK-04/09). Idempotente — doc-id = slug; re-rodar não duplica
 * nem sobrescreve campos.
 *
 * Uso (runner: tsx):
 *   SEED_ADMIN_UID=<uid> npx tsx scripts/seed-pools.ts
 * Credencial: FIREBASE_SERVICE_ACCOUNT_KEY (JSON em uma linha) OU applicationDefault()
 * (Cloud Run / `gcloud auth application-default login`). Emulador respeita
 * FIRESTORE_EMULATOR_HOST.
 */

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { poolSchema } from "@/schemas";

const SEED_SLUG = "bolao-dos-parcas";
const SEED_NAME = "Bolão dos Parças";

function buildApp(): App {
  const existing = getApps();
  if (existing[0]) return existing[0];

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_KEY"];
  if (raw && raw.length > 0) {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return initializeApp({ credential: applicationDefault() });
}

async function main(): Promise<void> {
  const adminUid = process.env["SEED_ADMIN_UID"];
  if (!adminUid || adminUid.length === 0) {
    throw new Error(
      "Defina SEED_ADMIN_UID com o uid do super_admin dono do pool-semente.",
    );
  }

  const db = getFirestore(buildApp());
  const ref = db.collection("pools").doc(SEED_SLUG);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`Pool-semente '${SEED_SLUG}' já existe — nada a fazer.`);
    return;
  }

  const pool = poolSchema.parse({
    id: SEED_SLUG,
    name: SEED_NAME,
    slug: SEED_SLUG,
    status: "active",
    adminId: adminUid,
    createdAt: new Date().toISOString(),
  });

  try {
    await ref.create(pool);
  } catch (err: unknown) {
    // Corrida: outro processo criou entre o get e o create (gRPC ALREADY_EXISTS = 6).
    if ((err as { code?: unknown }).code === 6) {
      console.log(`Pool-semente '${SEED_SLUG}' já existe (concorrência) — nada a fazer.`);
      return;
    }
    throw err;
  }
  console.log(`Pool-semente '${SEED_SLUG}' criado (active, admin=${adminUid}).`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
