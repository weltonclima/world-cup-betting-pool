import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import {
  deleteCredential,
  getCredentialById,
} from "@/server/auth/webauthnCredentialStore";
import { webauthnConfig } from "@/server/auth/webauthnConfig";

/**
 * DELETE /api/auth/webauthn/credentials/[credentialId] (login biométrico, TASK-06).
 *
 * Revoga (remove) um passkey do usuário. Segurança:
 *  - CSRF: exige Origin confiável;
 *  - sessão válida + `approved`;
 *  - **ownership**: só remove credencial cujo `uid` é o da sessão. Credencial
 *    inexistente OU de terceiro → 404 (não revela existência alheia).
 * A escrita é exclusiva do Admin SDK (Rules negam write client).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ credentialId: string }> },
): Promise<NextResponse> {
  if (request.headers.get("origin") !== webauthnConfig.origin) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { uid } = auth.user;

  const { credentialId } = await context.params;

  const cred = await getCredentialById(credentialId);
  // Ownership: inexistente ou de terceiro → 404 (mesma resposta, sem vazar).
  if (!cred || cred.uid !== uid) {
    return NextResponse.json(
      { error: "Credencial não encontrada." },
      { status: 404 },
    );
  }

  try {
    await deleteCredential(credentialId);
  } catch {
    return NextResponse.json(
      { error: "Erro ao remover a credencial." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
