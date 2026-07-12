# PLAN — Personalização do grupo: cor primária (por tema) e logo

## 1. Resumo do planejamento
Feature decomposta em **3 tarefas** com risco crescente:

1. **TASK-01 — Logo do grupo com editor de corte:** campo novo `logoBase64`
   (schema + route + form) reaproveitando 100% a infra existente (`AvatarCropModal`,
   `cropRectToCompressedDataUrl`, `validateImageInput`). Baixo risco.
2. **TASK-02 — Cor primária por tema (persistência + edição):** campos
   `primaryColorLight`/`primaryColorDark` (hex) no schema + route + 2 color pickers
   no form. Baixo/médio risco.
3. **TASK-03 — Propagação visual da cor (tema por pool):** mecanismo **novo do
   zero** que injeta a cor do pool do usuário como override da CSS var `--primary`
   na área autenticada, respeitando o tema claro/escuro ativo (`next-themes`).
   Inclui expor as cores ao client (via payload de `/api/rankings/pool`, precedente
   das flags). Maior risco/esforço; depende da TASK-02.

TASK-01 e TASK-02 são **independentes** entre si. TASK-03 depende da TASK-02
(precisa das cores persistidas/expostas).

## 2. Fases de execução recomendadas
- **Fase 1 — Fundação (imagem):** TASK-01 (logo + crop). Independente.
- **Fase 2 — Persistência de cor:** TASK-02 (campos + edição). Independente.
- **Fase 3 — Propagação visual:** TASK-03 (tema por pool). Depende da Fase 2.

## 3. Tasks

### TASK-01 – Logo do grupo (campo novo `logoBase64`) com editor de corte
- Type: application
- Goal: permitir que o group_admin faça upload do logo do grupo, com validação de
  tipo/tamanho e recorte manual (crop), persistido em `logoBase64` (distinto de
  `photoBase64`).
- Scope:
  - `logoBase64?: string` em `poolSchema` + `poolEditSchema` (aditivo, `.max()` de
    chars — teto próprio recalibrado p/ caber com `photoBase64` sob o limite de
    1MB do doc Firestore).
  - `settingsSchema` da route + montagem do patch (`PATCH /api/group/settings`).
  - Nova seção "Logo do Grupo" em `GroupSettingsForm.tsx`: input file →
    `validateImageInput` (restringir a PNG/JPEG/WebP, **excluir SVG** por XSS) →
    editor de corte com **proporção livre/retangular** → compressão → estado +
    diff no submit. Preview do logo.
  - `UpdateGroupSettingsInput` (service) ganha `logoBase64?`.
  - **Crop com aspect ratio configurável (DECIDIDO):** o `AvatarCropModal` faz
    crop 1:1 fixo — parametrizar `aspect`/free-form (ou extrair variante genérica
    `ImageCropModal`) e adaptar `cropRectToCompressedDataUrl`/geometria para
    retângulo. Manter o avatar do perfil intacto (1:1 default) — mudança
    retrocompatível.
- Main modules/files likely involved:
  - `src/schemas/pools.ts`, `src/app/api/group/settings/route.ts`,
    `src/services/group.ts`, `src/features/groupAdmin/components/GroupSettingsForm.tsx`,
    `src/features/profile/components/AvatarCropModal.tsx` (reuso),
    `src/features/profile/lib/imageToDataUrl.ts` (reuso; talvez restringir mimes).
- Dependencies: nenhuma
- Story points: 5
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes (validação de tipo/tamanho + geometria do crop
  retangular — regras testáveis puras)
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, ui-spec, tdd, implement, test, review, ui-review
- Notes: is_frontend: true (nova seção no form + modal de crop). SP subiu 3→5 e
  risco low→medium pela **decisão de crop com proporção livre** (parametrizar o
  modal quadrado). Restringir mimes a raster; recalibrar teto de bytes do logo
  (1MB do doc, somado à foto). Precedente: `onPickPhoto` (sem crop).

### TASK-02 – Cor primária por tema (persistência + edição no form)
- Type: api
- Goal: persistir duas cores de marca do grupo (`primaryColorLight`,
  `primaryColorDark`) editáveis pelo group_admin; ainda SEM aplicá-las
  visualmente (isso é a TASK-03).
- Scope:
  - `primaryColorLight?`, `primaryColorDark?` em `poolSchema` + `poolEditSchema`,
    validados por regex hex `#RRGGBB` (Zod). Aditivos/optional; ausente = usa o
    padrão do app.
  - `settingsSchema` da route + montagem do patch.
  - `UpdateGroupSettingsInput` (service) ganha os 2 campos.
  - Form: bloco "Cores do Grupo" com 2 seletores de cor (claro/escuro) —
    `<input type="color">` ou componente equivalente — com preview e diff no submit.
- Main modules/files likely involved:
  - `src/schemas/pools.ts`, `src/app/api/group/settings/route.ts`,
    `src/services/group.ts`, `src/features/groupAdmin/components/GroupSettingsForm.tsx`.
- Dependencies: nenhuma (independente da TASK-01)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (persistência/config; testes no /test — validação hex)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: is_frontend: true (2 color pickers no form). ui-spec/patterns pulados
  (bloco de form simples, sem novo padrão visual). Validação de contraste FORA
  do escopo (follow-up). Padrão consolidado (espelha `splitPhaseRanking` na
  persistência; adiciona validação de formato).

### TASK-03 – Propagação visual: tema por pool (override de `--primary`)
- Type: integration
- Goal: aplicar a cor do grupo do usuário nas telas da área autenticada,
  sobrescrevendo a CSS var `--primary` conforme o tema ativo (claro/escuro), com
  fallback ao padrão do app quando o pool não tem cor.
- Scope:
  - **SSR sem flash via cookie (DECIDIDO):** ao salvar as cores (ou no login/
    resolução de sessão), gravar um cookie com as cores efetivas do pool do
    usuário. O layout raiz da área autenticada (server component) lê o cookie e
    injeta `--primary`/`--primary-foreground` inline no wrapper antes da
    hidratação → sem flash. Sem cookie → padrão (`globals.css`).
  - **Componente `PoolThemeVars`** (client): mantém as vars sincronizadas ao
    trocar tema (claro/escuro) ou logo após edição, e cobre o caso do cookie
    ausente/desatualizado (lê a cor via `usePoolRanking`/settings e re-injeta).
  - **Foreground por contraste (mitigação (3)):** derivar `--primary-foreground`
    da luminância da cor (preto/branco por WCAG) — server e client.
  - **Expor as cores ao client:** estender o payload de `/api/rankings/pool` com
    `primaryColorLight`/`primaryColorDark` + `poolRankingResponseSchema` (para o
    sync client e o form). O cookie cobre o SSR; o payload cobre o client.
  - Função pura `resolveEffectivePrimary(pool, theme)` → `{ primary, foreground }`
    ou null (fallback, seleção por tema, hex inválido defensivo, luminância).
  - Verificar que a UI consome `var(--primary)` (Tailwind `--color-primary`) e não
    cores hardcoded — anotar exceções.
- Main modules/files likely involved:
  - `src/schemas/rankings.ts`, `src/app/api/rankings/pool/route.ts`,
    `src/features/groupAdmin/components/PoolThemeVars.tsx` (novo) + `lib` puro,
    `src/app/(app)/layout.tsx` (wiring), `src/providers/*` (se necessário).
- Dependencies: TASK-02 (cores persistidas)
- Story points: 8
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (resolução da cor efetiva + luminância — regra pura)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: in-progress
- Phases done: (none)
- Notes: is_frontend: true (mecanismo de tema — SSR cookie + CSS var + provider
  client). SP subiu 5→8 pela **decisão sem-flash (cookie/SSR)** + foreground por
  contraste. Maior risco: não regredir o tema claro/escuro global; consistência
  cookie↔fetch; timing com next-themes (`.dark` antes da hidratação). Fallback
  seguro obrigatório.

## 4. Mapa de dependências
- TASK-01 → (sem dependências)
- TASK-02 → (sem dependências)
- TASK-03 → depende de **TASK-02**

## 5. Ordem de execução recomendada
1. **TASK-01** (logo + crop; baixo risco, reaproveita infra) — pode ir primeiro
   ou em paralelo à TASK-02.
2. **TASK-02** (persistência de cor; base para a TASK-03).
3. **TASK-03** (propagação visual; maior risco; precisa da TASK-02).

## 5.1 Decisões (da verificação goal-backward) — RESOLVIDAS no checkpoint
1. **Flash de cor na hidratação (TASK-03): DECIDIDO = (B) SSR via cookie.** A cor
   efetiva do pool é persistida num cookie (não-httpOnly ou lido no server) e
   injetada no `--primary`/`--primary-foreground` no server (layout raiz da área
   autenticada) antes da hidratação → sem flash. O componente client
   (`PoolThemeVars`) mantém a var sincronizada em troca de tema/cor. Aumenta o
   esforço da TASK-03 (SSR + cookie + sync client). Fallback: sem cookie → padrão.
2. **Proporção do logo (TASK-01): DECIDIDO = (B) proporção livre/retangular.** O
   editor de corte passa a aceitar aspect ratio configurável (não só 1:1),
   preservando logos largos. Exige **parametrizar** o `AvatarCropModal` (hoje
   quadrado fixo) — ou extrair uma variante genérica. Aumenta o esforço da TASK-01.
3. **Legibilidade do texto sobre a cor (TASK-03):** `--primary-foreground` é fixo;
   uma cor de pool clara deixaria o texto do botão ilegível. **Mitigação adotada
   por padrão (dentro do MVP):** derivar `--primary-foreground` automaticamente da
   luminância da cor escolhida (preto/branco por contraste WCAG). Não requer
   decisão do usuário — é o default de engenharia; registrado aqui.

## 6. Riscos de planejamento e bloqueios
- **TASK-03 é o principal risco:** mecanismo de tema por pool é novo do zero.
  Mitigação: função pura de resolução (TDD) + fallback ao padrão + verificação de
  que a UI usa `var(--primary)`. Cuidar de flash de cor na hidratação (next-themes).
- **Segurança (TASK-01):** restringir o mime do logo a raster (excluir SVG → XSS).
  Anotado como requisito no spec.
- **Limite de 1MB do doc Firestore (TASK-01):** logo + foto do grupo somados;
  recalibrar tetos de bytes (não dobrar o limite atual).
- **Contraste de cor (TASK-02/03):** admin pode escolher cor ilegível. Fora do MVP
  — follow-up de UX (validação/aviso de contraste).
- **Exposição das cores ao client (TASK-03):** decidir no spec entre estender
  `/api/rankings/pool` (mais barato, precedente) vs. endpoint dedicado.
- plan-checker GSD indisponível no ambiente → verificação goal-backward própria
  (seções 4–6) vale; TASK-03 (risk high) justifica atenção extra no review.
