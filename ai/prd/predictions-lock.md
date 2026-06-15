# PRD — Lock/Unlock de Palpites por Grupo

## 1. Feature summary

Adicionar controle pool-level de bloqueio de palpites ao painel do group_admin. Um campo booleano `predictionsLocked` no doc `pools/{groupId}` serve como interruptor global: quando `true`, nenhum participante do grupo pode criar ou editar palpites em qualquer jogo. O group_admin (ou super_admin) alterna o estado via botão no dashboard do grupo. O bloqueio é verificado no Route Handler de escrita (`POST /api/predictions`) antes de persistir qualquer palpite.

## 2. Consolidated scope

### Comportamento esperado

- **Estado padrão:** `predictionsLocked` ausente ou `false` → palpites liberados.
- **Quando travado (`predictionsLocked: true`):**
  - `POST /api/predictions` retorna 423 para qualquer usuário do grupo, independente do jogo.
  - UI do participante exibe indicação de bloqueio (label "Palpite Bloqueado" visível no dashboard do grupo).
- **Quando liberado:**
  - Comportamento atual preservado — lock por jogo (kickoff) ainda se aplica.
  - Label "Palpite Liberado" no dashboard.
- **Toggle:** botão na seção "Ações Rápidas" do `GroupDashboard`, ao lado do atalho "Palpites". Apenas group_admin/super_admin veem e acionam o botão.
- **Scope do bloqueio:** todo o pool (`groupId`), todos os jogos, todos os participantes.
- **Admin manual (`POST /api/group/predictions`):** NÃO bloqueado pelo lock — o admin pode lançar palpites manuais mesmo com pool travado (invariante atual: só funciona em jogos já bloqueados por kickoff).

### Fora de escopo
- Bloqueio por jogo individual (já existe via `isPredictionLocked`).
- Notificação push/email ao travar/destravar.
- Histórico/auditoria do toggle (nice-to-have, não requerido).

## 3. System understanding relevant to this feature

### Persistência
- `pools/{poolId}` — Firestore, Admin SDK only (rule: `write: if false`). Campo novo `predictionsLocked: boolean` adicionado ao `poolSchema` como optional para backward-compat com pools existentes.
- `POST /api/predictions` lê `users/{uid}.groupId` para identificar o pool do usuário. Precisará ler `pools/{groupId}.predictionsLocked` antes de persistir.

### Autorização
- `authorizeGroupAdminOfPool()` (`src/app/api/group/_authorize.ts`) — retorna `{ uid, groupId, role }` ou `{ errorResponse }`. Padrão consolidado para todas as rotas `/api/group/*`. O endpoint de toggle deve reusá-lo.
- Participants nunca tocam a coleção `pools` — qualquer escrita vai via Admin SDK em Route Handler.

### Escrita de palpites (`POST /api/predictions`)
- Etapa 5 atual: `isPredictionLocked(match, now)` → 423 se jogo bloqueado por kickoff.
- Nova etapa (antes ou logo após): lê `pools/{groupId}.predictionsLocked` → 423 se pool travado.
- `groupId` do usuário está em `userData.groupId` (já lido na etapa 2 para verificar status).

### UI — GroupDashboard
- Seção "Ações Rápidas": grid 3→4 botões (`/group/users/pending`, `/group/invites`, `/group/settings`, `/group/predictions`).
- O botão de lock é um novo item nesta grid — ou um controle inline ao lado do item "Palpites".
- Estado inicial lido via `useGroupDashboard` (já busca dados do pool) ou hook dedicado.
- Mutation via React Query `useMutation` → `PATCH /api/group/settings` (reutilizar endpoint existente) ou endpoint dedicado.

### Endpoint de toggle
Duas opções:
- **A) Reutilizar `PATCH /api/group/settings`** — já aceita campos opcionais do pool, já autorizado. Basta adicionar `predictionsLocked: z.boolean().optional()` ao `settingsSchema` local. Prós: zero novo endpoint, menor surface. Contras: semântica misturada com configurações visuais.
- **B) Endpoint dedicado `POST /api/group/predictions/lock`** — toggle explícito, body `{ locked: boolean }`. Prós: semântica clara, auditoria isolável. Contras: novo arquivo de rota.

Recomendação: **opção A** (PATCH /api/group/settings) — menor surface, padrão já estabelecido, sem new-file overhead.

### Dashboard data (`useGroupDashboard`)
- Retorna `pool` (tipo `GroupDashboard.pool`) já inclui campos do `poolSchema`. Se `predictionsLocked` for adicionado ao schema, já virá no response de `GET /api/group/dashboard` sem mudança de contrato — desde que o servidor leia o campo do doc.

## 4. Technical impact analysis

| Área | Impacto |
|---|---|
| `src/schemas/pools.ts` | Adicionar `predictionsLocked: z.boolean().optional()` ao `poolSchema` |
| `src/app/api/group/settings/route.ts` | Adicionar `predictionsLocked` ao `settingsSchema` local e ao patch handler |
| `src/app/api/predictions/route.ts` | Nova verificação: ler `pools/{groupId}.predictionsLocked` → 423 se true |
| `src/services/group.ts` | Possível: expor `predictionsLocked` no tipo `GroupDashboard` |
| `src/features/groupAdmin/components/GroupDashboard.tsx` | Botão toggle na seção "Ações Rápidas" |
| `src/features/groupAdmin/hooks/useGroupSettings.ts` | Mutation para PATCH settings com `predictionsLocked` |
| Firestore Rules | Nenhuma mudança — `pools` write já é `if false` (Admin SDK only) |
| `poolSchema` backward-compat | Campo optional → pools existentes continuam fazendo parse sem erro |

### Fluxo de escrita com lock ativo
```
POST /api/predictions
  → verificar sessão cookie → uid
  → ler users/{uid} → status, groupId
  → ler pools/{groupId}.predictionsLocked → 423 se true  ← NOVO
  → validar body
  → buscar partida
  → isPredictionLocked(match, now) → 423 se travado por kickoff
  → gravar prediction
```

### Performance
- Leitura extra de `pools/{groupId}` por request de palpite. Custo: 1 Firestore read adicional. Mitigação possível: agrupar no mesmo batch com `users/{uid}` (já lido). No volume atual (não há picos esperados), aceitável sem cache.

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Admin trava sem querer e não sabe destravar | Médio | Label clara + confirmação no toggle (dialog) |
| `predictionsLocked` ausente em doc antigo → parse quebra | Baixo | Campo optional no schema → `undefined` interpretado como `false` |
| Race condition: usuário está editando enquanto admin trava | Baixo | Server-side check no momento da escrita — request em voo é rejeitado |
| Leitura extra de `pools/{groupId}` aumenta latência de palpites | Baixo | ~1 read Firestore por request; negócio aceita |
| `POST /api/group/predictions` (admin manual) deve ignorar o lock | Médio | Verificação explícita: este endpoint NÃO checa `predictionsLocked` (design intencional já documentado) |

## 6. Ambiguities and gaps

1. **Confirmação no toggle?** O usuário pediu apenas label no botão. Não está claro se deve haver um dialog de confirmação antes de travar (evita travamento acidental). Recomendado: sim, um dialog simples ("Bloquear todos os palpites do grupo?").

2. **Visibilidade para participantes:** O botão de toggle é só para admins. Mas participantes devem ver algum indicador de que os palpites estão travados? A tela de palpites (`/matches`) retornará 423 na tentativa — mas uma UI proativa seria mais clara. Não requerido pelo PRD, mas é um gap de UX.

3. **Auditoria:** Travar/destravar é uma ação administrativa com impacto em todos os usuários. `writeAuditLog` deveria ser chamado? Não requerido explicitamente — marcar como nice-to-have.

4. **`groupId` ausente no user doc:** `POST /api/predictions` já não trata explicitamente `groupId` ausente (usuários sem grupo não chegam ao ponto de ter palpites bloqueados, mas o código precisará de um fallback seguro para não lançar exceção ao tentar ler `pools/undefined`).

## 7. Recommended implementation concerns

- Adicionar `predictionsLocked` ao `poolSchema` antes de qualquer outra coisa — é o contrato base.
- Reutilizar `PATCH /api/group/settings` para o toggle evita nova rota.
- Na verificação de `POST /api/predictions`: se `groupId` ausente → skip do check (usuário sem grupo não está em pool algum). Fail-open intencional para não quebrar fluxo de usuários em transição (TASK-12 backfill ainda em curso).
- O botão no dashboard deve mostrar estado atual lido do `pool.predictionsLocked`. O `useGroupDashboard` já traz o objeto `pool` — basta expor o campo.
- Mutex visual no botão durante a mutation (loading state) para evitar double-submit.
- Testar: (a) participante tenta palpite com lock ativo → 423; (b) toggle de admin → estado persiste; (c) admin manual (`/api/group/predictions`) funciona mesmo com lock.
