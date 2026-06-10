/**
 * Flag de INTENÇÃO de ativar a biometria, marcada no submit do login (checkbox)
 * e consumida pelo prompt pós-redirect (`BiometricActivationPrompt`).
 *
 * `sessionStorage` (escopo de aba; some ao fechar) — é só uma DICA de UX, nunca
 * fonte de verdade de segurança: no máximo decide se um prompt aparece. O registro
 * WebAuthn em si continua autoritativo no servidor. Client-only, best-effort
 * (storage indisponível em modo privado/SSR não derruba nada).
 */

const INTENT_KEY = "bolao:activate-biometric-intent";

/** Marca a intenção de ativar a biometria após o login. */
export function setBiometricIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(INTENT_KEY, "1");
  } catch {
    // Storage indisponível: best-effort, segue sem intenção.
  }
}

/** Lê e LIMPA a intenção (atômico — garante prompt único por login). */
export function consumeBiometricIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const has = window.sessionStorage.getItem(INTENT_KEY) === "1";
    if (has) window.sessionStorage.removeItem(INTENT_KEY);
    return has;
  } catch {
    return false;
  }
}

/** Limpa a intenção sem lê-la (teardown explícito). */
export function clearBiometricIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // best-effort.
  }
}
