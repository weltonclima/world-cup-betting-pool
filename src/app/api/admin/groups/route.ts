import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { writeAuditLog } from "@/server/admin/auditLog";
import { listPoolsByStatus } from "@/server/admin/adminPools";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { poolCreateClientSchema, poolSchema, poolStatusSchema } from "@/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Firestore Admin SDK lança ALREADY_EXISTS (gRPC code 6) quando `.create()`
 * colide com um doc existente — slug já em uso (espelha POST /api/groups).
 */
function isAlreadyExists(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

/**
 * GET /api/admin/groups?status=pending|active|blocked — lista pools por status
 * para as telas PRD11-02/03/04 (PRD-11 TASK-04). Só super_admin/secret.
 *
 * Inclui contagem de participantes por pool (tela de Ativos exibe). Exclui
 * soft-deleted. `status` ausente/ inválido → 422.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const parsed = poolStatusSchema.safeParse(statusParam);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetro 'status' inválido." },
      { status: 422 },
    );
  }

  try {
    const pools = await listPoolsByStatus(parsed.data);
    return NextResponse.json({ pools }, { status: 200 });
  } catch (error) {
    console.error("[admin/groups] erro ao listar pools:", error);
    return NextResponse.json(
      { error: "Erro ao listar os grupos." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/groups — cria um pool já `active` pelo super_admin (PRD-11).
 *
 * Diferente de POST /api/groups (participante cria pool `pending`): aqui o grupo
 * nasce ativo, sem group_admin dedicado. `adminId` = uid do super_admin da sessão
 * (dono placeholder, mesmo padrão do seed) — o papel global NÃO muda. A atribuição
 * de um group_admin real é feita depois via PATCH /api/admin/groups/[id]/admin
 * ("Alterar Admin"), que promove o membro e não rebaixa o super_admin. Só
 * super_admin de sessão (caminho secret não tem ator → 401).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;
  if (!auth.actorUid) {
    return NextResponse.json(
      { error: "Criação de grupo requer sessão de super_admin." },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = poolCreateClientSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const { name, slug, description, photoBase64 } = parsed.data;

  const pool = poolSchema.safeParse({
    id: slug, // doc-id = slug (unicidade atômica via .create())
    name,
    slug,
    ...(description !== undefined ? { description } : {}),
    ...(photoBase64 !== undefined ? { photoBase64 } : {}),
    status: "active" as const,
    adminId: auth.actorUid,
    createdAt: new Date().toISOString(),
  });
  if (!pool.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const db = getAdminFirestore();
  try {
    await db.collection("pools").doc(slug).create(pool.data);
  } catch (err) {
    if (isAlreadyExists(err)) {
      return NextResponse.json(
        { error: "Já existe um grupo com esse identificador (slug)." },
        { status: 409 },
      );
    }
    console.error("[admin/groups] erro ao criar pool:", err);
    return NextResponse.json({ error: "Erro ao criar o grupo." }, { status: 500 });
  }

  void writeAuditLog({
    type: "group_created",
    actorUid: auth.actorUid,
    message: `Grupo criado: ${name}`,
    level: "info",
  });

  return NextResponse.json({ pool: pool.data }, { status: 201 });
}
