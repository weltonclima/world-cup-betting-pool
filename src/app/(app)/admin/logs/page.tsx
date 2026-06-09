import { AdminSubHeader, SystemLogs } from "@/features/admin";

/** Logs do Sistema (PRD-07, PRD07-06). */
export default function LogsPage() {
  return (
    <>
      <AdminSubHeader title="Logs do Sistema" />
      <SystemLogs />
    </>
  );
}
