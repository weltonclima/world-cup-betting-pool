import { AdminSubHeader, ApiStatus } from "@/features/admin";

/** Status da API (PRD-07, PRD07-05). */
export default function ApiStatusPage() {
  return (
    <>
      <AdminSubHeader title="Status da API" />
      <ApiStatus />
    </>
  );
}
