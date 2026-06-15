# PLAN — Lock/Unlock de Palpites por Grupo

## 1. Planning summary

Feature pequena, focada, alinhada a padrões existentes. 4 tasks em 3 fases: fundação (schema), regra de negócio (enforcement na escrita + toggle no endpoint), exposição (UI no dashboard). Sem migração de dados (campo optional, backward-compat). Sem mudança em Firestore Rules (pools já é Admin-SDK-only). Risco geral baixo, com um ponto crítico: o enforcement em `POST /api/predictions` (TASK-02) é a barreira de segurança real.

## 2. Recommended execution phases

- **Fase 1 — Fundação:** contrato de dados (schema do pool).
- **Fase 2 — Regra de negócio:** enforcement na escrita de palpites + persistência do toggle no endpoint de settings.
- **Fase 3 — Exposição:** botão de toggle + estado no dashboard do grupo.

## 3. Tasks

### TASK-01 – Adicionar `predictionsLocked` ao poolSchema
- Type: domain
- Goal: introduzir o campo de contrato `predictionsLocked` no `poolSchema` como base para todo o feature.
- Scope: adicionar `predictionsLocked: z.boolean().optional()` ao `poolSchema`. Documentar default-na-leitura (`undefined` = liberado). Atualizar testes do schema.
- Main modules/files likely involved: `src/schemas/pools.ts`, `src/schemas/__tests__/pools.test.ts`
- Dependencies: nenhuma
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (schema trivial, teste co-located cobre)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: campo aditivo optional — pools antigos continuam fazendo parse. Base de TASK-02 e TASK-03.

### TASK-02 – Enforcement do lock em `POST /api/predictions`
- Type: api
- Goal: rejeitar criação/edição de palpite de qualquer participante quando o pool do usuário está travado.
- Scope: após ler `users/{uid}` (já feito), ler `pools/{groupId}.predictionsLocked`; se `true` → 423 com mensagem pt-BR. Fail-open se `groupId` ausente (usuário em transição/sem pool). NÃO alterar `POST /api/group/predictions` (admin manual ignora o lock por design).
- Main modules/files likely involved: `src/app/api/predictions/route.ts`, teste co-located da rota
- Dependencies: TASK-01
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD later: yes (regra condicional de autorização, regression-sensitive)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: barreira de segurança real. 1 Firestore read extra por palpite. Confirmar que `groupId` ausente não lança em `pools/undefined`. Review opus/high: approved, sem ajustes bloqueantes. Achados não-bloqueantes p/ TASK-03/04: campo `code` nos 423 (M2), nota spec sobre integridade de `groupId` (M1). Fail-open também em erro de read do pool (Case G). GSD reviewer indisponível → adversarial pass via general-purpose.

### TASK-03 – Persistir toggle via `PATCH /api/group/settings`
- Type: api
- Goal: permitir que group_admin/super_admin alterne `predictionsLocked` do próprio pool.
- Scope: adicionar `predictionsLocked: z.boolean().optional()` ao `settingsSchema` local e ao patch handler de `PATCH /api/group/settings`. Garantir que `predictionsLocked` é retornado em `GET /api/group/dashboard` (via `poolSchema.parse`, já cobre se TASK-01 feita). Atualizar testes da rota.
- Main modules/files likely involved: `src/app/api/group/settings/route.ts`, `src/app/api/group/settings/__tests__/route.test.ts`, possível `src/services/group.ts` (tipo `GroupDashboard`)
- Dependencies: TASK-01
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (extensão de endpoint existente já testado; teste pós-impl basta)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: reusa endpoint existente (decisão PRD opção A) — autorização escopada já garantida por `authorizeGroupAdminOfPool`. Sem novo arquivo de rota. Follow-up: admin route (`/api/admin/groups/[id]`) aceita `predictionsLocked` via `poolEditSchema` mas não persiste — gap de TASK-01, resolver antes de release.

### TASK-04 – Botão de toggle no GroupDashboard (frontend)
- Type: application
- Goal: expor o estado e o controle de lock no dashboard do grupo, com label dinâmica.
- Scope: botão na seção "Ações Rápidas" ao lado de "Palpites", label "Palpite Bloqueado"/"Palpite Liberado" conforme `pool.predictionsLocked`. Dialog de confirmação antes de alternar. Mutation via React Query → `PATCH /api/group/settings`; invalidar `groupKeys.dashboard()`. Loading/disabled durante mutation.
- Main modules/files likely involved: `src/features/groupAdmin/components/GroupDashboard.tsx`, `src/features/groupAdmin/hooks/useGroupSettings.ts` (ou novo `useTogglePredictionsLock`), `src/services/group.ts`
- Dependencies: TASK-03 (endpoint), TASK-01 (campo no dashboard data)
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; teste de componente pós-impl)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: `is_frontend: true` → aciona ui-spec + patterns:nextjs. `useGroupDashboard` já traz `pool` — expor `predictionsLocked`. Confirmação evita travamento acidental (gap PRD §6.1).

## 4. Dependency map

```
TASK-01 (schema)
   ├─→ TASK-02 (enforcement em predictions)
   ├─→ TASK-03 (toggle em settings)
   └─→ TASK-04 (UI) ──depends-on──→ TASK-03
```

- TASK-01 é fundação — bloqueia tudo.
- TASK-02 e TASK-03 são independentes entre si (ambas só dependem de TASK-01).
- TASK-04 depende de TASK-03 (precisa do endpoint) e de TASK-01 (campo no dashboard data).

## 5. Recommended execution order

1. **TASK-01** — schema (fundação)
2. **TASK-02** — enforcement (barreira de segurança; independente da UI)
3. **TASK-03** — toggle no endpoint
4. **TASK-04** — UI do dashboard

TASK-02 antes de TASK-03/04: a barreira de segurança server-side deve existir antes de qualquer UI que a controle, garantindo que o lock funciona mesmo sem frontend.

## 6. Planning risks and blockers

- **TASK-02 é o ponto crítico** — se o enforcement falhar, o lock é cosmético. Review opus/high + TDD obrigatório.
- **Fail-open em `groupId` ausente** — decisão intencional (usuários em transição TASK-12). Confirmar no spec que não lança exceção em `pools/undefined`.
- **Sem blockers externos** — nenhum requer clarificação para começar. Ambiguidades do PRD (confirmação no toggle, indicador para participante, auditoria) resolvidas: confirmação=sim (TASK-04), indicador proativo=fora de escopo, auditoria=fora de escopo.
- plan-checker: skipped — plano pequeno (4 tasks, todas risk=low, sem critical). Raciocínio goal-backward dos passos 4–6 sustenta a cobertura: schema→enforcement→toggle→UI cobre todo o scope do PRD.
