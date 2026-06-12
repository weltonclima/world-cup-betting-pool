import { EditProfileForm, ProfileSubHeader } from "@/features/profile/components";

/** Editar Perfil (PRD-06, a partir de Configurações → Editar Perfil). */
export default function EditarPerfilPage() {
  return (
    <>
      <ProfileSubHeader title="Editar Perfil" />
      <EditProfileForm />
    </>
  );
}
