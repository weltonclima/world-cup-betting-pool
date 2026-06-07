import { HomeDashboard } from "@/features/home/components/HomeDashboard";

/**
 * Página /home — entry point mínimo da Home Dashboard (TASK-10).
 *
 * Server Component intencional: sem diretiva "use client".
 * AuthGuard + AppShell já estão no layout pai (src/app/(app)/layout.tsx).
 * Toda a lógica de estado (loading/error/sucesso) está em <HomeDashboard>.
 */
export default function HomePage() {
  return <HomeDashboard />;
}
