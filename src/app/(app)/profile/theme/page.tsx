import { ProfileSubHeader, ThemeSelector } from "@/features/profile/components";

/** Tela de seleção de tema (dark theme, TASK-03). */
export default function TemaPage() {
  return (
    <>
      <ProfileSubHeader title="Tema" />
      <ThemeSelector />
    </>
  );
}
