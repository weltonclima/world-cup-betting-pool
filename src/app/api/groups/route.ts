import "server-only"; // garante que não vaza para o bundle client

import { type NextRequest, NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolInputSchema, poolSchema } from "@/schemas";

// Node runtime: firebase-admin exige Node. Force dynamic: lê sessão + grava Firestore.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Firestore Admin SDK lança ALREADY_EXISTS (gRPC code 6) quando `.create()`
 * colide com um doc existente. Cobre a corrida de duas criações com o mesmo
 * slug (R7) — uma vence, a outra recebe 409.
 */
function isAlreadyExists(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

/**
 * POST /api/groups — cria um pool (grupo de bolão) `pending` via Admin SDK (TASK-04).
 *
 * `adminId` vem SEMPRE da sessão (nunca do body). Slug único é garantido pelo
 * doc-id = slug + `.create()` (falha atômica → 409). Coleção Firestore = `pools`
 * (a rota usa "groups" por linguagem de UI). Write client é negado pelas Rules
 * (TASK-03) — só o Admin SDK escreve aqui.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireApprovedUser();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { uid } = auth.user;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)." },
      { status: 400 },
    );
  }

  // adminId forçado = uid da sessão (sobrescreve qualquer adminId do body).
  const base = typeof json === "object" && json !== null ? json : {};
  const parsed = poolInputSchema.safeParse({ ...base, adminId: uid });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de entrada inválidos.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { name, slug, description, photoBase64 } = parsed.data;
  const pool = {
    id: slug, // doc-id = slug (unicidade atômica via .create())
    name,
    slug,
    ...(description !== undefined ? { description } : {}),
    ...(photoBase64 !== undefined ? { photoBase64 } : {}),
    status: "pending" as const,
    adminId: uid,
    createdAt: new Date().toISOString(),
  };

  // Defesa: garante o contrato completo antes de gravar.
  const validated = poolSchema.safeParse(pool);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Dados de entrada inválidos.", issues: validated.error.issues },
      { status: 422 },
    );
  }

  const db = getAdminFirestore();
  try {
    await db.collection("pools").doc(slug).create(validated.data);
  } catch (err) {
    if (isAlreadyExists(err)) {
      return NextResponse.json(
        { error: "Já existe um grupo com esse identificador (slug)." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Erro ao criar o grupo." }, { status: 500 });
  }

  return NextResponse.json({ pool: validated.data }, { status: 201 });
}
