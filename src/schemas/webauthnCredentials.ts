import { z } from "zod";

import { isoDateTime, nonEmptyString } from "@/schemas/shared";

// Coleção `webauthn_credentials` (`webauthn_credentials/{credentialId}`).
// Credencial de passkey (login biométrico, TASK-03). Gravada EXCLUSIVAMENTE
// pelo Admin SDK após verificação WebAuthn (registro/login). O cliente apenas
// lê as próprias (lista/gestão). Doc id = `credentialId` (base64url) → garante
// unicidade e lookup direto `credentialId → uid` no login usernameless.
export const webauthnCredentialSchema = z
  .object({
    credentialId: nonEmptyString, // = id do doc (base64url)
    uid: nonEmptyString, // dono (referência users.uid)
    publicKey: nonEmptyString, // chave pública COSE em base64url
    counter: z.int().min(0), // contador de assinatura (anti-clonagem, verificado no servidor)
    // Transportes do autenticador (ex.: "internal", "hybrid"). Lista permissiva:
    // a enumeração WebAuthn evolve; não acoplar a um conjunto fechado.
    transports: z.array(nonEmptyString).optional(),
    deviceLabel: nonEmptyString.optional(), // rótulo amigável definido no enrollment
    createdAt: isoDateTime,
    lastUsedAt: isoDateTime.optional(),
  })
  .strict();

export type WebauthnCredential = z.infer<typeof webauthnCredentialSchema>;
