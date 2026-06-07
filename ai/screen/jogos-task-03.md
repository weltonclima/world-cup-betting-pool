# SCREEN — TASK-03: Componentes base de UI (MatchCard, badges, skeletons, estados)
> Feature: Jogos (PRD-03) · Plataforma: mobile-first (responsivo)
> Design system: `design-system/MASTER.md` · Fonte de verdade: imagens PRD03-01, 04, 05, 06

---

## 1. Análise das imagens fonte

### PRD03-04 — Jogo: Palpite Enviado

```
┌──────────────────────────────────────────────────────┐
│                    Grupo C                           │  ← text-xs text-muted-foreground, centrado
│                                                      │
│  🇧🇷                  16:00               🇫🇷        │  ← bandeira left, horário center bold, bandeira right
│ Brasil             12/06/2026            França      │  ← nome time xs, data xs muted, nome time xs
│                   Estádio Lusail                     │  ← xs muted, centrado
│                   Lusail                             │  ← cidade xs muted
│                                                      │
│  ✓ PALPITE ENVIADO                              >    │  ← badge verde + chevron
└──────────────────────────────────────────────────────┘
```

### PRD03-05 — Jogo: Palpite Pendente

```
┌──────────────────────────────────────────────────────┐
│                    Grupo D                           │
│                                                      │
│  🇦🇷                  19:00               🇩🇪        │
│ Argentina       12/06/2026           Alemanha        │
│             Estádio Ahmad Bin Ali                    │
│                   Al Rayyan                          │
│                                                      │
│  ⏰ PALPITE PENDENTE                            >    │  ← badge âmbar + chevron
└──────────────────────────────────────────────────────┘
```

### PRD03-06 — Jogo Encerrado (com placar)

```
┌──────────────────────────────────────────────────────┐
│  Grupo G · Rodada 3              24/11/2026 · 16:00  │
│                                                      │
│  🇧🇷                  2  x  1              🇷🇸        │
│ Brasil                                   Sérvia      │
│              Estádio Lusail · Lusail                 │
│                                                      │
│                   JOGO ENCERRADO                     │  ← badge cinza (sem chevron)
│                                                      │
│  Resultado Final                          2  x  1   │  ← placar do usuário
│                                                      │
│  🔒 PALPITE BLOQUEADO                               │  ← badge cinza
│  Palpites não disponíveis para jogos encerrados.     │  ← text-xs muted
│                                                      │
│  ↗ Visualizar Resultado e Estatísticas         >    │
└──────────────────────────────────────────────────────┘
```

---

## 2. Tokens e classes aplicados por elemento

### 2.1 Card container
```
rounded-xl border border-border bg-card shadow-sm p-4
```
Mobile: `w-full`
Desktop: mantém `w-full` (lista vertical)

### 2.2 Grupo label
```
text-xs text-muted-foreground text-center mb-2
```

### 2.3 Bloco central de times
Layout flex row, `items-center justify-between`:

**Coluna time mandante (left):**
```
flex flex-col items-center gap-1
```
- Bandeira: `w-10 h-7 rounded-sm object-contain` (img) ou fallback span `size-10 rounded-sm`
- Nome: `text-sm font-medium text-foreground text-center max-w-[80px] truncate`

**Coluna central (horário/placar):**
```
flex flex-col items-center gap-0.5 flex-1
```
- Horário (agendado/pendente): `text-2xl font-bold text-foreground`
- Placar (encerrado): `text-3xl font-bold text-foreground` com separador "x"
- Data: `text-xs text-muted-foreground`
- Estádio: `text-xs text-muted-foreground text-center`
- Cidade: `text-xs text-muted-foreground text-center`

**Coluna time visitante (right):**
```
flex flex-col items-center gap-1
```
(espelho do mandante)

### 2.4 Rodapé do card (badge + chevron)
```
flex items-center justify-between mt-3 pt-3 border-t border-border
```
- Badge: `inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md`
- Chevron: `size-4 text-muted-foreground` (ícone `ChevronRight`)
- Área de toque do card: link wrapping o article inteiro com `min-h-[44px]`

---

## 3. Componente: MatchCard

### 3.1 Props de entrada
```typescript
interface MatchCardProps {
  match: MatchWithId;           // dados do jogo
  homeTeam: ResolvedTeam;       // { name, flagUrl? }
  awayTeam: ResolvedTeam;       // { name, flagUrl? }
  predictionStatus: MatchPredictionStatus;  // "enviado" | "pendente" | "bloqueado"
  userPrediction?: { homeScore: number; awayScore: number } | null;
  detailHref: string;           // "/matches/[id]"
  className?: string;
}
```

### 3.2 Variante: Enviado
- Badge: `MatchStatusBadge status="enviado"` → fundo verde claro + ícone `CheckCircle2`
- Rodapé: badge + chevron direito (card é link clicável)
- Cor badge: `bg-green-500/20 text-green-700 dark:text-green-400`

### 3.3 Variante: Pendente
- Badge: `MatchStatusBadge status="pendente"` → fundo âmbar + ícone `Clock`
- Rodapé: badge + chevron direito (card é link clicável)
- Cor badge: `bg-amber-500/20 text-amber-700 dark:text-amber-400`

### 3.4 Variante: Jogo Encerrado (status="bloqueado" + match.status="finished")
- Placar em destaque no centro (homeScore x awayScore)
- Badge: `GameStatusBadge status="finished"` → cinza
- Rodapé sem chevron (jogo encerrado)
- Seção extra: "Resultado Final" + placar do palpite (ou "Palpite Bloqueado")
- Botão "Visualizar Resultado e Estatísticas" (variant="outline", disabled ou placeholder href)

### 3.5 Bandeira (TeamFlag — subcomponente interno)
```typescript
// Com flagUrl:
<img src={flagUrl} alt={name} className="w-10 h-7 rounded-sm object-contain" />

// Sem flagUrl (fallback):
<span aria-label={name} className="w-10 h-7 flex items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground">
  {initials}  // até 3 letras maiúsculas
</span>
```

### 3.6 Formatação de data/hora
- Data: `format(kickoffAt, "dd/MM/yyyy", { locale: ptBR })`
- Hora: `format(kickoffAt, "HH:mm", { locale: ptBR })`
- Grupo+rodada (encerrado): `match.groupId ?? match.stage` + (round ? ` · Rodada ${round}` : "")

---

## 4. Componente: MatchStatusBadge

### 4.1 Visual por status
| Status | Rótulo | Ícone | Fundo | Texto |
|---|---|---|---|---|
| `enviado` | "Palpite Enviado" | `CheckCircle2` (size 12) | `bg-green-500/20` | `text-green-700` |
| `pendente` | "Palpite Pendente" | `Clock` (size 12) | `bg-amber-500/20` | `text-amber-700` |
| `bloqueado` | "Palpite Bloqueado" | `Lock` (size 12) | `bg-gray-500/20` | `text-gray-600` |

### 4.2 Implementação
Usa `PREDICTION_STATUS_LABEL` e `PREDICTION_STATUS_COLOR` de `matchLabels.ts`.
Wrapper `<span>` com classes do mapa + ícone inline.

```
className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md {colorClass}"
```

---

## 5. Componente: GameStatusBadge

### 5.1 Visual por status
| Status | Rótulo | Fundo | Texto |
|---|---|---|---|
| `scheduled` | "Agendado" | `bg-blue-500/20` | `text-blue-700` |
| `live` | "Ao Vivo" | `bg-green-500/20` | `text-green-700` |
| `finished` | "Encerrado" | `bg-gray-500/20` | `text-gray-600` |
| `postponed` | "Adiado" | `bg-gray-500/20` | `text-gray-600` |
| `canceled` | "Cancelado" | `bg-gray-500/20` | `text-gray-600` |

### 5.2 Implementação
Usa `GAME_STATUS_LABEL` e `GAME_STATUS_COLOR` de `matchLabels.ts`.

---

## 6. Componente: MatchCardSkeleton

```
┌──────────────────────────────────────────────────────┐
│  ██████████████   (w-24 h-3 rounded animate-pulse)  │  ← grupo
│                                                      │
│  ████  ████████████████  ████  (times + horário)    │
│  ████  ████████████████  ████                        │
│                                                      │
│  ██████████████████████   (estádio)                 │
│  ██████████████████████   (badge)                   │
└──────────────────────────────────────────────────────┘
```

- `role="status"` + `aria-busy="true"` + `aria-label="Carregando jogo"`
- 5 barras `animate-pulse motion-reduce:animate-none`
- Altura total similar ao card real (~120px)

---

## 7. Componente: MatchListSkeleton

```
┌──────────────────┐
│ ████ (seção)     │  ← label de dia skeleton
├──────────────────┤
│ [MatchCardSkeleton] │
│ [MatchCardSkeleton] │
│ [MatchCardSkeleton] │
└──────────────────┘
```

- `role="status"` + `aria-busy="true"` + `aria-label="Carregando jogos"`
- Prop `count` (default 3)
- Inclui um skeleton de seção header (`w-32 h-4`) antes dos cards

---

## 8. Componente: MatchesEmptyState

```
┌──────────────────────────────┐
│                              │
│       [Calendar icon]        │  ← size={40} text-muted-foreground
│   Nenhum jogo encontrado     │  ← text-sm font-medium text-foreground
│  (subtítulo se fornecido)    │  ← text-xs text-muted-foreground
│                              │
└──────────────────────────────┘
```

- Container: `flex flex-col items-center justify-center py-12 gap-3`
- Ícone: `Calendar` de lucide-react, `aria-hidden="true"`
- `role="status"` no container

---

## 9. Componente: MatchesErrorState

```
┌──────────────────────────────┐
│                              │
│     [AlertCircle icon]       │  ← size={40} text-destructive
│    Erro ao carregar jogos    │  ← text-sm font-medium text-foreground
│                              │
│    [Tentar novamente]        │  ← Button variant="outline" size="sm"
│                              │
└──────────────────────────────┘
```

- Container: `flex flex-col items-center justify-center py-12 gap-4`
- Ícone: `AlertCircle` de lucide-react, `aria-hidden="true"`
- Botão: `min-h-[44px]`

---

## 10. Responsividade

| Elemento | Mobile (base) | Desktop (md+) |
|---|---|---|
| Card | `w-full rounded-xl p-4` | idem (lista vertical permanece) |
| Bandeira | `w-10 h-7` | idem |
| Nome do time | `max-w-[80px] truncate` | `max-w-[120px]` |
| Horário/placar | `text-2xl` / `text-3xl` | idem |
| Skeleton | mesmo layout | idem |

---

## 11. Acessibilidade

| Elemento | Atributo |
|---|---|
| Card (Link) | `aria-label="[MandanteName] vs [VisitanteName]"` |
| Bandeira img | `alt={team.name}` |
| Bandeira fallback | `aria-label={team.name}` |
| Skeleton | `role="status"` + `aria-busy="true"` |
| Empty state | `role="status"` |
| Ícone decorativo | `aria-hidden="true"` |
| Botão onRetry | `aria-label="Tentar novamente"` (texto visível) |
| Área de toque | `min-h-[44px]` no link do card e no botão retry |

---

## 12. Barrel index.ts

```typescript
export * from "./MatchCard";
export * from "./MatchStatusBadge";
export * from "./GameStatusBadge";
export * from "./MatchListSkeleton";
export * from "./MatchesEmptyState";
export * from "./MatchesErrorState";
```
