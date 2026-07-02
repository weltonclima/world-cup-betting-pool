# PRD — Dark Theme

## 1. Feature summary

Ativar suporte a **tema escuro** no app, com três modos de seleção pelo
usuário: **Claro**, **Escuro** e **Automático (segue o sistema operacional)**.
Default = **Claro** (comportamento atual preservado). No modo automático, o app
detecta o `prefers-color-scheme` do dispositivo e alterna sozinho, reagindo a
mudanças em tempo real. A escolha vive nas **Configurações do Perfil**
(`/profile/settings`), onde hoje existe um item placeholder desabilitado ("Tema
do Aplicativo · Claro").

A base CSS já está pronta: `globals.css` tem a classe `.dark` com o conjunto
completo de tokens (background, foreground, card, primary, chart, sidebar,
win/loss, success/info/warning) e o `@custom-variant dark (&:is(.dark *))` do
Tailwind v4. O que falta é o **wiring do runtime**: montar o `ThemeProvider` do
`next-themes` (já instalado, v0.4.6) e trocar o placeholder por um controle real.

## 2. Consolidated scope

**Dentro do escopo:**
- Montar `next-themes` `ThemeProvider` (attribute `class`, `defaultTheme="light"`,
  `enableSystem`) no boundary de providers do app.
- `suppressHydrationWarning` no `<html>` do root layout (exigência do next-themes
  para evitar mismatch quando a classe é injetada antes da hidratação).
- Controle de seleção de tema na tela `/profile/settings`: três opções
  mutuamente exclusivas — Claro / Escuro / Automático (sistema).
- Persistência da escolha via `next-themes` (localStorage, por-dispositivo).
- Modo automático detecta `prefers-color-scheme` e reage a mudanças live.
- Sonner toaster já lê `useTheme()` — passará a receber o tema real (hoje só
  tem fallback `"system"` sem provider montado).
- Garantir que as **classes de tema por seção** (`.home-theme`, `.matches-theme`,
  `.ranking-theme`, `.profile-theme`, `.admin-theme`, `.grupos-theme`,
  `.notifications-theme`, `.palpites-theme`) continuem legíveis no dark — a base
  já tem overrides `.dark .<x>-theme` para primary/ring; validar cobertura.

**Decisões travadas (checkpoint PRD):**
- **Persistência = Firestore cross-device.** Campo novo `themePreference`
  (`"light" | "dark" | "system"`) no perfil do usuário, escrito via Route
  Handler (Admin SDK, padrão write do projeto). localStorage do next-themes
  atua como cache/fast-path; a fonte de verdade é o perfil. Ao logar em outro
  dispositivo, a escolha é hidratada do Firestore.
- **UI = sub-rota dedicada `/profile/theme`.** Item em Configurações navega
  para tela com as 3 opções (Claro/Escuro/Automático). O `SettingsMenu` deixa
  de ter placeholder disabled e passa a linkar a rota.

**Fora do escopo:**
- Redesign visual das telas de auth (`.auth-theme`/`.auth-card`/`.auth-light`)
  — telas de login/cadastro têm identidade própria (hero verde + card claro)
  independente do `.dark`; permanecem como estão.
- Novos tokens de cor ou repaleta do dark existente.
- Toggle rápido de tema fora do perfil (ex.: header).

## 3. System understanding relevant to this feature

- **Root layout** (`src/app/layout.tsx`): `<html lang="pt-BR">` sem
  `suppressHydrationWarning`; `viewport.themeColor` fixo em `#1f1f1f`.
- **Providers** (`src/providers/index.tsx`): `QueryProvider > AuthProvider >
  TooltipProvider`. Client boundary. **Sem `ThemeProvider`.**
- **CSS** (`src/app/globals.css`): `.dark` completo; Tailwind v4 class-based dark
  variant; blocos scoped `-theme` por rota com override `.dark .<x>-theme` já
  existente para os verdes de identidade.
- **Settings UI** (`src/features/profile/components/SettingsMenu.tsx`): seção
  "Tema" com `ProfileMenuItem` **disabled**, subtitle fixa "Claro". Comentário
  no código: "A4: tema claro/escuro é futuro — item visível, somente leitura."
- **ProfileMenuItem**: renderiza como `Link` (navegação) ou `button` (ação).
  Não suporta seleção de opções — precisará de controle novo (grupo de
  radios/segmented) ou sub-rota.
- **Sonner** (`src/components/ui/sonner.tsx`): já importa `useTheme` do
  next-themes; hoje resolve para `"system"` por falta de provider.
- **PWA**: app é PWA (`RegisterSW`, manifest). `themeColor` do viewport é
  estático — pode divergir do tema ativo (cosmético).

## 4. Technical impact analysis

**Módulos afetados:**
- `src/providers/index.tsx` — adicionar `ThemeProvider` (wrapper mais externo,
  ou logo abaixo, desde que cubra toda a árvore client).
- `src/app/layout.tsx` — `suppressHydrationWarning` no `<html>`.
- `src/features/profile/components/SettingsMenu.tsx` — trocar placeholder por
  controle real (ou apontar para sub-rota `/profile/theme`).
- Possível novo componente: seletor de tema (segmented control / radio group)
  usando `useTheme()` (`theme`, `setTheme`, `resolvedTheme`).

**Contratos / dados (decisão Firestore cross-device):**
- `src/schemas/users.ts` — campo opcional `themePreference:
  "light" | "dark" | "system"` (default ausente ≈ `"light"`).
- Route Handler de escrita da preferência (padrão write server-side; client não
  escreve `users` role/status, mas escrita de preferência própria precisa passar
  por endpoint ou por regra que permita self-update de campo whitelistado —
  **definir no plano**, ver risco). Reuso possível do fluxo `useUpdateProfile` /
  `PATCH` de perfil já existente.
- Sem mudança em API da Copa, rankings, notifications.

**Hidratação cross-device:** ao carregar, semear `next-themes` a partir de
`profile.themePreference` (via `setTheme`) quando o perfil chega, sem brigar com
o valor de localStorage — perfil é autoridade.

**Fluxos afetados:** navegação em Configurações do Perfil ganha ação funcional.
Toaster passa a herdar tema real. Todas as telas passam a poder renderizar dark.

**Arquitetura:** `ThemeProvider` é client component — compatível com o boundary
client já existente em `providers/index.tsx`. Sem impacto SSR além do
`suppressHydrationWarning` padrão.

**Performance/consistência:** next-themes injeta script inline pré-hidratação
para evitar flash (FOUC). Sem custo relevante. Reatividade ao SO via
`matchMedia` nativo.

## 5. Risks

- **FOUC / hydration mismatch** se `suppressHydrationWarning` faltar ou o
  provider não envolver a árvore — flash de tema errado no load. Mitigado pelo
  script inline do next-themes + config correta.
- **Regressão visual em dark** nas telas que ainda tenham cor hardcoded (hex/
  oklch fixo) fora dos tokens semânticos — badges, gráficos, ícones. Já houve
  trabalho de tokenização (win/loss, success/info/warning), mas telas não
  auditadas para dark podem ter contraste ruim. **Maior risco da feature.**
- **Telas de auth**: `.auth-*` hardcodam bg/fg próprios; com `.dark` no `<html>`
  pode haver combinação inesperada em bordas/inputs herdados. Validar.
- **Sonner**: mudança de comportamento (antes `"system"` fixo → agora segue
  escolha) — baixo risco, é melhoria.
- **themeColor estático** no viewport diverge do tema — cosmético (barra de
  status PWA). Opcional resolver.
- **Persistência localStorage**: usuário em outro dispositivo não vê a escolha —
  esperado, mas pode gerar percepção de "não salvou". Ver §6.

## 6. Ambiguities and gaps

1. ~~Persistência~~ **RESOLVIDO: Firestore cross-device** (campo
   `themePreference` no perfil + hidratação via `setTheme`).
2. ~~UI do seletor~~ **RESOLVIDO: sub-rota `/profile/theme`** dedicada.
3. **Self-write da preferência**: hoje Rules bloqueiam client escrever campos
   sensíveis de `users` (role/status), mas `useUpdateProfile` já faz self-update
   de campos permitidos (nome/avatar). **Definir no plano** se `themePreference`
   entra no whitelist de self-update (Rules) ou passa por Route Handler. Preferir
   reuso do caminho de update de perfil existente.
4. **Escopo dark nas telas de auth**: manter identidade atual (recomendado) ou
   também tematizar? Recomendação: manter — auth tem design intencional próprio.
4. **themeColor dinâmico** do viewport PWA: incluir agora ou depois?
   Recomendação: nice-to-have, pode entrar como ajuste pequeno.
5. **Cobertura de contraste**: precisa de auditoria visual dark das telas
   principais (home, matches, rankings, bracket, profile, admin)? Recomendação:
   validar no `/ui-review` das tasks.

## 7. Recommended implementation concerns

- Tratar o wiring do provider como **task 1 pequena e isolada** (provider +
  layout + suppressHydrationWarning), verificável com toggle manual.
- Seletor de tema em Configurações como **task 2** (frontend, `useTheme`).
- Reservar uma **task de auditoria/ajuste de contraste dark** para as telas
  principais — é onde mora o risco de regressão, não no wiring.
- Evitar `resolvedTheme` no primeiro render server (retorna undefined até
  montar) — usar guarda de `mounted` no seletor para não piscar estado errado.
- Nenhuma mudança de backend/Rules/schema — feature é 100% client/UI.
