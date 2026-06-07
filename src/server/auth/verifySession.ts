import { decodeProtectedHeader, importX509, jwtVerify } from "jose";

/**
 * Verificação de SESSION COOKIE do Firebase no edge (TASK-10).
 *
 * IMPORTANTE — session cookie ≠ ID token:
 *  - O session cookie do Firebase é um JWT assinado em RS256, mas o `iss` é
 *    `https://session.firebase.google.com/<projectId>` (NÃO o `iss` de ID token,
 *    que é `https://securetoken.google.com/<projectId>`).
 *  - As chaves públicas (certificados x509 PEM por `kid`) ficam em
 *    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys`
 *    (ID tokens usam um endpoint DIFERENTE).
 *
 * `firebase-admin` NÃO roda no middleware (runtime edge) → a verificação é feita
 * com `jose` (edge-compatible): `importX509` para a chave do `kid` do header e
 * `jwtVerify` checando `alg`, `iss`, `aud` e validade temporal (`exp`/`iat`/`nbf`,
 * que o `jose` valida automaticamente).
 *
 * Esta função é PURA o suficiente para teste: o fetch dos certificados é injetado
 * via `deps.fetchCerts`, e o `projectId` também. Assim o middleware fica fino e a
 * lógica é testável sob vitest sem edge real.
 */

/** Endpoint dos certificados públicos para SESSION COOKIES do Firebase. */
export const SESSION_COOKIE_CERTS_URL =
  "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys";

/** Mapa `kid` → certificado x509 (PEM). */
export type GoogleCerts = Record<string, string>;

/** Dependências injetáveis (testabilidade + sem rede no unit test). */
export interface VerifySessionDeps {
  /** Project ID do Firebase (`NEXT_PUBLIC_FIREBASE_PROJECT_ID`). */
  projectId: string;
  /** Busca os certificados públicos do Google (com cache próprio, se houver). */
  fetchCerts: () => Promise<GoogleCerts>;
}

/** Resultado discriminado da verificação. */
export type VerifySessionResult =
  | { valid: true; role: "admin" | "user" | null }
  | { valid: false };

const INVALID: VerifySessionResult = { valid: false };

/**
 * Normaliza o claim `role` do payload para o shape estável usado pelo middleware.
 * Só `"admin"`/`"user"` são reconhecidos; qualquer outra coisa vira `null`
 * (ausência de privilégio), nunca lança.
 */
function normalizeRole(raw: unknown): "admin" | "user" | null {
  return raw === "admin" || raw === "user" ? raw : null;
}

/**
 * Verifica um session cookie do Firebase. Retorna `{ valid:false }` para
 * qualquer falha (ausente, header sem `kid`, `kid` desconhecido, assinatura
 * inválida, `iss`/`aud` errados, expirado, erro de rede nos certs). Nunca lança.
 *
 * @param token Valor do cookie `__session` (ou undefined se ausente).
 * @param deps  `projectId` + `fetchCerts` injetados.
 */
export async function verifySession(
  token: string | undefined | null,
  deps: VerifySessionDeps,
): Promise<VerifySessionResult> {
  const { projectId, fetchCerts } = deps;

  // Sem token ou sem projectId configurado → não há como verificar.
  if (!token || !projectId) {
    return INVALID;
  }

  try {
    // 1. Header do JWT para descobrir o `kid` (sem verificar ainda).
    const header = decodeProtectedHeader(token);
    const kid = header.kid;
    if (!kid) {
      return INVALID;
    }

    // 2. Certificado público correspondente ao `kid`.
    const certs = await fetchCerts();
    const pem = certs[kid];
    if (!pem) {
      return INVALID;
    }

    // 3. Chave pública a partir do certificado x509.
    const publicKey = await importX509(pem, "RS256");

    // 4. Verifica assinatura + claims. `jose` valida exp/iat/nbf e lança em
    //    iss/aud divergentes ou assinatura inválida.
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `https://session.firebase.google.com/${projectId}`,
      audience: projectId,
    });

    return { valid: true, role: normalizeRole(payload.role) };
  } catch {
    // Qualquer falha de parse/verificação/rede → inválido. Mensagem não vaza.
    return INVALID;
  }
}
