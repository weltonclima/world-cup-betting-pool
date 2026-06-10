import { collection, getDocs, query, where } from "firebase/firestore";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import { firestore } from "@/firebase";
import { webauthnCredentialSchema, type WebauthnCredential } from "@/schemas";

/**
 * Serviço client do login biométrico (WebAuthn, TASK-06).
 *
 * Leitura das próprias credenciais: Firebase Client SDK direto (Rules permitem
 * own-read, TASK-03). Registro/revogação: Route Handlers (Admin SDK), pois write
 * client é negado pelas Rules. Erros propagam como `PasskeyError` com mensagem
 * pt-BR já mapeada — a UI não lida com status HTTP nem detalhe técnico WebAuthn.
 */

/** Código semântico do erro (para a UI diferenciar cancelamento de falha real). */
export type PasskeyErrorCode = "cancelled" | "exists" | "error";

export class PasskeyError extends Error {
  readonly code: PasskeyErrorCode;
  constructor(message: string, code: PasskeyErrorCode = "error") {
    super(message);
    this.name = "PasskeyError";
    this.code = code;
  }
}

const REGISTER_OPTIONS = "/api/auth/webauthn/register/options";
const REGISTER_VERIFY = "/api/auth/webauthn/register/verify";
const LOGIN_OPTIONS = "/api/auth/webauthn/login/options";
const LOGIN_VERIFY = "/api/auth/webauthn/login/verify";

/** Lista as credenciais do usuário (read client; Rules garantem só as próprias). */
export async function listMyPasskeys(
  uid: string,
): Promise<WebauthnCredential[]> {
  const q = query(
    collection(firestore, "webauthn_credentials"),
    where("uid", "==", uid),
  );
  const snap = await getDocs(q);
  const creds: WebauthnCredential[] = [];
  snap.forEach((docSnap) => {
    const parsed = webauthnCredentialSchema.safeParse(docSnap.data());
    if (parsed.success) creds.push(parsed.data);
  });
  return creds;
}

/**
 * Registra um passkey: pega as opções no servidor, dispara a cerimônia do
 * navegador (`startRegistration` → biometria do device) e envia a attestation
 * para verificação. Deve ser chamada a partir de um gesto do usuário (req. iOS).
 */
export async function registerPasskey(deviceLabel?: string): Promise<void> {
  const optionsRes = await fetch(REGISTER_OPTIONS, { method: "POST" });
  if (!optionsRes.ok) {
    throw new PasskeyError("Não foi possível iniciar o registro.");
  }
  const optionsJSON = await optionsRes.json();

  let regResponse;
  try {
    regResponse = await startRegistration({ optionsJSON });
  } catch (err) {
    const name = (err as Error).name;
    if (name === "NotAllowedError") {
      throw new PasskeyError("Registro cancelado.", "cancelled");
    }
    if (name === "InvalidStateError") {
      throw new PasskeyError(
        "Este dispositivo já está cadastrado.",
        "exists",
      );
    }
    throw new PasskeyError("Não foi possível ativar a biometria.");
  }

  const verifyRes = await fetch(REGISTER_VERIFY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: regResponse, deviceLabel }),
  });
  if (!verifyRes.ok) {
    if (verifyRes.status === 409) {
      throw new PasskeyError(
        "Este dispositivo já está cadastrado.",
        "exists",
      );
    }
    throw new PasskeyError("Não foi possível ativar a biometria.");
  }
}

/**
 * Login biométrico (TASK-08): pega as opções de autenticação no servidor, dispara
 * a cerimônia do navegador (`startAuthentication` → biometria do device, usernameless)
 * e envia a assertion para verificação. Resolve o `customToken` do Firebase (a troca
 * por sessão é de `signInWithBiometricToken`). Deve ser chamada a partir de um gesto
 * do usuário (req. iOS Safari). Cancelamento (`NotAllowedError`) → `code: "cancelled"`.
 */
export async function loginWithPasskey(): Promise<string> {
  const optionsRes = await fetch(LOGIN_OPTIONS, { method: "POST" });
  if (!optionsRes.ok) {
    throw new PasskeyError("Não foi possível entrar com biometria.");
  }
  const optionsJSON = await optionsRes.json();

  let authResponse;
  try {
    authResponse = await startAuthentication({ optionsJSON });
  } catch (err) {
    if ((err as Error).name === "NotAllowedError") {
      // NotAllowedError cobre tanto cancelamento quanto AUSÊNCIA de passkey
      // (login usernameless não distingue os dois). Mensagem orientadora cobre
      // ambos sem alarmar; `cancelled` mantém o toast neutro (info, não erro).
      throw new PasskeyError(
        "Biometria não concluída. Se ainda não cadastrou neste aparelho, ative em Perfil → Segurança.",
        "cancelled",
      );
    }
    throw new PasskeyError("Não foi possível entrar com biometria.");
  }

  const verifyRes = await fetch(LOGIN_VERIFY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: authResponse }),
  });
  if (!verifyRes.ok) {
    throw new PasskeyError("Não foi possível entrar com biometria.");
  }

  const data = await verifyRes.json().catch(() => null);
  if (!data || typeof data.customToken !== "string") {
    throw new PasskeyError("Não foi possível entrar com biometria.");
  }
  return data.customToken;
}

/** Revoga (remove) um passkey. Ownership é aplicada no servidor. */
export async function revokePasskey(credentialId: string): Promise<void> {
  const res = await fetch(
    `/api/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`,
    { method: "DELETE" },
  );
  // 404 = já removido (lista obsoleta / outra aba): a intenção do usuário já
  // está satisfeita → trata como sucesso idempotente, não erro.
  if (!res.ok && res.status !== 404) {
    throw new PasskeyError("Não foi possível remover o dispositivo.");
  }
}
