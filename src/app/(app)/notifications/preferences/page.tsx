import { PreferencesForm } from "@/features/notifications/components";
import { BackButton } from "@/components/layout/BackButton";

/** Tela 03 — Preferências de Notificação (PRD-08, PRD08-03). */
export default function PreferenciasPage() {
  return (
    <>
      <BackButton />
      <PreferencesForm />
    </>
  );
}
