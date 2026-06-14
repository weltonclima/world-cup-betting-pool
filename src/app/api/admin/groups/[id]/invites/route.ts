import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { writeAuditLog } from "@/server/admin/auditLog";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { inviteSchema, MAX_INVITE_MAX_USES, poolSchema } from "@/schemas";
import type { Invite } from "@/types/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sem `label` (decisão travada — super_admin só gera, sem rótulo).
const createSchema = z.object({
  maxUses: z.int().min(1).max(MAX_INVITE_MAX_USES),
  validityDays: z.int().min(1).max(365),
});

// Alfabeto sem caracteres ambíguos (0/O, 1/I) p/ legibilidade — subconjunto do
// regex `^[A-Z0-9]{6}$` do schema.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Gera um código curto não-adivinhável (server-side; nunca aceito do client). */
function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * GET /api/admin/groups/[id]/invites — super_admin lê o convite ATIVO atual de
 * qualquer pool, identificado pelo `[id]` da URL (superadmin-invite-generator).
 *
 * Mesmo gate do POST (`authorizeGroupAdmin`: super_admin global/secret). Retorna
 * `{ invite }` com o ativo mais recente do pool, ou `{ invite: null }` quando não
 * há nenhum. A invariante do POST mantém ~1 ativo por pool; em empate raro de
 * timestamp escolhe um deles de forma determinística (createdAt > vence). Docs
 * ilegíveis são ignorados (não derrubam a leitura).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id: groupId } = await ctx.params;
  const db = getAdminFirestore();

  try {
    const snap = await db
      .collection("invites")
      .where("groupId", "==", groupId)
      .where("isActive", "==", true)
      .get();

    let primary: Invite | null = null;
    for (const doc of snap.docs) {
      const parsed = inviteSchema.safeParse(doc.data());
      if (!parsed.success) continue;
      if (!primary || parsed.data.createdAt > primary.createdAt) {
        primary = parsed.data;
      }
    }

    return NextResponse.json({ invite: primary }, { status: 200 });
  } catch (err) {
    console.error("[admin/groups/invites GET] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao carregar o convite." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/groups/[id]/invites — super_admin gera um convite para QUALQUER
 * pool, identificado pelo `[id]` da URL (superadmin-invite-generator TASK-02).
 *
 * Espelha a geração de `POST /api/group/invites` (NÃO abstraído em util comum: os
 * endpoints diferem em autorização e escopo). Diferenças: (1) gate
 * `authorizeGroupAdmin` (super_admin global/secret); (2) `groupId` vem do param da
 * URL, nunca do body; (3) auditoria `group_invite_created` em `system_logs`.
 *
 * Respeita `allowInvites` (default `true` quando ausente — bloqueia se `false`).
 * `code` gerado server-side; unicidade GLOBAL via doc-id = code + `.create()`
 * (falha atômica → retry). A3: ao gerar, EXPIRA os ativos anteriores do pool
 * (`isActive = false`) — um link principal por vez.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { actorUid } = auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const { maxUses, validityDays } = parsed.data;

  // `groupId` vem EXCLUSIVAMENTE do param da URL (Next 15: params é Promise).
  const { id: groupId } = await ctx.params;
  // Caminho secret não tem ator humano → sentinela (schema exige nonEmptyString).
  const createdBy = actorUid ?? "system";

  const db = getAdminFirestore();

  try {
    // Respeita a flag do pool: ausente = true (default na leitura).
    const poolSnap = await db.collection("pools").doc(groupId).get();
    if (!poolSnap.exists) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
    }
    const pool = poolSchema.parse(poolSnap.data());
    if (pool.allowInvites === false) {
      return NextResponse.json(
        { error: "Os convites estão desativados nas configurações do grupo." },
        { status: 409 },
      );
    }

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + validityDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Ordem create→expira: cria o novo convite PRIMEIRO e só então expira os
    // anteriores. Se a criação falhar (colisão persistente, erro de IO), o link
    // anterior permanece intacto — preserva a invariante "nunca 0 links ativos".
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const invite = {
        id: code,
        groupId,
        code,
        maxUses,
        usedCount: 0,
        expiresAt,
        isActive: true,
        createdBy,
        createdAt,
      };
      const validated = inviteSchema.safeParse(invite);
      if (!validated.success) {
        return NextResponse.json(
          { error: "Dados de convite inválidos." },
          { status: 422 },
        );
      }
      try {
        await db.collection("invites").doc(code).create(validated.data);

        // A3: criado com sucesso → expira os ativos ESTRITAMENTE ANTERIORES deste
        // pool (createdAt < o atual), exceto o recém-criado. Comparar por createdAt
        // (não só por id) evita que duas criações concorrentes se expirem
        // mutuamente e deixem o pool sem link ativo: a mais recente vence; um
        // empate raro de timestamp preserva ambos os links (degrada para 2 ativos,
        // nunca para 0).
        const activeSnap = await db
          .collection("invites")
          .where("groupId", "==", groupId)
          .where("isActive", "==", true)
          .get();
        const stale = activeSnap.docs.filter((d) => {
          if (d.id === code) return false;
          const other = inviteSchema.safeParse(d.data());
          // Doc ilegível → expira (limpeza); legível → só se mais antigo.
          return !other.success || other.data.createdAt < createdAt;
        });
        if (stale.length > 0) {
          const batch = db.batch();
          stale.forEach((d) => batch.update(d.ref, { isActive: false }));
          await batch.commit();
        }

        // Auditoria best-effort (superadmin-invite-generator): só com ator humano
        // (caminho secret não tem actorUid). NUNCA derruba a resposta de sucesso.
        if (actorUid) {
          void writeAuditLog({
            type: "group_invite_created",
            actorUid,
            message: `Convite gerado para o grupo ${groupId}`,
            level: "info",
          });
        }

        return NextResponse.json({ invite: validated.data }, { status: 201 });
      } catch (err) {
        // ALREADY_EXISTS (gRPC 6): colisão de code — tenta outro.
        const c = (err as { code?: unknown }).code;
        if (c === 6 || c === "already-exists" || c === "ALREADY_EXISTS") {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    console.error(
      "[admin/groups/invites POST] colisão de code persistente:",
      lastError,
    );
    return NextResponse.json(
      { error: "Não foi possível gerar um código único. Tente novamente." },
      { status: 409 },
    );
  } catch (err) {
    console.error("[admin/groups/invites POST] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao gerar o convite." },
      { status: 500 },
    );
  }
}
