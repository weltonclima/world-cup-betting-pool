# SCREEN SPEC — Evolução no Ranking (Tela 04)
## Task: TASK-11
## Platform: web (mobile-first, responsivo)

## Visual Analysis (de docs/prd-05/PRD05-04-Evolucao-Ranking.png)
- **Cabeçalho da seção** (acima do mock do app): "4. Evolução no Ranking" + "Veja como sua posição evoluiu ao longo das rodadas".
- **Header de destaque verde** (card arredondado, verde escuro→médio): título branco "Sua evolução nas rodadas" no canto superior esquerdo, e **gráfico de linha** ocupando o card.
  - Linha branca ascendente (posição melhorando) ligando 5 pontos rotulados acima de cada nó: **#15 → #10 → #7 → #5 → #4**.
  - Eixo X com rótulos **R1 R2 R3 R4 R5** (5 rodadas).
  - Eixo Y implícito invertido: ponto mais alto = melhor posição (#4 no topo à direita, #15 mais baixo à esquerda).
- **Lista de rodadas** (card branco, mais recente no topo), uma linha por rodada:
  - `Rodada 5` · badge cinza-claro **"Atual"** · `#4` · **↑ 1** (verde)
  - `Rodada 4` · `#5` · **↑ 1** (verde)
  - `Rodada 3` · `#7` · **↑ 3** (verde) [pela imagem: subiu de #10 para #7]
  - `Rodada 2` · `#10` · **↑ 5** (verde) [subiu de #15 para #10]
  - `Rodada 1` · `#15` · **—** (cinza, manteve/sem anterior)
  - Cada linha: rótulo à esquerda (`text-foreground`), posição `#N` à direita em negrito (`tabular-nums`), indicador (ícone seta + número) à extrema direita.
- **Legenda** (rodapé do conteúdo): **↑ Subiu** (verde) · **— Manteve** (cinza) · **↓ Caiu** (vermelho).
- **Bottom Tab Bar** fixo (Home/Jogos/Palpites/Ranking/Perfil), Ranking ativo (troféu).
- **Style signals:** header verde com gráfico embutido, números grandes em negrito, badge arredondado claro para "Atual", setas Lucide coloridas + número, divisórias sutis entre linhas.

## 1. User and Business Goals
O participante vê como sua **posição no ranking geral evoluiu rodada a rodada** — visual (gráfico) + textual (lista com subiu/manteve/caiu e delta). Reforça engajamento e dá leitura rápida de tendência. Esta tela é só do **usuário logado** (reusa `useParticipantProfile(uid)` com o próprio uid).

## 2. Design System Reference
- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`; §10 acessibilidade Enhanced).
- Tema: a rota `/rankings` já aplica `.ranking-theme` (TASK-07) → `--primary` verde `oklch(0.46 0.16 150)`, `--chart-1` verde (linha do gráfico). Componentes usam tokens semânticos (`bg-primary`, `text-primary`, `text-destructive`, `text-muted-foreground`) — sem hex/inline.

## 3. User Flow
- Entrada: contextual a partir de **Meu Ranking** ("Ver evolução") → `/rankings/evolucao` (a sub-nav fixa não tem item próprio para Evolução — G1 da TASK-07). Deep-link direto também válido.
- Conteúdo: header verde + gráfico (topo) → lista de rodadas → legenda.
- Saída: back do navegador; Bottom Tab Bar.
- Edge: sem histórico → empty ("Sem histórico ainda"); falha de fetch → error + retry; carregando → skeleton.

## 4. Information Architecture
1. Header de destaque verde (`bg-primary text-primary-foreground`): título "Sua evolução nas rodadas" + `EvolutionLineChart`.
2. Card de lista de rodadas (recente → antiga).
3. Legenda (Subiu/Manteve/Caiu).
Bottom Tab Bar e Header globais já existem (AppShell) — não duplicar. Sub-nav da TASK-07 herdada pelo layout.

## 5. Layout and Components

### Header de evolução (gráfico)
- Container `rounded-2xl bg-primary text-primary-foreground p-4` (card hero verde).
- Título `text-base font-semibold` "Sua evolução nas rodadas".
- `EvolutionLineChart` (TASK-06) abaixo do título: recebe `data = positionHistory(ascendente).map(h => ({ label: "R"+round||índice, position: h.position }))`. Eixo Y já invertido; estado vazio textual embutido.
- Nota: o `EvolutionLineChart` usa `--chart-1` (verde no escopo) para a stroke; dentro do header verde, garantir contraste do traço/grid (validar no `/screen` de implementação — ver G2).

### Lista de rodadas (`EvolutionRow`)
- Card branco `rounded-lg border border-border bg-card`, linhas separadas por `divide-y divide-border`.
- Cada linha: `flex items-center justify-between min-h-11 px-4 py-3`.
  - Esquerda: rótulo `Rodada N` (`text-sm text-foreground`) + (se mais recente) `Badge` "Atual" (`variant secondary`, `text-xs`).
  - Direita: posição `#N` (`text-base font-bold tabular-nums`) + indicador.
- Indicador (à extrema direita, `flex items-center gap-1`):
  - subiu → `<ArrowUp size={16} aria-hidden />` + delta, `text-primary`.
  - caiu → `<ArrowDown size={16} aria-hidden />` + delta, `text-destructive`.
  - manteve → `<Minus size={16} aria-hidden />`, `text-muted-foreground` (sem delta, ou "—").
  - `aria-label` textual na linha/indicador: "subiu 1 posição", "caiu 2 posições", "manteve a posição".

### Legenda (`EvolutionLegend`)
- `flex flex-wrap gap-4 text-xs` com 3 itens: ícone + texto.
  - `ArrowUp text-primary` + "Subiu" · `Minus text-muted-foreground` + "Manteve" · `ArrowDown text-destructive` + "Caiu".
- Título opcional "Legenda" (`text-sm font-medium`), como na imagem.

### Página (stub → conteúdo)
- `src/app/(app)/rankings/evolucao/page.tsx` (Server Component fino) → renderiza `<Evolution />` (client). Substitui o stub "Evolução em construção".

## 6. Typography and Color Tokens
- Título do header `text-base font-semibold` (`text-primary-foreground` no card verde).
- Rótulo de rodada `text-sm`; posição `text-base font-bold tabular-nums`; delta `text-sm`.
- Cores: `--primary` (subiu/header), `--destructive` (caiu), `--muted-foreground` (manteve/labels), `--card`/`--border`/`--foreground`/`--primary-foreground`. **Sem hex; sem inline.**

## 7. UI States
| Estado | Tratamento |
|---|---|
| Loading | `RankingSkeleton` (>300ms) |
| Empty (sem histórico) | `RankingEmptyState` — "Sem histórico ainda" + subtítulo opcional ("Sua evolução aparece após a primeira rodada") |
| Error | `RankingErrorState` + "Tentar Novamente" (`onRetry`=refetch) |
| Populated | header verde + gráfico + lista + legenda |
| 1 rodada só | exibir único ponto + 1 linha ("—", "Atual") — não tratar como empty |

## 8. Accessibility Requirements (Priority 1)
- **Gráfico tem alternativa textual = a própria lista** (Recharts SVG é complementar; toda informação está na lista de rodadas).
- **Cor não é único indicador:** todo indicador combina ícone (ArrowUp/ArrowDown/Minus) + valor/texto + `aria-label`. A legenda também usa ícone + rótulo.
- Contraste: verde `--primary` (0.46) sobre branco e branco sobre header verde ≥ AA (validado em auth/palpites); `--destructive` sobre branco ≥ AA.
- Foco visível (`ring-2 ring-ring`) em elementos focáveis (botão de retry); ordem de tab = visual; headings sequenciais.
- `prefers-reduced-motion`: skeleton sem pulse; sem animação de entrada do gráfico/linhas.
- `tabular-nums` em posições e deltas (alinhamento e leitura por screen reader consistentes).
- Alvos interativos ≥44px (botão retry; linhas não são interativas nesta tela).

## 9. Animation and Motion (Priority 7)
- Skeleton `animate-pulse` com `motion-reduce:animate-none`.
- Sem animação de desenho da linha do gráfico (ou desligada em reduced-motion).
- Transições de cor (se houver) `transition-colors duration-150`.

## 10. Navigation Patterns (Priority 9)
- Bottom Tab Bar global inalterado; Ranking ativo.
- Evolução é alcançada **contextualmente** (a partir de Meu Ranking) — não há item fixo na `RankingSubNav` (G1 da TASK-07). Deep-link `/rankings/evolucao` funcional; back previsível.

## 11. Pre-Delivery Checklist Status
- Ícones Lucide named (ArrowUp/ArrowDown/Minus), sem emoji ✓ · tokens semânticos (sem hex/inline) ✓ · gráfico com alternativa textual (lista) ✓ · cor + ícone + texto nos indicadores ✓ · estados loading/empty/error definidos ✓ · reduced-motion ✓ · foco/aria ✓ · mobile-first + `pb-20` ✓ · `tabular-nums` ✓.

## 12. Design Gaps and Assumptions
- **G1 (rótulo):** "Rodada N" na lista vs "RN" no eixo X do gráfico (ambos na imagem). Assunção: lista = "Rodada N"; gráfico = "RN". Confirmar.
- **G2 (contraste do gráfico no header verde):** `EvolutionLineChart` usa `--chart-1` (verde) como stroke; sobre fundo verde do header o traço pode ter baixo contraste. Opções: (a) header verde com o gráfico em superfície clara aninhada, ou (b) ajustar a stroke para `--primary-foreground`/branco **dentro do header** via token. Resolver na implementação sem hex. A imagem mostra **linha branca sobre verde** → preferir stroke clara no header. Pode exigir variante/override de cor do chart no escopo do header (registrar como ajuste de TASK-06 se necessário).
- **G3 ("rodada" = recalc):** decisão A4 do PRD — cada execução de `/api/rankings/recalc` = um ponto; `round` é o nº/rótulo. Numeração assumida contígua começando em 1. Rodada 1 não tem anterior → "—" (manteve).
- **G4 (escopo):** lista/gráfico filtram `positionHistory` ao escopo **"geral"** (default). Validar se há intenção de evolução por fase (fora do escopo desta task).
- **G5 (empty vs go-live):** sem histórico retroativo (R6 do plano) — antes do 1º recalc a tela fica em **empty**. Mensagem deve deixar claro que a evolução aparece após a primeira rodada.
