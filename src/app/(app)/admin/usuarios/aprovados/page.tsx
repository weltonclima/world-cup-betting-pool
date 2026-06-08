import { AdminSubHeader, UserStatusList } from "@/features/admin";

/** Usuários Aprovados / Ativos (PRD-07, PRD07-03). Reusa `UserStatusList`. */
export default function UsuariosAprovadosPage() {
  return (
    <>
      <AdminSubHeader title="Usuários Ativos" />
      <UserStatusList status="approved" />
    </>
  );
}
