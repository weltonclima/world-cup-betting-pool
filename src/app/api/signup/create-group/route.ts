import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { getAdminAuth, getAdminFirestore } from "@/server/firebaseAdmin";
import { DEFAULT_CHAMPIONSHIP_ID } from "@/server/copaData/championshipCatalog";
import {
  DEFAULT_RANKING_MODE,
  inviteSchema,
  MAX_POOL_PHOTO_BASE64_LENGTH,
  nonEmptyString,
  poolSchema,
  poolSlugSchema,
  userSchema,
} from "@/schemas";

/**
 * POST /api/signup/create-group — onboarding auto-serviço (multi-championship TASK-16).
 *
 * Um visitante recém-autenticado cria um grupo e nasce `group_admin` de um pool que já
 * nasce `active`, com claims (`role` + `groupId`) e um convite inicial pronto para
 * compartilhar. Coexiste com o fluxo moderado (convite → `pending`), sem substituí-lo.
 *
 * Server-authoritative: identidade (`email`) vem SEMPRE do ID token verificado;
 * `adminId`/`groupId` são derivados do servidor (`uid`/`slug`), nunca do body. A criação
 * de `pools`/`users` continua exclusiva do Admin SDK (as Security Rules seguem
 * `if false`/anti-auto-promoção — sem relaxamento).
 *
 * Autenticação: ID token (mesmo padrão de `invite/[code]/redeem`) — o usuário ainda não
 * tem session cookie (o client emite o cookie DEPOIS, com `getIdToken(true)`, para
 * carregar os claims recém-gravados).
 *
 * Atomicidade: `pools/{slug}` e `users/{uid}` são criados via `.create()` (unicidade
 * atômica por doc-id → ALREADY_EXISTS mapeado a 409). Falha após uma escrita parcial
 * dispara rollback compensatório em ordem inversa (espelha `services/auth.signUp`),
 * logando falhas de rollback sem mascarar o erro original.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Input da rota (net-new). Não-strict (espelha poolInputSchema): campos extras
// (ex.: `email`, `adminId`, `groupId` injetados por um cliente malicioso) são
// IGNORADOS, nunca aceitos — a identidade/privilégio é 100% server-derived.
const bodySchema = z.object({
  idToken: z.string().min(1),
  name: nonEmptyString,
  nickname: nonEmptyString,
  groupName: nonEmptyString,
  slug: poolSlugSchema,
  description: z.string().max(160).optional(),
  photoBase64: z.string().max(MAX_POOL_PHOTO_BASE64_LENGTH).optional(),
});

// Alfabeto sem caracteres ambíguos (0/O, 1/I) — subconjunto do regex do schema.
// Igual ao de `group/invites` (fonte da mesma regra de código).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

// Convite inicial: limite generoso e validade longa (é o "link principal" do grupo;
// o group_admin pode regenerá-lo/ajustá-lo depois no dashboard — TASK-08).
const INITIAL_INVITE_MAX_USES = 1000;
const INITIAL_INVITE_VALIDITY_DAYS = 365;
const INITIAL_INVITE_LABEL = "Link principal";

/** Gera um código curto não-adivinhável (server-side; nunca aceito do client). */
function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

/** gRPC ALREADY_EXISTS (code 6) — colisão de doc-id no `.create()`. */
function isAlreadyExists(err: unknown): boolean {
  const c = (err as { code?: unknown }).code;
  return c === 6 || c === "already-exists" || c === "ALREADY_EXISTS";
}

/** Erro de domínio do onboarding, carregando o status HTTP a devolver. */
class OnboardingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OnboardingError";
    this.status = status;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const { idToken, name, nickname, groupName, slug, description, photoBase64 } =
    parsed.data;

  // Identidade SEMPRE do token verificado (nunca do body — anti-spoof).
  // `email_verified` também vem do token (BR4 TASK-18): decide se o pool nasce
  // visível na busca. Nunca confiar em campo enviado pelo cliente.
  let uid: string;
  let email: string | undefined;
  let emailVerified = false;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email;
    emailVerified = decoded.email_verified === true;
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!email) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    );
  }

  const db = getAdminFirestore();
  const createdAt = new Date().toISOString();

  // BR2 (TASK-18): 1 pool auto-serviço por conta. Se o caller já tem um perfil com
  // `groupId`/`group_admin`, rejeita ANTES de qualquer escrita (sem pool órfão nem
  // rollback). Pré-checagem best-effort: falha de leitura NÃO bloqueia — a criação
  // atômica de `users/{uid}` (`.create()`) ainda barra a re-execução com 409.
  try {
    const existingUserSnap = await db.collection("users").doc(uid).get();
    if (existingUserSnap.exists) {
      const existing = existingUserSnap.data() ?? {};
      const hasGroup =
        typeof existing["groupId"] === "string" &&
        existing["groupId"].length > 0;
      if (hasGroup || existing["role"] === "group_admin") {
        return NextResponse.json(
          { error: "Você já possui um grupo." },
          { status: 409 },
        );
      }
    }
  } catch (readErr) {
    console.error(
      "[signup/create-group] pré-checagem de grupo existente falhou:",
      readErr,
    );
  }

  // Pool nasce `active` só se o e-mail JÁ está verificado; senão nasce `pending`
  // (invisível na busca, que filtra `status == "active"`) até o caller confirmar
  // o e-mail e promover via `activate-pool` (TASK-18). doc-id = slug
  // (adminId/groupId 100% server-derived).
  const poolStatus = emailVerified ? ("active" as const) : ("pending" as const);
  const poolObj = {
    id: slug,
    name: groupName,
    slug,
    ...(description !== undefined ? { description } : {}),
    ...(photoBase64 !== undefined ? { photoBase64 } : {}),
    status: poolStatus,
    adminId: uid,
    allowInvites: true,
    enabledChampionships: [DEFAULT_CHAMPIONSHIP_ID],
    rankingMode: DEFAULT_RANKING_MODE,
    createdAt,
  };
  const validatedPool = poolSchema.safeParse(poolObj);
  if (!validatedPool.success) {
    return NextResponse.json(
      { error: "Dados do grupo inválidos." },
      { status: 422 },
    );
  }

  // Criador auto-aprovado: `group_admin` + `approved`, groupId = slug.
  const userObj = {
    uid,
    name,
    nickname,
    email, // do token, nunca do body
    role: "group_admin" as const,
    status: "approved" as const,
    groupId: slug,
    createdAt,
  };
  const validatedUser = userSchema.safeParse(userObj);
  if (!validatedUser.success) {
    return NextResponse.json(
      { error: "Dados do usuário inválidos." },
      { status: 422 },
    );
  }

  const poolRef = db.collection("pools").doc(slug);
  const userRef = db.collection("users").doc(uid);

  // Rastreia o que foi efetivamente criado p/ rollback compensatório em ordem inversa.
  let poolCreated = false;
  let userCreated = false;
  let inviteCode: string | undefined;

  async function rollback(): Promise<void> {
    // Ordem inversa da criação: invite → user → pool. Best-effort: falha de rollback
    // é logada, nunca mascara o erro original (espelha services/auth.signUp).
    if (inviteCode !== undefined) {
      try {
        await db.collection("invites").doc(inviteCode).delete();
      } catch (e) {
        console.error("[signup/create-group] rollback invite falhou:", e);
      }
    }
    if (userCreated) {
      try {
        await userRef.delete();
      } catch (e) {
        console.error("[signup/create-group] rollback user falhou:", e);
      }
    }
    if (poolCreated) {
      try {
        await poolRef.delete();
      } catch (e) {
        console.error("[signup/create-group] rollback pool falhou:", e);
      }
    }
  }

  try {
    // 1. Pool (unicidade atômica do slug). Colisão → 409 determinístico.
    try {
      await poolRef.create(validatedPool.data);
      poolCreated = true;
    } catch (err) {
      if (isAlreadyExists(err)) {
        throw new OnboardingError(409, "Este endereço de grupo já está em uso.");
      }
      throw err;
    }

    // 2. Usuário (unicidade atômica do uid → anti-rerun: uma conta não re-executa o
    //    onboarding p/ sequestrar/duplicar grupo). Colisão → 409.
    try {
      await userRef.create(validatedUser.data);
      userCreated = true;
    } catch (err) {
      if (isAlreadyExists(err)) {
        throw new OnboardingError(409, "Esta conta já concluiu o cadastro.");
      }
      throw err;
    }

    // 3. Convite inicial (link principal), vinculado ao groupId. Retry em colisão de code.
    const expiresAt = new Date(
      Date.now() + INITIAL_INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    let inviteData: z.infer<typeof inviteSchema> | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const invite = {
        id: code,
        groupId: slug,
        code,
        label: INITIAL_INVITE_LABEL,
        maxUses: INITIAL_INVITE_MAX_USES,
        usedCount: 0,
        expiresAt,
        isActive: true,
        createdBy: uid,
        createdAt,
      };
      const validatedInvite = inviteSchema.safeParse(invite);
      if (!validatedInvite.success) {
        throw new OnboardingError(422, "Dados de convite inválidos.");
      }
      try {
        await db.collection("invites").doc(code).create(validatedInvite.data);
        inviteCode = code;
        inviteData = validatedInvite.data;
        break;
      } catch (err) {
        if (isAlreadyExists(err)) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    if (inviteData === undefined) {
      console.error(
        "[signup/create-group] colisão de code persistente:",
        lastError,
      );
      throw new OnboardingError(
        500,
        "Não foi possível gerar o convite inicial.",
      );
    }

    // 4. Custom claims — 1ª gravação real de `groupId` no token do produto
    //    (desbloqueia a Rule de leitura de `invites` para o dono do grupo).
    await getAdminAuth().setCustomUserClaims(uid, {
      role: "group_admin",
      groupId: slug,
    });

    const origin = new URL(request.url).origin;
    return NextResponse.json(
      {
        pool: validatedPool.data,
        invite: {
          code: inviteData.code,
          link: `${origin}/invite/${inviteData.code}`,
        },
        // Aditivo (TASK-18): a UI usa isso para instruir a verificação de e-mail
        // e oferecer "Já verifiquei" quando o pool nasceu pending.
        pending: !emailVerified,
      },
      { status: 201 },
    );
  } catch (err) {
    // Compensação: desfaz escritas parciais antes de responder.
    await rollback();
    if (err instanceof OnboardingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[signup/create-group] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao criar o grupo." },
      { status: 500 },
    );
  }
}
