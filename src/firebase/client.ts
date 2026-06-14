import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

import { firebaseClientEnv, useEmulators } from "./env";

const firebaseConfig = {
  apiKey: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseClientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

// Singleton: reaproveita o app já criado (hot reload / múltiplos imports).
const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const firebaseAuth: Auth = getAuth(firebaseApp);
const firestore: Firestore = getFirestore(firebaseApp);

// Conecta aos emuladores apenas quando a flag estiver ligada.
// Guard global evita reconectar em hot reload (lança erro se reconectado).
declare global {
  var __FIREBASE_EMULATORS_CONNECTED__: boolean | undefined;
}

if (useEmulators && !globalThis.__FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true;
}

/**
 * Persistência da sessão de Auth no client (login biométrico, TASK-01).
 *
 * Torna a persistência EXPLÍCITA como `browserLocalPersistence` (localStorage):
 * a sessão sobrevive a reload e ao fechar a aba — comportamento de "manter
 * logado". Antes disso o SDK usava o default implícito; agora é intencional.
 *
 * `setPersistence` é assíncrono e deve concluir antes da ESCRITA da sessão (o
 * sign-in), senão a sessão pode ser gravada com persistência diferente da
 * pretendida. A garantia é aplicada no boundary da camada de serviço:
 * `signIn`/`signUp` aguardam `authPersistenceReady` antes de autenticar.
 *
 * `onAuthStateChanged` (em `AuthProvider`) TAMBÉM precisa aguardar essa promise
 * antes de subscrever: a restauração da sessão persistida só ocorre APÓS
 * `setPersistence` aplicar a persistência `local`. Se o listener registra antes,
 * ele emite um `null` transiente (persistência default in-memory, sem sessão
 * restaurada) que é falsamente interpretado como "deslogado" e dispara um
 * redirect /login → /home. Por isso tanto a ESCRITA (signIn/signUp) quanto a
 * LEITURA (AuthProvider) são gated em `authPersistenceReady`.
 *
 * Achado de auditoria de persistência (Frente A): o estado de Auth no client já
 * persistia indefinidamente (default local), MAS o session cookie `__session`
 * (servidor/edge) expira fixo em 5 dias sem renovação — divergência client↔server
 * que aparece como logout inesperado em rotas server-side. A correção dessa
 * renovação deslizante é a TASK-02 (fora do escopo desta task).
 *
 * Client-only: `setPersistence` usa storage do browser; em SSR/edge (sem
 * `window`) é pulado e a promise resolve de imediato. Best-effort: falha
 * (ex.: modo privado restrito) é logada e NÃO derruba o app nem bloqueia o
 * login — só significa que a sessão não sobrevive ao fechar a aba.
 */
const authPersistenceReady: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : setPersistence(firebaseAuth, browserLocalPersistence).catch((error) => {
        console.error("Falha ao definir a persistência do Auth:", error);
      });

export { firebaseApp, firebaseAuth, firestore, authPersistenceReady };
