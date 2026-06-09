# SCREEN — TASK-07: Tela Enviar/Editar Palpite + estados Bloqueado/Registrado

> Feature: Palpites (PRD-04) · Plataforma: both (mobile-first, responsivo até desktop)
> Design system: `design-system/MASTER.md` (referência — não recriar)
> Fonte de verdade: `docs/prd-04/PRD04-03-Enviar-Palpite.png`, `PRD04-04-Editar-Palpite.png`,
> `PRD04-05-Palpite-Bloqueado.png`, `PRD04-06-Palpite-Registrado.png`
> Spec técnico: `ai/spec/palpites-task-07.md`

---

## 1. Análise das imagens de referência

### PRD04-03 — Enviar Palpite

```
┌─────────────────────────────────────────────┐
│  ← [back]                                   │  ← link "Voltar"
│  3. ENVIAR PALPITE                          │  ← label de fluxo (não na UI)
│  Informe seu palpite para o jogo            │  (contextualização externa)
│  antes do horário de início.                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │      Enviar Palpite                 │    │  ← título h1
│  │                                     │    │
│  │   🇧🇷             ×            🇫🇷   │    │  ← bandeiras, "×" central
│  │   Brasil                    França  │    │  ← nomes
│  │   📅 12/06/2026 · 16:00             │    │  ← data/hora
│  │   📍 Lusail Stadium, Qatar          │    │  ← estádio/cidade
│  │                                     │    │
│  │   Seu palpite                       │    │  ← label seção
│  │   Gols do Mandante  Gols Visitante  │    │  ← labels steppers
│  │   [−]   2   [+]  ×  [−]   1   [+]  │    │  ← STEPPERS GRANDES
│  │                                     │    │
│  │   Você pode alterar seu palpite     │    │  ← aviso de edição (futuro)
│  │   quantas vezes quiser antes do     │    │
│  │   horário oficial de início do jogo.│    │
│  │                                     │    │
│  │   [      Salvar palpite       ]     │    │  ← botão primário verde
│  └─────────────────────────────────────┘    │
│                                             │
│  🏠  📅  ✏  🏆  👤                        │  ← bottom nav
└─────────────────────────────────────────────┘
```

**Observações visuais:**
- Bandeiras: tamanho médio-grande (~64×44px), com nome da seleção abaixo.
- Steppers: número central grande (~48-56px font), botões −/+ com tamanho generoso (≥44×44px).
- "×" entre os dois steppers: separador visual, muted, menor que os números.
- Labels "Gols do Mandante" / "Gols do Visitante" acima de cada stepper.
- Botão "Salvar palpite" ocupa largura total, cor primária (verde/escuro).
- **NÃO inclui texto de pontuação "3 pontos / 1 ponto / 0 pontos"** — removido (decisão A6).

### PRD04-04 — Editar Palpite

```
┌─────────────────────────────────────────────┐
│   4. EDITAR PALPITE                         │  ← contextualização externa
│   Altere seu palpite quantas vezes          │
│   quiser antes do início do jogo.           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │      Editar Palpite                 │    │  ← título h1 diferente
│  │                                     │    │
│  │   🇧🇷             ×            🇫🇷   │    │  ← mesma estrutura
│  │   Brasil                    França  │    │
│  │   📅 12/06/2026 · 16:00             │    │
│  │   📍 Lusail Stadium, Qatar          │    │
│  │                                     │    │
│  │   Seu palpite                       │    │
│  │   Gols do Mandante  Gols Visitante  │    │
│  │   [−]   2   [+]  ×  [−]   1   [+]  │    │  ← pré-preenchido
│  │                                     │    │
│  │   ⚠ Atenção: alterações não são     │    │  ← aviso específico do modo edit
│  │     permitidas após o horário de    │    │
│  │     início do jogo.                 │    │
│  │                                     │    │
│  │   [     Atualizar palpite      ]    │    │  ← botão com texto diferente
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Diferenças em relação ao PRD04-03:**
- Título: "Editar Palpite" (h1).
- Steppers pré-preenchidos com o palpite existente (2 × 1).
- Aviso: "Atenção: alterações não são permitidas após o horário de início do jogo." (trocando "quantas vezes quiser antes" por aviso mais restritivo — usar versão canônica da imagem 04).
- Botão: "Atualizar palpite".

### PRD04-05 — Palpite Bloqueado

```
┌─────────────────────────────────────────────┐
│  5. PALPITE BLOQUEADO                       │
│  O prazo para este jogo foi encerrado.      │
│  Não é possível editar seu palpite.         │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │   🔒                                │    │  ← ícone cadeado grande, central
│  │   Palpite bloqueado                 │    │  ← título h1
│  │                                     │    │
│  │   O prazo para este jogo foi        │    │  ← mensagem de bloqueio
│  │   encerrado. Não foi possível criar │    │
│  │   ou alterar seu palpite.           │    │
│  │                                     │    │
│  │   🇧🇷             ×            🇫🇷   │    │  ← header do jogo
│  │   Brasil                    França  │    │
│  │   📅 12/06/2026 · 16:00             │    │
│  │   📍 Lusail Stadium, Qatar          │    │
│  │                                     │    │
│  │   Seu palpite                       │    │
│  │          2              ×    1      │    │  ← placar read-only (sem botões)
│  │                                     │    │
│  │   [     Voltar para jogos     ]     │    │  ← botão outline (não primário)
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Observações:**
- Ícone cadeado (Lock) com fundo arredondado, centralizado — tom muted.
- Placar exibido sem botões +/− (read-only).
- Botão "Voltar para Jogos" de menor hierarquia que nos outros estados.
- Nomes dos times junto ao placar (contexto do palpite).

### PRD04-06 — Palpite Registrado (sucesso)

```
┌─────────────────────────────────────────────┐
│  6. PALPITE REGISTRADO                      │
│  Seu palpite foi salvo com sucesso!         │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │   ✅                                │    │  ← check verde grande, central
│  │   Palpite registrado!               │    │  ← título h1
│  │   Seu palpite foi salvo com         │    │  ← mensagem de sucesso
│  │   sucesso.                          │    │
│  │                                     │    │
│  │   🇧🇷             ×            🇫🇷   │    │  ← header do jogo
│  │   Brasil                    França  │    │
│  │   📅 12/06/2026 · 16:00             │    │
│  │   📍 Lusail Stadium, Qatar          │    │
│  │                                     │    │
│  │   Seu palpite                       │    │
│  │          2              ×    1      │    │  ← placar registrado
│  │                                     │    │
│  │   [     Voltar para jogos     ]     │    │  ← botão primário (cor principal)
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Diferenças do estado Bloqueado:**
- Ícone: checkmark verde (CheckCircle2) — não cadeado.
- Título: "Palpite registrado!".
- Mensagem: "Seu palpite foi salvo com sucesso.".
- Botão "Voltar para Jogos" é **primário** (bg-primary) — ação esperada do usuário.

---

## 2. Overrides de página (complementares ao design system)

O design system cobre a base. Esta seção registra apenas os valores específicos desta página.

### 2.1 Número grande do stepper

| Propriedade | Valor | Justificativa |
|---|---|---|
| Font size | `text-5xl` (48px) | Destaque visual do placar — elemento central da UX |
| Font weight | `font-bold` | Clareza numérica |
| Min width | `min-w-[3rem]` | Evita layout shift entre dígito único (0-9) e duplo (10+) |
| Color | `text-foreground` | Máximo contraste |

### 2.2 Botões +/− do stepper

| Propriedade | Valor | Justificativa |
|---|---|---|
| Dimensão mínima | `min-h-[44px] min-w-[44px]` | WCAG 2.5.5 touch target |
| Border radius | `rounded-lg` | Consistente com design system §5 |
| Background | `bg-background` | Neutro; destaque é o número central |
| Border | `border border-border` | Separação visual clara |
| Text size | `text-2xl` | Símbolo −/+ legível sem ambiguidade |
| Disabled | `opacity-50 cursor-not-allowed` | Estado visual padronizado |

### 2.3 Ícone de estado (bloqueado / sucesso)

| Estado | Ícone | Container | Cor |
|---|---|---|---|
| Bloqueado | `Lock` (Lucide, size=32) | `rounded-full bg-muted p-4` | `text-muted-foreground` |
| Sucesso | `CheckCircle2` (Lucide, size=48) | `rounded-full bg-green-500/10 p-4` | `text-green-600 dark:text-green-400` |

Nota: `text-green-600` é token Tailwind nativo com contraste ≥ AA sobre `bg-green-500/10`. O token `--color-win` (MASTER §2.4) ainda não existe em globals.css — usar Tailwind nativo até o token ser criado.

### 2.4 Seção "Seu palpite" (read-only em Bloqueado/Sucesso)

Diferente dos steppers ativos, o placar read-only usa apenas o número grande centralizado sem botões, com o nome do time acima. Contraste mantido via `text-foreground` para os números.

---

## 3. Layout — mobile (< 768px)

### Estado 1: Form ativo (Enviar / Editar)

```
┌──────────────────────────────┐  padding: px-4 py-4
│ ← Voltar                     │  text-sm text-muted-foreground, gap-1 com ArrowLeft
│                              │
│ Enviar Palpite               │  h1: text-xl font-bold text-foreground
│                              │  (ou "Editar Palpite" no modo edit)
│ ┌────────────────────────┐   │  rounded-xl border bg-card shadow-sm p-4
│ │ [🇧🇷]        ×   [🇫🇷] │   │  flex justify-around items-center
│ │ Brasil         França  │   │  text-sm font-medium
│ │ 📅 12/06/2026 · 16:00  │   │  text-xs text-muted-foreground, flex gap-1
│ │ 📍 Lusail, Qatar       │   │
│ └────────────────────────┘   │
│                              │
│ Seu palpite                  │  text-xs uppercase tracking-wide text-muted-foreground
│                              │
│    Gols Mandante  G. Visit.  │  labels: text-xs uppercase text-muted-foreground
│                              │
│  [−]    2    [+] × [−] 1 [+] │  steppers, número text-5xl font-bold
│                              │
│  Alterações permitidas até   │  text-sm text-muted-foreground text-center (edit only)
│  o horário de início do jogo │
│                              │
│  [    Salvar palpite    ]    │  Button variant="default" w-full min-h-[44px]
│                              │
│                              │  pb-20 (clearance BottomNav)
└──────────────────────────────┘
```

### Estado 2: Palpite Bloqueado

```
┌──────────────────────────────┐  px-4 py-4
│ ← Voltar                     │
│                              │
│      [🔒]                    │  ícone centralizado — rounded-full bg-muted p-4
│   Palpite bloqueado          │  h1: text-xl font-bold text-center
│   O prazo para este jogo     │  text-sm text-muted-foreground text-center
│   foi encerrado.             │
│                              │
│ ┌────────────────────────┐   │  match header card
│ │ [🇧🇷]        ×   [🇫🇷] │   │
│ │ Brasil         França  │   │
│ │ 📅 12/06/2026 · 16:00  │   │
│ │ 📍 Lusail, Qatar       │   │
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │  palpite read-only card
│ │ Seu palpite            │   │  text-xs uppercase text-muted-foreground
│ │  Brasil    ×   França  │   │  nomes times
│ │    2       ×    1      │   │  números text-4xl font-bold sem botões
│ │  12/06 às 16:00        │   │  data/hora do jogo
│ └────────────────────────┘   │
│                              │
│  [   Voltar para Jogos  ]    │  outline button w-full min-h-[44px]
└──────────────────────────────┘
```

### Estado 3: Palpite Registrado

```
┌──────────────────────────────┐  px-4 py-8
│      [✅]                    │  CheckCircle2 centralizado — rounded-full bg-green-500/10 p-4
│   Palpite registrado!        │  h1: text-xl font-bold text-center
│   Seu palpite foi salvo      │  text-sm text-muted-foreground text-center
│   com sucesso.               │
│                              │
│ ┌────────────────────────┐   │  match header card
│ │ [🇧🇷]        ×   [🇫🇷] │   │
│ │ Brasil         França  │   │
│ │ 📅 12/06/2026 · 16:00  │   │
│ │ 📍 Lusail, Qatar       │   │
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │  palpite confirmado card
│ │ Seu palpite            │   │
│ │  Brasil    ×   França  │   │
│ │    2       ×    1      │   │
│ └────────────────────────┘   │
│                              │
│  [   Voltar para Jogos  ]    │  Button default (bg-primary) w-full min-h-[44px]
└──────────────────────────────┘
```

---

## 4. Layout — desktop (≥ 768px)

Mesma estrutura, max-width `max-w-2xl mx-auto`. O conteúdo centra-se.

- `pb-4` (sem BottomNav no desktop) — remover `pb-20`.
- Steppers ficam naturalmente centralizados em coluna estreita — sem layout de grid adicional.
- SideNav lateral não afeta o conteúdo da rota (já tratado pelo AppShell).

---

## 5. Paleta e tokens

Todos os tokens seguem `design-system/MASTER.md §2`. Nenhum valor hexadecimal.

| Elemento | Token Tailwind | Observação |
|---|---|---|
| Fundo de página | `bg-background` | Branco/dark via token |
| Card (header jogo, palpite) | `bg-card border-border rounded-xl shadow-sm p-4` | Padrão de card do projeto |
| h1 título | `text-foreground text-xl font-bold` | Hierarquia de heading |
| Texto auxiliar | `text-muted-foreground text-sm` | Labels, mensagens de apoio |
| Label de seção | `text-muted-foreground text-xs font-medium uppercase tracking-wide` | "Seu palpite", "Gols Mandante" |
| Número stepper | `text-foreground text-5xl font-bold` | Elemento central da UX |
| "×" separador | `text-muted-foreground text-xl font-bold` | Entre steppers e entre placar |
| Botão primário (Salvar/Registrado) | `variant="default"` Shadcn Button | `bg-primary text-primary-foreground` |
| Botão outline (Bloqueado/Voltar) | `variant="outline"` Shadcn Button | `border-border bg-background` |
| Ícone bloqueado (container) | `bg-muted rounded-full p-4` | Suave, sem destaque |
| Ícone bloqueado | `text-muted-foreground` | Tom neutro — sem alarme |
| Ícone sucesso (container) | `bg-green-500/10 rounded-full p-4` | Verde suave |
| Ícone sucesso | `text-green-600 dark:text-green-400` | Verde semântico, WCAG AA |
| Link "Voltar" | `text-muted-foreground hover:text-foreground` | Ação secundária |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | Design system §10 |

---

## 6. Tipografia

Nenhuma fonte nova. Usando escala do design system §3.

| Elemento | Classes |
|---|---|
| Título principal (h1) | `text-xl font-bold text-foreground` |
| Label de seção | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| Número de placar (stepper ativo) | `text-5xl font-bold text-foreground` |
| Número de placar (read-only) | `text-4xl font-bold text-foreground` |
| Nomes das seleções | `text-sm font-medium text-foreground` |
| Mensagem de apoio | `text-sm text-muted-foreground` |
| Data/hora/estádio | `text-xs text-muted-foreground` |
| Botão label | `text-sm font-medium` (herdado do Shadcn Button) |

---

## 7. Iconografia

Usando Lucide React — design system §7.

| Elemento | Ícone | Size | aria |
|---|---|---|---|
| Link "Voltar" | `ArrowLeft` | 18 | `aria-hidden="true"` (label no `<Link>`) |
| Data | `Calendar` | 12 | `aria-hidden="true"` |
| Estádio/cidade | `MapPin` | 12 | `aria-hidden="true"` |
| Ícone de bloqueio | `Lock` | 32 | `aria-hidden="true"` (título h1 descreve o estado) |
| Ícone de sucesso | `CheckCircle2` | 48 | `aria-hidden="true"` (título h1 descreve o estado) |
| Botão "Voltar" Sucesso | sem ícone | — | texto descritivo é suficiente |

---

## 8. Componentes Shadcn utilizados

| Componente | Uso | Import |
|---|---|---|
| `Button` | Salvar, Atualizar, Voltar para Jogos | `@/components/ui/button` |
| `Form`, `FormField`, `FormControl`, `FormItem`, `FormMessage` | Integração RHF + a11y | `@/components/ui/form` |

`Input` Shadcn: **não usado** para os steppers — o stepper customizado com `<button>` + `<output>`
oferece melhor UX touch do que um input numérico nativo.

---

## 9. Acessibilidade — especificação detalhada (nível crítico)

### 9.1 Estrutura semântica

- **Um `<h1>` por estado** — nunca dois:
  - Form create: "Enviar Palpite"
  - Form edit: "Editar Palpite"
  - Bloqueado: "Palpite bloqueado"
  - Sucesso: "Palpite registrado!"
- `<main>` já provido pelo AppShell (`id="main-content"`, `tabIndex={-1}`).
- Cards de conteúdo como `<div>` (não necessitam de landmark adicional).

### 9.2 Stepper `ScoreInput` — ARIA detalhado

```tsx
<div role="group" aria-label="Gols Mandante">
  <span /* label visual */ className="...">Gols Mandante</span>
  <div className="flex items-center gap-4">
    <button
      type="button"
      aria-label="Diminuir Gols Mandante"
      disabled={value <= 0}
      /* min-h-[44px] min-w-[44px] */
    >−</button>
    <output
      aria-live="polite"
      aria-label="Gols Mandante: 2"
    >2</output>
    <button
      type="button"
      aria-label="Aumentar Gols Mandante"
      disabled={value >= 20}
      /* min-h-[44px] min-w-[44px] */
    >+</button>
  </div>
</div>
```

- `role="group"` + `aria-label` agrupa botões + output para screen readers.
- `<output aria-live="polite">` anuncia mudança de valor sem interromper leitura corrente.
- `aria-label` dinâmico no `<output>` inclui o valor atual: `"Gols Mandante: {value}"`.
- `disabled` + `opacity-50` quando fora dos limites (min=0, max=20).
- Ordem de foco: botão − → output (não focável) → botão +.

### 9.3 Estado de sucesso — `PredictionSuccess`

```tsx
<div
  role="status"
  aria-live="polite"
  aria-label="Palpite salvo com sucesso"
>
  {/* conteúdo */}
</div>
```

- `role="status"` + `aria-live="polite"` garante que screen readers anunciem a transição
  para este estado sem agressividade (`assertive`).
- O container é o elemento raiz do componente — cobre todo o conteúdo da confirmação.

### 9.4 Estado de bloqueio

- Sem `aria-live` necessário — o estado é carregado direto (não é transição dinâmica).
- Título h1 "Palpite bloqueado" é o anúncio natural via foco de página.
- Ícone `Lock` decorativo: `aria-hidden="true"`.

### 9.5 Botão de submit

```tsx
<Button
  type="submit"
  disabled={mutation.isPending}
  aria-busy={mutation.isPending}
>
  {mutation.isPending ? "Salvando..." : "Salvar palpite"}
</Button>
```

- `aria-busy` comunica estado de carregamento ao screen reader.
- Texto muda para "Salvando..." durante `isPending` — feedback visual + screen reader.

### 9.6 Link "Voltar"

```tsx
<Link
  href={`/matches/${matchId}`}
  aria-label="Voltar para detalhes do jogo"
>
  <ArrowLeft aria-hidden="true" />
  <span>Voltar</span>
</Link>
```

- `aria-label` descritivo no `<Link>` — evita "Voltar" ambíguo para screen readers.

### 9.7 Touch targets

| Elemento | Dimensão mínima | Classe |
|---|---|---|
| Botões −/+ do stepper | 44×44px | `min-h-[44px] min-w-[44px]` |
| Botão submit principal | 44px altura | `min-h-[44px] w-full` |
| Botão "Voltar para Jogos" | 44px altura | `min-h-[44px] w-full` |
| Link "← Voltar" | 44px área de toque | `py-2 min-h-[44px] inline-flex items-center` |

### 9.8 Contraste

- Números do stepper: `text-foreground` sobre `bg-background` — ratio > 7:1 (AAA).
- Botão primário: `text-primary-foreground` sobre `bg-primary` — design system garante AA.
- Ícone sucesso: `text-green-600` (#16a34a) sobre `bg-green-500/10` (#f0fdf4) — ratio ≈ 4.5:1 (AA).
- Ícone bloqueado: `text-muted-foreground` — apenas decorativo (`aria-hidden`), contraste não obrigatório.
- Texto muted: `text-muted-foreground` sobre `bg-background` — design system garante ≥ AA.

### 9.9 Reduced motion

```tsx
// Nos botões com hover
className="... transition-colors duration-150 motion-reduce:transition-none"
```

---

## 10. UX — Fluxo e microinterações

### 10.1 Navegação entre estados

```
Carrega /matches/[id]/predict
  ├── loading   → skeleton (3 blocos animados)
  ├── error     → "Erro ao carregar" + botão "Tentar novamente"
  ├── 404       → "Jogo não encontrado" + link "Voltar para Jogos"
  ├── locked    → PredictionLockedState (sem ação)
  ├── form      → PredictionForm ativo
  │     └── submit OK → PredictionSuccess (transição in-page, sem router.push)
  │     └── submit erro → toast.error (Sonner, auto-tratado pelo hook)
  └── success   → PredictionSuccess
```

### 10.2 Pré-preenchimento (modo edit)

O `useEffect` popula os campos via `form.reset()` quando `existingPrediction` carrega.
Não há flash de "0 × 0" pois `usePredictions` carrega rápido (query já em cache se vier
do detalhe do jogo).

### 10.3 Feedback de submit

1. Botão muda para "Salvando..." + `disabled` + `aria-busy` (feedback imediato).
2. Em caso de erro: `toast.error` aparece no topo via Sonner.
3. Em caso de sucesso: `setFormState("success")` → renderiza `PredictionSuccess` in-page.
4. Toast de sucesso: **não exibido** — `PredictionSuccess` já é o feedback visual.

### 10.4 Decisão de design: sem modal/drawer

O formulário é uma rota dedicada full-screen, não um modal sobre o detalhe do jogo.
Razão: consistência com a navegação do app (cada tela tem URL própria); permite
compartilhar link; history.back() funciona naturalmente.

---

## 11. Skeleton de loading

Três blocos de placeholder com `animate-pulse motion-reduce:animate-none`:

```
┌──────────────────────┐
│ ██████████           │  ← breadcrumb/link (w-16 h-4)
│ ████████████████     │  ← h1 (w-48 h-6)
│ ┌──────────────────┐ │
│ │ ████ × ████      │ │  ← card time (h-20)
│ │ ████████████████ │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ [██] ██ [██] × [██] ██ [██] │ │  ← steppers (h-16)
│ └──────────────────┘ │
│ ████████████████████ │  ← botão (h-11 w-full)
└──────────────────────┘
```

```tsx
function PredictionFormSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando formulário de palpite"
      className="flex flex-col gap-4 px-4 py-4 max-w-2xl mx-auto">
      <div aria-hidden="true" className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div aria-hidden="true" className="h-6 w-48 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div aria-hidden="true" className="h-24 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
      <div aria-hidden="true" className="h-16 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
      <div aria-hidden="true" className="h-11 w-full rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  );
}
```

---

## 12. Tokens CSS — resumo de overrides desta página

Nenhum novo token CSS é necessário. Todos os tokens são do design system existente.
O token `--color-win` (verde sucesso) ainda não existe em `globals.css`; usar
`text-green-600 dark:text-green-400` (Tailwind nativo) até o token ser criado via PRD de rankings.

```css
/* Nenhum override em globals.css necessário para TASK-07. */
```

---

## 13. Checklist de implementação visual

- [ ] Botões −/+ com `min-h-[44px] min-w-[44px]` em todos os estados (create, edit).
- [ ] Número do stepper com `text-5xl font-bold text-foreground`.
- [ ] Número read-only (Bloqueado/Sucesso) com `text-4xl font-bold text-foreground`.
- [ ] Card de header do jogo com `rounded-xl border border-border bg-card shadow-sm p-4`.
- [ ] `pb-20` no container mobile (clearance BottomNav); `pb-4` no desktop (`md:pb-4`).
- [ ] `max-w-2xl mx-auto` no container principal.
- [ ] Ícone bloqueado: `Lock` size=32, `text-muted-foreground`, container `bg-muted rounded-full p-4`.
- [ ] Ícone sucesso: `CheckCircle2` size=48, `text-green-600 dark:text-green-400`, container `bg-green-500/10 rounded-full p-4`.
- [ ] Botão "Salvar palpite" / "Atualizar palpite": `variant="default"` w-full min-h-[44px].
- [ ] Botão "Voltar para Jogos" no estado Sucesso: `variant="default"` (primário).
- [ ] Botão/Link "Voltar para Jogos" no estado Bloqueado: `variant="outline"` (menor hierarquia).
- [ ] **Sem** texto de pontuação "3/1/0" ou qualquer variação — decisão A6 removida completamente.
- [ ] `role="status" aria-live="polite"` no container de `PredictionSuccess`.
- [ ] `role="group" aria-label` no wrapper do `ScoreInput`.
- [ ] `<output aria-live="polite">` para o valor do stepper.
- [ ] `aria-label` descritivo nos botões +/−.
- [ ] `aria-busy` no botão de submit durante `mutation.isPending`.
- [ ] `aria-hidden="true"` em todos os ícones decorativos Lucide.
- [ ] Sem estilos inline `style={{}}` — apenas classes Tailwind.
- [ ] Sem valores hexadecimais.
- [ ] `motion-reduce:animate-none` e `motion-reduce:transition-none` onde aplicável.
