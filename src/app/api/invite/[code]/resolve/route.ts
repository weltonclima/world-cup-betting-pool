import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { resolveInvite } from "@/server/invites/resolveInvite";

/**
 * GET /api/invite/[code]/resolve — rota PÚBLICA (sem auth) que resolve um código
 * de convite válido em `{ groupId, groupName }` (PRD-10, TASK-04).
 *
 * Consumida pelo `SignupForm` (TASK-05) quando o usuário digita um código no
 * `/signup`. Reusa o util `resolveInvite` compartilhado com o Server Component
 * `/invite/[code]`, evitando drift de regra de validação.
 *
 * Expõe APENAS `groupId`/`groupName` — nunca `usedCount`/`maxUses`/`expiresAt`/
 * `createdBy`. Status uniforme `404` para qualquer convite indisponível reduz a
 * superfície de enumeração; `410` (Gone) sinaliza especificamente expiração.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await ctx.params;
  const resolution = await resolveInvite(code);

  if (resolution.ok) {
    return NextResponse.json(resolution.invite, { status: 200 });
  }

  const status = resolution.code === "expired" ? 410 : 404;
  return NextResponse.json({ error: resolution.reason }, { status });
}
