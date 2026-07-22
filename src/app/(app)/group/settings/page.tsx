import {
  GroupChampionshipsSettings,
  GroupSettingsForm,
} from "@/features/groupAdmin/components";

/** Configurações do Grupo (PRD-10, PRD10-05; multi-championship TASK-08). */
export default function GrupoConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-8">
      <GroupSettingsForm />
      <GroupChampionshipsSettings />
    </div>
  );
}
