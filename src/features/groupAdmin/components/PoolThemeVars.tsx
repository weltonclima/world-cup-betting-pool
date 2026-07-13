"use client";

import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { usePoolRanking } from "@/features/rankings/hooks";

import {
  POOL_THEME_COOKIE,
  poolThemeStyleVars,
  resolveEffectivePrimary,
  serializePoolThemeCookie,
} from "../lib/poolTheme";

/** Vars do tema por pool geridas por este componente (aplica/remove no root). */
const POOL_VAR_NAMES = [
  "--pool-primary",
  "--pool-primary-foreground",
  "--pool-primary-dark",
  "--pool-primary-foreground-dark",
] as const;

const COOKIE_MAX_AGE_S = 5 * 24 * 60 * 60;

/**
 * Componente headless (personalizacao-grupo TASK-03): sincroniza as CSS vars
 * `--pool-primary*` no `<html>` a partir das cores do pool do usuário (lidas do
 * payload de `usePoolRanking`). Cobre o cookie ausente/desatualizado e a mudança
 * de cor pelo admin NA SESSÃO ATUAL (o SSR via cookie dá a baseline sem flash;
 * este sync corrige em tempo real). Também refresca o cookie `pool-primary` p/ os
 * próximos SSR. Sem cores → remove as vars (volta ao verde padrão). Não renderiza.
 *
 * Montado no layout da área autenticada (`(app)/layout.tsx`), como o `ThemeSync`.
 */
export function PoolThemeVars(): null {
  const { profile } = useAuth();
  const { data, isSuccess } = usePoolRanking(profile?.groupId);
  const light = data?.primaryColorLight;
  const dark = data?.primaryColorDark;

  useEffect(() => {
    // CRÍTICO (review H2): enquanto a query NÃO resolveu, NÃO tocar nas vars — a
    // baseline do SSR (cookie) já pintou a cor certa; apagá-la aqui reintroduziria
    // o flash verde para quem tem cookie. Só sincronizamos com dado resolvido.
    if (!isSuccess) return;

    const root = document.documentElement;
    const vars = poolThemeStyleVars(
      resolveEffectivePrimary({ primaryColorLight: light, primaryColorDark: dark }),
    );
    for (const name of POOL_VAR_NAMES) {
      const value = vars[name];
      if (value !== undefined) root.style.setProperty(name, value);
      else root.style.removeProperty(name); // resolvido sem cor → volta ao verde
    }

    // Refresca o cookie p/ os próximos SSR (baseline sem flash). Sem cor → expira.
    const cookieValue = serializePoolThemeCookie(light, dark);
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie =
      cookieValue !== null
        ? `${POOL_THEME_COOKIE}=${cookieValue}; path=/; max-age=${COOKIE_MAX_AGE_S}; samesite=lax${secure}`
        : `${POOL_THEME_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
  }, [isSuccess, light, dark]);

  return null;
}
