import type { LucideIcon } from "lucide-react";
import { Monitor, Moon, Sun } from "lucide-react";

import type { ThemePreference } from "@/types";

/**
 * Lógica pura do seletor/sincronização de tema (dark theme, TASK-03).
 * Sem React — testável isoladamente. A regra `shouldSyncTheme` é o núcleo
 * anti-loop da hidratação cross-device.
 */

/** Opção do seletor de tema (rótulo + descrição pt-BR + ícone lucide). */
export interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * As 3 opções na ordem fixa light → dark → system (definida no ui-spec).
 * Rótulos/descrições em pt-BR; os valores são o enum `themePreferenceSchema`.
 */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: "light",
    label: "Claro",
    description: "Sempre o tema claro",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Escuro",
    description: "Sempre o tema escuro",
    icon: Moon,
  },
  {
    value: "system",
    label: "Automático",
    description: "Segue o sistema do dispositivo",
    icon: Monitor,
  },
] as const;

/** Rótulo pt-BR de um valor de preferência de tema. */
export function themeLabel(value: ThemePreference): string {
  return THEME_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Decide se o tema do next-themes deve ser sincronizado a partir da preferência
 * salva no perfil (hidratação cross-device).
 *
 * Retorna o valor a aplicar via `setTheme` SOMENTE quando há preferência salva
 * E ela difere do tema atual; senão `null`. Essa condição é o que evita o loop
 * persist ↔ hidratação: quando o usuário escolhe X, o tema já vira X e a
 * preferência do perfil converge para X → a próxima checagem retorna `null`.
 *
 * `currentTheme` pode ser `undefined` no client pré-mount do next-themes; nesse
 * caso, havendo preferência salva, ela é aplicada.
 */
export function shouldSyncTheme(
  pref: ThemePreference | undefined,
  currentTheme: string | undefined,
): ThemePreference | null {
  if (pref === undefined) return null;
  if (pref === currentTheme) return null;
  return pref;
}
