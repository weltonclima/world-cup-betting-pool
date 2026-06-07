# Screen — Home Dashboard (TASK-06) · Contrato Visual Canônico

> Origem: `ai/spec/home-dashboard-task-06.md` + `ai/prd/home-dashboard.md` + `docs/prd-02/home.png` + `design-system/MASTER.md`
> Escopo: `/home` — layout completo, 8 cards, 3 estados, tokens semânticos
> Referenciado por: TASK-06 (HomeHeader), TASK-07 (Ranking/Acertos/Aproveitamento), TASK-08 (Próximo Jogo), TASK-09 (Últimos Resultados/Meu Desempenho/Fase Atual/Avisos), TASK-10 (page.tsx, orquestração)

---

## 0. Visão Geral da Página

A Home Dashboard é a **tela central do bolão** — primeiro conteúdo que o usuário vê após login aprovado. É lida dentro do shell existente (`AppShell`: Header fixo h-14 + BottomNav fixo h-16; `<main>` com `px-4 py-4 pb-20 pt-14`).

**Hierarquia visual da página (mobile, de cima a baixo):**

```
┌───────────────────────────────────┐  ← Header fixo (chrome, z-50, h-14)
│  Bolão dos Parças         [Admin] │
├───────────────────────────────────┤
│  pt-14                            │  ← <main> AppShell (px-4 py-4 pb-20)
│  ┌ HomeHeader ─────────────────┐  │
│  │ [AV]  Olá, {nome} 👋  [🔔] │  │  ← bloco 1 (mb-6)
│  │       Bem-vindo ao bolão    │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌ Fila 1: Métrica 3-col ──────┐  │  ← cards Ranking, Acertos, Aproveitamento
│  │ [Rank] [Acert] [Aprv]       │  │
│  └─────────────────────────────┘  │
│  ┌ Próximo Jogo ───────────────┐  │  ← card full-width
│  └─────────────────────────────┘  │
│  ┌ Fase Atual ─────────────────┐  │  ← card full-width
│  └─────────────────────────────┘  │
│  ┌ Últimos Resultados ─────────┐  │  ← card full-width (lista até 5 itens)
│  └─────────────────────────────┘  │
│  ┌ Meu Desempenho ─────────────┐  │  ← card full-width (4 sub-métricas)
│  └─────────────────────────────┘  │
│  ┌ Avisos ─────────────────────┐  │  ← card full-width (lista de alertas)
│  └─────────────────────────────┘  │
│                                   │
├───────────────────────────────────┤
│  BottomNav (fixed, h-16, z-50)    │
└───────────────────────────────────┘
```

---

## 1. Layout e Grid Responsivo

### 1.1 Container da página

Herdado do `AppShell` — não criar wrapper próprio:
```
<main className="pt-14 px-4 py-4 pb-20 max-w-4xl mx-auto">
```
> `pt-14` compensação do Header fixo; `pb-20` compensação do BottomNav; `px-4` padding horizontal uniforme.

### 1.2 Container dos cards

```tsx
<div className="flex flex-col gap-4">
  {/* HomeHeader (mb-6 próprio) */}
  <HomeHeader … />

  {/* Fila de métricas curtas */}
  <div className="grid grid-cols-3 gap-3">
    <RankingCard />
    <AcertosCard />
    <AproveitamentoCard />
  </div>

  {/* Cards de largura total */}
  <ProximoJogoCard />
  <FaseAtualCard />
  <UltimosResultadosCard />
  <MeuDesempenhoCard />
  <AvisosCard />
</div>
```

### 1.3 Breakpoints responsivos

| Breakpoint | Largura | Métricas 3-col | Cards restantes | Observação |
|---|---|---|---|---|
| Base (mobile) | 360–639px | `grid-cols-3 gap-3` | `col-span-3` (full) | Compacto — ver §3 por card |
| sm | 640–767px | `grid-cols-3 gap-3` | full | Igual mobile (BottomNav ainda presente) |
| md (tablet) | 768–1023px | `grid-cols-3 gap-4` | full (`max-w-4xl` ativa) | SideNav aparece; BottomNav some |
| lg (desktop) | 1024px+ | `grid-cols-3 gap-4` | Próximo Jogo + Fase Atual → `md:grid-cols-2` laterais (opcional v2) | MVP: todos full-width |

> **Decisão MVP:** todos os cards abaixo dos 3 de métrica são full-width em todos os breakpoints. A grade de 2 colunas para Próximo Jogo / Fase Atual é uma melhoria v2 — não implementar agora.

---

## 2. Tokens e Paleta Semântica

### 2.1 Tokens existentes (usar sem modificação)

| Token | Classe Tailwind | Uso na Home |
|---|---|---|
| `--background` | `bg-background` | Fundo de página |
| `--card` | `bg-card` | Fundo de todos os cards |
| `--card-foreground` | `text-card-foreground` | Texto dentro dos cards |
| `--foreground` | `text-foreground` | Títulos, texto primário |
| `--muted-foreground` | `text-muted-foreground` | Labels, metadados, subtítulos |
| `--muted` | `bg-muted` | Fundo de skeletons e badges secundários |
| `--border` | `border-border` | Bordas de card e divisores de lista |
| `--primary` | `bg-primary` / `text-primary` | CTA buttons (Ver Jogo, Enviar, Editar) |
| `--primary-foreground` | `text-primary-foreground` | Texto em botões primary |
| `--destructive` | `text-destructive` / `bg-destructive/10` | Badge erro/errou; avisos críticos |
| `--secondary` | `bg-secondary` | Fundo de badges neutros |
| `--secondary-foreground` | `text-secondary-foreground` | Texto em badges neutros |

### 2.2 Novos tokens semânticos — adicionar em `globals.css`

Estes tokens **não existem ainda** e devem ser adicionados por TASK-06 (quando a task implementar `HomeHeader`) ou TASK-07 (quando o primeiro card que os usa for implementado). Adicionar nos blocos `:root` e `.dark`:

```css
/* :root */
--color-win: oklch(0.52 0.16 145);        /* verde escuro — acerto (AA sobre branco) */
--color-win-bg: oklch(0.95 0.05 145);     /* verde muito claro — fundo de badge acerto */
--color-loss: oklch(0.577 0.245 27.325);  /* vermelho — erro (reusa --destructive) */
--color-loss-bg: oklch(0.97 0.04 27);     /* vermelho muito claro — fundo de badge erro */

/* .dark */
--color-win: oklch(0.72 0.18 145);        /* verde mais vivo no dark */
--color-win-bg: oklch(0.25 0.06 145);     /* verde muito escuro no dark */
--color-loss: oklch(0.704 0.191 22.216);  /* reusa --destructive do dark */
--color-loss-bg: oklch(0.25 0.07 27);     /* vermelho muito escuro no dark */
```

**Mapeamento Tailwind** (via `@theme inline` em `globals.css`):

```css
@theme inline {
  --color-win: var(--color-win);
  --color-win-bg: var(--color-win-bg);
  --color-loss: var(--color-loss);
  --color-loss-bg: var(--color-loss-bg);
}
```

Uso nas classes:
- `text-win` → acerto/vitória
- `bg-win-bg` → fundo de badge "Acertou"
- `text-loss` → erro/derrota (ou `text-destructive` — são equivalentes no light)
- `bg-loss-bg` → fundo de badge "Errou"

**Contraste AA:** `--color-win` (oklch 0.52 hue 145) sobre branco: ratio ≈ 4.8:1 (passa AA normal). `text-destructive` (oklch 0.577 hue 27) sobre branco: ratio ≈ 4.6:1 (passa AA).

> Alternativa sem novos tokens: `text-emerald-700 bg-emerald-50` para win e `text-destructive bg-destructive/10` para loss. Esta alternativa é permitida somente se a adição de tokens ao globals.css for inviável — preferir os tokens semânticos acima.

### 2.3 Proibições absolutas

- Sem `text-green-*`, `text-red-*` literais — usar tokens semânticos win/loss.
- Sem valores hex literais.
- Sem `style={{}}`.
- Sem `bg-[oklch(...)]` arbitrário inline.

---

## 3. Especificação Visual por Card

### Card Shell (padrão para todos os cards)

```tsx
<div className="rounded-lg border border-border bg-card p-4 shadow-sm">
  {/* conteúdo do card */}
</div>
```

- `rounded-lg` = `--radius-lg` (≈10px) — padrão do design system §5
- `border border-border` — divisão sutil
- `bg-card` — superfície branca (light) / cinza escuro (dark)
- `p-4` — padding interno 16px (§4.2)
- `shadow-sm` — elevação 1 (§6) — sutil, não agressivo

---

### 3.1 Card Ranking Geral (métrica compacta)

**Tamanho:** 1/3 da grade (`col-span-1`)
**Dados:** posição do usuário, total de participantes

```
┌──────────────┐
│  🏆          │  ← ícone Trophy, size=20, text-primary
│  #4          │  ← número grande
│  de 28       │  ← denominador
│  Ranking     │  ← label
└──────────────┘
```

| Elemento | Classes Tailwind |
|---|---|
| Card shell | `rounded-lg border border-border bg-card p-3 shadow-sm flex flex-col gap-1` |
| Ícone `Trophy` | `size={20} text-primary mb-1` |
| Número/posição | `text-2xl font-bold text-foreground` (`#4`) |
| Denominador | `text-xs text-muted-foreground` (`de 28`) |
| Label | `text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto` |

> Padding `p-3` (12px) nos cards de métrica — menor que o padrão p-4, pois o espaço é limitado em mobile 1/3 de largura.

**Estado loading:** skeleton — ver §5.1
**Estado empty:** posição `--` de `--`
**Ícone:** `Trophy` de `lucide-react`

---

### 3.2 Card Acertos (métrica compacta)

**Tamanho:** 1/3 da grade

```
┌──────────────┐
│  ✓           │  ← ícone CheckCircle2, size=20, text-win
│  12          │  ← número grande
│  acertos     │  ← label
└──────────────┘
```

| Elemento | Classes Tailwind |
|---|---|
| Ícone `CheckCircle2` | `size={20} text-win mb-1` |
| Número | `text-2xl font-bold text-foreground` |
| Label | `text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto` |

**Ícone:** `CheckCircle2` de `lucide-react`

---

### 3.3 Card Aproveitamento (métrica compacta)

**Tamanho:** 1/3 da grade

```
┌──────────────┐
│  📊          │  ← ícone BarChart3, size=20, text-primary
│  25%         │  ← percentual grande
│  acertos     │  ← label (sem fração — A3 simplificada)
└──────────────┘
```

| Elemento | Classes Tailwind |
|---|---|
| Ícone `BarChart3` | `size={20} text-primary mb-1` |
| Percentual | `text-2xl font-bold text-foreground` |
| Label | `text-xs font-medium text-muted-foreground uppercase tracking-wide mt-auto` |

> A3 do PRD: exibir `statistics.accuracy` formatado como `Math.round(accuracy) + "%"`. Sem fração de jogos no card compacto (espaço insuficiente) — a fração vai no Card Meu Desempenho.

**Ícone:** `BarChart3` de `lucide-react`

---

### 3.4 Card Próximo Jogo (full-width)

**Dados:** seleções (nome + bandeira), data/hora, status do palpite, CTA

```
┌────────────────────────────────────────┐
│  Próximo Jogo                 [badge]  │  ← título + badge status palpite
│                                        │
│  🇧🇷 Brasil    VS    França 🇫🇷         │  ← seleções com bandeira
│                                        │
│  Sáb, 14 Jun · 15:00                  │  ← data/hora formatada
│                                        │
│  [     Ver Jogo / Enviar / Editar    ] │  ← CTA button
└────────────────────────────────────────┘
```

| Elemento | Classes Tailwind |
|---|---|
| Título | `text-sm font-semibold text-foreground` |
| Badge status palpite | ver §3.4.1 |
| Bandeiras | `<img>` com `size-8 rounded-sm object-contain` (ou emoji fallback) |
| Nome das seleções | `text-sm font-medium text-foreground` |
| "VS" separador | `text-xs font-bold text-muted-foreground` |
| Layout seleções | `flex items-center justify-center gap-4 py-3` |
| Data/hora | `text-sm text-muted-foreground text-center` |
| CTA button | `Button` Shadcn `variant="default" size="sm" w-full mt-2` |

#### 3.4.1 Badge de status do palpite

| Estado | Texto | Variante Badge | Classes extras |
|---|---|---|---|
| Sem palpite | `Sem palpite` | `secondary` | `text-muted-foreground` |
| Com palpite | `Palpite enviado` | `outline` | `text-foreground border-win text-win` |
| Bloqueado | `Encerrado` | `destructive` | — |

> A variante `outline` com `border-win text-win` é um override inline via `className` no `<Badge>` — sem criar variante nova.

#### 3.4.2 Texto do CTA por estado

| Condição | Texto do botão | Ação |
|---|---|---|
| Sem palpite + palpites abertos | `Enviar Palpite` | navegar para `/predictions` (placeholder) |
| Com palpite + palpites abertos | `Editar Palpite` | navegar para `/predictions` (placeholder) |
| Palpites bloqueados (`predictionsLocked: true`) | `Ver Jogo` | navegar para `/matches` (placeholder) |

#### 3.4.3 Estado empty (sem jogo futuro)

```
┌────────────────────────────────────────┐
│  Próximo Jogo                          │
│                                        │
│  [Calendar icon, size=24, muted]       │
│  Nenhum jogo agendado                  │
│  Os jogos aparecem quando disponíveis  │
└────────────────────────────────────────┘
```
Texto: `text-sm text-muted-foreground text-center py-4`
Ícone: `Calendar size={24} className="mx-auto mb-2 text-muted-foreground"`

---

### 3.5 Card Fase Atual (full-width)

**Dados:** `system_settings.currentStage` → texto da fase; `round`/`matchday` se disponível

```
┌────────────────────────────────────────┐
│  ⚽ Fase Atual                          │
│                                        │
│  Fase de Grupos                        │  ← nome da fase (Heading 2)
│  Rodada 2 de 3                         │  ← quando disponível (Body)
└────────────────────────────────────────┘
```

| Elemento | Classes Tailwind |
|---|---|
| Ícone `Swords` (ou `Flag`) + título | `flex items-center gap-2 text-sm font-semibold text-foreground mb-3` |
| Nome da fase | `text-xl font-semibold text-foreground` |
| "Rodada X de Y" | `text-sm text-muted-foreground mt-1` (omitir se não disponível — R4) |

**Mapeamento de stage para texto legível:**

| `stage` | Texto exibido |
|---|---|
| `grupos` | `Fase de Grupos` |
| `oitavas` | `Oitavas de Final` |
| `quartas` | `Quartas de Final` |
| `semifinal` | `Semifinal` |
| `terceiro` | `Disputa do 3º Lugar` |
| `final` | `Final` |

**Ícone:** `Flag` de `lucide-react`, `size={16}`, `text-primary`

---

### 3.6 Card Últimos Resultados (full-width, lista)

**Dados:** até 5 `matches` com `status:"finished"`, placar final, resultado do palpite do usuário

```
┌────────────────────────────────────────┐
│  Últimos Resultados                    │
├────────────────────────────────────────┤
│  🇧🇷 Brasil 2 – 1 França 🇫🇷  [Acertou]│  ← item de resultado
│  🇩🇪 Alemanha 0 – 0 Japão 🇯🇵  [Errou] │
│  ...                                   │
└────────────────────────────────────────┘
```

#### Estrutura de cada item da lista

```tsx
<li className="flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-b-0">
  {/* Seleções + placar */}
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <span className="text-xs font-medium text-foreground truncate">
      {homeTeam.name}
    </span>
    <span className="text-sm font-bold text-foreground shrink-0">
      {homeScore} – {awayScore}
    </span>
    <span className="text-xs font-medium text-foreground truncate">
      {awayTeam.name}
    </span>
  </div>
  {/* Badge resultado */}
  <ResultBadge isCorrect={isCorrect} userPredicted={userPredicted} />
</li>
```

#### ResultBadge — especificação

| Condição | Texto | Fundo | Texto-cor | Exemplo de classes |
|---|---|---|---|---|
| `isCorrect: true` | `Acertou` | `bg-win-bg` | `text-win` | `bg-win-bg text-win text-xs font-medium px-2 py-0.5 rounded-sm` |
| `isCorrect: false` + usuário palpitou | `Errou` | `bg-loss-bg` | `text-loss` | `bg-loss-bg text-loss text-xs font-medium px-2 py-0.5 rounded-sm` |
| Usuário não palpitou | `Sem palpite` | `bg-muted` | `text-muted-foreground` | `bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-sm` |

> O `ResultBadge` é um componente interno do card — não usar o `<Badge>` Shadcn aqui (não tem variante win/loss). Usar um `<span>` com classes diretas.

#### Estado empty (sem resultados finalizados)

```
Ícone: CheckCircle2 size={24} text-muted-foreground mx-auto mb-2
Texto: "Nenhum resultado disponível" text-sm text-muted-foreground text-center py-4
```

---

### 3.7 Card Meu Desempenho (full-width, 4 sub-métricas)

**Dados:** `statistics/{uid}` — `totalCorrect`, `accuracy`, `longestStreak`, derivados via D1

```
┌────────────────────────────────────────┐
│  Meu Desempenho                        │
│                                        │
│  ┌──────────┐  ┌──────────┐            │
│  │  12      │  │  25%     │            │
│  │  Acertos │  │  Aprova. │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │  3       │  │  48      │            │
│  │  Sequên. │  │  Palpites│            │  ← derivado de accuracy (D1)
│  └──────────┘  └──────────┘            │
└────────────────────────────────────────┘
```

Layout interno:
```tsx
<div className="grid grid-cols-2 gap-3 mt-3">
  <SubMetrica value="12"  label="Acertos" />
  <SubMetrica value="25%" label="Aproveitamento" />
  <SubMetrica value="3"   label="Maior sequência" />
  <SubMetrica value="48"  label="Palpites" />
</div>
```

#### SubMetrica (componente interno)

```tsx
<div className="flex flex-col">
  <span className="text-2xl font-bold text-foreground">{value}</span>
  <span className="text-xs text-muted-foreground">{label}</span>
</div>
```

> Sem card shell interno (sem border/bg extras) — o card pai já dá o contexto. As 4 sub-métricas ficam sobre o fundo `bg-card`.

**Dados derivados (D1):**
- "Palpites" = se `accuracy > 0`: `Math.round(totalCorrect / (accuracy / 100))`. Se `accuracy === 0`: mostrar `0`.
- "Maior sequência" = `statistics.longestStreak`.

---

### 3.8 Card Avisos (full-width)

**Dados:** derivados de `system_settings` (flags) — R6, sem coleção de avisos estruturada

```
┌────────────────────────────────────────┐
│  🔔 Avisos                             │
├────────────────────────────────────────┤
│  ⚠  Palpites encerrados                │  ← se predictionsLocked: true
│  ℹ  Cadastro aberto                    │  ← se registrationOpen: true (admin)
│  ─ nenhum aviso ativo ─               │  ← estado empty
└────────────────────────────────────────┘
```

#### AvisoItem — estrutura

```tsx
<div className="flex items-start gap-2 py-2 border-b border-border last:border-b-0">
  <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
  <span className="text-sm text-foreground">{mensagem}</span>
</div>
```

**Mapeamento de flags → avisos:**

| Flag | Condição | Texto | Ícone |
|---|---|---|---|
| `predictionsLocked: true` | sempre | `Palpites encerrados. Resultados em breve.` | `Lock` `text-destructive` |
| `registrationOpen: false` | apenas admin | `Cadastro encerrado.` | `UserX` `text-muted-foreground` |

**Estado empty (sem avisos ativos):**
```
<p className="text-sm text-muted-foreground text-center py-3">Nenhum aviso no momento</p>
```

**Ícone do título:** `Bell size={16} text-primary` (diferente do sino do HomeHeader — é decorativo no título do card)

---

## 4. HomeHeader — Especificação em Contexto

O `HomeHeader` é especificado detalhadamente em `ai/spec/home-dashboard-task-06.md`. Este documento adiciona apenas o **contexto visual dentro da página**:

### 4.1 Posição e espaçamento

- Renderizado como **primeiro filho** do `<div className="flex flex-col gap-4">` da página.
- Contém `className="mb-6"` no `<section>` próprio — cria 24px de separação antes da grade de métricas (maior que o `gap-4` = 16px dos cards, criando hierarquia visual).
- O `gap-4` do flex-col dos cards NÃO adiciona espaço antes do HomeHeader (ele é o primeiro item).

### 4.2 Visual resumido

| Elemento | Especificação |
|---|---|
| Avatar | `size-12` (48×48px) · `rounded-full` · cor determinística por uid |
| Saudação | `text-lg font-semibold text-foreground` · `truncate` |
| Subtítulo | `text-sm text-muted-foreground` (`Bem-vindo ao bolão`) |
| Sino | `<button disabled>` · `size-11` (44px) · `rounded-full` · `text-muted-foreground opacity-50` |

### 4.3 Integração com página — estado de loading

Quando a página está em loading inicial (`isLoading`), TASK-10 envolve o HomeHeader em um skeleton de seção:

```tsx
{isLoading ? (
  <div className="mb-6 flex items-center gap-3" aria-hidden="true">
    <div className="size-12 rounded-full bg-muted animate-pulse motion-reduce:animate-none shrink-0" />
    <div className="flex flex-col gap-2 flex-1">
      <div className="h-5 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  </div>
) : (
  <HomeHeader name={profile?.name ?? null} uid={firebaseUser?.uid ?? null} />
)}
```

---

## 5. Estados de Tela

### 5.1 Loading — Skeletons por Card

Todos os skeletons usam `animate-pulse motion-reduce:animate-none` e `bg-muted`.

#### Skeleton: cards de métrica compacta (Ranking, Acertos, Aproveitamento)

```tsx
<div className="grid grid-cols-3 gap-3" aria-hidden="true">
  {[0, 1, 2].map((i) => (
    <div key={i} className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
      <div className="size-5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-7 w-3/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-3 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  ))}
</div>
```

#### Skeleton: Próximo Jogo

```tsx
<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3" aria-hidden="true">
  <div className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
  <div className="flex items-center justify-center gap-4 py-2">
    <div className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    <div className="h-5 w-8 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    <div className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none" />
  </div>
  <div className="h-4 w-1/2 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
  <div className="h-9 w-full rounded-md bg-muted animate-pulse motion-reduce:animate-none" />
</div>
```

#### Skeleton: Últimos Resultados (lista de 5)

```tsx
<div className="rounded-lg border border-border bg-card p-4" aria-hidden="true">
  <div className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3" />
  {[0,1,2,3,4].map((i) => (
    <div key={i} className="flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-b-0">
      <div className="h-3 flex-1 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-5 w-14 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  ))}
</div>
```

#### Skeleton: Meu Desempenho

```tsx
<div className="rounded-lg border border-border bg-card p-4" aria-hidden="true">
  <div className="h-4 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3" />
  <div className="grid grid-cols-2 gap-3 mt-3">
    {[0,1,2,3].map((i) => (
      <div key={i} className="flex flex-col gap-1">
        <div className="h-8 w-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
    ))}
  </div>
</div>
```

#### Skeleton: Fase Atual e Avisos (genérico simples)

```tsx
<div className="rounded-lg border border-border bg-card p-4" aria-hidden="true">
  <div className="h-4 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3" />
  <div className="h-6 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
</div>
```

#### Orquestração dos skeletons (TASK-10)

O loading é **por card independente** (cada query tem seu próprio estado). TASK-10 renderiza cada skeleton enquanto a respectiva query está em `isLoading`. Não há um spinner global de página (exceto se todas as queries falharem simultaneamente).

```tsx
// Pseudocódigo de orquestração em home/page.tsx
<div className="flex flex-col gap-4">
  {/* HomeHeader skeleton ou componente real */}
  {isProfileLoading ? <HomeHeaderSkeleton /> : <HomeHeader … />}

  {/* Métrica 3-col */}
  <div className="grid grid-cols-3 gap-3">
    {isRankingLoading ? <MetricCardSkeleton /> : <RankingCard … />}
    {isStatsLoading ? <MetricCardSkeleton /> : <AcertosCard … />}
    {isStatsLoading ? <MetricCardSkeleton /> : <AproveitamentoCard … />}
  </div>

  {isMatchesLoading ? <ProximoJogoSkeleton /> : <ProximoJogoCard … />}
  {isSystemLoading ? <FaseAtualSkeleton /> : <FaseAtualCard … />}
  {isResultsLoading ? <UltimosResultadosSkeleton /> : <UltimosResultadosCard … />}
  {isStatsLoading ? <MeuDesempenhoSkeleton /> : <MeuDesempenhoCard … />}
  {isSystemLoading ? <AvisosSkeleton /> : <AvisosCard … />}
</div>
```

---

### 5.2 Empty — Estado sem dados

Cada card tem seu próprio empty state. Padrão:

```tsx
<div className="rounded-lg border border-border bg-card p-4">
  <h2 className="text-sm font-semibold text-foreground mb-3">{título}</h2>
  <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
    <{IconeRelevante} size={24} aria-hidden="true" />
    <p className="text-sm text-center">{mensagem empty}</p>
  </div>
</div>
```

| Card | Ícone | Mensagem |
|---|---|---|
| Ranking | `Trophy` | `Ranking ainda não disponível` |
| Acertos | `CheckCircle2` | `Nenhum acerto registrado` |
| Aproveitamento | `BarChart3` | `Sem dados de aproveitamento` |
| Próximo Jogo | `Calendar` | `Nenhum jogo agendado` |
| Fase Atual | `Flag` | `Fase não definida` |
| Últimos Resultados | `CheckCircle2` | `Nenhum resultado disponível` |
| Meu Desempenho | `Activity` | `Sem dados de desempenho` |
| Avisos | — | texto inline `Nenhum aviso no momento` |

---

### 5.3 Error — Estado de erro com retry

Padrão de erro reutilizável por card:

```tsx
<div className="rounded-lg border border-destructive/30 bg-card p-4">
  <div className="flex flex-col items-center gap-3 py-4">
    <AlertCircle size={24} className="text-destructive" aria-hidden="true" />
    <p className="text-sm text-muted-foreground text-center">
      Não foi possível carregar os dados.
    </p>
    <Button
      variant="outline"
      size="sm"
      onClick={onRetry}
      className="min-h-[44px]"
    >
      Tentar novamente
    </Button>
  </div>
</div>
```

- `border-destructive/30` — borda sutil vermelha para indicar erro, sem ser agressivo.
- `onRetry` = `refetch` da respectiva query TanStack Query.
- `aria-live="polite"` no container do card quando em estado de erro para anunciar ao leitor de tela.
- Botão `min-h-[44px]` — toque mínimo WCAG 2.5.5.
- **Ícone:** `AlertCircle` de `lucide-react`.

---

## 6. Tipografia por Bloco

Resumo da aplicação da escala tipográfica do MASTER.md §3.2:

| Contexto | Tamanho | Peso | Classes |
|---|---|---|---|
| Título de card | Body | Medium | `text-sm font-semibold text-foreground` |
| Número grande (métricas) | Heading 1 | Bold | `text-2xl font-bold text-foreground` |
| Denominador de métrica | Body Small | Normal | `text-xs text-muted-foreground` |
| Label de métrica | Label | Medium | `text-xs font-medium text-muted-foreground uppercase tracking-wide` |
| Nome de seleção | Body | Medium | `text-sm font-medium text-foreground` |
| Placar `X – Y` | Body | Bold | `text-sm font-bold text-foreground` |
| Data/hora | Body | Normal | `text-sm text-muted-foreground` |
| Fase atual (destaque) | Heading 2 | Semibold | `text-xl font-semibold text-foreground` |
| Rodada X de Y | Body | Normal | `text-sm text-muted-foreground` |
| Sub-métrica valor | Heading 1 | Bold | `text-2xl font-bold text-foreground` |
| Sub-métrica label | Body Small | Normal | `text-xs text-muted-foreground` |
| Texto de aviso | Body | Normal | `text-sm text-foreground` |
| Texto de empty/error | Body | Normal | `text-sm text-muted-foreground text-center` |

---

## 7. Acessibilidade

### 7.1 Estrutura semântica

| Elemento | ARIA / HTML |
|---|---|
| HomeHeader | `<section aria-label="Boas-vindas">` |
| Cards de métrica | `<article aria-label="Ranking Geral">` (e variações por card) |
| Próximo Jogo | `<article aria-label="Próximo Jogo">` |
| Lista de resultados | `<ul aria-label="Últimos Resultados">` com `<li>` por item |
| Meu Desempenho | `<article aria-label="Meu Desempenho">` |
| Avisos | `<section aria-label="Avisos do sistema">` |
| Skeletons ativos | `role="status" aria-busy="true" aria-label="Carregando {nome do card}"` |
| Cards em erro | `aria-live="polite"` no container |
| Ícones decorativos | `aria-hidden="true"` |
| Botão sino | `aria-label="Notificações (em breve)" aria-disabled="true" disabled` |

### 7.2 Áreas de toque

| Elemento | Tamanho mínimo |
|---|---|
| Botão sino | `size-11` = 44×44px |
| CTA "Enviar/Editar/Ver Jogo" | `Button size="sm"` → `min-h-[44px]` via override |
| Botão "Tentar novamente" | `min-h-[44px]` |
| Itens de `BottomNav` (existente) | `min-h-[44px]` (já implementado) |

### 7.3 Contraste

| Combinação | Ratio estimado | Status |
|---|---|---|
| `text-foreground` sobre `bg-card` (oklch 0.145 / 1) | ~19:1 | Passa AAA |
| `text-muted-foreground` sobre `bg-card` (oklch 0.556 / 1) | ~5.7:1 | Passa AA |
| `text-win` (oklch 0.52 h145) sobre `bg-win-bg` (oklch 0.95) | ~5.1:1 | Passa AA |
| `text-loss` / `text-destructive` (oklch 0.577 h27) sobre branco | ~4.6:1 | Passa AA |
| `text-primary-foreground` sobre `bg-primary` (oklch 0.985 / 0.205) | ~17:1 | Passa AAA |

### 7.4 Reduced motion

```
animate-pulse motion-reduce:animate-none
```
Aplicado em todos os skeletons (padrão já usado em `UserListSkeleton`).

---

## 8. Breakpoints Específicos por Dispositivo

| Dispositivo | Largura | Ajustes |
|---|---|---|
| iPhone SE / small | 360px | `grid-cols-3` permanece; cards métrica com `p-3` e `text-2xl` — confirmar não truncar `#4`/`25%` |
| iPhone 14 | 390px | Confortável — layout padrão |
| iPhone 14 Pro Max | 430px | Idem |
| iPad Mini (portrait) | 768px | `md:` ativa — SideNav aparece; `max-w-4xl mx-auto` centraliza; `gap-4` |
| iPad / laptop | 1024px+ | `lg:` ativa; conteúdo centralizado em 896px (`max-w-4xl`) |

> Em 360px, `p-3` nos cards de métrica resulta em ~(360 - 32px padding de página - 2×12px padding interno - 2×gap) / 3 ≈ 88px por coluna. `text-2xl` (24px) para `#4` cabe; `25%` cabe; `Aprova.` pode precisar de `truncate` no label.

---

## 9. Ícones por Card — Referência Rápida

| Card | Ícone título | Ícone empty | Import |
|---|---|---|---|
| Ranking | `Trophy` | `Trophy` | `lucide-react` |
| Acertos | `CheckCircle2` | `CheckCircle2` | `lucide-react` |
| Aproveitamento | `BarChart3` | `BarChart3` | `lucide-react` |
| Próximo Jogo | — | `Calendar` | `lucide-react` |
| Fase Atual | `Flag` | `Flag` | `lucide-react` |
| Últimos Resultados | — | `CheckCircle2` | `lucide-react` |
| Meu Desempenho | — | `Activity` | `lucide-react` |
| Avisos | `Bell` | — (inline text) | `lucide-react` |
| Error (todos) | — | `AlertCircle` | `lucide-react` |

Todos: `size={16}` no título do card; `size={20}` nas métricas compactas (espaço limitado); `size={24}` nos estados empty/error.

---

## 10. Tokens a Adicionar em `globals.css` — Sumário

Adicionar nas seções `:root`, `.dark` e `@theme inline`:

```css
/* ── :root ─────────────────────────── */
--color-win: oklch(0.52 0.16 145);
--color-win-bg: oklch(0.95 0.05 145);
--color-loss: oklch(0.577 0.245 27.325);   /* igual a --destructive */
--color-loss-bg: oklch(0.97 0.04 27);

/* ── .dark ──────────────────────────── */
--color-win: oklch(0.72 0.18 145);
--color-win-bg: oklch(0.25 0.06 145);
--color-loss: oklch(0.704 0.191 22.216);   /* igual a --destructive dark */
--color-loss-bg: oklch(0.25 0.07 27);

/* ── @theme inline ──────────────────── */
--color-win: var(--color-win);
--color-win-bg: var(--color-win-bg);
--color-loss: var(--color-loss);
--color-loss-bg: var(--color-loss-bg);
```

> Responsabilidade de adicionar: a task que primeiro usar `text-win`/`bg-win-bg` (provavelmente TASK-07). Se TASK-06 (HomeHeader) não usa estes tokens, pode adiar a adição para TASK-07.

---

## 11. Decisões de Design e Justificativas

| Decisão | Justificativa |
|---|---|
| Cards de métrica com `p-3` (não `p-4`) | Espaço horizontal limitado em 1/3 de largura mobile (360px) |
| Grade de métricas `grid-cols-3` em todos os breakpoints | Mockup `home.png` mostra 3 colunas mesmo em mobile; dados são comparáveis lado a lado |
| Todos os outros cards full-width no MVP | Simplifica implementação; grid de 2 colunas é v2 |
| `mb-6` no HomeHeader (vs `gap-4` dos cards) | Separação visual maior entre saudação e conteúdo de dados |
| Números de métrica em `text-2xl font-bold` | Visibilidade rápida — leitura esportiva; maior que body mas menor que display |
| Fase Atual com `text-xl font-semibold` | Destaque dentro do card sem competir com métricas numéricas |
| ResultBadge como `<span>` manual (não `<Badge>`) | Badge Shadcn não tem variante win/loss; criar variante quebraria o padrão |
| Borda `border-destructive/30` em card de erro | Sinaliza problema sem alarme excessivo |
| Skeletons por card independente (não spinner global) | Queries independentes — cards com dados mostram logo; degradação parcial é melhor UX |
| `--color-win` ≠ verde da auth (`oklch(0.46 0.16 150)`) | Auth usa verde médio-escuro para contraste sobre branco em CTA; win usa verde diferente de peso para funcionar sobre `bg-win-bg` claro |

---

*Este documento é o contrato visual canônico da Home Dashboard. TASK-07, TASK-08, TASK-09 e TASK-10 devem referenciar este arquivo antes de implementar. Atualizações de design que afetem múltiplos cards devem ser feitas aqui primeiro.*
