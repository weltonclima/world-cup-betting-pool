import { UsersPanel } from "@/features/admin/components/UsersPanel";

/**
 * Painel administrativo (PRD-01.2). Gating em `(app)/admin/layout.tsx`
 * (AdminGuard). O boundary "use client" começa em `UsersPanel`.
 */
export default function AdminPage() {
  return <UsersPanel />;
}
