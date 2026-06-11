import { AdminSubHeader, UserStatusList } from "@/features/admin";

/** Usuários Pendentes (PRD-07, PRD07-02). Reusa `UserStatusList`. */
export default function UsuariosPendentesPage() {
  return (
    <>
      <AdminSubHeader title="Usuários Pendentes" />
      <UserStatusList status="pending" />
    </>
  );
}
