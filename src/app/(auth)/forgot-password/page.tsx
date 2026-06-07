import { AuthLogo } from "@/components/auth/AuthLogo";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

/**
 * Página "Esqueci minha senha" (PRD-01.1, TASK-03).
 *
 * Layout de duas zonas (hero verde `.auth-theme` + cartão claro `.auth-card`),
 * consistente com a tela de Login. Os dois estados do fluxo (informar e-mail →
 * e-mail enviado) são gerenciados dentro de `ForgotPasswordForm`.
 *
 * Sem BottomNav: o grupo `(auth)` não monta o AppShell.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="auth-theme flex min-h-screen flex-col bg-background">
      <section className="flex flex-col items-center gap-6 px-6 pb-8 pt-12">
        <AuthLogo variant="cadastro" />
      </section>

      <section className="auth-card flex-1 rounded-t-3xl bg-card px-6 pb-10 pt-8 shadow-lg">
        <div className="mx-auto w-full max-w-sm">
          <ForgotPasswordForm />
        </div>
      </section>
    </div>
  );
}
