import Link from "next/link";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { CreateGroupForm } from "@/features/auth/CreateGroupForm";

/**
 * Página "Criar grupo" — onboarding auto-serviço (multi-championship TASK-16).
 *
 * Um visitante cria sua conta e um grupo já ativo em uma única tela, tornando-se
 * `group_admin`. Coexiste com o cadastro comum (`/signup`, que nasce `pending`) e
 * com o fluxo de convite (`/invite/[code]`), sem substituí-los.
 *
 * Mesma superfície clara de tela inteira (`.auth-light`) das demais telas de auth.
 * A navegação pós-sucesso NÃO acontece aqui: o `CreateGroupForm` troca para a fase
 * de sucesso (link de convite + CTA) e só navega no clique explícito do usuário.
 */
export default function CreateGroupPage() {
  return (
    <div className="auth-light flex min-h-screen flex-col items-center bg-background px-6 py-10">
      <main
        aria-label="Criar grupo"
        className="mx-auto flex w-full max-w-sm flex-col gap-6"
      >
        <AuthLogo variant="cadastro" />

        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Criar seu grupo
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre-se e comece a organizar o bolão do seu grupo.
          </p>
        </div>

        <CreateGroupForm />

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </main>
    </div>
  );
}
