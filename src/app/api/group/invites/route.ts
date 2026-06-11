import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  inviteSchema,
  MAX_INVITE_LABEL_LENGTH,
  MAX_INVITE_MAX_USES,
  poolSchema,
} from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().max(MAX_INVITE_LABEL_LENGTH).optional(),
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
 * GET /api/group/invites — convites ATIVOS do pool da sessão (PRD-10, TASK-08).
 * Ordenados por `createdAt` desc (mais recentes primeiro).
 */
export async function GET(): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  const db = getAdminFirestore();
  try {
    const snap = await db
      .collection("invites")
      .where("groupId", "==", groupId)
      .where("isActive", "==", true)
      .get();
    const invites = snap.docs
      .map((d) => inviteSchema.parse(d.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ invites }, { status: 200 });
  } catch (err) {
    console.error("[group/invites GET] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao carregar os convites." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/group/invites — cria um convite (PRD-10, TASK-08).
 *
 * Respeita `allowInvites` (default `true` quando ausente — bloqueia se `false`).
 * `code` gerado server-side; unicidade GLOBAL via doc-id = code + `.create()`
 * (falha atômica → retry). A3: ao gerar, EXPIRA os ativos anteriores do pool
 * (`isActive = false`) — um link principal por vez.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId, uid } = result.auth;

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
  const { label, maxUses, validityDays } = parsed.data;

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

    // Ordem create→expira (review WR-02): cria o novo convite PRIMEIRO e só então
    // expira os anteriores. Se a criação falhar (colisão persistente, erro de IO),
    // o link anterior permanece intacto — elimina o pior caso da ordem antiga
    // (expira-os, create falha → pool fica com ZERO convites e link destruído).
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const invite = {
        id: code,
        groupId,
        code,
        ...(label !== undefined ? { label } : {}),
        maxUses,
        usedCount: 0,
        expiresAt,
        isActive: true,
        createdBy: uid,
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
    console.error("[group/invites POST] colisão de code persistente:", lastError);
    return NextResponse.json(
      { error: "Não foi possível gerar um código único. Tente novamente." },
      { status: 409 },
    );
  } catch (err) {
    console.error("[group/invites POST] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao gerar o convite." },
      { status: 500 },
    );
  }
}
