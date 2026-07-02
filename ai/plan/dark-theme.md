# PLAN — Dark Theme

## 1. Planning summary

Feature de UI/client puro. Base CSS (`.dark`) e lib (`next-themes`) já presentes;
o trabalho é wiring + UI + persistência cross-device + auditoria de contraste.
Decomposto em **4 tasks** em 3 fases: fundação (persistência + provider),
exposição (rota `/profile/theme` + seletor + hidratação), validação (auditoria
dark). Sem mudança de Firestore Rules (self-update de campo não-sensível já
permitido). Sem backend/Route Handler novo — reuso do caminho client
`updateProfile`.

## 2. Recommended execution phases

- **Phase 1 – foundation:** TASK-01 (persistência: schema + service), TASK-02
  (montar ThemeProvider + suppressHydrationWarning).
- **Phase 2 – exposure:** TASK-03 (rota `/profile/theme`, seletor 3-opções,
  hidratação do perfil, link no SettingsMenu).
- **Phase 3 – validation:** TASK-04 (auditoria e ajuste de contraste dark nas
  telas principais).

## 3. Tasks

### TASK-01 – Persistência da preferência de tema (schema + service)
- Type: persistence
- Goal: adicionar `themePreference` (`"light" | "dark" | "system"`) ao perfil do
  usuário e permitir self-update via camada de serviço existente.
- Scope:
  - `src/schemas/shared.ts`: enum `themePreferenceSchema` (3 valores).
  - `src/schemas/users.ts`: campo opcional `themePreference` no `userSchema`
    (`.strict()` exige registrar o campo).
  - `src/types/*`: tipo derivado (automático via `z.infer`).
  - `src/services/users.ts`: `updateProfile` aceita `themePreference` no patch.
  - `src/features/profile/hooks/useUpdateProfile.ts`: `UpdateProfileVars` +
    `themePreference`.
  - Confirmar (sem alterar) que Rule `users` update permite campo não-role/status.
- Main modules/files likely involved: `schemas/shared.ts`, `schemas/users.ts`,
  `services/users.ts`, `features/profile/hooks/useUpdateProfile.ts`, testes
  co-locados de schema.
- Dependencies: none.
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (schema+service fino; teste de schema cobre)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: `.strict()` no `userSchema` — sem o campo, doc com `themePreference`
  falha o parse. Campo é aditivo/opcional → docs antigos seguem válidos.

### TASK-02 – Montar ThemeProvider + suppressHydrationWarning
- Type: infra
- Goal: ativar o runtime do `next-themes` cobrindo toda a árvore client, sem
  FOUC nem hydration mismatch. Default `light`, `enableSystem`, class-based.
- Scope:
  - `src/providers/index.tsx`: envolver com `ThemeProvider`
    (`attribute="class"`, `defaultTheme="light"`, `enableSystem`,
    `disableTransitionOnChange` a avaliar).
  - `src/app/layout.tsx`: `suppressHydrationWarning` no `<html>`.
  - Verificar Sonner (`components/ui/sonner.tsx`) herdando tema real.
- Main modules/files likely involved: `providers/index.tsx`, `app/layout.tsx`.
- Dependencies: none (independente de TASK-01).
- Story points: 1
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (config de provider; validação = toggle manual +
  ausência de FOUC, coberto no /test e /ui-review)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: risco = mismatch de hidratação se ordem do provider/atributo errada.
  `ThemeProvider` deve ser o wrapper mais externo do boundary client. Review
  elevado 1 tier por risco médio.

### TASK-03 – Rota /profile/theme: seletor + hidratação cross-device
- Type: application
- Goal: tela dedicada com 3 opções (Claro/Escuro/Automático); aplica via
  `useTheme().setTheme`, persiste no perfil (`themePreference`), e hidrata o
  next-themes a partir do perfil ao logar em outro dispositivo. SettingsMenu
  passa a linkar a rota (remove placeholder disabled).
- Scope:
  - `src/app/(app)/profile/theme/page.tsx`: nova rota.
  - Componente seletor (ex.: `features/profile/components/ThemeSelector.tsx`):
    guarda `mounted` (evita render de estado errado pré-mount), 3 opções, chama
    `setTheme` + `useUpdateProfile({ themePreference })`.
  - Hidratação: efeito que semeia `setTheme(profile.themePreference)` quando o
    perfil chega e diverge do valor atual (perfil = autoridade; localStorage do
    next-themes = cache). Evitar loop set↔persist.
  - `SettingsMenu.tsx`: item "Tema do Aplicativo" vira `Link` para
    `/profile/theme`, subtitle refletindo escolha atual; remover `disabled`.
  - Testes: mapeamento opção→label, guarda mounted, persistência dispara update.
- Main modules/files likely involved: `app/(app)/profile/theme/page.tsx`,
  `features/profile/components/{ThemeSelector,SettingsMenu}.tsx`,
  `features/profile/hooks/useUpdateProfile.ts` (consumo), testes co-locados.
- Dependencies: TASK-01 (campo/serviço), TASK-02 (provider montado).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (lógica de hidratação + guarda mounted + evitar
  loop têm regras condicionais que se beneficiam de teste-primeiro)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, tdd, implement, test, review, ui-review
- Notes: cuidado com loop de reconciliação (setTheme → persist → refreshProfile →
  efeito → setTheme). Persistir só em ação explícita do usuário; hidratar só
  quando perfil≠tema-atual e origem = perfil. `resolvedTheme` só válido pós-mount.

### TASK-04 – Auditoria e ajuste de contraste dark (telas principais)
- Type: refactor-support
- Goal: garantir legibilidade/contraste AA no dark nas telas principais; corrigir
  cores hardcoded fora dos tokens semânticos que quebrem no escuro.
- Scope:
  - Varredura de `oklch(`/hex hardcoded e classes de cor fixas em componentes das
    telas: home, matches, rankings, bracket/eliminatórias, profile, admin,
    notifications, grupos, auth (só verificar que `.auth-*` não quebra sob `.dark`).
  - Confirmar cobertura dos overrides `.dark .<x>-theme` em `globals.css`.
  - Ajustes pontuais: trocar cor fixa por token (`text-foreground`,
    `bg-card`, `text-muted-foreground`, `--color-win/loss/success/...`).
  - Sem redesign — só correção de contraste/regressão.
- Main modules/files likely involved: `src/app/globals.css`,
  `src/features/**/components/*`, `src/components/**`.
- Dependencies: TASK-02 (precisa do toggle funcional para auditar), TASK-03
  (ideal ter o seletor para alternar; pode iniciar após TASK-02).
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no (auditoria visual; validação via /ui-review, não
  teste unitário)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, implement, test, review, ui-review
- Notes: MAIOR fonte de regressão da feature. Auditoria: 22 achados em 15
  arquivos. Corrigidos (cor crua → token): matchLabels, predictionLabels,
  KnockoutMatchCard (red→loss, amber→warning), PredictionMatchRow (amber→
  warning), statusBadge, PredictionSuccess (green→success), InviteValue +
  GroupSettingsForm + GroupPendingUsers + GroupsPending (emerald→success),
  layout themeColor (light/dark). Exceções documentadas: MEDAL_CLASS (par
  autocontido), lime +5 "quase vitória" (LastResultsCard + predictionLabels,
  sem token p/ 5º matiz), scrims dialog/sheet (bg-black theme-independent). Escopo pode crescer — priorizar
  telas de maior tráfego (home, matches, rankings, profile). `/ui-review` é o
  gate real de qualidade aqui. Review elevado 1 tier por risco médio.

## 4. Dependency map

- TASK-01 — sem dependências.
- TASK-02 — sem dependências.
- TASK-03 — depende de **TASK-01** (campo/serviço) + **TASK-02** (provider).
- TASK-04 — depende de **TASK-02** (toggle funcional); ideal após **TASK-03**.

TASK-01 e TASK-02 são paralelizáveis. TASK-03 é o join. TASK-04 fecha.

## 5. Recommended execution order

1. **TASK-02** — provider (destrava toggle e auditoria; menor, alto valor).
2. **TASK-01** — persistência (schema+serviço).
3. **TASK-03** — rota/seletor/hidratação (join de 01+02).
4. **TASK-04** — auditoria de contraste dark.

(01 e 02 podem inverter; 02 primeiro por destravar TASK-04 cedo.)

## 6. Planning risks and blockers

- **TASK-03 loop de reconciliação** persist↔hidratação — exige TDD e cuidado de
  design (só persistir em ação do usuário; hidratar 1x por chegada de perfil).
- **TASK-04 escopo aberto** — contraste dark pode revelar muitas correções.
  Mitigar priorizando telas de maior tráfego; `/ui-review` como gate.
- **TASK-02 FOUC/hydration** — config errada do provider gera flash; validar no
  build/preview real, não só teste unitário.
- Sem blockers de clarificação: ambiguidades do PRD (persistência, UI) já
  resolvidas no checkpoint. Sem mudança de Rules/backend.
- plan-checker (gsd) **skipped** — agents GSD desabilitados neste ambiente
  (`~/.claude/_disabled/agents/`); feature de UI baixo-risco, raciocínio
  goal-backward das seções 4–6 permanece autoritativo.
