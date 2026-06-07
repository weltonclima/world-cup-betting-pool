# Screen Design — TASK-05: Sheet de Filtros

> Gerado para: Bolão dos Parças | PRD-03 | Branch `feat/integracao-api-football`
> Referências: `design-system/MASTER.md`, `docs/prd-03/PRD03-03-Tabela-Grupos.png`
> Plataforma alvo: Mobile-first (bottom sheet); responsivo até desktop.

---

## 1. Visão geral

O `MatchFiltersSheet` é um **bottom sheet** que abre sobre a lista de jogos ao clicar no botão
de filtros avançados (ícone `SlidersHorizontal` no `MatchListHeader`). Exibe três seções de
filtro e duas ações. A imagem `PRD03-03` é a fonte de verdade do layout.

---

## 2. Anatomia do Sheet (leitura da imagem PRD03-03)

```
┌─────────────────────────────────────────────────────┐
│  Filtros                                          [X] │  ← SheetHeader
├─────────────────────────────────────────────────────┤
│                                                       │
│  Fase                                                 │  ← Label seção
│  ┌───────────────┐ ┌──────────┐                       │
│  │ Fase de Grupos│ │ Oitavas  │                       │  ← Botões toggle (row-wrap)
│  └───────────────┘ └──────────┘                       │
│  ┌──────────┐ ┌────────────┐                          │
│  │ Quartas  │ │  Semifinal │                          │
│  └──────────┘ └────────────┘                          │
│  ┌──────────┐ ┌──────────┐                            │
│  │  3º Lugar│ │  Final   │                            │
│  └──────────┘ └──────────┘                            │
│                                                       │
│  Status do Palpite                                    │  ← Label seção
│  ┌──────┐ ┌───────────────┐                           │
│  │ Todos│ │ Palpite Enviado│                          │  ← Botões toggle
│  └──────┘ └───────────────┘                           │
│  ┌─────────────────┐ ┌───────────────────┐            │
│  │ Palpite Pendente│ │  Jogo Encerrado   │            │
│  └─────────────────┘ └───────────────────┘            │
│  ┌────────────┐                                       │
│  │  Bloqueado │                                       │
│  └────────────┘                                       │
│                                                       │
│  Seleção                                              │  ← Label seção
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🔍 Buscar seleção                               │  │  ← Input busca
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  ○ Todas as seleções                        ●   │  │  ← Opção "Todas"
│  │  ○ Brasil                                       │  │
│  │  ○ Argentina                                    │  │  ← Lista scrollável
│  │  ○ França                                       │  │
│  │  ○ Alemanha                                     │  │
│  │  ○ Espanha                                      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Aplicar Filtros                    │  │  ← Botão primary
│  └─────────────────────────────────────────────────┘  │
│              Limpar Filtros                            │  ← Botão ghost/link
└─────────────────────────────────────────────────────┘
```

---

## 3. Tokens e classes (design system)

### 3.1 Sheet container

| Propriedade | Classe Tailwind | Token |
|---|---|---|
| Background | `bg-background` | `--background` |
| Borda top | `rounded-t-2xl` | `--radius-2xl` |
| Sombra | `shadow-xl` | Elevação 4 |
| Z-index | gerenciado pelo shadcn | `z-[100]` |
| Padding interno | `p-6` | 24px |
| Max height | `max-h-[90vh]` | — |
| Overflow | `overflow-y-auto` | — |

### 3.2 Header do sheet

| Elemento | Classes |
|---|---|
| Título "Filtros" | `text-xl font-semibold text-foreground` |
| Botão fechar X | `Button variant="ghost" size="icon"` com `X` icon `size={20}` |
| Container header | `flex items-center justify-between mb-4` |

### 3.3 Labels de seção

```
text-sm font-semibold text-foreground mb-3
```

### 3.4 Botões toggle de opção (Fase e Status)

Estado **não selecionado:**
```
variant="outline" size="sm"
rounded-lg h-9 px-3 text-sm
```

Estado **selecionado** (baseado na imagem — fundo verde escuro = `bg-primary text-primary-foreground`):
```
variant="default" size="sm"
rounded-lg h-9 px-3 text-sm
bg-primary text-primary-foreground
```

Layout: `flex flex-wrap gap-2` (wrap automático para acomodar labels longos).

### 3.5 Lista de seleções

Container: `max-h-48 overflow-y-auto border border-border rounded-lg`

Item:
```
flex items-center gap-3 px-3 py-2.5 min-h-[44px]
hover:bg-accent cursor-pointer
text-sm text-foreground
```

Item selecionado (indicado por check ou fundo):
```
bg-accent text-accent-foreground
```

"Todas as seleções" item — sempre no topo, com `●` quando selecionado (conforme imagem):
```
flex items-center justify-between px-3 py-2.5 min-h-[44px]
```

Ícone de seleção ativa: `Check` de `lucide-react` `size={16}` `text-primary`.

### 3.6 Input de busca

```
shadcn Input
placeholder="Buscar seleção"
className="pl-9" (ícone Search à esquerda)
```

### 3.7 Área de ações (footer do sheet)

```
flex flex-col gap-2 mt-6 pt-4 border-t border-border
```

**Aplicar Filtros:**
```
Button variant="default" className="w-full h-11"
```

**Limpar Filtros:**
```
Button variant="ghost" className="w-full h-10 text-muted-foreground"
```

---

## 4. Comportamento de estado visual

### Fase — estado visual

| Botão | Não selecionado | Selecionado |
|---|---|---|
| "Todas as fases" | `variant="outline"` | `variant="default"` |
| "Fase de Grupos" | `variant="outline"` | `variant="default"` (verde) |
| etc. | `variant="outline"` | `variant="default"` (verde) |

Nota: a imagem mostra "Fase de Grupos" em verde escuro (primary) e "Oitavas", "Quartas" etc. em
branco/outline. Isso é consistente com `variant="default"` para selecionado e `variant="outline"`
para não selecionado no design system.

### Status — estado visual (imagem PRD03-03)

- "Todos" aparece selecionado (fundo escuro).
- "Palpite Enviado", "Palpite Pendente", "Jogo Encerrado", "Bloqueado" — não selecionados (outline).

### Seleção — estado visual

- "Todas as seleções" tem indicador `●` (check verde) à direita quando selecionado (conforme imagem).
- Items de team: ícone `Check` à direita quando selecionado.

---

## 5. Responsividade

### Mobile (< 768px) — padrão

- Sheet com `side="bottom"`.
- Abre da borda inferior, empurra conteúdo.
- Padding: `px-4 pb-6 pt-4`.
- Lista de seleções: `max-h-40` para caber acima do fold no mobile.

### Desktop (≥ 768px)

- Shadcn Sheet continua como bottom sheet (design unificado).
- Ou pode mudar para `side="right"` — porém a imagem mostra bottom, manter `side="bottom"` como
  padrão unificado.
- Conteúdo centralizado: `max-w-md mx-auto` no container interno se necessário.

---

## 6. Acessibilidade

| Requisito | Solução |
|---|---|
| Focus trap | Radix UI Dialog (base do shadcn Sheet) — automático |
| Fechar por ESC | Radix UI — automático |
| Fechar por overlay | Radix UI — automático |
| Foco retorna ao trigger | Radix UI — automático |
| Botões toggle | `aria-pressed` + rótulos descritivos |
| Lista seleções | `role="listbox"` + `role="option"` + `aria-selected` |
| Input busca | `aria-label="Buscar por seleção"` |
| Área de toque | `min-h-[44px]` em todos os itens interativos |
| Contraste WCAG AA | Tokens semânticos — garantidos pelo design system |
| Label de seção associado | `<h3>` ou `<p>` como label visual (não precisa de `aria-labelledby` nos grupos de botões, pois são visualmente adjacentes) |

---

## 7. Microinterações

- Sheet: transição built-in do shadcn (slide from bottom) — `motion-reduce:transition-none`.
- Botões de toggle: `transition-colors duration-150` — hover suave.
- Items da lista: `hover:bg-accent transition-colors duration-100`.
- Sem animações extras (Framer Motion não necessário aqui).

---

## 8. Variações de estado

### Sheet vazio (sem teams carregados)

```
Seleção
[🔍 Buscar seleção]
○ Todas as seleções
(lista vazia — sem mensagem de erro; dados de teams têm staleTime 24h)
```

### Sheet com busca ativa

```
Seleção
[🔍 bras]
○ Todas as seleções   ← sempre visível
○ Brasil              ← único resultado
```

### Sheet com filtro de seleção ativo

```
○ Todas as seleções
● Brasil [✓]          ← indicado com check verde
○ Argentina
```

---

## 9. Layout detalhado — componentes shadcn usados

```tsx
<Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
  <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Filtros</SheetTitle>
    </SheetHeader>
    {/* Seção Fase */}
    {/* Seção Status do Palpite */}
    {/* Seção Seleção */}
    {/* Ações */}
  </SheetContent>
</Sheet>
```

`SheetClose` é usado no botão X automático do shadcn, ou pode ser adicionado via `asChild`.

---

## 10. Desvios intencionais da imagem

| Item na imagem | Decisão | Razão |
|---|---|---|
| "Bloqueado" como item separado de status | Mantido como `predictionStatus="bloqueado"` | Consistência com enum existente |
| Indicador de seleção `●` circular | Implementado como `Check` icon ou `●` | Mais acessível (não apenas visual) |
| Fundo verde = primary | `bg-primary text-primary-foreground` | Segue token do design system |
