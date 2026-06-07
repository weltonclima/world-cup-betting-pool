# SCREEN — TASK-06: Página Detalhe do Jogo (`/matches/[id]`)
> Feature: Jogos (PRD-03) · Plataforma: both (mobile-first, responsivo até desktop 1024px+)
> Design system: `design-system/MASTER.md` · Fonte de verdade: `docs/prd-03/PRD03-02-Detalhe-Jogo.png`

---

## 1. Análise da imagem PRD03-02

A tela PRD03-02 mostra:

```
┌─────────────────────────────────────────────────────┐
│  ← [back]           Detalhes do Jogo         [bell] │  ← header com back + título
│              Fase de Grupos · Grupo C                │  ← subtítulo de fase/grupo
│                                                      │
│    🇧🇷                 X                🇫🇷           │  ← bandeiras grandes centralizadas
│   Brasil                              França          │  ← nomes das seleções
│                                                      │
│  📅 Data:            12 de Junho de 2026             │  ← ícone + label: valor
│  🕐 Hora:            16:00                           │
│  🏟️ Estádio:         Estádio Lusail                  │
│  📍 Cidade:          Lusail, Catar                   │
│                                                      │
│  Status do Jogo                                      │  ← seção heading
│  🔵 Agendado                                         │  ← badge azul
│                                                      │
│  Status do Palpite                                   │  ← seção heading
│  ✓ PALPITE ENVIADO                                   │  ← badge verde
│  Seu palpite foi enviado com sucesso.                │  ← mensagem auxiliar
│                                                      │
│  Ações                                               │  ← seção heading
│  [✏ Editar Palpite                              ]    │  ← botão primary (desabilitado)
│  [👁 Visualizar Palpite                         ]    │  ← botão outline (desabilitado)
│  [ℹ Ver Informações da Partida                  ]    │  ← botão outline (desabilitado)
│                                                      │
│                                                      │
│  🏠 Jogos Palpites Ranking Perfil               │  ← bottom nav
└─────────────────────────────────────────────────────┘
```

---

## 2. Paleta e tokens

Todos os tokens seguem `design-system/MASTER.md §2`.

| Elemento | Token Tailwind | Observação |
|---|---|---|
| Fundo de página | `bg-background` | Branco (light) / escuro (dark) |
| Card de detalhes | `bg-card border-border` | `rounded-xl shadow-sm` |
| Título principal | `text-foreground text-2xl font-semibold` | "Detalhes do Jogo" |
| Subtítulo fase/grupo | `text-muted-foreground text-sm` | "Fase de Grupos · Grupo C" |
| Nome das seleções | `text-foreground text-sm font-medium` | Abaixo das bandeiras |
| "X" separador | `text-muted-foreground text-2xl font-bold` | Entre bandeiras |
| Labels (Data, Hora…) | `text-muted-foreground text-sm` | Coluna esquerda |
| Valores (datas…) | `text-foreground text-sm font-medium` | Coluna direita |
| Heading de seção | `text-foreground text-base font-semibold` | "Status do Jogo" etc. |
| Divisor | `border-t border-border` | Entre seções |
| Mensagem palpite | `text-muted-foreground text-sm` | Abaixo do badge |
| Botão primário | `variant="default"` (shadcn Button) | CTA principal |
| Botão secundário | `variant="outline"` | CTAs extras |
| Botão desabilitado | `disabled` + `aria-disabled="true"` | Todos os CTAs (PRD-04 pendente) |

---

## 3. Bandeiras e fallback

Conforme TASK-03 (`MatchCard`), reusar o mesmo padrão de TeamFlag:

- `flagUrl` disponível → `<img src={flagUrl} alt={name} className="w-16 h-12 rounded object-contain" />`
- `flagUrl` ausente → span com iniciais (até 3 letras), `bg-muted rounded text-muted-foreground font-bold`

Na tela de detalhe as bandeiras são maiores que no card: `w-16 h-12` mobile, `w-20 h-14` (`md:`) desktop.

---

## 4. Layout — Mobile (< 768px)

```
┌──────────────────────────────┐
│  ← back  "Detalhes do Jogo" │  ← sticky header, h-14
├──────────────────────────────┤
│  [main content, scroll]      │  ← px-4, pb-20 (BottomNav)
│                               │
│  "Fase de Grupos · Grupo C"  │  ← text-sm text-muted-foreground, mt-4
│                               │
│  ┌──────────────────────────┐ │  ← card bg-card rounded-xl p-6
│  │  🇧🇷   X   🇫🇷           │ │    flex row justify-around items-center
│  │ Brasil   França          │ │
│  └──────────────────────────┘ │
│                               │
│  ┌──────────────────────────┐ │  ← card bg-card rounded-xl p-4
│  │ 📅 Data  12 de jun 2026  │ │    grid 2 colunas (label | valor)
│  │ 🕐 Hora  16:00           │ │    gap-y-3
│  │ 🏟 Estádio  Est. Lusail  │ │
│  │ 📍 Cidade  Lusail, Catar │ │
│  └──────────────────────────┘ │
│                               │
│  ┌──────────────────────────┐ │  ← card bg-card rounded-xl p-4
│  │ Status do Jogo           │ │    heading + badge
│  │  [🔵 Agendado]           │ │
│  ├──────────────────────────┤ │  ← divisor
│  │ Status do Palpite        │ │    heading + badge + mensagem
│  │  [✓ PALPITE ENVIADO]     │ │
│  │  Seu palpite foi...      │ │
│  └──────────────────────────┘ │
│                               │
│  ┌──────────────────────────┐ │  ← card bg-card rounded-xl p-4
│  │ Ações                    │ │    heading + botões em coluna
│  │ [✏ Editar Palpite    ]   │ │    gap-3
│  │ [👁 Visualizar Palpite]  │ │
│  │ [ℹ Ver Informações...]   │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 5. Layout — Desktop (≥ 768px)

```
┌──────────────────────────────────────────────────────────────┐
│ SideNav │  ← back "Detalhes do Jogo"                         │
│  (64px) │  "Fase de Grupos · Grupo C"                        │
│         │  max-w-2xl mx-auto px-4 py-6                       │
│         │                                                     │
│         │  ┌──────────────────────────────────────────────┐  │
│         │  │  🇧🇷          X         🇫🇷                  │  │
│         │  │  Brasil               França                  │  │
│         │  └──────────────────────────────────────────────┘  │
│         │                                                     │
│         │  ┌─────────────────┐  ┌─────────────────────────┐  │
│         │  │ Detalhes Jogo   │  │ Status do Jogo / Palpite │  │
│         │  │ Data: ...       │  │ [badge] [badge]          │  │
│         │  │ Hora: ...       │  │ Ações:                   │  │
│         │  │ Estádio: ...    │  │ [Editar Palpite]         │  │
│         │  │ Cidade: ...     │  │ [Visualizar Palpite]     │  │
│         │  └─────────────────┘  │ [Ver Informações]        │  │
│         │                       └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

Desktop usa `md:grid md:grid-cols-2 md:gap-6` para separar o bloco de detalhes e o bloco de status/ações.

---

## 6. Estado: Loading Skeleton

```
┌─────────────────────────────┐
│  skeleton h-5 w-32 (back)   │
├─────────────────────────────┤
│  skeleton h-4 w-40 (subtít) │
│                              │
│  ┌────────────────────────┐  │  ← card skeleton
│  │ rect 16x12  rect 16x12 │  │    bandeiras
│  │ rect 16 w-20 (nome)    │  │    nomes
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │  ← card detalhes
│  │ 4 × [rect h-4 full-w]  │  │    linhas data/hora/estádio/cidade
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │  ← card status
│  │ rect h-6 w-24 (badge)  │  │    badge jogo
│  │ rect h-6 w-32 (badge)  │  │    badge palpite
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │  ← card ações
│  │ rect h-10 full-w       │  │    botão 1
│  │ rect h-10 full-w       │  │    botão 2
│  │ rect h-10 full-w       │  │    botão 3
│  └────────────────────────┘  │
└─────────────────────────────┘
```

Classes skeleton: `bg-muted animate-pulse motion-reduce:animate-none rounded`

---

## 7. Estado: 404 — Jogo não encontrado

```
┌─────────────────────────────┐
│  ← back                     │
│                              │
│      [CalendarX icon 48px]   │  ← text-muted-foreground
│                              │
│  Jogo não encontrado         │  ← text-lg font-semibold text-foreground
│  Não foi possível encontrar  │  ← text-sm text-muted-foreground
│  este jogo.                  │
│                              │
│  [← Voltar para Jogos]       │  ← Button variant="outline" href="/matches"
└─────────────────────────────┘
```

---

## 8. Estado: Error

```
<MatchesErrorState
  onRetry={refetch}
  message="Erro ao carregar detalhes do jogo"
/>
```

Reusar o componente TASK-03 sem alteração.

---

## 9. Ícones Lucide para a tela

| Elemento | Ícone Lucide | Import |
|---|---|---|
| Botão voltar | `ArrowLeft` | `lucide-react` |
| Data | `Calendar` | `lucide-react` |
| Hora | `Clock` | `lucide-react` |
| Estádio | `Building2` | `lucide-react` |
| Cidade | `MapPin` | `lucide-react` |
| Vazio (404) | `CalendarX` | `lucide-react` |
| Editar palpite | `Pencil` | `lucide-react` |
| Visualizar palpite | `Eye` | `lucide-react` |
| Ver informações | `Info` | `lucide-react` |
| Ver resultado/estat. | `BarChart2` | `lucide-react` |

Todos decorativos → `aria-hidden="true"`.

---

## 10. Animações e Transições

- Hover de botões: `transition-colors duration-150` (Tailwind built-in via shadcn).
- Skeleton: `animate-pulse motion-reduce:animate-none`.
- Sem Framer Motion nesta tela (sem animação de entrada de rota neste PRD).

---

## 11. Acessibilidade

| Item | Implementação |
|---|---|
| Botão voltar | `aria-label="Voltar para lista de jogos"` |
| Hierarquia heading | `h1` = "Detalhes do Jogo"; `h2` para cada seção |
| Bandeiras | `<img alt={team.name}>` |
| Fallback bandeira | `aria-label={team.name}` no span |
| CTAs desabilitados | `disabled` + `aria-disabled="true"` |
| Skeleton | `role="status" aria-busy="true" aria-label="Carregando detalhes do jogo"` |
| Empty state | `role="status"` no container |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| Contraste WCAG AA | Tokens do design system (não usar valores arbitrários) |

---

## 12. Variações de CTAs por contexto

### Palpite Pendente (scheduled, sem envio)
```
[Enviar Palpite]              ← variant="default" disabled
[Ver Informações da Partida]  ← variant="outline" disabled
```

### Palpite Enviado (scheduled, com envio)
```
[Editar Palpite]              ← variant="default" disabled
[Visualizar Palpite]          ← variant="outline" disabled
[Ver Informações da Partida]  ← variant="outline" disabled
```

### Bloqueado / Live
```
[Visualizar Palpite]          ← variant="default" disabled
[Ver Informações da Partida]  ← variant="outline" disabled
```

### Bloqueado / Finished
```
[Visualizar Palpite]                      ← variant="default" disabled
[Ver Informações da Partida]              ← variant="outline" disabled
[Visualizar Resultado & Estatísticas]     ← variant="outline" disabled
```

---

## 13. Decisões de design

| # | Decisão |
|---|---|
| DS1 | Cards separados para "Times", "Detalhes", "Status", "Ações" — hierarquia visual clara por seção |
| DS2 | Bandeiras maiores na tela de detalhe vs card (w-16 h-12 vs w-10 h-7) — mais destaque |
| DS3 | Grid 2-col no desktop para detalhes + status/ações lado a lado |
| DS4 | Todos CTAs disabled com visual de desabilitado (opacidade 50% padrão shadcn) — não engana o usuário |
| DS5 | Mensagem descritiva do palpite abaixo do badge — contexto extra sem precisar abrir outro fluxo |
| DS6 | Ícones Lucide ao lado das labels (Data, Hora, Estádio, Cidade) — escaneabilidade aumentada |
