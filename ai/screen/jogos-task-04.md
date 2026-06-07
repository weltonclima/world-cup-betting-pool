# Screen — TASK-04: Página Lista de Jogos (`/matches`)

> Design system: `design-system/MASTER.md`
> Fonte de verdade visual: `docs/prd-03/PRD03-01-Lista-Jogos.png`
> Plataformas: Mobile-first (375px) → Desktop (1024px+)
> Gerado para: `MatchList.tsx` + `MatchListHeader.tsx`

---

## 1. Análise da PRD03-01 (fonte de verdade)

Da imagem PRD03-01 extraímos:

- **Header da página**: título "Jogos" à esquerda, `text-2xl font-semibold`.
- **Linha de busca + filtros**: input "Buscar por seleção" com ícone à esquerda + botão de filtros (ícone grade) à direita, alinhados horizontalmente.
- **Chips de filtro rápido**: linha horizontal com 3 chips — "Fase de Grupos ▾", "Todos ▾", "Todas as seleções ▾". Fundo cinza claro (secondary), texto escuro, bordas arredondadas (rounded-full ou rounded-md).
- **Seção por dia**: cabeçalho "Hoje · 12 de Junho" em texto smaller/muted, uppercase ou peso leve.
- **Cards de jogo**: bordas arredondadas, sombra leve, espaçamento interno confortável. Bandeiras + nomes dos times + horário/placar central.
- **Badge de palpite**: na parte inferior do card — "PALPITE ENVIADO" (verde) ou "PALPITE PENDENTE" (âmbar) com ícone e chevron à direita.
- **Bottom nav**: 5 itens fixos na base.

---

## 2. Layout geral — Mobile (375px)

```
┌─────────────────────────────────────────┐
│ ← AppShell (pt-14 pelo Header fixo)    │
│                                         │
│  Jogos                                  │  ← h2 text-2xl font-semibold
│  ┌─────────────────────────────────┬──┐ │
│  │ 🔍 Buscar por seleção           │≡ │ │  ← Input + Button(icon)
│  └─────────────────────────────────┴──┘ │
│  ┌──────────────┐ ┌──────┐ ┌──────────┐ │
│  │ Fase de Grupos▾│ │Todos▾│ │Todas selec│ │  ← chips overflow-x-auto
│  └──────────────┘ └──────┘ └──────────┘ │
│                                         │
│  Hoje · 12 de Junho                     │  ← seção label
│  ┌─────────────────────────────────┐    │
│  │  Grupo C                        │    │
│  │  🇧🇷 Brasil  16:00  🇫🇷 França   │    │
│  │  Estádio Lusail · Lusail        │    │
│  │  ─────────────────────────────  │    │
│  │  ✅ PALPITE ENVIADO          >  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Grupo D                        │    │
│  │  🇦🇷 Argentina  19:00  🇩🇪 Alem  │    │
│  │  Estádio Ahmad Bin Ali · Al R   │    │
│  │  ─────────────────────────────  │    │
│  │  🕐 PALPITE PENDENTE         >  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Amanhã · 13 de Junho                   │
│  ┌─────────────────────────────────┐    │
│  │  Grupo E                        │    │
│  │  🇪🇸 Espanha  13:00  🇯🇵 Japão   │    │
│  │  Estádio Khalifa · Al Rayyan    │    │
│  │  ─────────────────────────────  │    │
│  │  🕐 PALPITE PENDENTE         >  │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ 🏠  📅  📝  🏆  👤                     │  ← BottomNav (já existe)
└─────────────────────────────────────────┘
```

---

## 3. Layout — Desktop (1024px+)

- Conteúdo centralizado: `max-w-4xl mx-auto`.
- Chips de filtro não precisam de scroll horizontal no desktop (cabem em linha).
- Cards: layout mantido em coluna única (a lista não vira grid no desktop — mantém legibilidade).
- SideNav substituindo BottomNav (já implementado no AppShell).

---

## 4. Especificação de componentes

### 4.1 MatchListHeader

**Bloco: Título**
```
text-2xl font-semibold text-foreground
mb-4 (espaçamento abaixo antes da busca)
```

**Bloco: Linha de busca + botão filtros**
```
Wrapper: flex items-center gap-2

Input (shadcn):
  - placeholder="Buscar por seleção"
  - aria-label="Buscar jogos por seleção"
  - className="flex-1"
  - Prefixo ícone: wrapper relative com <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true"/>
  - Input com pl-9 para dar espaço ao ícone
  - type="search"

Botão filtros (shadcn Button variant="outline" size="icon"):
  - aria-label="Abrir filtros avançados"
  - min-h-[44px] min-w-[44px]
  - Ícone: <SlidersHorizontal size={18} aria-hidden="true"/>
  - Badge numérica (se filtersCount > 0): posição absolute top-right, bg-primary text-primary-foreground, rounded-full, text-[10px], size-4
```

**Bloco: Chips de filtro rápido**
```
Wrapper: flex gap-2 overflow-x-auto pb-1 scrollbar-none
  role="group"
  aria-label="Filtros rápidos"

Chips de Fase (Stage):
  - Um chip por valor de Stage: grupos, oitavas, quartas, semifinal, terceiro, final
  - Labels: "Fase de Grupos", "Oitavas", "Quartas", "Semifinal", "3º Lugar", "Final"
  - + chip "Todas" (undefined) sempre à esquerda → limpa o filtro
  - Quando selectedStage === undefined: chip "Todas" com variant default; outros com variant outline
  - Quando selectedStage === X: chip X com variant default; outros outline
  - Implementação: <Button size="sm" variant={...} onClick={...} className="rounded-full whitespace-nowrap text-xs h-8 px-3 min-h-[32px]">

Chips de Status do Palpite (MatchPredictionStatus):
  - "Todos" → undefined (padrão, sempre à esquerda)
  - "Enviados" → "enviado"
  - "Pendentes" → "pendente"
  - "Bloqueados" → "bloqueado"
  - Mesma lógica de variante (default = selecionado, outline = não selecionado)
```

Organização dos chips: Em 2 linhas no mobile? Não — PRD03-01 mostra 3 chips em linha única scrollável. Implementar como linha única overflow-x-auto.

### 4.2 MatchList — container e layout

```
"use client"

<div className="flex flex-col gap-4 pb-20 md:pb-4">
  <MatchListHeader ... />

  {/* Estados */}
  {isLoading && <MatchListSkeleton count={5} />}
  {isError && !isLoading && <MatchesErrorState onRetry={refetch} />}
  {!isLoading && !isError && filteredGroups.length === 0 && (
    <MatchesEmptyState
      subtitle={hasActiveFilters ? "Tente limpar os filtros" : undefined}
    />
  )}

  {/* Lista agrupada */}
  {!isLoading && !isError && filteredGroups.length > 0 && (
    <div className="flex flex-col gap-6" role="list" aria-label="Jogos">
      {filteredGroups.map(group => (
        <section key={group.date} aria-labelledby={`section-${group.date}`}>
          <h2
            id={`section-${group.date}`}
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3"
          >
            {group.label}
          </h2>
          <div className="flex flex-col gap-4">
            {group.matches.map(item => (
              <MatchCard key={item.id} ... />
            ))}
          </div>
        </section>
      ))}
    </div>
  )}

  {/* TODO TASK-05: MatchFiltersSheet */}
</div>
```

### 4.3 Seção de dia — label de cabeçalho

```
text-xs font-semibold text-muted-foreground uppercase tracking-wide
mb-3
```

Não inclui a data completa ao lado do label de "Hoje"/"Amanhã" no cabeçalho de seção — o label do hook já é suficiente ("Hoje", "Amanhã", "12 de junho de 2026").

---

## 5. Tokens de cor e tipografia

| Elemento | Token |
|---|---|
| Título "Jogos" | `text-foreground text-2xl font-semibold` |
| Cabeçalho de seção | `text-muted-foreground text-xs font-semibold uppercase tracking-wide` |
| Input placeholder | `text-muted-foreground` (padrão shadcn) |
| Chip selecionado | `bg-primary text-primary-foreground` (Button default) |
| Chip não selecionado | `bg-background text-foreground border border-border` (Button outline) |
| Ícone busca | `text-muted-foreground` |
| Ícone filtros | `text-foreground` |
| Badge contador filtros | `bg-primary text-primary-foreground` |

---

## 6. Interações e estados

| Estado | Renderização |
|---|---|
| Loading | `<MatchListSkeleton count={5} />` — substitui toda a lista |
| Error | `<MatchesErrorState onRetry={refetch} />` |
| Empty (sem dados) | `<MatchesEmptyState message="Nenhum jogo encontrado" />` |
| Empty (com filtros) | `<MatchesEmptyState message="Nenhum jogo encontrado" subtitle="Tente limpar os filtros" />` |
| Busca sem resultado | Mesma empty state com subtitle |
| Normal | Seções por dia com MatchCard |

---

## 7. Acessibilidade

| Requisito | Implementação |
|---|---|
| Input de busca | `aria-label="Buscar jogos por seleção"`, `type="search"` |
| Botão filtros | `aria-label="Abrir filtros avançados"` |
| Chips de filtro | `role="group" aria-label="Filtros rápidos"` no wrapper, cada botão tem texto descritivo |
| Seções | `<section aria-labelledby>` + `<h2 id>` |
| Focus ring | Todos elementos interativos: `focus-visible:ring-2 ring-ring` |
| Área toque chips | mínimo `h-8 min-h-[32px]` — aceitável para ação secundária; botão filtros: `min-h-[44px]` |
| Loading state | O `MatchListSkeleton` já tem `role="status" aria-busy="true"` |
| Error state | `MatchesErrorState` já acessível |

---

## 8. Responsividade

| Breakpoint | Comportamento |
|---|---|
| Base (mobile) | Chips em linha scrollável, cards empilhados, pb-20 (BottomNav) |
| `md` (768px+) | max-w-4xl mx-auto, chips cabem sem scroll, pb-4 |
| `lg` (1024px+) | Conteúdo centralizado, SideNav presente (já no AppShell) |

---

## 9. Animações e transições

- Chips: `transition-colors duration-150` na troca de variante.
- Sem Framer Motion nesta tela (lista simples, sem AnimatePresence por ora).
- MatchCard já tem `hover:bg-accent transition-colors duration-150` (TASK-03).

---

## 10. Estrutura de arquivos definitiva

```
src/app/(app)/matches/page.tsx          ← Server Component: renderiza <MatchList />
src/features/matches/components/
  MatchListHeader.tsx                   ← Client Component: header + busca + chips
  MatchList.tsx                         ← Client Component: compositor principal
  __tests__/
    MatchListHeader.test.tsx
    MatchList.test.tsx
```
