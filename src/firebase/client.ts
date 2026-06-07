import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
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

export { firebaseApp, firebaseAuth, firestore };
