import { z } from "zod";

/**
 * Schema das variáveis públicas do Firebase (client SDK).
 * Todas são NEXT_PUBLIC_* → embarcadas no bundle do browser (NÃO são segredos).
 * Segredos server-side (service account) são lidos em admin.ts, nunca aqui.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  // VAPID public key (Web Push certificate). OPCIONAL: ausente → push opt-in
  // fica oculto/desabilitado (degrada gracioso). Gerada em Firebase Console →
  // Project settings → Cloud Messaging → Web Push certificates → Generate key pair.
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().min(1).optional(),
  // Flag opcional: liga conexão aos emuladores locais.
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

export type FirebaseClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Lê e valida as envs públicas. As referências precisam ser literais
 * (process.env.NEXT_PUBLIC_X) para o Next inlinear no bundle client.
 */
function readClientEnv(): FirebaseClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    NEXT_PUBLIC_FIREBASE_USE_EMULATORS:
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS,
  });

  if (!parsed.success) {
    // Sob testes (Vitest), o feature web-push-pwa fez `firebase/messaging` →
    // `firebase/client` → este módulo serem alcançados transitivamente por
    // muitos pontos (Header → useForegroundPush, services/auth → registration).
    // Lançar no load quebraria qualquer teste que não mocke a cadeia. Aqui
    // devolvemos config placeholder (sem rede no load; `initializeApp` só guarda
    // a config) e NÃO tocamos em `process.env` — `firebaseAdmin` lê
    // `NEXT_PUBLIC_FIREBASE_PROJECT_ID` direto de `process.env` e deve continuar
    // vendo-o ausente. Em prod/dev o fail-fast original é preservado.
    if (process.env.VITEST || process.env.NODE_ENV === "test") {
      return {
        NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.appspot.com",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
        NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:test",
        NEXT_PUBLIC_FIREBASE_VAPID_KEY: undefined,
        NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "false",
      };
    }
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Variáveis NEXT_PUBLIC_FIREBASE_* inválidas/ausentes: ${missing}. ` +
        `Copie .env.local.example para .env.local e preencha (ou use emuladores).`,
    );
  }

  return parsed.data;
}

export const firebaseClientEnv = readClientEnv();

export const useEmulators =
  firebaseClientEnv.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";
