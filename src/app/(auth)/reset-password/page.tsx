import { Suspense } from "react";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import { ResetVerifying } from "@/features/auth/ResetVerifying";

/**
 * Página "Redefinir senha" (PRD-01.1, TASK-04).
 *
 * Layout de duas zonas (hero verde `.auth-theme` + cartão claro `.auth-card`).
 * O hero (logo + título) é constante; o corpo do cartão troca conforme a
 * máquina de estados de `ResetPasswordForm` (verificando → válido → sucesso /
 * inválido), que lê o `oobCode` da query string.
 *
 * `ResetPasswordForm` usa `useSearchParams`, portanto vive dentro de um
 * `<Suspense>` (exigência do Next 15). Sem BottomNav: grupo `(auth)`.
 */
export default function ResetPasswordPage() {
  return (
    <div className="auth-theme flex min-h-screen flex-col bg-background">
      <section className="flex flex-col items-center gap-6 px-6 pb-8 pt-12">
        <AuthLogo variant="login" />
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
        </div>
      </section>

      <section className="auth-card flex-1 rounded-t-3xl bg-card px-6 pb-10 pt-8 shadow-lg">
        <div className="mx-auto w-full max-w-sm">
          <Suspense fallback={<ResetVerifying />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
