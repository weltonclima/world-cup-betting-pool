# PRD — Jogos (PRD-03)

> Fonte de verdade: `docs/prd-03/prd-03.md` + 6 telas (`PRD03-01` a `PRD03-06`).
> Stack/regras gerais: `.claude/CLAUDE.md`, PRD-00 e **PRD-07 v2.0** (arquitetura de dados da Copa).
> Branch: `feat/integracao-api-football`.

## 1. Resumo da feature

Catálogo oficial de partidas da Copa 2026. O usuário aprovado visualiza todos os jogos, filtra por fase / status de palpite / seleção, pesquisa por país, vê o status do seu palpite em cada card e abre o detalhe da partida para enviar/editar palpite ou consultar resultado.

Esta feature é **essencialmente UI/frontend**: a camada de dados já existe (foi entregue na integração API-Football desta branch). PRD-03 entrega: listagem, filtros, busca, detalhe, estados (loading/empty/error) e a navegação até a ação de palpite. **Não** implementa o formulário de envio/edição de palpite — isso é PRD-04.

## 2. Escopo consolidado

### Dentro do escopo
- **Lista de Jogos** (`/matches`): header (título, busca por seleção, botão de filtros), chips de filtro rápido, cards agrupados por dia (Hoje / Amanhã / data), badge de status do palpite, bottom nav.
- **Filtros** (sheet/modal): Fase, Status do Palpite, Seleção (busca por país + lista), ações Aplicar / Limpar.
- **Busca**: por nome de seleção (mandante ou visitante).
- **Card de Jogo**: bandeiras + nomes das duas seleções, grupo, data/hora, estádio/cidade, badge de status do palpite (Enviado / Pendente / Bloqueado), placar quando encerrado, navegação para detalhe.
- **Detalhe do Jogo** (`/matches/[id]`, tela cheia — ver `PRD03-02`): info completa (times, bandeiras, data, hora, estádio, cidade, fase, grupo), status do jogo, status do palpite, ações contextuais (Enviar / Editar / Visualizar Palpite, Ver Info da Partida, Visualizar Resultado & Estatísticas).
- **Estados**: loading (skeleton list/card), empty ("Nenhum jogo encontrado"), error (com "Tentar novamente").

### Fora do escopo (outros PRDs)
- Formulário de envio/edição de palpite (PRD-04) — aqui só a navegação/CTA.
- Tela de resultado & estatísticas da partida (PRD-04/PRD-07) — aqui só o CTA.
- Ingestão/atualização de resultados (Cloud Function / scheduler) — já tratado na integração API-Football.
- Tabela de grupos / classificação (apesar dos nomes de arquivo `PRD03-03`/`04`, as imagens são, de fato, **Filtros** e **Card Palpite-Enviado** — não há tela de tabela neste PRD).

### Precedência de fontes
Imagens (layout) > `prd-03.md` (texto). Onde divergem, a tela manda. Ex.: chips rápidos na lista (só nas imagens), placar no card encerrado (só nas imagens).

## 3. Entendimento do sistema (partes relevantes)

> ⚠️ **Correção de arquitetura.** O texto do `prd-03.md` afirma "Tela Jogos consulta apenas Firestore / nenhuma chamada direta para API-Football". Isso está **desatualizado**. Na arquitetura atual (PRD-07 v2.0, esta branch): **matches e teams vêm de Route Handlers Next.js (`/api/*`)** que fazem proxy + cache server-side da API-Football; **predictions** continuam no Firestore. O critério real "browser nunca chama API-Football direto" **continua satisfeito** (via `/api`). O PRD-03 técnico segue a arquitetura `/api`, não Firestore para matches.

A camada de dados de `matches` **já está pronta** (entregue na integração API-Football, TASK-04→11):

| Artefato | Estado atual | Reuso no PRD-03 |
|---|---|---|
| `src/app/api/matches/route.ts` | `GET /api/matches` — todas as partidas mapeadas + validadas | consumir (via service) |
| `src/app/api/matches/[id]/route.ts` | `GET /api/matches/:id` — partida única (404 → null) | consumir (via service) |
| `src/app/api/teams/route.ts` | `GET /api/teams` — todas as seleções | consumir p/ bandeira/nome/grupo |
| `src/services/matches.ts` | `listMatches()`, `getMatchById(id)`, `getNextScheduledMatch()`, `getRecentFinishedMatches()` — **já existem** (fetch `/api`, parse Zod) | **reusar como está** |
| `src/services/teams.ts` | `listAllTeams()` (fetch `/api/teams`, parse Zod) | reusar |
| `src/services/predictions.ts` | `listPredictionsByUid(uid)` (Firestore) | reusar p/ join client-side |
| `src/features/matches/hooks/useMatches.ts` | `useMatches()` — query `["matches","list"]` | **reusar como está** |
| `src/features/matches/hooks/useMatch.ts` | `useMatch(id)` — query `["matches","detail",id]` | **reusar como está** |
| `src/features/matches/hooks/useTeams.ts` | `useTeams()` — query `["matches","teams"]` | reusar |
| `src/schemas/matches.ts` | `matchSchema` (homeTeamId, awayTeamId, kickoffAt, stage, round, groupId, venue{name,city}, status, scores) + `MatchWithId` | reusar; sem mudança |
| `src/schemas/teams.ts` | `teamSchema` (name, flagUrl, groupId) + `TeamWithId` | reusar |
| `src/schemas/predictions.ts` | `predictionSchema` (uid, matchId, homeScore, awayScore, timestamps) | reusar |
| `src/schemas/shared.ts` | `stageSchema`, `matchStatusSchema` | fonte única dos enums de filtro |
| `src/features/home/lib/homeDashboardHelpers.ts` | `derivePredictionStatus(matchId, predictions, locked)` → enviado\|pendente\|bloqueado | **extrair p/ lib compartilhada** e reusar |
| `src/app/(app)/matches/page.tsx` | placeholder ("em construção") | **substituir** pela lista real |
| `src/components/layout/BottomNav.tsx` | funcional; aba Jogos → `/matches` já existe | reusar |
| `design-system/MASTER.md` | definido (PRD-02) | seguir nos `/screen` e `/implement` |
| `src/components/ui` | shadcn instalado | reusar (Sheet, Input, Badge, Skeleton, Tabs/Select…) |

**Conclusão:** PRD-03 é predominantemente **construção de UI** sobre dados já servidos. Pouco/nenhum trabalho novo de service/hook — o esforço está em componentes, filtros/busca/agrupamento (funções puras) e estados.

## 4. Análise de impacto técnico

### Módulos / arquivos
- **Novo** `src/features/matches/components/`: lista, card (variantes enviado/pendente/encerrado), detalhe, filtros (sheet), badges de status, skeletons, empty/error.
- **Novo** `src/features/matches/lib/`: helpers puros — agrupamento por dia (Hoje/Amanhã/data), filtragem (fase/status/seleção), busca por país, derivação de status do palpite e do jogo, mapa `id→team`.
- **Possível novo hook** `usePredictions` (escopo matches) ou reuso do service `listPredictionsByUid` direto via query — confirmar no `/plan`. Home tem sua própria versão; avaliar extrair hook compartilhado.
- **Substituir** `src/app/(app)/matches/page.tsx` (lista) + **novo** `src/app/(app)/matches/[id]/page.tsx` (detalhe, tela cheia).
- **Reuso direto** (sem alteração): `useMatches`, `useMatch`, `useTeams`, `listMatches`, `getMatchById`, `listAllTeams`, schemas.

### Dados / contratos
- Sem mudança de schema. Join palpite↔jogo por `matchId` + `uid` client-side (igual à Home).
- **Status do palpite** (derivado, não persistido): `Enviado` (existe prediction) / `Pendente` (sem prediction e jogo aberto) / `Bloqueado` (kickoff passou ou status ≠ `scheduled`). Já há `derivePredictionStatus()` na Home — reusar/extrair.
- **Status do jogo**: mapear `matchStatusSchema` (scheduled/live/finished/postponed/canceled) → rótulos pt-BR (Agendado/Ao Vivo/Encerrado; postponed/canceled — ver ambiguidades).
- **Resolução de seleções**: `useTeams()` fornece mapa `id→{name, flagUrl, groupId}` p/ render dos cards. `flagUrl` pode faltar → fallback.

### Persistência / integrações
- **Leitura** matches/teams via `/api/*` (cache server-side por tier já configurado). **Leitura** predictions via Firestore. Sem escrita neste PRD.
- Filtros/busca **client-side** (base ≈ 104 jogos): nenhum índice composto novo no Firestore; nenhum parâmetro de query novo no `/api`.

### Performance / escala
- ~104 jogos: carregar todos + palpites do usuário e filtrar/buscar client-side é viável e simples.
- Cache React Query: `staleTime` dos hooks de matches = `jogoDia` (30 min) já configurado. PRD-03 cita "5 min" — **conflito**; ver ambiguidades (A1). Server-side já revalida por tier.
- Meta: carregamento ≤ 2s.

### Migração / rollout
- Sem migração. Depende de `/api/matches` retornar dados (API-Football configurada). Empty-state robusto p/ pré-Copa / sem dados.

## 5. Riscos

1. **Dados ausentes / pré-Copa**: `/api/matches` pode vir vazio antes do sorteio/calendário. Mitigar com empty-state robusto + validar comportamento em `/local-env`.
2. **Bloqueio de palpite por horário** depende de relógio: usar `kickoffAt` (UTC canônico do mapper) + `date-fns`; não confiar só no `status` (pode estar defasado entre revalidação e início real). Risco de palpite "aberto" após kickoff se status não atualizou → regra de bloqueio deve checar `now >= kickoffAt` **ou** status ≠ scheduled.
3. **`flagUrl` opcional** no `teamSchema`: precisa fallback (placeholder) p/ não quebrar o card.
4. **`postponed`/`canceled`** sem rótulo/tratamento definido no PRD nem nas telas.
5. **Divergência fonte-de-verdade**: o texto do PRD-03 (Firestore) conflita com a arquitetura real (/api). Já corrigido neste documento; garantir que `/spec` e `/implement` sigam este PRD, não o `prd-03.md` literal.

## 6. Ambiguidades e lacunas

| # | Item | Lacuna | Sugestão |
|---|---|---|---|
| A1 | Cache React Query | PRD-03 diz 5 min; hooks atuais usam `jogoDia` (30 min) | Manter o tier já configurado (30 min) — semi-dinâmico; confirmar no `/plan` |
| A2 | Filtro server vs client | — | **Resolvido**: client-side (base pequena, `/api` retorna tudo) |
| A3 | `postponed`/`canceled` | Sem rótulo nas telas | Mapear ("Adiado"/"Cancelado") ou agrupar como não-jogável |
| A4 | "Ao Vivo" | Telas não mostram card ao vivo | Definir layout do estado live (placar parcial, somente consulta) |
| A5 | Agrupamento por dia | Telas mostram "Hoje 12 de Junho / Amanhã 13 de Junho" | Confirmar regra de cabeçalho (Hoje/Amanhã/data por extenso) |
| A6 | Busca | Por país; casa com mandante e/ou visitante? | Assumir ambos |
| A7 | "Ver Informações da Partida" (detalhe) | Conteúdo não definido | Provável estatística (PRD-07) — fora do escopo, só placeholder/CTA |
| A8 | Escudos vs bandeiras | Detalhe cita ambos; schema só tem `flagUrl` | Usar `flagUrl`; escudo de clube não se aplica a seleção |
| A9 | Paginação/scroll | Não citado | Lista única com scroll (104 itens) — sem paginação |
| A10 | Hook de predictions p/ matches | Home tem o seu; matches não | Avaliar extrair hook compartilhado vs query local no `/plan` |

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first, responsivo até desktop 1024px+)
- **Screens:**
  - Lista de Jogos (`/matches`) — substitui placeholder
  - Detalhe do Jogo (`/matches/[id]`) — novo, tela cheia
  - Filtros (sheet/modal sobre a lista) — novo
  - Variantes de card: Palpite Enviado, Palpite Pendente, Jogo Encerrado
  - Estados: loading / empty / error
- **Product type:** Sports Team/Club — catálogo de fixtures / bolão esportivo
- **Recommended style direction:** seguir `design-system/MASTER.md` existente (tema verde "Bolão dos Parças", cards arredondados, mobile-first). Badges de status com cor semântica: verde=enviado, âmbar=pendente, cinza=encerrado/bloqueado. Micro-interações leves; bento/cards.
- **Design complexity:** medium

> Dispara `/screen` para as tarefas de UI (Lista, Card, Detalhe, Filtros). Cada `/screen` deve ler `design-system/MASTER.md` e gerar overrides de página se necessário.

## 8. Preocupações de implementação (alto nível)

- **Reusar a camada de dados existente** (services/hooks de matches/teams) — não recriar. Foco em componentes + lib.
- Derivação de status (jogo e palpite), filtragem, busca e agrupamento por dia como **funções puras em `lib/`** testáveis isoladamente → candidatas a TDD.
- Bloqueio de palpite (`kickoffAt` vs now + status) é regra de negócio crítica → TDD. Reusar/extrair `derivePredictionStatus()` da Home p/ evitar duplicação.
- Resolver `teams` (id→bandeira/nome/grupo) via mapa em memória; fallback quando `flagUrl` ausente.
- Acessibilidade: bottom nav, foco/trap no sheet de filtros, contraste dos badges (WCAG AA), área de toque ≥ 44px.
- Sem `any`, sem estilo inline, sem hardcode (rótulos/enum mapeados em arquivo dedicado).
- Rotas dentro de `(app)` (protegidas por AuthGuard/aprovação já existentes).
