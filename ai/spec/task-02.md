# SPEC — TASK-02: Configurar Shadcn UI + tema base

> Entrada: `ai/plan/feature.md` (TASK-02) + `ai/prd/feature.md` (seção UI) + `.claude/CLAUDE.md`.
> Tipo: `infra` · Criticidade: `high` · Risco técnico: `low` · Story points: 2.
> TDD: não · Screen: não (config de design system, não tela) · Dependências: **TASK-01** (scaffold) — Wave 2.
> Design domains: style, color, typography · Design complexity: low · Accessibility: standard.

---

## 1. Objetivo

Instalar e inicializar o **Shadcn UI** no projeto Next.js 15 + React 19 + TypeScript strict + **Tailwind CSS v4**, configurando um **tema base mobile-first** com estética de app de apostas esportivas (limpa, sóbria), e disponibilizar um conjunto inicial de **componentes base tipados** (button, input, form, sonner) para alimentar as features futuras e o futuro `design-system/MASTER.md`.

Esta tarefa é **somente configuração + componentes base**. Ela **NÃO** constrói nenhuma tela de feature e **NÃO** monta providers no layout — em particular, o `<Toaster />` da Sonner **não** é montado aqui (isso é TASK-06/TASK-11). Apenas o arquivo do componente `sonner.tsx` é instalado.

### Truths que devem ser verdadeiras ao fim
- `components.json` presente e configurado para **Tailwind v4 / CSS variables** (`cssVariables: true`, `tailwind.config: ""`).
- `src/lib/utils.ts` exporta o helper `cn` padrão do Shadcn (`clsx` + `tailwind-merge`).
- `src/app/globals.css` define os **tokens de tema** (cores em `oklch`, `--radius`, dark mode) via `@theme inline` + `:root`/`.dark`, padrão Tailwind v4.
- Componentes base instalados e tipados em `src/components/ui/`: `button`, `input`, `form`, `sonner` (+ `label`, dependência do form).
- `src/lib/index.ts` (barrel pré-existente) permanece **válido**.
- `npx tsc --noEmit`, `npm run lint` e `npm run build` permanecem **verdes**.
- Sem `any`, sem estilos inline de feature, todos os componentes tipados.
- **Nenhum** wiring de provider/Toaster no `layout.tsx` (zero alteração funcional de runtime no layout).

---

## 2. Escopo

### Dentro do escopo
- `npx shadcn@latest init` (CLI atual) em modo não-interativo, configurado para Tailwind v4 + CSS variables.
- Geração de `components.json`, `src/lib/utils.ts` (com `cn`) e atualização de `src/app/globals.css` com os tokens de tema.
- Instalação dos componentes base: `button`, `input`, `form`, `sonner` (via `npx shadcn@latest add ...`), mais `label` (dependência direta do `form`).
- Ajuste mínimo de `tsconfig.json` para suportar a resolução de aliases exigida pela CLI do Shadcn (`baseUrl`).
- Garantir `typecheck` / `lint` / `build` verdes.

### Fora do escopo (tarefas posteriores)
- **Wiring de providers** — montar `<Toaster />` da Sonner, `next-themes` ThemeProvider, QueryClient, AuthProvider → **TASK-06**.
- **App shell / layout base** mobile-first, navegação, guard por status → **TASK-11**.
- Qualquer **tela de feature** (login, cadastro, jogos, palpites etc.) → PRD-01+.
- Formulários reais com React Hook Form + Zod das features → PRD-01+ (aqui só o **wrapper** `form.tsx` genérico).
- Definição final do `design-system/MASTER.md` (a TASK-11 gera via `/screen`; o tema base apenas o alimenta).

> Importante: o componente `src/components/ui/sonner.tsx` é instalado, mas **não** é montado em lugar nenhum. Não tocar no comportamento de runtime do `layout.tsx`.

---

## 3. Decisões técnicas

### 3.1 CLI atual do Shadcn (mudanças relevantes)
A CLI do Shadcn evoluiu e o comando `init` **mudou de flags**:
- **Não** existe mais `--base-color`/`-b` como cor base no `init`; o tema é dirigido por **presets/styles**. O default atual é o style **`base-nova`** (preset `base-nova`).
- Flags válidos relevantes: `--defaults` (usa `--template=next --preset=base-nova`), `--force` (sobrescreve config existente), `--yes`, `--css-variables` (default `true`), `-c/--cwd`.
- O `add` usa `--overwrite` (não `--force`) para sobrescrever arquivos existentes.

**Decisão:** rodar `npx shadcn@latest init --defaults --force --yes`. A CLI detecta automaticamente **Next.js + Tailwind v4** e escreve `components.json` com `cssVariables: true` e `tailwind.config: ""` (correto para v4, sem `tailwind.config.ts`).

### 3.2 Style `base-nova` → Base UI (não Radix)
O style default atual (`base-nova`) gera componentes sobre **`@base-ui/react`** (Base UI, sucessor do Radix mantido pela equipe MUI/Base), **não** sobre `radix-ui`. Consequências:
- Dependências instaladas pela CLI: `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `next-themes`, `shadcn`, `lucide-react`.
- `button.tsx` usa `@base-ui/react/button`; `input.tsx` usa `@base-ui/react/input`; `sonner.tsx` usa `next-themes` + `sonner`.
- **`form` no registry `base-nova` é um item vazio** (sem arquivo). O Base UI tem seu próprio namespace `field`/`form`, então a CLI não entrega o clássico `form.tsx`. Como a regra de desenvolvimento nº 4 exige **React Hook Form + Zod** em todo formulário, escrevemos manualmente o wrapper `form.tsx` (API padrão Shadcn: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`), **adaptado** para Base UI e para o `Label` deste projeto.

### 3.3 Adaptação do `form.tsx` para Base UI
O `form.tsx` canônico do Shadcn (style new-york) depende de `radix-ui` (`Slot`, `Label.Root`). Para manter coerência com `base-nova` e **evitar adicionar `radix-ui`** como dependência paralela:
- `FormControl` é implementado com o hook **`useRender`** do Base UI (`@base-ui/react/use-render`), que provê o equivalente ao `Slot`/render-prop (injeta `id`, `aria-describedby`, `aria-invalid` no filho). Tipagem via `useRender.ComponentProps<"div">` (inclui o prop opcional `render`).
- `FormLabel` usa o `Label` local (`@/components/ui/label`, gerado pela CLis) em vez de `LabelPrimitive`.
- Restante (`FormField` sobre `Controller`, contextos `FormFieldContext`/`FormItemContext`, `useFormField`, `FormMessage` lendo `fieldState.error`) segue o padrão Shadcn, totalmente tipado com os genéricos `FieldValues`/`FieldPath` do `react-hook-form`. Sem `any`.

### 3.4 Ajuste no `tsconfig.json`
A CLI do Shadcn valida o import alias e precisa de `baseUrl` para resolver `@/*`. O scaffold da TASK-01 tinha apenas `paths` sem `baseUrl`. **Decisão:** adicionar `"baseUrl": "."` ao `compilerOptions`, mantendo `"paths": { "@/*": ["./src/*"] }`. Mudança mínima e compatível; `build`/`typecheck` permanecem verdes.

### 3.5 Tema base (cores, radius, dark mode) — mobile-first
A CLI gera o tema neutro (`baseColor: neutral`) em **`oklch`**, com `--radius: 0.625rem`, escala de radii derivada (`--radius-sm..4xl`) e blocos `:root` (claro) + `.dark` (escuro) completos, expostos ao Tailwind via `@theme inline`. Decisões:
- **Manter a paleta neutra/limpa** gerada: serve à estética sóbria de app de apostas esportivas (foco em dados, placares e rankings; cor de destaque fica para o design system da TASK-11). Tokens semânticos (`primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar-*`) ficam disponíveis.
- **Dark mode** incluído (tokens `.dark` + `@custom-variant dark`); o *toggle* em si (ThemeProvider/next-themes) é wiring de TASK-06/TASK-11. Dark mode é "optional but acceptable" — mantido pronto.
- **Mobile-first** é garantido pela ausência de overrides desktop-first e pelos componentes responsivos (ex.: `input` com `text-base md:text-sm`). Estilização exclusivamente via classes Tailwind/variáveis CSS — **sem estilos inline de feature**.

> Nota: o `sonner.tsx` gerado pela CLI usa `style={{ "--normal-bg": ... }}` para mapear variáveis CSS de tema ao runtime da Sonner. Esse é o **padrão canônico do componente Shadcn** (mapeamento de CSS custom properties), não um estilo inline de feature — é mantido como gerado.

---

## 4. Arquivos afetados

| Arquivo | Ação | Origem |
|---|---|---|
| `components.json` | criado | `shadcn init` |
| `src/lib/utils.ts` | criado (`cn`) | `shadcn init` |
| `src/app/globals.css` | atualizado (tokens de tema) | `shadcn init` |
| `src/components/ui/button.tsx` | criado | `shadcn init` |
| `src/components/ui/input.tsx` | criado | `shadcn add input` |
| `src/components/ui/sonner.tsx` | criado | `shadcn add sonner` |
| `src/components/ui/label.tsx` | criado | dependência do form |
| `src/components/ui/form.tsx` | criado (manual, adaptado Base UI) | manual |
| `tsconfig.json` | editado (`baseUrl: "."`) | manual |
| `package.json` / `package-lock.json` | atualizado (deps Shadcn/Base UI) | CLI/npm |

`src/lib/index.ts` e `src/components/index.ts` (barrels): **inalterados** e ainda válidos (`export {}`).

---

## 5. Critérios de aceite / verificação
- `npx tsc --noEmit` → sem erros.
- `npm run lint` → "No ESLint warnings or errors".
- `npm run build` → build de produção verde, páginas geradas.
- `components.json` com `cssVariables: true` e `tailwind.config: ""`.
- `cn` exportado de `src/lib/utils.ts`.
- `button`, `input`, `form`, `sonner` (+ `label`) presentes em `src/components/ui/`.
- Sem `any`; componentes tipados; sem wiring de Toaster/provider no `layout.tsx`.

---

## 6. Riscos / observações
- **R4 (compat React 19 + Next 15 + Shadcn):** mitigado — CLI detectou stack corretamente e build passa.
- **Desvio de stack do Shadcn:** o style atual usa **Base UI** (`@base-ui/react`), não Radix. É o default oficial vigente da CLI; documentado aqui para as features futuras (imports `@base-ui/react/*`).
- **`form` manual:** necessário porque o registry `base-nova` não entrega `form.tsx`. Mantido 100% compatível com a API Shadcn padrão para não impactar features que consumam `<FormField>`.
- **`next-themes`** entrou como dependência (trazida pelo `sonner` do Shadcn); seu provider só é montado em TASK-06/TASK-11.
