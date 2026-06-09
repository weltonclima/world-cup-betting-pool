# SCREEN SPEC — Meu Ranking (resumo pessoal)
## Task: TASK-10
## Platform: web (mobile-first, responsivo)

## Visual Analysis (de docs/prd-05/PRD05-02-Meu-Ranking.png)
- **Header de tela** (chrome do mock): título "Meu Ranking" centralizado, voltar à esquerda, share à direita — chrome do mock; no app o Header global (`h-14`) + `RankingSubNav` já cobrem navegação. Subtítulo do mock fora do device: "Resumo do seu desempenho no bolão".
- **Header de destaque verde** (card hero arredondado, `bg-primary`, texto branco): label "Sua Posição Atual" (pequeno), número gigante "#4" em negrito com badge "Você" ao lado (pílula clara), e abaixo "de 28 participantes". É o elemento dominante do topo.
- **Grid 2×2 de cards brancos** (borda sutil, cantos arredondados): cada card tem label pequeno no topo (cinza) + número grande verde embaixo.
  - "Pontos" → **87** · "Acertos" → **12** · "Erros" → **12** · "Aproveitamento" → **25%** com sublinha "12 de 48 jogos".
  - (Os números do mock são 3/1/0; sob binário Pontos===Acertos — ver Gaps G1.)
- **Seção "Desempenho Geral"**: título à esquerda + mini-gráfico de linha verde com pontos rotulados (15, 10, 7, 5, 4) em R1..R5 no eixo X. Linha desce numericamente (posição melhora). Área sob a linha levemente preenchida.
- **Dois cards inferiores** lado a lado: "Melhor Posição" → **#4** + "Rodada 5"; "Média de Pontos" → **17,4** + "por rodada".
- **Bottom Tab Bar** fixo (Home/Jogos/Palpites/Ranking ativo/Perfil) — global, já existe.
- **Style signals:** verde primário no hero + números + linha do gráfico; branco/cinza-claro nos cards; números grandes em negrito; badge arredondado claro sobre verde; tipografia funcional; densidade média.

## 1. User and Business Goals
O participante abre "Meu Ranking" para ver, num relance, **como está indo**: posição atual no bolão, pontos/acertos/erros/aproveitamento, a trajetória de posição ao longo das rodadas e marcos pessoais (melhor posição, média por rodada). É a tela de auto-acompanhamento — motiva e contextualiza antes de mergulhar no ranking geral ou na evolução completa.

## 2. Design System Reference
- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`; §10 acessibilidade enhanced).
- Tema: `.ranking-theme` já aplicado no container raiz de `/rankings` (TASK-07) remapeia `--primary`/`--ring`/`--chart-1` para verde `oklch(0.46 0.16 150)`. Esta tela só usa tokens semânticos (`bg-primary`, `text-primary-foreground`, `text-primary`, `bg-card`, `text-muted-foreground`). Sem hex, sem inline.

## 3. User Flow
- Entrada: `RankingSubNav` → "Meu Ranking" (`/rankings/eu`); ou deep-link.
- Leitura passiva (sem interações obrigatórias). Ação contextual: "Ver evolução" → `/rankings/evolucao` (Tela 04 completa) a partir da seção do gráfico.
- Saída: trocar item na `RankingSubNav` ou aba no Bottom Tab Bar; back previsível (rota real).
- Edge: usuário ainda sem posição (recalc não rodou) → empty; falha de fetch → error + retry; carregando → skeleton; sem histórico de evolução → gráfico "Sem histórico ainda" + cards "—".

## 4. Information Architecture
1. (Header global + `RankingSubNav`, já existentes.)
2. **Hero de posição** (`MyRankingHeader`) — verde, dominante.
3. **Grid 2×2 de métricas** (`StatCard` × 4): Pontos, Acertos, Erros, Aproveitamento.
4. **Seção "Desempenho Geral"** — título + `EvolutionLineChart` + link "Ver evolução".
5. **Dois cards derivados** — Melhor Posição · Média de Pontos.
Estados (skeleton/empty/error) substituem o bloco 2–5 conforme as queries.

## 5. Layout and Components

Container: `max-w-4xl mx-auto px-4 py-4 pb-20` (pb-20 compensa Bottom Tab Bar). Empilhamento vertical com `space-y-4`/`gap-4`.

### MyRankingHeader (hero verde)
- `rounded-2xl bg-primary text-primary-foreground p-6 text-center` (cantos hero `rounded-2xl` conforme §5 do Master).
- Label "Sua Posição Atual" → `text-sm font-medium opacity-90`.
- Linha do número: `#N` em `text-4xl font-bold tabular-nums` + badge "Você" (`Badge` Shadcn, superfície clara sobre verde → `bg-primary-foreground text-primary` ou `bg-background/20 text-primary-foreground`; garantir AA) alinhado por `flex items-center justify-center gap-2`.
- Subtexto "de M participantes" → `text-sm opacity-90`.
- `aria-label="Sua posição atual: número N de M participantes"` no container.

### StatCard (grid 2×2)
- Grid: `grid grid-cols-2 gap-3` (2 colunas já no mobile, conforme mock; mantém em todos os breakpoints).
- Card: `rounded-lg border border-border bg-card p-4` (`shadow-none` flat-first).
- Label topo: `text-xs font-medium text-muted-foreground` (ex.: "Pontos").
- Valor: `text-3xl font-bold tabular-nums text-primary` (verde no escopo).
- Hint opcional (só Aproveitamento): `text-xs text-muted-foreground` ("12 de 48 jogos").
- Ícone Lucide pequeno opcional no topo (`Trophy`/`Target`/`XCircle`/`Percent`, `size={16} aria-hidden`) — decoração leve; cor herda do card. **Manter sóbrio** (Master: baixa distração).
- Mapeamento: Pontos=`entry.points`; Acertos=`entry.points` (=`totalCorrect`); Erros=`totalWrong ?? "—"`; Aproveitamento=`accuracy%` + hint "X de Y jogos".

### Seção "Desempenho Geral"
- Título `text-lg font-medium` ("Desempenho Geral") + link "Ver evolução" (`Button variant="link"` / `next/link`, `min-h-11`) à direita: `flex items-center justify-between`.
- `EvolutionLineChart` (TASK-06): recebe `data` mapeado de `positionHistory` (scope geral) → `{ label: "R{n}", position }`. Altura `h-48` (default do componente). Linha verde (`--chart-1`), eixo Y invertido (posição menor no topo).
- **Alternativa textual** do gráfico: `sr-only` com a sequência ("Posição por rodada: R1 #15, R2 #10, R3 #7, R4 #5, R5 #4") ou `aria-label` no wrapper. Vazio → componente já mostra "Sem histórico ainda".

### Cards derivados (linha inferior)
- `grid grid-cols-2 gap-3`.
- Mesmo padrão visual do `StatCard` (pode reusar `StatCard`): 
  - "Melhor Posição" → valor `#N` + hint "Rodada N" (ícone `Award`).
  - "Média de Pontos" → valor `17,4` (pt-BR, 1 decimal) + hint "por rodada" (ícone `TrendingUp`).
- Derivações no client (ver spec §6.3); "—" quando sem histórico.

## 6. Typography and Color Tokens
- Números de destaque: `text-3xl`/`text-4xl font-bold tabular-nums`.
- Labels de card: `text-xs font-medium text-muted-foreground`. Títulos de seção: `text-lg font-medium`.
- Cores: `--primary` (hero, números, linha), `--primary-foreground` (texto no hero), `--card`/`--border`/`--foreground`/`--muted-foreground` (cards), `--chart-1` (gráfico). **Sem hex, sem inline.**

## 7. UI States
| Estado | Tratamento |
|---|---|
| Loading | `RankingSkeleton` (>300ms) — esqueleto de hero + cards |
| Empty | `RankingEmptyState` ("Você ainda não está no ranking", subtítulo: "Faça seus palpites e volte após a apuração.") quando `useMyRanking`=`null` ou profile=`null` |
| Error | `RankingErrorState` + "Tentar Novamente" (`onRetry` = refetch das duas queries) |
| Populated | hero + grid + gráfico + cards derivados |
| Gráfico vazio | `EvolutionLineChart` "Sem histórico ainda"; cards derivados "—" |

## 8. Accessibility Requirements (Priority 1) — Enhanced
- Contraste: hero verde (`--primary` 0.46) + texto branco ≥ AA (validado); badge "Você" sobre verde ≥ AA; números verdes sobre card branco ≥ AA.
- **Gráfico não-visual:** alternativa textual obrigatória (`sr-only`/`aria-label`) — cor/linha não são único meio. A própria Tela 04 (lista de rodadas) é a alternativa completa (link "Ver evolução").
- `tabular-nums` em todos os números (alinhamento + legibilidade).
- Foco visível (`ring-2 ring-ring`) no link "Ver evolução" e no botão de retry; ordem de tab = ordem visual.
- Cor não é único indicador (badge "Você" é textual; labels nomeiam cada métrica).
- `prefers-reduced-motion`: sem animação de entrada do gráfico/transições supérfluas (`motion-reduce:*`).
- Alvos ≥44px (link/botões `min-h-11`); ≥8px entre alvos. Headings sequenciais (h1/h2 da seção → labels). Text scaling sem truncar números.

## 9. Animation and Motion (Priority 7)
- Skeleton `animate-pulse` com `motion-reduce:animate-none`.
- Transições de cor em links `transition-colors duration-150`. Sem animar width/height. Gráfico Recharts sem animação custosa (ou desligada em reduced-motion).

## 10. Navigation Patterns (Priority 9)
- Alcançada via `RankingSubNav` (item "Meu Ranking", `/rankings/eu`) — definido na TASK-07.
- Saída contextual: "Ver evolução" → `/rankings/evolucao` (Tela 04). Bottom Tab Bar global inalterado (Ranking ativo).

## 11. Pre-Delivery Checklist Status
- Ícones Lucide (sem emoji) ✓ · tokens semânticos (sem hex/inline) ✓ · alvos ≥44px ✓ · estados definidos ✓ · reduced-motion ✓ · foco/aria + alternativa textual do gráfico ✓ · mobile-first (grid 2×2) ✓ · tabular-nums ✓.

## 12. Design Gaps and Assumptions
- **G1 (CRÍTICO — Pontos vs Acertos):** o mock mostra Pontos 87 e Acertos 12 (números diferentes) porque assumia 3/1/0. **Sob binário, Pontos === Acertos (mesmo número).** Decisão default: **manter os dois cards exibindo o mesmo valor (`entry.points`) + microcopy/tooltip** "cada placar exato vale 1 ponto — pontos e acertos são iguais". **Alternativa a validar:** remover "Acertos" e usar "Maior Sequência" (`longestStreak`) no lugar, deixando o grid sem redundância. **Confirmar antes do /implement.**
- **G2:** os números 15/10/7/5/4 sobre os pontos do gráfico são **posições**, não pontos — coerente com `EvolutionLineChart` (plota `position`, eixo Y invertido). A "queda" numérica = melhora de posição; o eixo invertido comunica isso. Sem inverter o sentido.
- **G3 (denominador "X de Y jogos"):** Y no client = acertos + erros (palpites finalizados). Se o recalc expuser total de partidas finalizadas (A2 do PRD), preferir esse Y. Default: acertos+erros.
- **G4 ("Erros" sem `totalWrong`):** doc legado pode não ter `totalWrong` (opcional) → exibir "—". Default "—" (não assumir 0).
- **G5 (Melhor Posição / Média por rodada):** derivados no client a partir de `positionHistory` + `entry.points` (sem campo dedicado). "—" quando `positionHistory` vazio. Se instável, promover ao recalc (TASK-03).
- **G6 (header de tela do mock):** "voltar/compartilhar/título Meu Ranking" do mock são chrome do device; no app, Header global + `RankingSubNav` cobrem isso — não recriar barra de título própria.
