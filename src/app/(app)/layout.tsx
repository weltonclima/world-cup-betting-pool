import type { ReactNode } from "react";
import { cookies } from "next/headers";

import {
  POOL_THEME_COOKIE,
  parsePoolThemeCookie,
  poolThemeStyleVars,
  resolveEffectivePrimary,
} from "@/features/groupAdmin/lib/poolTheme";

import { AppLayoutShell } from "./AppLayoutShell";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Layout das rotas internas protegidas (Server Component).
 *
 * Tema por pool (TASK-03): lê o cookie não-httpOnly `pool-primary` e injeta as
 * CSS vars `--pool-primary*` num wrapper `display:contents` ANTES da hidratação
 * → sem flash. Ausente/inválido → objeto vazio (as classes `.*-theme` caem no
 * verde padrão). O CSS escolhe light vs dark por `.dark`, então não precisamos
 * saber o tema aqui. A leitura do cookie fica no escopo de `(app)` (não no root
 * layout) para que as rotas de auth — que nem consomem `--pool-primary` — sigam
 * estáticas (TASK-03 M1).
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  const cookieStore = await cookies();
  const parsed = parsePoolThemeCookie(cookieStore.get(POOL_THEME_COOKIE)?.value);
  const poolVars = poolThemeStyleVars(
    parsed
      ? resolveEffectivePrimary({
          primaryColorLight: parsed.light,
          primaryColorDark: parsed.dark,
        })
      : null,
  );

  return (
    <div className="contents" style={poolVars as React.CSSProperties}>
      <AppLayoutShell>{children}</AppLayoutShell>
    </div>
  );
}
