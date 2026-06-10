"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";

import { firebaseAuth } from "@/firebase";
import { refreshSessionCookie } from "@/services/auth";

/**
 * Renovação deslizante do session cookie (TASK-02).
 *
 * Assina `onIdTokenChanged`: o callback dispara no mount (com o usuário atual) e
 * a cada refresh do ID token (~1×/h enquanto o app está aberto) e em login/
 * logout. Cada evento aciona `refreshSessionCookie`, que internamente aplica o
 * throttle e as guardas — o hook é fino de propósito.
 *
 * Headless: não renderiza nada. Montar uma única vez na árvore de providers.
 */
export function useSessionRenewal(): void {
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, () => {
      void refreshSessionCookie();
    });
    return unsubscribe;
  }, []);
}
