# PRD — Jogos (PRD-03)

> Fonte de verdade: `docs/prd-03/prd-03.md` + 6 telas (`PRD03-01` a `PRD03-06`).
> Stack/regras gerais: `.claude/CLAUDE.md` e PRD-00.

## 1. Resumo da feature

Catálogo oficial de partidas da Copa 2026. O usuário aprovado visualiza todos os jogos, filtra por fase / status de palpite / seleção, pesquisa por país, vê o status do seu palpite em cada card e abre o detalhe da partida para enviar/editar palpite ou consultar resultado. Apenas leitura do Firestore — nenhum acesso direto à API-Football (regra PRD-00 §7).

Esta feature **não** implementa o envio/edição de palpite em si (formulário) — isso é PRD-04. Aqui entregamos: listagem, filtros, busca, detalhe e a navegação até a ação de palpite.

## 2. Escopo consolidado

### Dentro do escopo
- **Lista de Jogos** (`/matches`): header (título, busca por seleção, botão de filtros), chips de filtro rápido, cards agrupados por dia, badge de status do palpite, bottom nav.
- **Filtros** (sheet/modal): Fase, Status do Palpite, Seleção (busca por país + lista), ações Aplicar / Limpar.
- **Busca**: por nome de seleção (mandante ou visitante).
- **Card de Jogo**: bandeiras + nomes das duas seleções, grupo, data/hora, estádio/cidade, badge de status do palpite (Enviado / Pendente / Bloqueado), placar quando encerrado, navegação para detalhe.
- **Detalhe do Jogo** (`/matches/[id]`): info completa (times, escudos/bandeiras, data, hora, estádio, cidade, fase, grupo), status do jogo, status do palpite, ações contextuais (Enviar / Editar / Visualizar Palpite, Ver Info da Partida, Visualizar Resultado & Estatísticas).
- **Estados**: loading (skeleton list/card), empty ("Nenhum jogo encontrado"), error (com "Tentar novamente").
- **Cache** React Query (staleTime alinhado ao projeto).

### Fora do escopo (outros PRDs)
- Formulário de envio/edição de palpite (PRD-04) — aqui só a navegação/CTA.
- Tela de resultado & estatísticas da partida (PRD-04/PRD-07) — aqui só o CTA.
- Cloud Function de atualização de resultados (backend/ingestão).
- Tabela de grupos / classificação (apesar dos nomes de arquivo `PRD03-03`/`04`, as imagens são, de fato, Filtros e Card-Enviado — não há tela de tabela neste PRD).

### Precedência de fontes
Imagens (layout) > `prd-03.md` (texto). Onde divergem, a tela manda. Ex.: chips rápidos na lista (só nas imagens), placar no card encerrado (só nas imagens).

## 3. Entendimento do sistema (partes relevantes)

Já existe base do domínio `matches` (criada no PRD-02 para a Home):

| Artefato | Estado atual | Reuso no PRD-03 |
|---|---|---|
| `src/schemas/matches.ts` | `matchSchema` completo (homeTeamId, awayTeamId, kickoffAt, stage, round, groupId, venue, status, scores) | reusar; sem mudança de schema |
| `src/schemas/predictions.ts` | `predictionSchema` (uid, matchId, homeScore, awayScore, timestamps) | reusar p/ derivar status do palpite |
| `src/schemas/teams.ts` | `teamSchema` (name, code, flagUrl, groupId) | reusar p/ bandeira/nome/grupo |
| `src/schemas/shared.ts` | `stageSchema` (grupos/oitavas/quartas/semifinal/terceiro/final), `matchStatusSchema` (scheduled/live/finished/postponed/canceled) | fonte única dos enums de filtro |
| `src/services/matches.ts` | só `getNextScheduledMatch` + `getRecentFinishedMatches` | **estender**: listar todas + getById |
| `src/services/predictions.ts` | `listPredictionsByUid` | reusar p/ join client-side |
| `src/services/teams.ts` | existe | reusar |
| `src/features/matches/` | vazio (só README/index) | **destino** da feature |
| `src/app/(app)/matches/page.tsx` | placeholder | **substituir** pela lista real |
| `src/components/layout/BottomNav.tsx` | funcional (Home/Jogos/Palpites/Ranking/Perfil) | reusar; aba Jogos já existe |
| `design-system/MASTER.md` | definido no PRD-02 | seguir nos `/screen` e `/implement` |
| `src/components/ui` | shadcn instalado | reusar (Sheet, Input, Badge, Skeleton, Tabs/Select…) |

Padrão estabelecido (Home, PRD-02): service puro Firestore (parse Zod, id injetado pós-parse) → hooks TanStack Query (`featureKeys.ts`) → componentes tipados → helpers em `lib/`. PRD-03 deve seguir o mesmo molde.

## 4. Análise de impacto técnico

### Módulos / arquivos
- **Novo** `src/features/matches/`: components (lista, card, detalhe, filtros sheet, badges, skeletons, empty/error), hooks (`matchesKeys.ts`, `useMatches`, `useMatch`, `usePredictionsByUid` reuso), lib (helpers de derivação de status, agrupamento por dia, filtragem/busca).
- **Estender** `src/services/matches.ts`: `listMatches()` (todas, ordenadas por kickoffAt) e `getMatchById(id)`.
- **Substituir** `src/app/(app)/matches/page.tsx` (lista) + **novo** `src/app/(app)/matches/[id]/page.tsx` (detalhe).
- Possível necessidade de service/cache de `teams` agregado (mapa id→team) para resolver bandeiras/nomes no card.

### Dados / contratos
- Sem mudança de schema esperada. **Atenção**: `predictionSchema` não tem campo de id do doc; o join palpite↔jogo é por `matchId` + `uid` client-side (igual à Home).
- **Status do palpite** é derivado (não persistido): `Enviado` (existe prediction p/ o jogo) / `Pendente` (sem prediction e jogo aberto) / `Bloqueado` (kickoff já passou ou status ≠ scheduled). Regra de bloqueio: "no horário oficial de início" → comparar `now >= kickoffAt` (ou status `live/finished/...`).
- **Status do jogo**: mapear `matchStatusSchema` → rótulos pt-BR (Agendado/Ao Vivo/Encerrado; postponed/canceled a definir — ver ambiguidades).

### Persistência / integrações
- Apenas leitura Firestore (`matches`, `predictions`, `teams`). Sem escrita neste PRD.
- **Índices Firestore**: `listMatches` ordenado por `kickoffAt` (índice simples já coberto). Se houver filtro server-side por `stage`+`kickoffAt`, exigirá índice composto — **decisão**: filtros client-side (≤ ~104 jogos, base pequena, alinha com "< 100 usuários" e custo baixo). Confirmar no `/plan`.

### Performance / escala
- Total de jogos da Copa 2026 ≈ 104. Carregar todos de uma vez e filtrar/buscar client-side é viável e simples. Cache React Query 5 min (PRD-03) — **conflito** com 30 min do CLAUDE.md global; ver ambiguidades.
- Meta: carregamento ≤ 2s.

### Migração / rollout
- Sem migração de dados. Depende de a coleção `matches` estar populada (ingestão via Cloud Function — pré-requisito de release, já sinalizado como HOLD no plano de release do PRD-02).

## 5. Riscos

1. **Dados ausentes**: sem ingestão de `matches`/`teams` populados, a tela fica vazia em produção. Mitigar com empty-state robusto + seed local (`/local-env`).
2. **Bloqueio de palpite por horário** depende de relógio: usar `kickoffAt` do servidor/Firestore + `date-fns`; não confiar só no status (que pode estar defasado entre scheduler e início real). Risco de palpite "aberto" após o kickoff se status não atualizou.
3. **`teams` como fonte de bandeira/nome**: `flagUrl` é opcional no schema; precisa fallback (código FIFA / placeholder) para não quebrar o card.
4. **Volume de leitura**: carregar todos os jogos + todos os palpites do usuário a cada visita; cache mitiga, mas validar custo de reads no Firestore.
5. **`postponed`/`canceled`** não têm rótulo/tratamento definido no PRD nem nas telas.

## 6. Ambiguidades e lacunas

| # | Item | Lacuna | Sugestão |
|---|---|---|---|
| A1 | Cache React Query | PRD-03 diz 5 min; CLAUDE.md global diz 30 min | Definir no `/plan` — provável 5 min p/ matches (dado semi-dinâmico) |
| A2 | Filtro server vs client | Não especificado | Client-side (base pequena) — confirmar |
| A3 | `postponed`/`canceled` | Sem rótulo nas telas | Mapear ("Adiado"/"Cancelado") ou agrupar como não-jogável |
| A4 | "Ao Vivo" | Telas não mostram card ao vivo | Definir layout do estado live (placar parcial, somente consulta) |
| A5 | Agrupamento por dia | Telas mostram "Hoje 12 de Junho / Amanhã 13 de Junho" | Confirmar regra de cabeçalho de seção (Hoje/Amanhã/data) |
| A6 | Busca | Por país; casa com mandante e/ou visitante? | Assumir ambos |
| A7 | "Ver Informações da Partida" (detalhe) | Conteúdo não definido | Provável link externo/estatística (PRD-07) — fora do escopo, só placeholder/CTA |
| A8 | Escudos vs bandeiras | Detalhe cita ambos; schema só tem `flagUrl` | Usar `flagUrl`; escudo de clube não se aplica a seleção |
| A9 | Paginação/scroll | Não citado | Lista única com scroll (104 itens) — sem paginação |

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first, responsivo até desktop 1024px+)
- **Screens:**
  - Lista de Jogos (`/matches`) — substitui placeholder
  - Detalhe do Jogo (`/matches/[id]`) — novo
  - Filtros (sheet/modal sobre a lista) — novo
  - Variantes de card: Palpite Enviado, Palpite Pendente, Jogo Encerrado
  - Estados: loading / empty / error
- **Product type:** Sports Team/Club — catálogo de fixtures / bolão esportivo
- **Recommended style direction:** seguir `design-system/MASTER.md` já existente (tema verde "Bolão dos Parças", cards arredondados, mobile-first). Referência ui-ux-pro-max: *Vibrant & Block-based* + *Bento/cards* + *Micro-interactions* (badges de status com cor semântica: verde=enviado, âmbar=pendente, cinza/bloqueado=encerrado).
- **Design complexity:** medium

> Dispara `/screen` para as tarefas de UI (Lista, Card, Detalhe, Filtros). Cada `/screen` deve ler `design-system/MASTER.md` e gerar overrides de página se necessário.

## 8. Preocupações de implementação (alto nível)

- Manter o molde do PRD-02: `service (Zod parse, id pós-parse)` → `hooks (queryKeys + TanStack Query)` → `components tipados` → `helpers em lib/` testáveis isoladamente.
- Derivação de status (jogo e palpite) deve viver em helper puro em `lib/` com testes unitários (lógica de negócio: candidata a TDD).
- Bloqueio de palpite (`kickoffAt` vs now + status) é regra de negócio crítica → TDD.
- Filtros/busca/agrupamento como funções puras testáveis (entrada: lista + critérios → saída: lista agrupada).
- Resolver `teams` (id→bandeira/nome/grupo) via mapa em memória; fallback quando `flagUrl` ausente.
- Acessibilidade: bottom nav, foco no sheet de filtros, contraste dos badges (WCAG AA), área de toque ≥ 44px.
- Sem `any`, sem estilo inline, sem hardcode de dados (rótulos/enum mapeados em arquivo dedicado).
- Rotas dentro de `(app)` (protegidas por AuthGuard/aprovação já existentes).
