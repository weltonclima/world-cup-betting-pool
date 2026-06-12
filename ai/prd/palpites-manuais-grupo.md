# PRD — Palpites Manuais pelo Admin de Grupo (PRD-12)

> Feature slug: `palpites-manuais-grupo`
> Gerado: 2026-06-12 · Stack: Next.js 15 / React 19 / TS strict / Firebase App Hosting
> Origem: pedido do usuário — "tela para o admin do grupo adicionar palpites manuais para users do seu grupo, mesmo se o jogo já estiver encerrado, seguindo o design do projeto".

---

## 1. Resumo da feature

Dar ao **admin de grupo** (`group_admin`, e por herança `super_admin`) uma tela para **registrar/editar o palpite de qualquer participante aprovado do seu próprio grupo**, inclusive para **jogos já encerrados** — furando o time-lock por kickoff que normalmente bloqueia a escrita.

Caso de uso: participante esqueceu de palpitar (ou pediu ao admin), o jogo já passou/encerrou, e o admin lança o placar previsto manualmente. Como o palpite entra para um jogo finalizado, ele é **pontuado imediatamente** e o **ranking do grupo recalcula**.

A feature **não muda a regra de pontuação** (placar exato = +1, resto = 0, PRD-00). Muda **quem** pode gravar um palpite e **quando** (override de lock por um admin, escopo ao próprio grupo).

---

## 2. Escopo consolidado

### Dentro do escopo
- Nova tela `(app)/group/predictions` no painel de admin de grupo já existente (PRD-10), atrás de `GroupAdminGuard`.
- Fluxo: **selecionar participante do grupo → selecionar jogo → digitar placar (home/away) → salvar**.
- Novo endpoint `POST /api/group/predictions` (group-scoped, Admin SDK) que:
  - autentica via `authorizeGroupAdminOfPool()` (sessão → role + `groupId`);
  - aceita `targetUid` no body e **valida que o alvo pertence ao mesmo `groupId`** do admin e está `approved`;
  - **ignora `isPredictionLocked`** por design (override consciente do admin);
  - grava via `predictionDocId(targetUid, matchId)` com `set({ merge: true })`;
  - marca a origem manual (`editedBy` = uid do admin, `editedByRole`, `editedAt`) para transparência/auditoria;
  - dispara **score + recalc de ranking** quando o jogo já está finalizado.
- Registro de **audit log** (`system_logs`) por gravação: tipo novo `group_admin_manual_prediction`, com `actorUid` (admin) e `targetUid` (participante).
- **Marcação visível** na UI de que aquele palpite foi lançado pelo admin (badge "lançado pelo admin").
- Edição/sobrescrita: se o participante já tem palpite naquele jogo, o admin **pode sobrescrever** (com confirmação).

### Fora do escopo (explícito)
- Lançamento em massa (vários jogos/vários users de uma vez) — entrega futura; aqui é 1 participante + 1 jogo por submit (com a tela permitindo trocar de jogo/participante).
- Edição de **resultado do jogo** (isso é PRD-11, super_admin, `isManualOverride` em `matches`). Aqui edita-se **palpite**, não o jogo.
- Mudança na regra de pontuação ou no algoritmo de ranking (PRD-02/04 inalterados).
- Auto-save/rascunho local (fluxo é submit explícito por jogo).
- Permitir que o admin lance para participante **de outro grupo** (proibido por isolamento).

---

## 3. Entendimento do sistema (partes relevantes)

### Write split (arquitetura crítica)
- Escrita de palpite é **server-only via Route Handler + Admin SDK**. Rules negam write client-direto em `predictions`. (`architecture.md` §Read/Write).
- `POST /api/predictions` (`route.ts`): `uid` **sempre da sessão, nunca do body** (`:32,:124`); `if (isPredictionLocked(match, now)) → 423` (`:108`). **Estes dois pontos são exatamente o que a nova feature precisa contornar — por isso NÃO se reusa esse endpoint; cria-se um novo, group-scoped e isolado.**

### Trilho de admin de grupo já existente (PRD-10) — reuso
- `authorizeGroupAdminOfPool()` (`api/group/_authorize.ts:52`): resolve `groupId` da sessão (nunca do request), valida role por `roleSchema.safeParse` (fail-closed), aceita `isGroupAdminRole` OU `isSuperAdminRole`.
- Moderação de usuários do grupo (`api/group/users/_moderation.ts`): padrão de isolamento `targetUser.groupId === sessionGroupId` (`:82`) e proteção contra alvo `super_admin` (`:125`). **Mesmo padrão a reusar.**
- UI: rotas `(app)/group/{dashboard,users,settings,invites}` atrás de `GroupAdminGuard` (`components/layout/GroupAdminGuard.tsx`: `group_admin` OU `super_admin`). Nova rota `(app)/group/predictions` entra na mesma navegação.

### Modelo de dados (reuso)
- `predictionSchema = { uid, matchId, homeScore, awayScore, status?, points? }`; `status`/`points` só o servidor grava. `predictionDocId(uid,matchId) = `${uid}_${matchId}``.
- `users/{uid}.groupId` = pertencimento ao pool; `role` em `shared.ts` (3 níveis + legados).
- `matchSchema.status ∈ {scheduled,live,finished,postponed,canceled}`; `finished` ⇒ `homeScore`/`awayScore` numéricos. `isPredictionLocked(match,now)` = `now ≥ kickoff` **ou** `status ≠ scheduled`.
- `fetchAllMatches()` (`server/copaData`) retorna os 104 jogos (não há fetch unitário — server filtra por id em memória).

### Pontuação e ranking (reuso)
- `POST /api/predictions/score` aplica `scorePrediction(prediction, match)` para jogos finalizados e encadeia `POST /api/rankings/recalc` (best-effort, via `RANKINGS_SECRET`).
- Para a nova feature, após gravar um palpite de jogo já finalizado, é preciso **garantir o score desse palpite + recalc do ranking** — senão o lançamento não reflete no ranking.

### Auditoria (reuso)
- `writeAuditLog()` (`server/admin/auditLog.ts`) grava em `system_logs` (best-effort). Enum de tipos em `schemas/systemLogs.ts` — **adicionar** `group_admin_manual_prediction`.

---

## 4. Análise de impacto técnico

### Módulos afetados
- **Novo** `src/app/api/group/predictions/route.ts` — POST group-scoped (auth + escopo + override lock + write + audit + trigger score/recalc).
- **Novo** `src/app/(app)/group/predictions/page.tsx` (+ componentes em `features/predictions` ou `features/group`) — tela de lançamento.
- **`schemas/`** — novo `groupManualPredictionInputSchema = { targetUid, matchId, homeScore, awayScore }`; estender `predictionSchema` com campos de origem manual (`editedBy?`, `editedByRole?`, `editedAt?`) — espelha o padrão PRD-11 de `matches`.
- **`schemas/systemLogs.ts`** — novo tipo de log.
- **`services/`** — novo método client (`createManualPredictionForMember`) + hook React Query.
- **`features/predictions`** — reuso de `ScoreInput`; possível badge "lançado pelo admin" no card de palpite.
- **Leitura de participantes do grupo** — listar users `approved` com `groupId === adminGroupId` (reuso do que a tela de moderação de grupo já faz).

### Persistência e contratos
- Mantém **só `predictions`** persistido (mais campos de origem manual). Nenhum dado da Copa no banco (`D-PERSIST`).
- Write idempotente `set({ merge: true })` em `predictionDocId(targetUid, matchId)`.
- Disparo de score/recalc reusa o chain existente; avaliar chamar `score` direcionado ou o recalc geral (decisão no /plan).

### Segurança / autorização (núcleo da feature)
- **targetUid vem do body** (exceção controlada ao invariante uid-from-session) — por isso a checagem de escopo é obrigatória e dupla: alvo `approved` **e** `targetUser.groupId === sessionGroupId`.
- Admin de grupo **não** pode lançar para `super_admin` nem para alvo fora do grupo (403).
- `super_admin` herda acesso (consistente com guards atuais).
- Toda gravação **auditada** (actor + target + jogo + placar).

### Performance / escala
- < 100 usuários, 104 jogos — trivial. `fetchAllMatches()` já é cacheado; filtrar em memória.

### Migração / rollout
- Aditivo: nova rota + endpoint, nenhum breaking nos fluxos existentes. Campos novos em `predictionSchema` são opcionais (compat com palpites já existentes).

---

## 5. Riscos

1. **Fairness / abuso (ALTO, produto).** Furar o lock permite lançar palpite **após o resultado conhecido**. Inerente à feature. Mitigação: audit obrigatório + marcação visível "lançado pelo admin" no palpite + restrição de escopo ao próprio grupo. Decisão de produto: aceitar (confia-se no admin do grupo).
2. **Quebra do invariante uid-from-session (ALTO, técnico).** Aceitar `targetUid` do body é perigoso se vazar para o endpoint geral. Mitigação: endpoint **separado e isolado** (`/api/group/predictions`), nunca alterar `/api/predictions`; checagem de escopo fail-closed.
3. **Ranking não atualiza após lançamento (MÉDIO).** Se o score/recalc não disparar para o jogo finalizado, o palpite não pontua visivelmente. Mitigação: garantir trigger pós-write e testar o caminho jogo-finalizado.
4. **Sobrescrita silenciosa de palpite do usuário (MÉDIO).** Admin pode apagar/alterar palpite legítimo do participante. Mitigação: confirmação na UI + audit + (opcional) preservar valor anterior no log.
5. **`super_admin` sem `groupId` (BAIXO/MÉDIO).** `authorizeGroupAdminOfPool` exige `groupId` na sessão; super_admin global pode não ter um. Decisão: super_admin precisa selecionar grupo, ou feature é efetivamente para `group_admin`. Resolver no /plan (A4).
6. **Design system — verde de auth vs shell neutro (BAIXO).** Seguir `design-system/MASTER.md` e os padrões das telas `(app)/group/*` já existentes (não reinventar).

---

## 6. Ambiguidades e lacunas (resolver no /plan ou via decisão)

- **A1.** Quais jogos o admin pode lançar: **só finalizados/encerrados**, ou qualquer jogo bloqueado (kickoff passado, ao vivo), ou **todos** (inclusive futuros)? O pedido cita "mesmo se encerrado". Recomendação: permitir **qualquer jogo bloqueado** (encerrado/ao vivo/kickoff passado), pois para jogo futuro o próprio participante palpita.
- **A2.** Sobrescrever palpite já existente do participante: **permitir com confirmação** (recomendado) ou bloquear se já existe?
- **A3.** Lançamento por jogo (1×1) agora; **lote** (vários jogos/users) fica fora — confirmar.
- **A4.** `super_admin` usando a tela: precisa **selecionar grupo** primeiro, ou a feature é só para `group_admin` com `groupId`? Recomendação: escopo pelo `groupId` da sessão; super_admin sem grupo vê seletor (ou fica fora desta entrega).
- **A5.** Marcação de origem: gravar `editedBy/editedByRole/editedAt` no `prediction` **e** exibir badge ao participante? Recomendação: sim, ambos (transparência).
- **A6.** Recalc: chamar `score` direcionado ao jogo + `rankings/recalc`, ou só recalc geral? Decisão técnica no /plan.
- **A7.** Notificar o participante que o admin lançou um palpite por ele? Recomendação: fora do escopo nesta entrega (notificações = só Sistema hoje).

---

### 6.1 Decisões resolvidas (usuário, 2026-06-12)

| # | Decisão |
|---|---|
| A1 | Admin lança para **qualquer jogo bloqueado** (`isPredictionLocked === true`: encerrado, ao vivo, ou kickoff passado). Jogo **futuro/scheduled** fica fora — o próprio participante palpita pelo fluxo normal. UI lista só jogos bloqueados; endpoint valida que o jogo está bloqueado (rejeita futuro com 4xx). |
| A2 | **Sobrescrita permitida com confirmação.** Se o participante já tem palpite, a UI mostra o valor atual e exige confirmação; o audit log registra valor anterior → novo. |
| A4 | Entrega só para **`group_admin`**, escopada pelo `groupId` da sessão. `super_admin` global (sem grupo) **não** é alvo desta entrega (seletor de grupo fica para futuro). `super_admin` que também tenha `groupId` herda acesso naturalmente. |
| A3 | **Confirmado fora de escopo:** lançamento em lote (vários jogos/users). Aqui é 1 participante + 1 jogo por submit. |
| A5 | **Sim:** gravar `editedBy`/`editedByRole`/`editedAt` no `prediction` **e** exibir badge "lançado pelo admin". |
| A7 | **Fora de escopo:** notificar participante (notificações só Sistema hoje). |

## 7. Impacto UI/Layout

- **UI Impact:** yes · **Platform:** web (mobile-first, responsivo) · **is_frontend: true**
- **Telas:** 1 nova — `(app)/group/predictions` (seletor de participante + seletor de jogo + `ScoreInput` + confirmação/estado de sucesso/erro). Estados: vazio (sem participantes/jogos elegíveis), bloqueado/permitido, sucesso, erro de escopo.
- **Style:** consistente com as telas `(app)/group/*` existentes e `design-system/MASTER.md` (cards elevados, shell neutro). Reusar `ScoreInput` de `features/predictions`.
- **Design complexity:** **média** — formulário com 2 seletores + input de placar + confirmação; sem wizard.

---

## 8. Preocupações de implementação (alto nível, sem tasks)

- **Endpoint isolado** `POST /api/group/predictions` — copiar o esqueleto de auth de `api/group/users/*` (`authorizeGroupAdminOfPool` + isolamento de `groupId`), **não** o de `api/predictions`.
- **Override de lock é explícito** — o novo endpoint simplesmente **não chama** `isPredictionLocked`; documentar no código o porquê (admin-override consciente).
- **Reuso de leitura de membros** — a query de participantes `approved` do grupo já existe na moderação de grupo; reaproveitar.
- **Trigger de pontuação** — após write em jogo finalizado, garantir score+recalc; testar o caminho.
- **Schema aditivo** — campos de origem manual opcionais em `predictionSchema` (não quebrar palpites existentes nem os testes de `schemas/__tests__`).
- **Audit + marcação** — `system_logs` novo tipo + badge na UI; lógica pura de autorização/escopo é candidata a **TDD**.
- **Acessibilidade** — alvos ≥44px, foco visível, `aria` nos seletores e no `ScoreInput`.
