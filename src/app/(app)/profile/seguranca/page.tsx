import { ProfileSubHeader } from "@/features/profile/components";
import { PasskeyManager } from "@/features/passkeys";

/**
 * Tela de Segurança / Biometria (login-biometrico, TASK-06).
 * Registro e gestão de passkeys (biometria do dispositivo).
 */
export default function SegurancaPage() {
  return (
    <>
      <ProfileSubHeader title="Segurança" />
      <PasskeyManager />
    </>
  );
}
