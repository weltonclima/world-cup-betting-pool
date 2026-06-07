import Link from "next/link";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { SignupForm } from "@/features/auth/SignupForm";

/**
 * Página de cadastro (PRD-01, TASK-08).
 *
 * Superfície de autenticação clara de tela inteira via `.auth-light`
 * (globals.css), sem card elevado — campos direto na superfície, como no mock
 * `docs/prd-01/cadastro.png`. O `--primary` verde dá contraste AA ao CTA e links.
 *
 * O usuário criado nasce `pending`; os guards do AuthLayout cuidam do
 * redirecionamento — esta tela não navega no sucesso.
 */
export default function SignupPage() {
  return (
    <div className="auth-light flex min-h-screen flex-col items-center bg-background px-6 py-10">
      <main
        aria-label="Criar conta"
        className="mx-auto flex w-full max-w-sm flex-col gap-6"
      >
        <AuthLogo variant="cadastro" />

        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Criar sua conta
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo para criar sua conta.
          </p>
        </div>

        <SignupForm />

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
