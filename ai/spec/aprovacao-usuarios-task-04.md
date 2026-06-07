# SPEC — TASK-04: Primitivos Shadcn (tabs, dialog, avatar, badge)

> Feature: Aprovação de Usuários (PRD-01.2) · Plano: `ai/plan/aprovacao-usuarios.md` (TASK-04)
> Tipo: infra / ui · Story points: 2 · Criticality: medium · Risk: low · TDD: no
> Contrato visual: `design-system/MASTER.md` (tokens travados)

---

## 1. Objetivo

Disponibilizar 4 primitivos base ausentes em `src/components/ui/` — **`tabs`**, **`dialog`**, **`avatar`**, **`badge`** — para o painel admin (telas 03/05) e o modal de confirmação (tela 04). **Sem lógica de negócio.** Devem aderir a `design-system/MASTER.md` (tokens oklch, raios, sombras, tipografia) e ser compatíveis com **React 19 / Next 15**.

Out of scope: composição de painel, ações, hooks, dados. Apenas os primitivos reutilizáveis e seus exports.

---

## 2. Decisão de origem dos componentes (CLI shadcn vs cópia manual)

**Decisão: composição manual** wrapando primitivas de `@base-ui/react`. **Não** usar `npx shadcn add`.

Fundamentos (verificados no repo):

- `components.json` → `"style": "base-nova"`, `"registries": {}` (sem registry custom configurado), `"ui": "@/components/ui"`, `"utils": "@/lib/utils"`. Não é o registry padrão Radix do shadcn.
- O projeto **não usa Radix**. Usa **Base UI** (`@base-ui/react@^1.5.0`) — confirmado em `package.json` e em todos os wrappers existentes (`button.tsx`, `input.tsx`, `checkbox.tsx`, `tooltip.tsx`, `form.tsx` importam de `@base-ui/react/*`). `MASTER.md` (linha 5) declara: "Shadcn UI (Base UI)".
- Precedente documentado: `src/components/ui/checkbox.tsx` (linhas 9–17) registra que **o registry `base-nova` não disponibilizou o componente via CLI**, então foi composto manualmente "seguindo o mesmo padrão de Button/Input (wrap da primitiva base-ui + tokens de tema)". Aplicar a mesma estratégia aqui.
- Rodar `npx shadcn add tabs dialog avatar badge` puxaria implementações **Radix** (`@radix-ui/*`), incompatíveis com a convenção do projeto e introduzindo dep duplicada/conflitante. **Proibido.**

> Se em algum momento for tentado o CLI, deve ser **apenas** como referência de classes, e a saída reescrita para Base UI. O artefato final precisa importar de `@base-ui/react/*`.

---

## 3. Dependências npm

**Nenhuma dependência nova.** Tudo já está instalado:

| Primitivo | Origem | Já instalado? |
|---|---|---|
| `tabs` | `@base-ui/react/tabs` | Sim (`@base-ui/react@^1.5.0`) — subpacote `tabs/` presente em node_modules |
| `dialog` | `@base-ui/react/dialog` | Sim — subpacote `dialog/` presente |
| `avatar` | `@base-ui/react/avatar` | Sim — subpacote `avatar/` presente |
| `badge` | HTML puro + `cva` | Sim (`class-variance-authority@^0.7.1`) |

Utilitários já disponíveis: `cn` em `@/lib/utils` (clsx + tailwind-merge), `lucide-react` para ícones. **Não** adicionar `@radix-ui/*`.

---

## 4. Convenções a espelhar (dos wrappers existentes)

Todo novo arquivo deve seguir o padrão já estabelecido em `button.tsx` / `checkbox.tsx` / `tooltip.tsx`:

1. `"use client"` no topo **quando** o componente usa estado/portal/contexto de cliente (dialog, tabs, avatar → sim; badge → não precisa, é estático).
2. Import da primitiva: `import { X as XPrimitive } from "@base-ui/react/x"`.
3. `import { cn } from "@/lib/utils"`.
4. Cada subcomponente recebe `className` e faz merge via `cn(...)`.
5. `data-slot="..."` em cada subcomponente (padrão em todos os wrappers — usado para hooks de estilo).
6. Tipagem via `XPrimitive.<Part>.Props` (padrão `tooltip.tsx`) ou `React.ComponentProps<typeof XPrimitive.Root>` (padrão `checkbox.tsx`). **Sem `any`.**
7. Sem `style={{}}` inline; cores/raios/sombras **somente** via tokens (classes `bg-*`, `text-*`, `rounded-*`, `shadow-*`).
8. Estados via data-attributes da Base UI: `data-[checked]`, `data-open`, `data-closed`, `data-[side=*]`, `data-selected` etc. (ver `tooltip.tsx` para o padrão de animação `data-open:animate-in ... data-closed:animate-out`).
9. Exportar todos os subcomponentes nomeados num único `export { ... }`.

---

## 5. Especificação por arquivo

### 5.1 `src/components/ui/tabs.tsx`

Wrap de `@base-ui/react/tabs`. Partes exportadas pela Base UI: `Root`, `List`, `Tab`, `Indicator`, `Panel`.

Exportar: `Tabs` (Root), `TabsList`, `TabsTab`, `TabsPanel` (e opcionalmente `TabsIndicator` se a tela usar a barra deslizante).

- `"use client"`.
- `Tabs` → `TabsPrimitive.Root` · `data-slot="tabs"` · default `className="flex flex-col gap-2"`.
- `TabsList` → `TabsPrimitive.List` · `data-slot="tabs-list"`. Classe sugerida (aderente a MASTER §2/§5/§4):
  `inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground` (fundo sutil `bg-muted` = token §2.1; raio `rounded-lg` §5; densidade `p-1` §4).
- `TabsTab` → `TabsPrimitive.Tab` · `data-slot="tabs-tab"`. Estado ativo via `data-selected`:
  `inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm text-muted-foreground` (tipografia "Body/Label" §3.2; foco §10.5; elevação `shadow-sm` §6).
- `TabsPanel` → `TabsPrimitive.Panel` · `data-slot="tabs-panel"` · `className="flex-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"`.
- (Opcional) `TabsIndicator` → `TabsPrimitive.Indicator` se barra deslizante for usada — `bg-background rounded-md shadow-sm`.

Acessibilidade (vem nativa da Base UI Tabs, **não reimplementar**): `role="tablist"`/`tab`/`tabpanel`, roving tabindex, navegação por setas, `aria-selected`, `aria-controls`. Atende MASTER §10 (tabs com roving focus/aria). TASK-06 fará as tabs Pendentes/Aprovados/Bloqueados consumirem isto.

### 5.2 `src/components/ui/dialog.tsx`

Wrap de `@base-ui/react/dialog`. **Componente crítico de acessibilidade** — é a base do modal da tela 04 (TASK-07). Partes da Base UI: `Root`, `Trigger`, `Portal`, `Backdrop`, `Popup`, `Title`, `Description`, `Close` (+ `Viewport`).

Exportar: `Dialog` (Root), `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogContent` (composição Portal+Backdrop+Popup), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`.

- `"use client"`.
- `Dialog` → `DialogPrimitive.Root` · `data-slot="dialog"`.
- `DialogTrigger` → `DialogPrimitive.Trigger` · `data-slot="dialog-trigger"`.
- `DialogClose` → `DialogPrimitive.Close` · `data-slot="dialog-close"`.
- `DialogPortal` → `DialogPrimitive.Portal` · `data-slot="dialog-portal"`.
- `DialogOverlay` (interno) → `DialogPrimitive.Backdrop` · `data-slot="dialog-overlay"`:
  `fixed inset-0 z-[100] bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0` (overlay `z-[100]` = MASTER §13 Modal overlay; animação por data-state como em `tooltip.tsx`).
- `DialogContent` → compõe `DialogPortal` + `DialogOverlay` + `DialogPrimitive.Popup` · `data-slot="dialog-content"`:
  `fixed top-1/2 left-1/2 z-[100] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-md sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`
  (raio `rounded-xl` = MASTER §5 modais; padding `p-6` §4 "padding de modal"; superfície `bg-card`/`text-card-foreground` §2.1; elevação `shadow-md` §6 "modais"; `z-[100]` §13). Incluir um `DialogClose` com ícone `X` (`lucide-react`, `size={16}`, `aria-hidden`) posicionado `absolute top-4 right-4`, com `sr-only` "Fechar" — **opcional** conforme tela (a tela 04 "Usuário aprovado!" pode dispensar o X e usar só botão de ação).
- `DialogHeader` → `<div data-slot="dialog-header" className="flex flex-col gap-1.5 text-center sm:text-left">`.
- `DialogFooter` → `<div data-slot="dialog-footer" className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">`.
- `DialogTitle` → `DialogPrimitive.Title` · `data-slot="dialog-title"` · `text-lg font-semibold` (MASTER §3.2 Heading 2/3).
- `DialogDescription` → `DialogPrimitive.Description` · `data-slot="dialog-description"` · `text-sm text-muted-foreground` (§3.4 secundário).

**Foco / teclado (requisito do plano — base do modal tela 04):** a Base UI `Dialog` entrega nativamente, **sem reimplementação**:
- Foco preso dentro do popup enquanto aberto (focus trap).
- `Escape` fecha; foco retorna ao elemento que abriu (return focus).
- Scroll lock no body; `aria-modal`, `role="dialog"`, e fios `aria-labelledby`/`aria-describedby` ligados automaticamente quando `DialogTitle`/`DialogDescription` estão presentes.
- Click no backdrop fecha (comportamento default; controlável via prop se TASK-07 exigir confirmação destrutiva sem fechar acidental).

Isto cobre MASTER §10 "Enhanced" e o critério `accessibility: critical` da TASK-07 (foco preso, esc, confirmação destrutiva). **Não** adicionar bibliotecas de focus-trap externas.

### 5.3 `src/components/ui/avatar.tsx`

Wrap de `@base-ui/react/avatar`. Partes: `Root`, `Image`, `Fallback`. Uso na lista (TASK-06): avatar com **iniciais** (sem upload), logo `Fallback` é o caminho principal.

Exportar: `Avatar` (Root), `AvatarImage`, `AvatarFallback`.

- `"use client"`.
- `Avatar` → `AvatarPrimitive.Root` · `data-slot="avatar"`:
  `relative flex size-10 shrink-0 overflow-hidden rounded-full` (`rounded-full` = MASTER §5 avatares; `size-10` = 40px, área confortável §4).
- `AvatarImage` → `AvatarPrimitive.Image` · `data-slot="avatar-image"` · `aspect-square size-full`.
- `AvatarFallback` → `AvatarPrimitive.Fallback` · `data-slot="avatar-fallback"`:
  `flex size-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground` (fundo `bg-muted`, texto `text-muted-foreground` = tokens §2.1; tipografia "Body/Label" §3.2). As iniciais são passadas como `children` pela TASK-06 — o primitivo não deriva iniciais.

### 5.4 `src/components/ui/badge.tsx`

**Sem primitiva** — `<span>` HTML + `cva` (mesmo padrão de `buttonVariants` em `button.tsx`). Usado para contadores das tabs (TASK-06) e tags de status. **Não** precisa de `"use client"`.

Exportar: `Badge`, `badgeVariants`.

- `badgeVariants` (cva) — base:
  `inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 w-fit transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-3 [&>svg]:pointer-events-none`
  (raio `rounded-md`/`rounded-sm` chips MASTER §5; padding `px-2 py-0.5` ~ §4 badge; tipografia "Body Small/Label" §3.2 `text-xs`).
- Variantes (mapeadas a tokens, espelhando as cores das variantes de Button em MASTER §8):
  - `default`: `border-transparent bg-primary text-primary-foreground`
  - `secondary`: `border-transparent bg-secondary text-secondary-foreground`
  - `destructive`: `border-transparent bg-destructive/10 text-destructive` (alinhado ao tratamento `destructive` do `button.tsx`, que usa fundo translúcido + texto destructive — não `bg-destructive` sólido)
  - `outline`: `border-border text-foreground`
  - `muted`: `border-transparent bg-muted text-muted-foreground` (recomendado para **contadores** neutros das tabs)
  - `defaultVariants: { variant: "default" }`
- `Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>)` → renderiza `<span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />`.

> Mapeamento de status (Pendente/Aprovado/Bloqueado) para variantes **não** é decidido aqui — é responsabilidade da UI (TASK-06/07). Este arquivo só expõe as variantes neutras de tema.

---

## 6. Checklist de aderência ao MASTER.md (gate de revisão)

Verificar antes de concluir a task:

- [ ] **Sem hexadecimais / sem cor arbitrária** — apenas tokens (`bg-muted`, `text-muted-foreground`, `bg-primary`, `border-border`, `bg-destructive/10`…). (MASTER §2, §14, §15)
- [ ] **Sem `style={{}}` inline.** (MASTER §14)
- [ ] **Sem `any`** — tipagem via `*.Props` / `React.ComponentProps<...>`. (MASTER §14)
- [ ] **Raios via token**: `rounded-md` (badge/tab), `rounded-lg` (tabs-list), `rounded-xl` (dialog), `rounded-full` (avatar). (MASTER §5)
- [ ] **Sombra moderada**: `shadow-sm` (tab ativa), `shadow-md` (dialog). (MASTER §6)
- [ ] **Espaçamento na escala**: `p-6` modal, `p-1` tabs-list, `gap-*` da escala 4px. (MASTER §4)
- [ ] **Tipografia por escala**: `text-sm font-medium` (tab/avatar/badge fallback), `text-lg font-semibold` (dialog title), `text-xs` (badge), `text-sm text-muted-foreground` (dialog description). (MASTER §3)
- [ ] **Focus ring** consistente: `focus-visible:ring-3 focus-visible:ring-ring/50` (mesmo padrão de `button.tsx`/`input.tsx`). (MASTER §10.5)
- [ ] **Animações por data-state** (`data-open:animate-in` / `data-closed:animate-out`, via `tw-animate-css` já importado), espelhando `tooltip.tsx`. (MASTER §12)
- [ ] **Z-index**: overlay e popup do dialog em `z-[100]` (Modal overlay). (MASTER §13)
- [ ] **`data-slot`** presente em cada subcomponente (consistência com wrappers existentes).
- [ ] **`"use client"`** em tabs/dialog/avatar; ausente em badge.
- [ ] **Lucide named import** se usar ícone `X` no dialog (`import { X } from "lucide-react"`, `aria-hidden`). (MASTER §7)
- [ ] **Dark mode**: como tudo usa tokens semânticos, dark mode funciona sem regra extra; não usar valores fixos. (MASTER §2.2)

---

## 7. Verificação / Done

1. `npm run typecheck` (tsc --noEmit) passa — sem `any`, props tipadas.
2. `npm run lint` passa.
3. `npm run format:check` passa (Prettier).
4. Smoke manual: montar `Dialog` com `DialogTitle`+`DialogContent` e um `DialogTrigger`; confirmar foco preso, fechamento por `Esc`, retorno de foco. Montar `Tabs` com 3 `TabsTab` e navegar por setas. Renderizar `Avatar` com `AvatarFallback` (iniciais) e `Badge` em cada variante (incl. `muted`/`destructive`).
5. Nenhuma dependência nova em `package.json` (nenhum `@radix-ui/*`).
6. 4 arquivos criados: `src/components/ui/tabs.tsx`, `dialog.tsx`, `avatar.tsx`, `badge.tsx`.

> Opcional pós-merge: atualizar `design-system/MASTER.md` §8 (tabela "Componentes Shadcn disponíveis") adicionando Tabs, Dialog, Avatar, Badge — o doc é fonte de verdade e hoje lista só Button/Input/Form/Sonner. Fora do escopo estrito da TASK-04, mas recomendado para manter o contrato sincronizado.

---

## 8. Riscos / Notas

- **R-1 (origem):** tentar `npx shadcn add` traria Radix e quebraria a convenção Base UI. Mitigação: composição manual obrigatória (§2).
- **R-2 (API Base UI):** nomes de partes podem divergir do Radix (ex.: `Backdrop` em vez de `Overlay`, `Popup` em vez de `Content`, `Tab` em vez de `Trigger`, `Panel` em vez de `Content`). Usar os nomes reais verificados em node_modules: Tabs[`Root,List,Tab,Indicator,Panel`], Dialog[`Root,Trigger,Portal,Backdrop,Popup,Title,Description,Close,Viewport`], Avatar[`Root,Image,Fallback`].
- **R-3 (sem testes):** TDD `no` no plano — cobertura virá indiretamente em TASK-06/07. Garantir typecheck/lint como rede mínima.
- **Compat React 19 / Next 15:** `@base-ui/react@^1.5.0` é a mesma versão já em uso por Button/Input/Checkbox/Tooltip neste projeto (React 19.2.7 / Next 15.5.19) — sem incompatibilidade conhecida.
</content>
</invoke>
