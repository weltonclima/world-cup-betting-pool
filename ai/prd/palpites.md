# PRD — Palpites (PRD-04)

> Fonte de verdade: `docs/prd-04/prd-04.md` + 6 telas (`PRD04-01` a `PRD04-06`).
> Stack/regras gerais: `.claude/CLAUDE.md`, PRD-00 e **PRD-07 v2.0** (arquitetura de dados da Copa).
> Branch atual: `feat/integracao-api-football`.
> **Decisão travada (sobrepõe layout):** pontuação **BINÁRIA** — placar exato = **1**; qualquer outro = **0**. Sem ponto por acerto de vencedor. As telas `PRD04-03/04` mostram "3 / 1 / 0", mas `.claude/CLAUDE.md` manda binário; as telas serão ajustadas no `/screen`.

## 1. Resumo da feature

Permite ao usuário aprovado **registrar, editar e consultar** seus palpites de placar exato para cada partida da Copa 2026, sempre **antes do horário oficial de início**. Depois do kickoff, o palpite fica **bloqueado** (sem criar/editar/excluir). A pontuação (acertou/errou) é calculada **a posteriori**, quando o resultado oficial chega — fora do fluxo síncrono do usuário.

Esta feature é **fullstack leve**: a leitura de palpites já existe (`listPredictionsByUid`, `usePredictions`); PRD-04 adiciona a **escrita** (create/update) no Firestore via Client SDK, a **regra de bloqueio temporal**, e as **telas** de lista de palpites, formulário de envio/edição, estados (bloqueado, sucesso) e a integração com o detalhe de jogo (PRD-03).

## 2. Escopo consolidado

### Dentro do escopo
- **Lista de Palpites** (`PRD04-01`, rota `/predictions` — aba "Palpites" do bottom nav): lista dos jogos com o palpite do usuário, exibindo jogo, data, placar palpitado e **status** (Pendente / Acertou / Errou / Bloqueado). Filtros por status (chips: Todos / Pendentes / Acertos / Erros / Bloqueados, conforme imagem).
- **Detalhe do Jogo** (`PRD04-02`): já existe (PRD-03, `/matches/[id]`). PRD-04 garante o CTA contextual **Enviar Palpite / Editar Palpite / Palpite bloqueado** e o bloco "Meu Palpite".
- **Enviar Palpite** (`PRD04-03`): formulário com dois steppers (Gols Mandante / Gols Visitante), botão **Salvar Palpite**. Cria doc em `predictions`.
- **Editar Palpite** (`PRD04-04`): mesmo formulário, campos pré-preenchidos, botão **Atualizar Palpite**. Atualiza doc existente.
- **Palpite Bloqueado** (`PRD04-05`): estado quando `agora >= kickoffAt`. Exibe o palpite informado + data/hora do jogo; sem ações de edição.
- **Palpite Registrado** (`PRD04-06`): confirmação de sucesso ("Seu palpite foi salvo com sucesso"), exibe `Mandante X x Y Visitante` e botão **Voltar para Jogos**.
- **Regra de bloqueio temporal** (`agora >= kickoffAt` ⇒ `locked`) aplicada na UI **e** defendida nas Security Rules.
- **Schema/serviço de escrita** de `predictions` + hooks de mutação (TanStack Query) com invalidação de cache.
- **Route Handler de pontuação** (`POST /api/predictions/score` ou dobrado na ingestão de resultados): compara palpite × resultado oficial e **grava** `status` (`correct|wrong`) + `points` (`0|1`) nos docs de `predictions`. **Sem Cloud Function** — lógica em Route Handler Next (App Hosting), disparado por agendador externo (cron) ou ação admin. Pontuação **binária**.

### Fora do escopo (outros PRDs / camadas)
- **Configuração do agendador externo** (cron que chama o Route Handler de pontuação): infra/deploy, fora do código da feature — ver Risco R7.
- **Ranking / estatísticas** (PRDs próprios) — aqui só se garante que o dado gravado é suficiente para alimentá-los.
- **Palpites bônus** (campeão, artilheiro — `bonus_predictions`).
- **Ingestão de resultados** da API-Football — já tratada na integração desta branch.

### Precedência de fontes
1. `.claude/CLAUDE.md` (regra de pontuação binária) **>** imagens.
2. Imagens (layout) **>** `prd-04.md` (texto) para tudo o mais.
3. Naming de código existente (`src/schemas/predictions.ts`, serviços) **>** naming do texto do PRD (`userId`/`homeScorePrediction`).

## 3. Entendimento do sistema (partes relevantes)

- **Schema de leitura** `src/schemas/predictions.ts`: `predictionSchema` `.strict()` com `uid`, `matchId`, `homeScore`, `awayScore`, `createdAt?`, `updatedAt?`. **Não tem** `status` nem `points` hoje.
- **Serviço** `src/services/predictions.ts`: só `listPredictionsByUid(uid)` — leitura via **Firebase Client SDK** direto no Firestore (não Route Handler; partidas é que vêm via Route Handler). Valida cada doc com `.parse`, erros do Firebase propagam crus.
- **Hooks** `usePredictions` (em `features/home` e `features/matches`) — leitura para badge de status do palpite no card. Namespacing por feature (`matchesKeys`, `homeKeys`).
- **Partidas** `src/schemas/matches.ts`: `kickoffAt` (ISO 8601 com offset), `status` (`scheduled|live|finished|postponed|canceled`), `homeScore`/`awayScore` nullable (preenchidos quando `finished`). **`kickoffAt` é a fonte do bloqueio.**
- **Detalhe de jogo** `features/matches/components/MatchDetail*.tsx` + `MatchDetailActions.tsx` — ponto de entrada do CTA de palpite.
- **Feature `predictions/`** praticamente vazia (`README.md` confirma binário + `index.ts`). É onde nasce a UI nova.
- **Tipos** derivados em `src/types` (`Prediction`); schemas Zod são fonte única.
- **Primitivos** `src/schemas/shared.ts`: `scoreSchema = z.int().min(0)`, `isoDateTime`, `nonEmptyString`.

## 4. Análise de impacto técnico

### Dados / persistência
- **Estender `predictionSchema`** (mantendo naming atual): adicionar `status` (`pending|correct|wrong|locked` — enum novo em `shared.ts`) e `points` (`0|1`), gravados pelo **Route Handler de pontuação** (não pelo cliente). O frontend **deriva** `locked` em runtime (tempo) e exibe `correct/wrong/points` quando já gravados. `id` do doc = `${uid}_${matchId}` para garantir unicidade (uid, matchId) sem query.
- **Coleção `predictions`**: read-write pelo cliente **apenas** para `homeScore/awayScore` (a previsão); `status`/`points` são escritos pelo Route Handler via **Admin SDK** (`src/firebase/admin.ts`), que bypassa as rules. Exige **Security Rules** (TASK dedicada): dono só escreve o próprio palpite, `homeScore/awayScore` inteiros ≥ 0, **bloqueio server-side por `kickoffAt`** (rule lê o doc da partida), e cliente **não** pode escrever `points`/`status`.

### Cálculo de pontuação (Route Handler)
- **Endpoint** Next (App Hosting) que, para partidas `finished`, percorre os palpites e grava `status`+`points` binários via Admin SDK. Idempotente (re-rodar não muda resultado). Helper puro de comparação `scorePrediction(prediction, match)` testável.
- **Disparo:** cron externo (ex. Cloud Scheduler → HTTP, GitHub Action agendada, ou serviço de cron) ou botão admin. Protegido por segredo/role (não público).
- Reaproveita o ciclo diário de ingestão de resultados já existente na branch, se aplicável.

### Serviço / lógica
- Novas funções em `src/services/predictions.ts`: `upsertPrediction({uid, matchId, homeScore, awayScore})` (create+update via `setDoc(merge)` com id determinístico), e `getPredictionByMatch(uid, matchId)`.
- Helper puro de **lock**: `isPredictionLocked(match, now)` (`now >= kickoffAt || status !== "scheduled"`). Testável, fonte única para UI e cópia da regra nas rules.
- Helper de **status de exibição**: deriva `Pendente|Acertou|Errou|Bloqueado` a partir de (palpite, partida, agora).

### React Query
- Query keys: `["predictions"]` (lista) e `["prediction", matchId]` (item) — alinhar com namespacing existente (provável `predictionsKeys` na feature).
- **Mutação** com `onSuccess` invalidando `["predictions"]` + `["prediction", matchId]` e os keys de badge já usados (`matchesKeys.predictions`, `homeKeys.predictions`) para o status no card atualizar.

### UI / rotas
- Nova rota `/predictions` (aba bottom nav "Palpites").
- Formulário de palpite: decidir **rota dedicada** (`/matches/[id]/predict`) **vs** sheet/drawer sobre o detalhe (Ambiguidade A2). Form com **React Hook Form + Zod** (obrigatório), steppers acessíveis (touch ≥ 44px).
- Estados: bloqueado, sucesso (`PRD04-06`), loading/empty/error da lista.

### Não-funcionais
- **Consistência**: bloqueio precisa ser garantido no servidor (rules), não só na UI — relógio do cliente é não-confiável.
- **Custo**: id determinístico evita query de unicidade; `<100` usuários → carga trivial.
- **Acessibilidade**: steppers com labels, `aria-live` na confirmação, foco gerenciado.

## 5. Riscos

- **R1 — Bloqueio só client-side é burlável.** Mitigação: regra de `kickoffAt` nas Security Rules (server-time). **Crítico.**
- **R2 — Divergência de pontuação.** Imagens dizem 3/1/0; regra é binária. Risco de implementar errado se o `/screen` copiar a tela literalmente. Mitigação: decisão travada no topo + ajuste explícito da tela.
- **R3 — Schema `.strict()` + novos campos.** Adicionar `status`/`points` sem quebrar `listPredictionsByUid` (que faz `.parse`). Mitigação: campos opcionais + migração não exige docs antigos.
- **R4 — Relógio do cliente.** Usuário com hora errada vê estado de lock incorreto. Mitigação: derivar de `kickoffAt` vs hora do servidor quando possível; rules como verdade final.
- **R5 — Corrida de cache.** Após salvar, badge no card de Jogos pode ficar desatualizado. Mitigação: invalidar todos os keys de palpite (lista + matches + home).
- **R6 — Unicidade (uid, matchId).** Sem id determinístico, usuário cria palpites duplicados. Mitigação: doc id `${uid}_${matchId}` + rule.
- **R7 — Pontuação não dispara sozinha.** Sem Cloud Function, o Route Handler de pontuação depende de agendador externo; se ninguém chamar, `points`/`status` ficam vazios e ranking não atualiza. Mitigação: configurar cron (infra, fora do código) + fallback de botão admin "Calcular pontuação". **Importante.**
- **R8 — Endpoint de pontuação exposto.** Route Handler que escreve no DB via Admin SDK não pode ser público. Mitigação: segredo/header de autorização ou checagem de role admin.

## 6. Ambiguidades e lacunas

- **A1 — RESOLVIDO.** Sem Cloud Functions. `status`/`points` gravados por **Route Handler Next** (Admin SDK), disparado por cron externo/admin. Pontuação binária. Está **no escopo** do PRD-04 (cálculo + endpoint); só a config do cron é infra externa (R7).
- **A2 — RESOLVIDO.** Form em **rota dedicada** `/matches/[id]/predict` (tela cheia, consistente com detalhe full-screen do PRD-03).
- **A3 — RESOLVIDO.** **Só create e update.** Sem delete na UI nem no serviço. (A menção a "excluir" no prd-04.md fica fora.)
- **A4 — RESOLVIDO.** Lista de Palpites com **chips client-side single-select**: `Todos · Pendentes · Acertos · Erros · Bloqueados`. Default `Todos`, ordenado por `kickoffAt` asc (próximos primeiro). Chip ativo **persistido em `localStorage`**. Filtro puro em memória (sem query extra). Contadores nos chips = opcional.
- **A5 — RESOLVIDO.** Jogo iniciado (`agora >= kickoffAt`) ⇒ usuário **não pode** criar nem editar palpite (bloqueado). Jogo sem palpite que já iniciou **não** entra na Lista de Palpites (lista = jogos com palpite do usuário).
- **A6 — Empate/pontuação display nas telas 03/04.** Remover o texto "3 pontos / 1 ponto / 0 pontos" das telas (regra binária). Tratar no `/screen`.

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first, responsivo desktop)
- **Screens:** `/predictions` (Lista de Palpites — **nova**); formulário Enviar/Editar Palpite (**novo**, rota ou sheet); estado Palpite Bloqueado (**novo**); confirmação Palpite Registrado (**novo**); Detalhe do Jogo (**existente**, ajustar CTA + bloco "Meu Palpite").
- **Product type:** Sports prediction / betting-pool app (amigos), mobile-first com bottom nav.
- **Recommended style direction:** seguir `design-system/MASTER.md` (esportivo limpo, baixa distração, tokens oklch, dark mode nativo). **Não** estética de casino. Cores de status reusando tokens semânticos (success/destructive/muted) — nenhum hex novo.
- **Design complexity:** medium (formulário com steppers + múltiplos estados + nova aba de navegação; design system já estabelecido reduz o esforço).

## 8. Implementation concerns (alto nível, sem tarefas)

- Estender schema/tipos (`predictions.ts` + `shared.ts`) antes de qualquer UI — contrato primeiro.
- Serviço de escrita (`upsertPrediction`) + helper `isPredictionLocked` puro e testado (TDD candidato — regra de tempo/branching).
- Helper `scorePrediction(prediction, match)` binário puro + Route Handler de pontuação (Admin SDK, idempotente, protegido) — TDD candidato.
- Hooks de mutação com invalidação cruzada de cache (lista + matches + home).
- **Security Rules de `predictions`** como tarefa de primeira classe (bloqueio server-side por `kickoffAt`, dono, cliente não escreve `points`/`status`).
- Telas via `/screen` referenciando `design-system/MASTER.md`; remover a pontuação 3/1/0 das telas.
- Formulário com React Hook Form + Zod; steppers acessíveis; `aria-live` na confirmação.
- Testes: helper de lock (unit), serviço (mock Firestore), componentes (estados pendente/acertou/errou/bloqueado), e fluxo create→edit→lock.
