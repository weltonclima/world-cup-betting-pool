import { ChangePasswordForm, ProfileSubHeader } from "@/features/profile/components";

/** Tela 04 — Alterar Senha (PRD-06, PRD06-04). */
export default function SenhaPage() {
  return (
    <>
      <ProfileSubHeader title="Alterar Senha" />
      <ChangePasswordForm />
    </>
  );
}
