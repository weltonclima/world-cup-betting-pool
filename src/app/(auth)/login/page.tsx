import Link from "next/link";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { LoginForm } from "@/features/auth/LoginForm";

/**
 * Página de Login (PRD-01, TASK-07).
 *
 * Layout de duas zonas conforme `docs/prd-01/login.png`:
 * - Hero verde escuro (`.auth-theme`): logo + boas-vindas.
 * - Cartão claro (`.auth-card`): formulário + link de cadastro.
 *
 * O redirecionamento pós-login é responsabilidade do `AuthLayout`.
 */
export default function LoginPage() {
  return (
    <div className="auth-theme flex min-h-screen flex-col bg-background">
      {/* Hero — logo centralizado + boas-vindas alinhadas à esquerda */}
      <section className="flex flex-col items-center gap-6 px-6 pb-8 pt-12">
        <AuthLogo variant="login" />
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground">
            Bem-vindo de volta!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça login para continuar.
          </p>
        </div>
      </section>

      {/* Cartão claro do formulário — ocupa o restante da tela */}
      <section className="auth-card flex-1 rounded-t-3xl bg-card px-6 pb-10 pt-8 shadow-lg">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <LoginForm />

          <footer className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Cadastre-se
            </Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
