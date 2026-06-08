# SCREEN SPEC — Perfil do Participante
## Task: TASK-12
## Platform: web (mobile-first, responsivo)

## Visual Analysis (fonte de verdade: `docs/prd-05/PRD05-05-Perfil-Participante.png`)
- **Header de contexto** (topo, fora do card): título "Perfil do Participante", legenda "Veja as estatísticas de qualquer participante do bolão.", ícone de voltar (`<`) à esquerda e ícone de compartilhar à direita (estilo de tela de detalhe).
- **Bloco de identidade** centralizado em card branco: avatar circular **grande** com borda, Nome em destaque (`text-xl/2xl font-semibold`, ex.: "Lucas Pereira"), subtítulo "Participante desde 20/05/2026" (`text-xs/sm text-muted-foreground`).
- **Card "Posição Atual":** rótulo centralizado "Posição Atual", número grande verde `#5` (`text-3xl/4xl font-bold`), "de 28 participantes" (`text-sm text-muted-foreground`).
- **Grid 2x2 de métricas** (cards brancos): Pontos (82), Acertos (11), Erros (13), Aproveitamento (23% + "11 de 48 jogos"). Rótulo pequeno em cima, número grande verde embaixo. *(Valores do mock seguem 3/1/0 — IGNORAR a magnitude; sob binário Pontos === Acertos.)*
- **"Desempenho por Fase":** título de seção à esquerda; linha/grid de cards por fase: "Fase de Grupos #3 24 pts", "Oitavas de Final #6 8 pts", "Quartas de Final - 0 pts". Cada card = nome da fase (`text-xs`), posição (`#N`, destaque) e pts.
- **Botão verde full-width** "Ver histórico de palpites" (`bg-primary text-primary-foreground`, `rounded-lg`).
- **Bottom Tab Bar** fixo com Ranking ativo (troféu).
- **Style signals:** verde primário nos números e no CTA, branco/cinza nos cards, números grandes em negrito, avatar circular grande, layout vertical empilhado.
- **States visible:** só populado no mock → loading/empty/error/not-found derivados do padrão do app (TASK-07).

## 1. User and Business Goals
Participante visualiza as estatísticas de **outro** membro do bolão (alcançado clicando numa linha do ranking), comparando posição/pontuação/aproveitamento. Tela **somente-leitura**. O acesso ao histórico de palpites do outro usuário está **bloqueado por A5** (decisão de produto pendente).

## 2. Design System Reference
- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`; §3 tipografia; §5 radius; §10 acessibilidade enhanced).
- Tema: `.ranking-theme` já aplicado no container raiz de `/rankings` (TASK-07 / `layout.tsx`) remapeia `--primary`/`--ring`/`--chart-1` para verde `oklch(0.46 0.16 150)`. Esta tela **herda** — usa só tokens semânticos (`bg-primary`, `text-primary`, `text-primary-foreground`, `bg-card`, `text-muted-foreground`, `border-border`). Sem hex, sem inline.

## 3. User Flow
- Entrada: linha de participante no Ranking Geral/Fase (TASK-08/09) → `next/link` → `/rankings/perfil/[uid]`. `uid` via `useParams()` (client) ou `params` (Server Component fino).
- Conteúdo: leitura de `useParticipantProfile(uid)` (statistics) + entry do uid em `useRanking("geral")` (name/position/points/wrong/accuracy/total).
- Saída: botão voltar (`<`) / back do navegador; Bottom Tab Bar.
- Bloqueado: "Ver histórico de palpites" — **não navega** (A5). Oculto (default) ou desabilitado.
- Edge: uid inexistente / sem statistics → estado "Participante não encontrado"; falha de fetch → error + retry; carregando → skeleton.

## 4. Information Architecture
1. Header de contexto (título + legenda + voltar/compartilhar). *(Voltar/compartilhar: ver Gap G2.)*
2. Bloco de identidade (avatar + nome + "participante desde").
3. Card "Posição Atual #N de M".
4. Grid 2x2 (Pontos / Acertos / Erros / Aproveitamento).
5. Seção "Desempenho por Fase" (cards por fase).
6. CTA "Ver histórico de palpites" (condicionado a A5).
Header global + Bottom Tab Bar já existem (AppShell) — não duplicar. Sub-nav (`RankingSubNav`) NÃO aparece nesta tela (perfil é contextual, fora dos 4 itens fixos — ver TASK-07 G1).

## 5. Layout and Components

### Container
- `flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto` (mobile-first; centraliza em telas largas — tela de perfil é estreita). `pb-20` já no layout.

### Header de identidade
- Card `bg-card rounded-2xl p-6 flex flex-col items-center text-center gap-2 shadow-sm`.
- Avatar: Shadcn `Avatar` grande `h-20 w-20` (`rounded-full`), `AvatarImage` (se houver — não há `photoURL` em rankings/statistics, então normalmente só fallback) + `AvatarFallback` com iniciais do nome (`text-lg font-semibold`). `alt` = nome do participante.
- Nome: `text-xl font-semibold text-foreground` (fallback `nickname` se `name` ausente).
- "Participante desde {data}": `text-sm text-muted-foreground` — **condicional** à disponibilidade de `createdAt` (ver Gap G3); formatar com `date-fns` (`dd/MM/yyyy`).

### Card "Posição Atual"
- `bg-card rounded-xl p-4 text-center shadow-sm`.
- Rótulo "Posição Atual" `text-sm font-medium text-muted-foreground`.
- `#{position}` `text-4xl font-bold text-primary tabular-nums`.
- "de {total} participantes" `text-sm text-muted-foreground`.

### Grid 2x2 de métricas
- `grid grid-cols-2 gap-3`.
- Cada `ProfileStatCard`: `bg-card rounded-xl p-4 shadow-sm flex flex-col gap-1`.
  - Label `text-sm font-medium text-muted-foreground` (Pontos / Acertos / Erros / Aproveitamento).
  - Valor `text-3xl font-bold text-primary tabular-nums`.
  - Sublabel opcional (`Aproveitamento`): "X de Y jogos" `text-xs text-muted-foreground` — só se Y disponível (Gap G4).
- **Binário:** Pontos e Acertos exibem o **mesmo número** (`entry.points`). Erros = `entry.wrong ?? statistics.totalWrong ?? "—"`. Aproveitamento = `entry.accuracy`%.

### Seção "Desempenho por Fase"
- Título `text-lg font-semibold text-foreground mb-2`.
- Grid de `StagePerformanceCard` (`grid grid-cols-2 sm:grid-cols-3 gap-3` ou linha rolável).
- Cada card: `bg-card rounded-xl p-3 flex flex-col gap-1`.
  - Nome da fase `text-xs text-muted-foreground` (Fase de Grupos / Oitavas / Quartas / Semifinal / Final).
  - Pts/acertos `text-base font-bold text-primary tabular-nums` (= `correctByStage[stage]`, binário). Fase sem dados → "0 pts" ou "—".
  - **Posição por fase (#N):** ver Gap G5 — `statistics.correctByStage` não tem posição. Default: **omitir #N**; exibir só pts. (Imagem mostra #N, mas o dado disponível só dá pts.)
- Ordem: Grupos → Oitavas → Quartas → Semifinal → Final (subconjunto de `rankingScopeSchema` sem "geral"). Ignorar `dezesseis-avos`/`terceiro` na UI.

### Botão "Ver histórico de palpites" (BLOQUEADOR A5)
- **Default desta task: OCULTO** (não renderizado). Comentário de código apontando A5.
- Alternativa (decisão de produto): `Button` `variant="default"` full-width (`w-full min-h-11 bg-primary text-primary-foreground`), **desabilitado** (`disabled aria-disabled="true"`), texto "Ver histórico de palpites (em breve)". Sem `onClick`/navegação.
- Em nenhum caso implementar destino até A5 + rules.

## 6. Typography and Color Tokens
- Nome `text-xl font-semibold`; números de destaque `text-3xl/4xl font-bold tabular-nums`; labels `text-sm/xs text-muted-foreground`; seção `text-lg font-semibold`.
- Cores: `--primary` (números/CTA), `--primary-foreground` (texto no CTA), `--foreground`, `--muted-foreground`, `--card`, `--border`. Erros pode usar `text-foreground` (não `text-destructive` — "Erros" é métrica neutra, não estado de erro de UI). Sem hex.

## 7. UI States
| Estado | Tratamento |
|---|---|
| Loading | `RankingSkeleton` (avatar circular + cards) (>300ms) |
| Not found | `RankingEmptyState` — "Participante não encontrado" (uid sem entry/statistics) |
| Error | `RankingErrorState` + "Tentar Novamente" (`onRetry` = `refetch`) |
| Populated | perfil completo (identidade + posição + grid + fases) |
| Botão histórico | **oculto** (default) ou **desabilitado** — bloqueado por A5 |

## 8. Accessibility Requirements (Priority 1)
- `Avatar`: `alt`/fallback textual = nome do participante; fallback de iniciais legível.
- Contraste: números verdes (`--primary` 0.46) sobre branco ≥ AA (validado em auth/palpites). CTA branco sobre verde ≥ AA.
- Cada card de métrica: label + valor associados semanticamente (ex.: `<dl>`/`<dt>`/`<dd>` ou aria-label) para screen reader.
- Foco visível (`ring-2 ring-ring`) no botão voltar/CTA; ordem de tab = visual.
- Ícones Lucide (`ChevronLeft`/`Share2` no header; ícones de fase se houver) `aria-hidden="true"`; botões de ícone com `aria-label`.
- Alvos ≥44px (`min-h-11`) no voltar/compartilhar/CTA; ≥8px entre alvos.
- Cor não é único indicador (números têm rótulo textual). Suporte a text scaling (sem truncar).
- Botão desabilitado (se A5 = desabilitado): `aria-disabled` + texto explicativo, não só visual.

## 9. Animation and Motion (Priority 7)
- Skeleton `animate-pulse` com `motion-reduce:animate-none`.
- Transições de cor/foco `transition-colors duration-150`. Sem animar layout. Sem gráficos nesta tela.

## 10. Navigation Patterns (Priority 9)
- Entrada contextual (linha do ranking → perfil); botão voltar (`<`) volta ao ranking; back do navegador previsível (rota real `/rankings/perfil/[uid]`).
- Bottom Tab Bar global inalterado (Ranking ativo). `RankingSubNav` não exibido (tela contextual).
- "Ver histórico de palpites" **não** navega (A5).

## 11. Pre-Delivery Checklist Status
- Ícones Lucide named (sem emoji) ✓ · tokens semânticos (sem hex/inline) ✓ · alvos ≥44px ✓ · estados definidos (inclui not-found) ✓ · reduced-motion ✓ · foco/aria/avatar alt ✓ · mobile-first ✓ · binário (Pontos===Acertos) ✓ · botão A5 oculto/desabilitado ✓.

## 12. Design Gaps and Assumptions
- **G1 — BLOQUEADOR A5 (botão "Ver histórico de palpites"):** visibilidade de palpites alheios NÃO decidida (PRD §6 A5 / PLAN R2). Default = **oculto**; alternativa = desabilitado. Não implementar destino até decisão de produto + Firestore Rules. Marcar no código.
- **G2 — Botões voltar/compartilhar do header:** a imagem mostra `<` e ícone de compartilhar. Voltar é viável (`router.back()` / link ao ranking). **Compartilhar** não tem destino/spec definido → assunção: **omitir** o compartilhar nesta task (ou apenas decorativo desabilitado). Confirmar com produto.
- **G3 — "Participante desde {createdAt}":** `createdAt` não está em `rankings`/`statistics` (únicas coleções lidas no client). Assunção: **omitir a linha** até desnormalizar `createdAt` no recalc (TASK-03) ou liberar leitura de `users/{uid}`. Não inventar data.
- **G4 — "X de Y jogos" no Aproveitamento:** denominador Y (partidas finalizadas elegíveis, A2) não exposto em `RankingEntry`/`Statistics`. Assunção: exibir **só o `%`** (omitir "X de Y") até Y ser desnormalizado. Derivar de points/accuracy é frágil — evitar.
- **G5 — Posição por fase (#N) em "Desempenho por Fase":** `statistics.correctByStage` só tem acertos (= pts binário) por fase, não posição. Assunção: exibir **só pts/acertos por fase**, omitindo o `#N` da imagem. Alternativa (custo: 5 leituras de `rankings/{fase}`) fica para decisão.
- **G6 — name/position/total:** composição `useRanking("geral")` + filtro por uid (default; `total = entries.length`) OU novo `useUserRanking(uid)` sobre `getUserRanking(uid)` (serviço já aceita qualquer uid). `name` → fallback `nickname`.
- **G7 — Pontos vs Acertos:** binário ⇒ mesmo número. Assunção: manter ambos os rótulos (fidelidade à imagem) com o mesmo valor; não tratar como métricas distintas. Consolidar é opção do produto.
- **G8 — Avatar real:** sem `photoURL` em rankings/statistics ⇒ usar fallback de iniciais (não buscar foto). Avatar grande conforme imagem.
