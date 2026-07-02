"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { useAuth } from "@/hooks/useAuth";

import { shouldSyncTheme } from "../lib/themeSync";

/**
 * Componente headless (dark theme, TASK-03): hidrata o tema do next-themes a
 * partir da preferência salva no perfil (`users/{uid}.themePreference`), para a
 * escolha valer cross-device. Não renderiza UI.
 *
 * Anti-loop: o efeito depende APENAS de `profile.themePreference` (não de
 * `theme`). Quando o usuário troca o tema localmente, `theme` muda mas a
 * preferência do perfil só muda após a persistência+refresh; ao convergirem,
 * `shouldSyncTheme` retorna `null` e nada é reaplicado. Ao logar em outro
 * dispositivo, a preferência do perfil difere do tema local → aplica 1×.
 *
 * Montado no layout da área autenticada (`(app)/layout.tsx`) para cobrir todas
 * as telas — o tema é global, não só do perfil.
 */
export function ThemeSync(): null {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const pref = profile?.themePreference;

  useEffect(() => {
    const next = shouldSyncTheme(pref, theme);
    if (next !== null) setTheme(next);
    // Intencional: depende só de `pref` (e setTheme estável). Incluir `theme`
    // aqui reintroduziria o loop de reconciliação. `theme` é lido como snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pref, setTheme]);

  return null;
}
