# PRD — Multi-Championship & Public Launch

> Slug: `multi-championship-launch`. Epic que transforma o produto de "bolão da Copa 2026" (torneio único, fixo) em **plataforma multi-campeonato auto-serviço**, pronta para lançamento público na internet.

## 1. Feature summary

Quatro mudanças estruturais, entregues como um épico coeso:

1. **Multi-campeonato via ESPN** — hoje a integração ESPN é fixa na liga `fifa.world`. Passar a suportar qualquer campeonato de futebol que a ESPN exponha (Premier League, La Liga, Brasileirão, Champions, Libertadores, etc.), com um catálogo de campeonatos que o **admin do grupo habilita/desabilita** no dashboard.

2. **UX/UI e ranking multi-campeonato** — com >1 campeonato ativo, a interface (jogos, palpites, chaveamento, ranking) precisa segmentar por campeonato. Ranking passa a ter dois modos — **geral** (agregado de todos os campeonatos do grupo) ou **por campeonato** — controlados por uma **config habilitável no dashboard do grupo**.

3. **Persistência dos jogos no nosso banco (arquivamento/backup)** — hoje a ESPN é fonte viva única; `matches/{id}` guarda só overrides manuais. Requisito: **snapshotar todos os dados de jogos no Firestore** para que, quando a ESPN deixar de servir dados de um campeonato encerrado, o produto continue exibindo histórico, rankings e perfis sem depender da API.

4. **Cadastro público auto-serviço com criação de grupo** — hoje o cadastro nasce `pending` e depende de aprovação de admin; criar um pool também nasce `pending` (aprovação super_admin). Requisito: usuário se cadastra, **já cria um grupo e vira admin dele automaticamente** (grupo ativo, sem gate de aprovação global), e recebe um **link de convite** para compartilhar. É o fluxo de onboarding para lançamento na internet.

## 2. Consolidated scope

### In scope
- **Catálogo de campeonatos ESPN**: descoberta/lista de ligas de futebol da ESPN (`/apis/site/v2/sports/soccer/leagues` + slugs por liga), normalizada em um schema `championship` (id/slug ESPN, nome, temporada, tipo liga-vs-copa, janela de datas).
- **Parametrização da camada ESPN por liga**: `espnClient` deixa de ter `fifa.world` hardcoded; recebe o slug da liga. `ESPN_TOURNAMENT_RANGES` (hoje datas fixas da Copa) vira derivado por campeonato/temporada.
- **matchId namespaced por campeonato**: evitar colisão de `predictions/{matchId}` e escopos de ranking entre campeonatos. Todo id de partida passa a carregar o campeonato.
- **Config no dashboard do grupo**: quais campeonatos estão habilitados no pool + modo de ranking (`geral` vs `por-campeonato`). Segue o padrão de flags aditivas já existente no `poolSchema`.
- **Segmentação de UI**: seletor/abas de campeonato em jogos, palpites, chaveamento e ranking. Ranking respeita o modo configurado.
- **Recalc/scoring por campeonato**: pontuação e rankings escopados por campeonato; agregação para o modo "geral".
- **Arquivamento de partidas**: pipeline que persiste o schedule completo de um campeonato em `matches/{id}` (não só overrides), e uma precedência de leitura que usa o snapshot quando a ESPN não tem mais os dados. Marca de "campeonato encerrado/arquivado".
- **Onboarding público**: fluxo cadastro→cria-grupo→vira group_admin→grupo ativo→link de convite, sem gate de aprovação global para o caminho auto-serviço.

### Out of scope (a confirmar no plano)
- Suporte a esportes além de futebol (ESPN tem outros; fora do escopo).
- Pagamentos/planos/monetização do lançamento.
- Migração retroativa de bolões existentes para o modelo multi-campeonato além do necessário para não quebrar (a Copa 2026 vira "um campeonato" legado).
- Moderação/antifraude do cadastro público aberto (captcha, verificação de e-mail) além do que já existe — sinalizado como risco.

## 3. System understanding relevant to this feature

- **ESPN é fonte única (PRD-13)**: `src/server/copaData/espn{Client,Types,Mapper,Matcher}.ts`. URL fixa `soccer/fifa.world/scoreboard`. `fetchSchedule()` usa `ESPN_TOURNAMENT_RANGES` (2 ranges de datas da Copa; ESPN trunca em 100 eventos/chamada). `mapEspnEventsToMatches()` produz `MatchWithId[]`.
- **matchId**: byte-idêntico ao slug/`m{num}` legado (openfootball) — `predictions/{matchId}` e rankings dependem disso. `espnMatchId.ts`/`matchId.ts` derivam o id. **Não há namespace de campeonato** — premissa de torneio único embutida.
- **`getEffectiveMatches()` (`matchSource.ts`)**: base ESPN (viva) → overrides manuais de `matches/{id}` com `isManualOverride === true`. Se ESPN cai, erro propaga (route handler serve snapshot stale). Firestore só guarda overrides, **não o schedule completo**.
- **Derived cache (`src/server/worldcup/` + `worldcup_cache/{groups,bracket}`)**: standings e bracket computados server-side, TTL dinâmico. Assumem um torneio.
- **Ranking (`src/features/rankings` + `src/server/rankings/recalc.ts`)**: escopos `pool-{id}-geral`, `pool-{id}-grupos`, `pool-{id}-eliminatorias`. Flag `pools.splitPhaseRanking` já divide exibição por fase — **precedente direto** para dividir por campeonato. Rotas `rankings/[scope]` e `rankings/pool` fecham escopo por sessão/`groupId`.
- **Pools multi-tenant (PRD-09)**: `poolSchema` com padrão de flags aditivas optional (`allowInvites`, `predictionsLocked`, `splitPhaseRanking`, `ignoreOvertimeGoals`, `primaryColor*`). Roles 3-níveis (`participant<group_admin<super_admin`). Dashboard group_admin em `src/features/groupAdmin` + rotas `api/group/*` (settings, invites, recalc).
- **Onboarding atual**: `POST /api/groups` cria pool com `status: "pending"`, `adminId = uid` da sessão. Signup → `users/{uid}` `status: pending`, `role: participant`. Function `promoteFirstAdmin` (primeiro user → admin). Aprovação/ativação é super_admin. Convites: `invites/{id}` + `/invite/[code]` (Server Component resolve, `redeem` incrementa `usedCount`).
- **Auth defense-in-depth (4 camadas)**: middleware edge (jose) + Route Handlers (Admin SDK) + Firestore Rules + client guards. `groupId` custom claim isola `invites` e escopa ranking.

## 4. Technical impact analysis

### 4.1 Contrato de dados (alto impacto)
- **Novo schema `championship`** (`src/schemas/championships.ts`): id/slug ESPN, nome, temporada, tipo (`league` liga de pontos-corridos vs `cup` mata-mata/grupos), janela de datas, status (`upcoming|live|archived`). Types derivados.
- **`matchSchema`**: acrescentar `championshipId` (ou `leagueSlug`) a toda partida. matchId passa a ser namespaced (`{championshipId}:{slug}`), o que **muda a chave de `predictions/{matchId}`** → maior ponto de risco de regressão (ver §5).
- **`poolSchema`**: novos campos aditivos optional — `enabledChampionships: string[]` e `rankingMode: "geral" | "por-campeonato"` (default na leitura = comportamento atual). Segue o padrão já estabelecido.
- **Escopos de ranking**: `pool-{id}-{championshipId}-{fase}`; "geral" agrega os habilitados.

### 4.2 Camada ESPN (alto impacto)
- `espnClient` parametrizado por slug de liga; `ESPN_TOURNAMENT_RANGES` derivado por campeonato (ligas de temporada longa têm centenas de jogos → paginação por range de datas fica crítica dado o cap de 100 eventos/chamada da ESPN).
- `espnBracketMap`/`bracket.ts` só se aplicam a campeonatos tipo `cup`; ligas de pontos corridos não têm chaveamento → UI e derived cache precisam ramificar por tipo.
- Catálogo de ligas: novo cliente para `/sports/soccer/leagues` (ou lista curada) + cache.

### 4.3 Persistência / arquivamento (alto impacto)
- Inverter o papel de `matches/{id}`: de "só overrides" para "snapshot completo do schedule". Novo pipeline de escrita (Admin SDK) que arquiva um campeonato inteiro.
- `getEffectiveMatches()` vira **por campeonato** e ganha precedência ESPN-vs-snapshot dependente do status: campeonato `archived` → lê do banco primeiro; `live` → ESPN + overlay. Regras Firestore/índices de `matches` mudam (query por `championshipId`).
- Volume: ligas longas × múltiplos pools multiplicam docs `matches`. Firestore doc/coleção sizing e índices compostos precisam de atenção.

### 4.4 UI/UX (médio-alto impacto)
- Seletor de campeonato transversal (jogos, palpites, chaveamento, ranking, home). Estado de "campeonato ativo" no cliente.
- Home dashboard (`useHomeDashboard`, 9 hooks) e ranking precisam de dimensão campeonato.
- Dashboard group_admin: nova seção "Campeonatos" (habilitar/desabilitar do catálogo) + toggle de modo de ranking.

### 4.5 Onboarding / auth (médio-alto impacto)
- Novo caminho de cadastro auto-serviço: signup cria pool **ativo** e promove o criador a `group_admin` sem aprovação super_admin. Diverge do gate `pending` atual → precisa coexistir com o fluxo moderado existente (ou substituí-lo por decisão de produto).
- Impacto em `promoteFirstAdmin`, claims (`role`, `groupId`), Rules de `pools` (create hoje é `if false` / Admin SDK) e no middleware.
- Link de convite já existe; reusar. Precisa garantir grupo nasce com `allowInvites` e ativo.

### 4.6 Recalc / scoring / notificações
- `recalc.ts` e `/api/predictions/score` passam a operar por campeonato; agregação "geral". Cron de scoring (GitHub Actions) precisa varrer campeonatos ativos.
- Idempotência de notificações (`games-{uid}-{matchId}`) sobrevive se matchId namespaced for consistente.

## 5. Risks

- **Regressão de matchId (crítico)**: mudar a chave de `predictions/{matchId}` pode invalidar palpites/rankings da Copa 2026 existentes. Precisa de estratégia de compat/migração (ex.: Copa legada mantém ids atuais; campeonatos novos nascem namespaced) — decisão de arquitetura antes de codar.
- **Cap de 100 eventos/chamada da ESPN**: ligas longas (38 rodadas) exigem muitas chamadas por range; custo/latência e rate-limit da API pública não-oficial (sem SLA). Risco de bloqueio/instabilidade.
- **ESPN não-oficial**: slugs de liga, shape de payload e disponibilidade histórica variam por competição; o que vale para `fifa.world` pode não valer para `bra.1`. Necessário spike de validação por tipo de liga (mapper pode quebrar).
- **Modelo de arquivamento**: definir o gatilho de "arquivar" (manual pelo admin? automático no fim do campeonato?) e a fonte-da-verdade quando ESPN e snapshot divergirem em campeonato encerrado.
- **Cadastro público aberto**: sem verificação de e-mail/anti-abuso, o caminho auto-serviço vira vetor de spam/pools lixo. Segurança do lançamento.
- **Bracket vs liga**: assumir chaveamento em toda parte quebra para ligas de pontos corridos; muitos componentes/derivations assumem fases da Copa.
- **Custo Firestore**: snapshot completo de várias ligas × pools multiplica leituras/escritas e índices.
- **Escopo do épico**: 4 frentes grandes; risco de entrega monolítica. Deve ser fatiado no `/plan` com um campeonato-piloto antes de generalizar.

## 6. Decisions locked (2026-07-21)

Decisões travadas com o usuário (substituem as ambiguidades originais):

- **matchId — COMPAT.** Copa 2026 mantém os ids atuais (`m1`, `m2`, slug legado); apenas campeonatos NOVOS nascem namespaced (`{championshipId}:{slug}`). Zero regressão em `predictions`/`rankings` existentes. O namespacing é aplicado só na nova camada de campeonato.
- **Catálogo — curado completo.** Lançamento cobre o catálogo curado dos campeonatos famosos (todos os grupos da lista abaixo), NÃO "todas as ligas da ESPN". Cada slug passa por **spike de validação** (shape do payload + paginação por range de datas) antes de habilitar. Catálogo:
  - Seleções/copas: `fifa.world` (legado), `conmebol.america`, `uefa.euro`, `uefa.nations`, `fifa.cwc`.
  - Ligas (pontos corridos): `bra.1`, `eng.1`, `esp.1`, `ita.1`, `ger.1`, `fra.1`, `por.1`, `ned.1`, `mex.1`, `usa.1`, `ksa.1`, `arg.1`.
  - Copas mata-mata: `uefa.champions`, `uefa.europa`, `conmebol.libertadores`, `conmebol.sudamericana`, `bra.copa_do_brazil`, `eng.fa`.
- **Onboarding — auto-serviço com moderação no nível do grupo.**
  - `super_admin` permanece como papel global.
  - Novo fluxo: quem se cadastra criando um grupo é **auto-aprovado no registro** (sem gate `pending`/aprovação super_admin) e vira **`group_admin`** do próprio grupo, que nasce **ativo**.
  - Quem entra depois pelo **link de convite** do grupo continua precisando de **aprovação do `group_admin`** daquele grupo (moderação permanece, mas descentralizada para o dono do grupo — não mais super_admin).
- **Arquivamento — vira HISTÓRICO com telas dedicadas.** Ao finalizar um campeonato (todos os jogos `finished`), o schedule completo é snapshotado no banco (`matches`), o campeonato é marcado `archived` e **movido da área ativa para uma seção de "Histórico"** (campeonatos antigos) com telas próprias — ranking/jogos/estatísticas congelados, servidos do banco, sem depender da ESPN.

### Gaps ainda abertos (resolver no `/plan`, não bloqueiam aprovação)
- **Ranking "geral" entre campeonatos heterogêneos** (nº de jogos muito diferente): soma bruta vs normalização — decidir na task de ranking.
- **Formato de palpite em liga de pontos corridos**: placar exato/parcial reusável; bônus/best-thirds são específicos de Copa (provavelmente ocultos para `league`).
- **Limite de campeonatos ativos por pool**: teto para conter custo/UI.
- **Anti-abuso do cadastro público** (verificação de e-mail/captcha): tratar como requisito de release.
- **Gatilho de detecção de "campeonato finalizado"** para ligas longas (temporada inteira) — como saber que acabou de forma confiável.

## 7. Recommended implementation concerns

- **Fatiar por frente e por campeonato-piloto.** Ordem sugerida ao `/plan`: (a) schema `championship` + namespacing de matchId com compat da Copa; (b) parametrizar camada ESPN + spike de 1 liga de pontos corridos; (c) config de campeonatos no dashboard; (d) segmentação de UI + ranking por modo; (e) arquivamento/persistência; (f) onboarding público. Cada frente deve ser independentemente entregável.
- **Spike ESPN obrigatório** antes de generalizar: validar slug catalog, shape do mapper e paginação para pelo menos uma liga não-Copa (`bra.1`) e uma copa não-FIFA (`uefa.champions`). Reduz o risco de o mapper quebrar em produção.
- **Namespacing de matchId com estratégia de compat explícita** — é o item de maior risco de regressão; tratar cedo e com testes de snapshot como os já usados na paridade openfootball↔ESPN.
- **Reusar padrões existentes**: flags aditivas em `poolSchema`; precedente `splitPhaseRanking` para segmentação de ranking; convites já prontos; padrão overlay `getEffectiveMatches` para a precedência ESPN-vs-snapshot.
- **Bloquear bracket/derivations atrás do tipo de campeonato** (`cup` vs `league`) para não quebrar ligas de pontos corridos.
- **Segurança do lançamento**: tratar anti-abuso do cadastro aberto como requisito de release, não opcional.
- **Custo/observabilidade**: medir volume de escrita do arquivamento e chamadas ESPN por campeonato antes de habilitar muitos campeonatos.
