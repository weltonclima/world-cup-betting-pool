import { MatchList } from "@/features/matches/components/MatchList";

/**
 * Página `/matches` — Lista de Jogos da Copa 2026 (TASK-04).
 *
 * Server Component intencional: sem diretiva "use client".
 * AuthGuard + AppShell já aplicados pelo layout pai `src/app/(app)/layout.tsx`.
 * Toda a lógica de estado (loading/error/filtros/busca) está em <MatchList>.
 *
 * Padrão espelhado de `src/app/(app)/home/page.tsx`.
 */
export default function MatchesPage() {
  return <MatchList />;
}
