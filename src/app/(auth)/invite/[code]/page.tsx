import Link from "next/link";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { SignupForm } from "@/features/auth/SignupForm";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { inviteCodeSchema, inviteSchema, poolSchema } from "@/schemas";

/**
 * Página pública de resgate de convite (PRD-10, A2) — destino do link
 * `${origin}/invite/${code}` gerado em "Convites".
 *
 * Server Component (runtime Node): valida o convite via Admin SDK ANTES de exibir
 * o cadastro (as Rules bloqueiam a coleção `invites` no client). Se válido, renderiza
 * o `SignupForm` com o grupo TRAVADO no pool do convite; o consumo (`usedCount`) é
 * contabilizado por `redeemInvite` após o cadastro. Convite inexistente/inativo/
 * expirado/cheio → estado amigável com link para o cadastro normal.
 *
 * Mora em `(auth)`: herda o inverse-guard (ejeta usuário já logado) e a superfície
 * auth-light, como as demais telas de autenticação.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

interface ValidInvite {
  groupId: string;
  groupName: string;
}

type Resolution =
  | { ok: true; invite: ValidInvite }
  | { ok: false; reason: string };

/** Valida o convite server-side e resolve o nome do pool. Nunca lança. */
async function resolveInvite(rawCode: string): Promise<Resolution> {
  const parsedCode = inviteCodeSchema.safeParse(rawCode);
  if (!parsedCode.success) {
    return { ok: false, reason: "Este link de convite é inválido." };
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection("invites").doc(parsedCode.data).get();
    if (!snap.exists) {
      return { ok: false, reason: "Convite não encontrado." };
    }
    const invite = inviteSchema.parse(snap.data());

    if (!invite.isActive) {
      return { ok: false, reason: "Este convite não está mais ativo." };
    }
    if (Date.parse(invite.expiresAt) <= Date.now()) {
      return { ok: false, reason: "Este convite expirou." };
    }
    if (invite.usedCount >= invite.maxUses) {
      return { ok: false, reason: "Este convite atingiu o limite de usos." };
    }

    const poolSnap = await db.collection("pools").doc(invite.groupId).get();
    if (!poolSnap.exists) {
      return { ok: false, reason: "O grupo deste convite não está mais disponível." };
    }
    const pool = poolSchema.parse(poolSnap.data());
    if (pool.status === "blocked") {
      return { ok: false, reason: "O grupo deste convite está bloqueado." };
    }

    return {
      ok: true,
      invite: { groupId: invite.groupId, groupName: pool.name },
    };
  } catch {
    return {
      ok: false,
      reason: "Não foi possível validar o convite. Tente novamente.",
    };
  }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const resolution = await resolveInvite(code);

  return (
    <div className="auth-light flex min-h-screen flex-col items-center bg-background px-6 py-10">
      <main
        aria-label="Convite para grupo"
        className="mx-auto flex w-full max-w-sm flex-col gap-6"
      >
        <AuthLogo variant="cadastro" />

        {resolution.ok ? (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">
                Você foi convidado!
              </h1>
              <p className="text-sm text-muted-foreground">
                Crie sua conta para entrar em{" "}
                <strong className="text-foreground">
                  {resolution.invite.groupName}
                </strong>
                .
              </p>
            </div>

            <SignupForm
              presetGroup={{
                id: resolution.invite.groupId,
                name: resolution.invite.groupName,
              }}
              inviteCode={code}
            />

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">
                Convite indisponível
              </h1>
              <p className="text-sm text-muted-foreground">{resolution.reason}</p>
            </div>

            <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
              <p>
                Você ainda pode{" "}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                  criar sua conta
                </Link>{" "}
                e escolher um grupo.
              </p>
              <p>
                Já tem conta?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
