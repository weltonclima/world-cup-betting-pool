# SCREEN SPEC — TASK-08: Tela Lista de Palpites (`/predictions`)

> PRD: `ai/prd/palpites.md` | Spec: `ai/spec/palpites-task-08.md`
> Design system: `design-system/MASTER.md`
> Imagem de referência: `docs/prd-04/PRD04-01-Lista-Palpites.png`
> Aplicar: ui-ux-pro-max (ux, layout, color, a11y)

---

## 1. Análise da imagem de referência (PRD04-01-Lista-Palpites.png)

A imagem mostra:

- **Header da tela:** "Meus Palpites" (texto grande, topo).
- **Linha de chips de filtro:** horizontal scrollável com chips "Todos · Pendentes · Acertos · Erros · Bloqueados". Chip "Todos" ativo com fundo escuro; demais inativos com fundo claro.
- **Seção "Próximos Jogos":** label de seção antes dos cards.
- **Cards de palpite:**
  - Bandeiras dos times lado a lado com nomes abaixo.
  - Placar palpitado no centro em destaque: `"2 x 1"` (fonte grande).
  - Data, hora e nomes abreviados dos times.
  - Badge colorido de status (ex.: "Pendente" em âmbar, "Acertou" em verde, "Errou" em vermelho/rosa, "Bloqueado" em cinza).
- **Bottom nav:** 5 abas — Início · Jogos · Palpites · Ranking · Perfil. Aba "Palpites" ativa (ícone + label em destaque, cor primária).
- **Cores dos badges:** verde (acertou), vermelho (errou), âmbar/amarelo (pendente), cinza (bloqueado) — alinhado com os tokens `win/loss/amber/gray` já definidos.

---

## 2. Layout Geral

### Estrutura de página (mobile-first)

```
┌──────────────────────────────────────┐
│  [Header fixo — "Bolão dos Parças"]  │  h-14, z-50
├──────────────────────────────────────┤
│  H1: "Meus Palpites"                 │  text-2xl font-semibold pt-4
│                                      │
│  ── Chips de filtro ──────────────── │  overflow-x-auto, gap-2, py-2
│  [Todos] [Pendentes] [Acertos]       │
│  [Erros] [Bloqueados]                │
│                                      │
│  Lista de cards (flex-col gap-4)     │
│  ┌──────────────────────────────┐    │
│  │ PredictionListCard            │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ PredictionListCard            │    │
│  └──────────────────────────────┘    │
│  ...                                 │
├──────────────────────────────────────┤
│  [BottomNav: Início·Jogos·Palpites·  │  h-16, fixed bottom
│   Ranking·Perfil]                    │
└──────────────────────────────────────┘
```

**Desktop (md+):**
- SideNav colapsado à esquerda (w-16).
- Conteúdo: `max-w-4xl mx-auto`, padding `px-4 py-4 pb-4`.
- BottomNav oculta; SideNav visível.

---

## 3. Área de Header da Página

```
H1: "Meus Palpites"
Classes: text-2xl font-semibold text-foreground
Margin: mb-0 (gap-4 do container pai gerencia o espaçamento)
```

Sem subtítulo. Sem breadcrumb (rota de primeiro nível).

---

## 4. Chips de Filtro (`PredictionFilters`)

### Layout

```
<div role="group" aria-label="Filtrar palpites">
  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
    [chip] [chip] [chip] [chip] [chip]
  </div>
</div>
```

- `overflow-x-auto` com `scrollbar-none` (ou `scrollbar-hide` Tailwind) — chips não quebram linha em mobile.
- `pb-1` para não clipar o foco ring dos chips ao rolar.

### Visual dos chips

| Estado | Classes |
|---|---|
| **Inativo** | `bg-secondary text-secondary-foreground rounded-full px-3 py-1.5 text-xs font-medium border border-transparent` |
| **Ativo** | `bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-semibold` |
| **Hover (inativo)** | `hover:bg-accent hover:text-accent-foreground` |
| **Focus ring** | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |

- Transição: `transition-colors duration-150 motion-reduce:transition-none`.
- Toque mínimo: `min-h-[44px]` (WCAG 2.5.5) — combinar `py-1.5` com padding vertical extra ou usar `min-h-[44px]` explícito.

### Labels dos chips

| Chip | Label | `aria-pressed` quando ativo |
|---|---|---|
| `todos` | "Todos" | `true` |
| `pendente` | "Pendentes" | `true` |
| `acertou` | "Acertos" | `true` |
| `errou` | "Erros" | `true` |
| `bloqueado` | "Bloqueados" | `true` |

### Acessibilidade

```tsx
<button
  type="button"
  role="button"
  aria-pressed={isActive}
  className={cn(chipClasses, isActive ? activeClasses : inactiveClasses)}
  onClick={() => onChange(chip.value)}
>
  {chip.label}
</button>
```

- `role="group"` no wrapper `<div>` com `aria-label="Filtrar palpites"`.
- `aria-pressed` em cada botão (toggle semântico).
- `tabIndex` natural (0 para todos) — navegação linear por Tab.

---

## 5. Card de Palpite (`PredictionListCard`)

### Dimensões e estrutura

```
┌──────────────────────────────────────────────────────┐
│  [🏴 Bandeira]  Brasil         France  [🏴 Bandeira]  │  ← times (flex entre si)
│  (nome abaixo)              2  ×  1   (nome abaixo)  │  ← placar no centro
│                                                      │
│  15/06/2026 · 16:00                                  │  ← data/hora centralizada
│ ─────────────────────────────────────────────────── │
│  Meu palpite: 2 × 1                   [Pendente ▲]  │  ← rodapé
└──────────────────────────────────────────────────────┘
```

### Classes do card container

```
rounded-xl border border-border bg-card shadow-sm p-4
flex flex-col gap-3
```

### Bloco de times e placar

```tsx
<div className="flex items-center justify-between gap-2">
  {/* Time mandante */}
  <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
    <TeamFlag team={item.homeTeam} />
    <span className="w-full truncate text-center text-xs font-medium text-foreground">
      {item.homeTeam.name}
    </span>
  </div>

  {/* Placar palpitado */}
  <div className="flex items-center gap-1.5 shrink-0">
    <span className="text-2xl font-bold text-foreground">{item.prediction.homeScore}</span>
    <span className="text-lg font-bold text-muted-foreground">×</span>
    <span className="text-2xl font-bold text-foreground">{item.prediction.awayScore}</span>
  </div>

  {/* Time visitante */}
  <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
    <TeamFlag team={item.awayTeam} />
    <span className="w-full truncate text-center text-xs font-medium text-foreground">
      {item.awayTeam.name}
    </span>
  </div>
</div>
```

**`TeamFlag`** — reusar o mesmo padrão de `MatchCard.tsx`:
- `flagUrl` disponível: `<img width={40} height={28} loading="lazy" className="w-10 h-7 rounded-sm object-contain" />`.
- Fallback: `<span>` com iniciais (até 3 letras) + `bg-muted text-xs font-bold text-muted-foreground`.

### Data/hora

```tsx
<p className="text-xs text-muted-foreground text-center">
  {format(new Date(item.kickoffAt), "dd/MM/yyyy · HH:mm", { locale: ptBR })}
</p>
```

### Rodapé (divider + palpite + badge)

```tsx
<div className="border-t border-border pt-3 flex items-center justify-between gap-2">
  <p className="text-xs text-muted-foreground">
    Meu palpite:{" "}
    <span className="font-bold text-foreground">
      {item.prediction.homeScore} × {item.prediction.awayScore}
    </span>
  </p>
  <PredictionStatusBadge displayStatus={item.displayStatus} />
</div>
```

### `PredictionStatusBadge` — subcomponente interno

```tsx
// Ícones por status
const STATUS_ICONS: Record<PredictionDisplayStatus, ReactNode> = {
  pendente:  <Clock size={12} aria-hidden="true" />,
  acertou:   <CheckCircle2 size={12} aria-hidden="true" />,
  errou:     <XCircle size={12} aria-hidden="true" />,
  bloqueado: <Lock size={12} aria-hidden="true" />,
};

<span
  className={cn(
    "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
    PREDICTION_DISPLAY_STATUS_COLOR[displayStatus],
  )}
>
  {STATUS_ICONS[displayStatus]}
  {PREDICTION_DISPLAY_STATUS_LABEL[displayStatus]}
</span>
```

**Cor dos badges** (tokens TASK-02):
| Status | Classes |
|---|---|
| `acertou` | `bg-win-bg text-win` |
| `errou` | `bg-loss-bg text-loss` |
| `pendente` | `bg-amber-500/20 text-amber-700 dark:text-amber-400` |
| `bloqueado` | `bg-gray-500/20 text-gray-600 dark:text-gray-400` |

Badge sempre tem texto + ícone — nunca apenas cor (WCAG 1.4.1 — uso de cor).

---

## 6. Estado Loading (Skeleton)

```
┌──────────────────────────────────────────────────────┐
│  [████] ████████████      ████████████ [████]        │  ← bandeiras + nomes skeleton
│           [████████]  ×  [████████]                  │  ← placar skeleton
│                  [████████████]                      │  ← data skeleton
│  ─────────────────────────────────────────────────── │
│  [████████████████]              [█████████]         │  ← rodapé skeleton
└──────────────────────────────────────────────────────┘
```

- Usar `animate-pulse motion-reduce:animate-none` em cada bloco `bg-muted rounded`.
- Container com `role="status" aria-busy="true" aria-label="Carregando palpite"`.
- Renderizar 4 cards skeleton (default count=4).
- O H1 "Meus Palpites" e os chips de filtro devem **aparecer** mesmo durante loading (UX: usuário pode mudar o filtro antes dos dados chegarem — nesse caso os chips ficam visíveis mas desabilitados ou simplesmente exibidos normalmente, e a lista mostra skeleton).

---

## 7. Estado Empty

```
┌──────────────────────────────────────────┐
│                                          │
│           [ícone PenLine 40px]           │
│                                          │
│         Nenhum palpite ainda             │
│                                          │
│  Registre seus palpites nos jogos para   │
│  acompanhá-los aqui.                     │
│                                          │
└──────────────────────────────────────────┘
```

- `role="status"` no container.
- Ícone: `<PenLine size={40} aria-hidden="true" className="text-muted-foreground" />`.
- Mensagem principal: `text-sm font-medium text-foreground`.
- Subtexto: `text-xs text-muted-foreground`.
- Container: `flex flex-col items-center justify-center py-12 gap-3 text-center px-4`.

**Estado empty filtrado** (filtro ativo mas sem itens correspondentes):
- Mensagem: `"Nenhum palpite com este status"`.
- Subtexto: `"Experimente outro filtro."`.

---

## 8. Estado Error

```
┌──────────────────────────────────────────┐
│                                          │
│         [ícone AlertCircle 40px]         │
│                                          │
│       Erro ao carregar palpites          │
│                                          │
│         [ Tentar novamente ]             │
│                                          │
└──────────────────────────────────────────┘
```

- Ícone: `<AlertCircle size={40} aria-hidden="true" className="text-destructive" />`.
- Botão "Tentar novamente": `Button variant="outline" size="sm"` com `min-h-[44px] px-6`.
- Container padrão: `flex flex-col items-center justify-center py-12 gap-4 text-center px-4`.
- **Chips de filtro**: ocultos no estado de erro (não há dados para filtrar).

---

## 9. Bottom Nav — aba "Palpites" ativa

O item "Palpites" já está em `nav-items.ts`. Quando o pathname é `/predictions`:

- Ícone `PenLine`: `text-primary` (cor primária), `size={22}` (ativo é um pouco maior que os 20px inativos — padrão BottomNav.tsx linha 34).
- Label: `text-xs font-semibold text-primary`.
- `aria-current="page"` no link.

**SideNav desktop:** mesmo item ativo com `bg-sidebar-primary text-sidebar-primary-foreground rounded-lg`.

---

## 10. Responsividade

### Mobile (< 768px)

- Layout coluna simples (`flex flex-col gap-4`).
- Chips com `overflow-x-auto` — não quebram linha.
- Cards full-width.
- BottomNav visível.
- Padding: `px-4 py-4 pb-20` (compensar BottomNav).

### Desktop (md+)

- SideNav w-16 + conteúdo `max-w-4xl mx-auto`.
- Cards permanecem coluna (não é grid) — adequado para lista linear.
- BottomNav oculta; padding-bottom reduzido: `pb-4`.
- Chips de filtro: mesmo layout, sem scroll horizontal (cabem na largura).

---

## 11. Acessibilidade — checklist completo

### Chips de filtro

| Requisito | Implementação |
|---|---|
| Role semântico | `<button type="button" aria-pressed>` |
| Group ARIA | `<div role="group" aria-label="Filtrar palpites">` |
| Estado ativo | `aria-pressed={true}` no chip ativo |
| Teclado | Tab entre chips; Enter/Space para ativar |
| Toque mínimo | `min-h-[44px]` |
| Contraste ativo | `bg-primary text-primary-foreground` ≥ 4.5:1 AA |
| Contraste inativo | `bg-secondary text-secondary-foreground` ≥ 4.5:1 AA |

### Cards

| Requisito | Implementação |
|---|---|
| Semântica | `<article aria-label="Brasil vs France">` |
| Não é link | Nenhum `<a>` ou `<Link>` no card (informacional) |
| Imagens | `<img alt={team.name}>` ou fallback com `aria-label` |

### Badges de status

| Requisito | Implementação |
|---|---|
| Texto visível | Sempre label + ícone (nunca só cor) |
| Ícone decorativo | `aria-hidden="true"` no ícone |
| Contraste | Tokens `win/loss/amber/gray` — verificar ≥ 3:1 para texto pequeno |

### Página

| Requisito | Implementação |
|---|---|
| H1 único | `<h1>Meus Palpites</h1>` |
| Skip link | Já no `AppShell` (não repetir) |
| `main` id | Já no `AppShell` (`id="main-content" tabIndex={-1}`) |

### Estados

| Estado | ARIA |
|---|---|
| Loading skeleton | `role="status" aria-busy="true" aria-label="Carregando palpite"` |
| Empty | `role="status"` |
| Error | Nenhum `role="alert"` — é estado de página, não notificação instantânea |

---

## 12. Tokens de cor utilizados

| Elemento | Token / Classe | Modo |
|---|---|---|
| Background página | `bg-background` | light + dark |
| Card | `bg-card border-border shadow-sm` | light + dark |
| Texto principal | `text-foreground` | light + dark |
| Texto auxiliar | `text-muted-foreground` | light + dark |
| Placar palpitado | `text-foreground font-bold` | light + dark |
| Chip ativo | `bg-primary text-primary-foreground` | light + dark |
| Chip inativo | `bg-secondary text-secondary-foreground` | light + dark |
| Badge acertou | `bg-win-bg text-win` | dark mode automático via token |
| Badge errou | `bg-loss-bg text-loss` | dark mode automático via token |
| Badge pendente | `bg-amber-500/20 text-amber-700 dark:text-amber-400` | manual |
| Badge bloqueado | `bg-gray-500/20 text-gray-600 dark:text-gray-400` | manual |
| Skeleton | `bg-muted animate-pulse` | light + dark |
| Ícone empty/error | `text-muted-foreground` / `text-destructive` | light + dark |
| Divider | `border-border` | light + dark |

**Nunca usar hexadecimais ou valores arbitrários** (design system §15).

---

## 13. Micro-interações

| Elemento | Interação |
|---|---|
| Chip de filtro | `transition-colors duration-150` no hover/active |
| Botão retry | `hover:bg-accent transition-colors duration-150` (via Button Shadcn) |
| Cards | Sem hover state (não são clicáveis) |
| Bottom nav item | `transition-colors duration-150 motion-reduce:transition-none` (já no BottomNav.tsx) |

---

## 14. Tipografia detalhada

| Elemento | Classes |
|---|---|
| H1 "Meus Palpites" | `text-2xl font-semibold text-foreground` |
| Chip label | `text-xs font-medium` (inativo) / `text-xs font-semibold` (ativo) |
| Nome do time | `text-xs font-medium text-foreground truncate` |
| Placar central | `text-2xl font-bold text-foreground` |
| Separador placar | `text-lg font-bold text-muted-foreground` |
| Data/hora | `text-xs text-muted-foreground` |
| Label "Meu palpite:" | `text-xs text-muted-foreground` |
| Valor do palpite no rodapé | `font-bold text-foreground` |
| Badge texto | `text-xs font-medium` |
| Empty state principal | `text-sm font-medium text-foreground` |
| Empty state subtexto | `text-xs text-muted-foreground` |
| Bottom nav label | `text-xs font-semibold text-primary` (ativo) / `text-xs font-medium text-muted-foreground` (inativo) |

---

## 15. Notas UX

1. **Chips persistidos:** o filtro ativo sobrevive à navegação — usuário volta para a aba "Palpites" e vê o mesmo filtro. Expectativa natural em apps mobile.
2. **Ordenação ASC = próximos primeiro:** a aba de palpites serve de agenda — jogos futuros no topo, facilitando revisão de palpites pendentes.
3. **Só jogos com palpite:** a lista não exibe jogos sem palpite (A5 do PRD) — mantém o foco e evita "ruído" de partidas não palpitadas.
4. **Placar repetido no rodapé:** o "Meu palpite: 2 × 1" no rodapé reforça a informação para o usuário que acabou de scrollar e não lembra o placar no topo do card — redundância intencional para UX de lista densa.
5. **Cards não-clicáveis:** diferente do `MatchCard`, o `PredictionListCard` é informacional. Sem affordance de link (sem chevron, sem hover de destaque de card). Futuras iterações podem adicionar link para o detalhe do jogo.
6. **Estado empty filtrado vs. empty total:** mensagens diferentes ajudam o usuário a entender se não tem palpites ou se o filtro está vazio — evita confusão.
