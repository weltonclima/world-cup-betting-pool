import { AdminSubHeader, UserStatusList } from "@/features/admin";

/** Usuários Bloqueados (PRD-07, PRD07-04). Reusa `UserStatusList`. */
export default function UsuariosBloqueadosPage() {
  return (
    <>
      <AdminSubHeader title="Usuários Bloqueados" />
      <UserStatusList status="blocked" />
    </>
  );
}
