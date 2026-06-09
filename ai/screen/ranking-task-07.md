# SCREEN SPEC — Shell de Ranking (navegação + estados)
## Task: TASK-07
## Platform: web (mobile-first, responsivo)

## Visual Analysis (dos screenshots docs/prd-05/)
- Fonte: PRD05-01..06 (vistos diretamente).
- Layout: header de destaque verde no topo de telas-resumo; conteúdo em cards brancos; **segmented tabs** no topo da Tela 01 ("Geral / Por Fase / Por Grupo") e Tela 03 ("Por Fase / Por Grupo"); Bottom Tab Bar fixo (Home/Jogos/Palpites/Ranking/Perfil) com Ranking ativo (troféu).
- Style signals: verde primário (header, aba ativa), branco/cinza claro nos cards, números grandes em negrito, badges arredondados, avatares circulares.
- States visible: listas populadas (não há loading/empty/error nos mocks → derivar do padrão do app).
- Assumptions: Meu Ranking/Evolução/Perfil/Estatísticas são telas próprias alcançadas por nav contextual.

## 1. User and Business Goals
Participante navega entre as visões de ranking (geral, por fase/grupo, pessoal, evolução, perfil de outro, estatísticas) a partir da aba Ranking, com feedback claro de carregamento/erro/vazio. Esta task entrega o **esqueleto navegável + estados**; o conteúdo vem nas TASK-08..13.

## 2. Design System Reference
- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`).
- Tema: classe `.ranking-theme` no container raiz de `/rankings` remapeia `--primary`/`--ring`/`--chart-1` p/ verde `oklch(0.46 0.16 150)` (padrão `.auth-theme`/`.palpites-theme`). Componentes usam tokens semânticos (`bg-primary`, `text-primary`).

## 3. User Flow
- Entrada: Bottom Tab Bar → Ranking (`/rankings`).
- `RankingSubNav` (segmented) alterna: **Geral** (`/rankings`) · **Fases** (`/rankings/fase`) · **Meu Ranking** (`/rankings/eu`) · **Estatísticas** (`/rankings/estatisticas`).
- Contextual: linha de participante → `/rankings/perfil/[uid]`; Meu Ranking → "Ver evolução" → `/rankings/evolucao`.
- Saída: trocar de aba no Bottom Tab Bar; back do navegador previsível (rotas reais).
- Edge: sem dados → empty; falha de fetch → error + retry; carregando → skeleton.

## 4. Information Architecture
1. `RankingSubNav` (topo, sticky abaixo do header global).
2. Slot de conteúdo da rota ativa.
3. Estados (substituem o slot conforme query): skeleton / empty / error.
Bottom Tab Bar e Header globais já existem (AppShell) — não duplicar.

## 5. Layout and Components

### RankingSubNav
- Segmented horizontal, scroll-x no mobile (`overflow-x-auto`, sem scrollbar visível), itens `next/link`.
- Item: `min-h-11` (44px), `px-4`, `text-sm`. Ativo: `text-primary font-semibold` + borda inferior `border-b-2 border-primary`; inativo: `text-muted-foreground border-b-2 border-transparent`.
- `aria-current="page"` no ativo (via `usePathname`). `role="navigation"` `aria-label="Navegação de ranking"`.
- Sticky: `sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border` (top-14 = abaixo do Header h-14).

### RankingSkeleton
- Lista de N linhas (default 8): cada linha = círculo (avatar) `h-10 w-10 rounded-full bg-muted` + duas barras `bg-muted rounded` (nome larga, métrica curta) + bloco à direita.
- `animate-pulse` com `motion-reduce:animate-none`. `role="status"` `aria-label="Carregando ranking"`.

### RankingEmptyState
- Centralizado: ícone Lucide (`Users` ou `Trophy`) `size={40} text-muted-foreground`, título "Nenhum participante encontrado" (`text-base font-medium`), subtítulo opcional (`text-sm text-muted-foreground`).
- `role="status"`.

### RankingErrorState
- Centralizado: ícone `AlertTriangle` `text-destructive`, mensagem "Erro ao carregar ranking" (`text-base font-medium`), botão `Button` (variant default → verde no escopo) "Tentar Novamente" `onClick={onRetry}`. `min-h-11`.
- `role="alert"`.

### Páginas (stubs nesta task)
- `page.tsx` (Server Component fino) por rota → renderiza componente client da feature. Nesta task, rotas ainda-não-implementadas renderizam um stub com `RankingSubNav` + texto "Em construção" (substituído nas TASK-08..13). `/rankings` (Geral) e estados já podem ser exercitados.

## 6. Typography and Color Tokens
- Títulos de seção `text-2xl font-semibold`; números de destaque `text-3xl/4xl font-bold tabular-nums` (telas 08+).
- Cores: `--primary` (verde escopo), `--foreground`, `--muted-foreground`, `--card`, `--border`, `--destructive`. Sem hex.

## 7. UI States
| Estado | Tratamento |
|---|---|
| Loading | `RankingSkeleton` (>300ms) |
| Empty | `RankingEmptyState` ("Nenhum participante encontrado") |
| Error | `RankingErrorState` + "Tentar Novamente" (`onRetry`=refetch) |
| Populated | conteúdo das TASK-08..13 |
| Active nav | item destacado (cor+peso+borda, `aria-current`) |
| Disabled | n/a nesta task |

## 8. Accessibility Requirements (Priority 1)
- Contraste: verde `--primary` (0.46) + branco ≥ AA (validado em auth/palpites); aba ativa verde sobre branco ≥ AA.
- Foco visível (`ring-2 ring-ring`); ordem de tab = ordem visual; `aria-current` na rota ativa.
- Cor não é único indicador (peso + borda inferior na aba).
- `prefers-reduced-motion`: skeleton sem pulse.
- Alvos ≥44px; ≥8px entre itens. Headings sequenciais.

## 9. Animation and Motion (Priority 7)
- Skeleton `animate-pulse` (≤ suave), desligado em reduced-motion.
- Transição de cor da aba `transition-colors duration-150`. Sem animar width/height.

## 10. Navigation Patterns (Priority 9)
- Bottom Tab Bar (global, 5 itens) inalterado; Ranking ativo.
- `RankingSubNav` = navegação secundária dentro da seção; rota atual destacada; deep-links reais por rota; back previsível.

## 11. Pre-Delivery Checklist Status
- Ícones Lucide (sem emoji) ✓ · tokens semânticos ✓ · alvos ≥44px ✓ · estados definidos ✓ · reduced-motion ✓ · foco/aria ✓ · mobile-first ✓.

## 12. Design Gaps and Assumptions
- **G1:** Itens fixos da sub-nav = Geral/Fases/Meu Ranking/Estatísticas (assunção; Evolução e Perfil ficam contextuais). Validar ao montar Tela 02/05.
- **G2:** Meu Ranking como rota `/rankings/eu` (deep-link) — assunção.
- **G3:** "Por Grupo" aparece como sub-aba dentro de `/rankings/fase` (Tela 03) — detalhado na TASK-09.
