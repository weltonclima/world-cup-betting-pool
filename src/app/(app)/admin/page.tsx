import { redirect } from "next/navigation";

/** `/admin` redireciona para o Dashboard (PRD-07.1, TASK-08). */
export default function AdminPage() {
  redirect("/admin/dashboard");
}
