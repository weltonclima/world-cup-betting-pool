import "server-only";

import {
  getAdminApp,
  getAdminAuth,
  getAdminFirestore,
} from "@/server/firebaseAdmin";

/**
 * Compatibilidade — Admin SDK (server-only).
 *
 * A lógica de inicialização e resolução de credencial vive numa fonte única:
 * `@/server/firebaseAdmin`. Este módulo apenas reexporta as instâncias para
 * manter a superfície histórica (`adminApp` / `adminAuth` / `adminFirestore`)
 * usada por importadores legados, evitando duplicar (e arriscar drift de) a
 * lógica de credencial entre dois inicializadores.
 *
 * Server-only: `import "server-only"` garante erro de build se o bundle client
 * tentar importá-lo. As instâncias são lazy (singleton em `firebaseAdmin`),
 * então só inicializam quando efetivamente acessadas em runtime de servidor.
 */
export const adminApp = getAdminApp();
export const adminAuth = getAdminAuth();
export const adminFirestore = getAdminFirestore();
