import { GroupDetail } from "@/features/groups/components";

/** Detalhes do Grupo (PRD-09, TASK-09 — tela PRD09-05). */
export default async function GrupoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GroupDetail id={id} />;
}
