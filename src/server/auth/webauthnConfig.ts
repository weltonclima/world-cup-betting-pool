import "server-only";

import type { AuthenticatorSelectionCriteria } from "@simplewebauthn/server";

/**
 * Configuração de Relying Party (RP) do WebAuthn (login biométrico, TASK-04).
 *
 * `rpID`/`origin` ATRELAM os passkeys ao domínio: um passkey registrado num
 * domínio não funciona em outro, e trocar de domínio invalida TODOS os passkeys
 * já cadastrados. Por isso a configuração é resolvida por ambiente via env, com
 * defaults seguros:
 *  - dev:  rpID="localhost",                origin="http://localhost:3000";
 *  - prod: rpID="bolaodosparcas.vercel.app", origin="https://bolaodosparcas.vercel.app".
 *
 * `.vercel.app` está na Public Suffix List → `bolaodosparcas.vercel.app` é um
 * domínio registrável e um `rpID` VÁLIDO (não usar `vercel.app` como rpID).
 *
 * Server-only: nunca vai ao bundle do browser.
 */

const isProduction = process.env.NODE_ENV === "production";

const DEFAULT_RP_ID = isProduction ? "bolaodosparcas.vercel.app" : "localhost";
const DEFAULT_ORIGIN = isProduction
  ? "https://bolaodosparcas.vercel.app"
  : "http://localhost:3000";
const DEFAULT_RP_NAME = "Bolão dos Parças";

const rpID = process.env.WEBAUTHN_RP_ID ?? DEFAULT_RP_ID;
const rpName = process.env.WEBAUTHN_RP_NAME ?? DEFAULT_RP_NAME;

// Parse único do origin, com erro amigável (URL malformada → falha clara no
// build/boot em vez de TypeError cru).
const rawOrigin = process.env.WEBAUTHN_ORIGIN ?? DEFAULT_ORIGIN;
let originUrl: URL;
try {
  originUrl = new URL(rawOrigin);
} catch {
  throw new Error(`Config WebAuthn: WEBAUTHN_ORIGIN inválido: "${rawOrigin}".`);
}
// `.origin` normaliza (remove barra/caminho final).
const origin = originUrl.origin;
const originHost = originUrl.hostname;

// Guard de Public Suffix: um sufixo público de hosting (ex.: "vercel.app") NÃO
// é um rpID válido — user agents WebAuthn o rejeitam, brickando silenciosamente
// registro/login. Falha cedo se o rpID for um desses (footgun de config).
const PUBLIC_SUFFIX_BLOCKLIST = new Set([
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "web.app",
  "firebaseapp.com",
  "github.io",
  "now.sh",
]);
if (PUBLIC_SUFFIX_BLOCKLIST.has(rpID)) {
  throw new Error(
    `Config WebAuthn: rpID "${rpID}" é um sufixo público de hosting, inválido como ` +
      `Relying Party ID. Use o subdomínio completo (ex.: "bolaodosparcas.vercel.app").`,
  );
}

// Coerência rpID ⊆ origin: o `rpID` deve ser o host do `origin` ou um sufixo
// registrável dele. Falha cedo (carga do módulo) para não emitir options
// inválidas que invalidariam silenciosamente os passkeys.
const rpIdMatchesOrigin =
  originHost === rpID || originHost.endsWith(`.${rpID}`);
if (!rpIdMatchesOrigin) {
  throw new Error(
    `Config WebAuthn inconsistente: origin "${origin}" (host "${originHost}") ` +
      `não casa com rpID "${rpID}". O rpID deve ser o host do origin ou seu sufixo registrável.`,
  );
}

export const webauthnConfig: {
  readonly rpName: string;
  readonly rpID: string;
  readonly origin: string;
} = { rpName, rpID, origin };

/**
 * Seleção de autenticador padrão (prioridade mobile Android/iOS): exige o
 * autenticador de PLATAFORMA do device (Face ID/Touch ID/digital), passkey
 * descoberto (`residentKey: "required"` → login usernameless) e verificação do
 * usuário (biometria/PIN) obrigatória. Consumido pelos endpoints (TASK-05/07).
 */
export const webauthnAuthenticatorSelection: AuthenticatorSelectionCriteria = {
  authenticatorAttachment: "platform",
  residentKey: "required",
  userVerification: "required",
};

/** Algoritmos COSE suportados: ES256 (-7) e RS256 (-257). */
export const webauthnSupportedAlgorithmIDs: number[] = [-7, -257];
