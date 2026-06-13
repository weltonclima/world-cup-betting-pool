import { Clock } from "lucide-react";
import Link from "next/link";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { SignupForm } from "@/features/auth/SignupForm";
import { resolveInvite } from "@/server/invites/resolveInvite";

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
        ) : resolution.code === "expired" ? (
          <>
            <div className="flex flex-col items-center gap-4 text-center">
              <Clock aria-hidden className="h-12 w-12 text-muted-foreground" />
              <h1 className="text-2xl font-bold text-foreground">
                Este link expirou
              </h1>
              <p className="text-sm text-muted-foreground">
                Este link de convite não está mais disponível. Peça ao
                administrador do grupo para gerar um novo.
              </p>
            </div>

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
