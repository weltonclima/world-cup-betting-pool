# PLAN — Invite Flow Fix & Auth Screen Refinements

## 1. Planning Summary

5 tasks. O fluxo de convite (PRD-10) já existe mas tem um bug de geração e o cadastro ainda permite entrada sem convite. O plano diagnostica o bug primeiro (TASK-01), faz as mudanças de baixo risco (TASK-02 login, TASK-03 expired UI), e depois o trabalho maior: nova rota pública de resolução (TASK-04) e refatoração do SignupForm (TASK-05) que depende dela.

Ordem do menor para o maior risco/dependência. TASK-04 é pré-requisito de TASK-05.

## 2. Recommended Execution Phases

- **Phase 1 — Diagnóstico/foundation:** TASK-01 (bug de geração)
- **Phase 2 — UI de baixo risco:** TASK-02 (login), TASK-03 (expired UI)
- **Phase 3 — Contrato/API:** TASK-04 (rota `/resolve`)
- **Phase 4 — Integração:** TASK-05 (SignupForm invite-code)

## 3. Tasks

### TASK-01 – Diagnosticar e corrigir bug de geração de link de convite
- Type: integration
- Goal: O `group_admin` consegue gerar um convite, copiar o link e abri-lo até a tela de cadastro com grupo pré-selecionado.
- Scope: Reproduzir o bug, identificar root cause (403 por `groupId` ausente no doc do admin, `allowInvites: false`, falha do `inviteSchema.strict()` na leitura, ou erro de cookie/CORS em prod). Aplicar correção mínima. Não refatorar o que funciona.
- Main modules/files likely involved: `src/app/api/group/invites/route.ts`, `src/app/(auth)/invite/[code]/page.tsx`, `src/features/groupAdmin/components/GroupInvites.tsx`, `src/services/group.ts`, `src/schemas/invites.ts`
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
- Technical risk: high
- Recommended TDD later: no (diagnóstico primeiro; teste de regressão após root cause confirmado)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Usar `superpowers:systematic-debugging`. Root cause não confirmado — investigação é parte da task. Pode revelar que o "bug" é configuração (admin sem `groupId`) e não código.

### TASK-02 – Remover link "Cadastre-se" da tela de login
- Type: application
- Goal: Login não exibe nenhum caminho para cadastro sem convite.
- Scope: Remover o `<footer>` "Não tem conta? Cadastre-se" de `login/page.tsx`. Sem outras mudanças.
- Main modules/files likely involved: `src/app/(auth)/login/page.tsx`
- Dependencies: nenhuma
- Story points: 1
- Criticality: low
- Technical risk: low
- Recommended TDD later: no (mudança de markup trivial)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Verificar se há teste que assere a presença do link e ajustar.

### TASK-03 – UI dedicada de "link expirado" em /invite/[code]
- Type: application
- Goal: Acessar `/invite/CODE` com convite expirado exibe tela visual distinta dos erros genéricos.
- Scope: Diferenciar o estado expirado dos demais em `invite/[code]/page.tsx`. Título "Este link expirou", ícone de tempo (lucide `Clock`/`TimerOff`), mensagem orientando pedir novo link ao admin. Sem link para `/signup`; link para `/login` se já tiver conta. Demais estados de falha mantêm tratamento genérico.
- Main modules/files likely involved: `src/app/(auth)/invite/[code]/page.tsx`, `resolveInvite()` (precisa diferenciar reason "expirado")
- Dependencies: nenhuma (independe de TASK-01)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI estática condicional; cobertura via teste de componente leve)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `resolveInvite()` hoje retorna `{ ok: false, reason: string }`. Adicionar discriminante (ex.: `code: "expired" | "generic"`) para a page decidir a UI sem comparar strings de mensagem.

### TASK-04 – Rota pública GET /api/invite/[code]/resolve
- Type: api
- Goal: Endpoint público que resolve um código de convite válido em `{ groupId, groupName }`, sem auth, expondo só o mínimo.
- Scope: Criar `src/app/api/invite/[code]/resolve/route.ts`. Validar código (regex), buscar invite via Admin SDK, checar `isActive`/`expiresAt`/`usedCount`/pool ativo. Retornar `{ groupId, groupName }` (200) ou `{ error }` (4xx). Extrair a lógica compartilhada de validação (hoje em `resolveInvite()` do Server Component) para uma função server-only reutilizável.
- Main modules/files likely involved: `src/app/api/invite/[code]/resolve/route.ts` (novo), `src/server/invites/*` (novo util compartilhado), `src/app/(auth)/invite/[code]/page.tsx` (consumir o util extraído), `src/schemas/invites.ts`
- Dependencies: TASK-03 (se o discriminante de reason for movido para o util compartilhado, coordenar; senão independente)
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (validação de convite = regra de negócio: ativo/expirado/cheio/pool bloqueado)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Não vazar `usedCount`/`maxUses`/`createdBy`/`expiresAt`. Reutilizar entre Server Component e rota evita drift de regra. Rota pública — sem `requireApprovedUser`.

### TASK-05 – SignupForm aceita código de convite (substitui GroupSelectField)
- Type: integration
- Goal: Usuário em `/signup` digita código de 6 chars, resolve grupo, cadastra e o `usedCount` é incrementado.
- Scope: Substituir `GroupSelectField` por input de código no `SignupForm` (modo sem `presetGroup`). Trocar campo `groupId` por `inviteCode` no `signupFormSchema` (regex `inviteCodeSchema`). No submit: chamar `resolveInvite(code)` (novo client service), depois `signUp({...groupId})`, depois `redeemInvite(code)`. Tratar erro de código inválido/expirado com mensagem clara. Atualizar testes do SignupForm. Manter o fluxo `presetGroup` (via `/invite/[code]`) intacto.
- Main modules/files likely involved: `src/features/auth/SignupForm.tsx`, `src/features/auth/schemas.ts`, `src/services/invites.ts` (add `resolveInvite`), `src/features/auth/__tests__/SignupForm.test.tsx`
- Dependencies: TASK-04 (precisa da rota `/resolve`)
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (mudança de contrato do schema + fluxo condicional de submit)
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: É frontend (`is_frontend: true`) — aciona ui-spec + patterns:nextjs + ui-review. Cuidado para não quebrar o fluxo `/invite/[code]` que já passa `presetGroup`+`inviteCode`. Decidir resolução no submit vs blur (UX trade-off do PRD §6.4).

## 4. Dependency Map

```
TASK-01  (independente)
TASK-02  (independente)
TASK-03  (independente)
TASK-04  (independente; coordena util com TASK-03)
TASK-05  → depende de TASK-04
```

Único acoplamento forte: TASK-05 precisa da rota de TASK-04. TASK-03 e TASK-04 compartilham o util de validação `resolveInvite` — fazer TASK-04 extrair o util e TASK-03 consumir, ou inverter; ordem atual (03 antes de 04) significa que 04 extrai e 03 pode ser ajustada, então recomenda-se **TASK-04 extrair o discriminante de reason** e TASK-03 consumi-lo. Ver ordem recomendada.

## 5. Recommended Execution Order

1. **TASK-01** — diagnóstico do bug (desbloqueia o uso real do fluxo; maior risco isolado)
2. **TASK-02** — remover link do login (trivial, rápido)
3. **TASK-04** — rota `/resolve` + extração do util de validação (foundation para 03 e 05)
4. **TASK-03** — expired UI (consome o discriminante do util extraído em 04)
5. **TASK-05** — SignupForm invite-code (depende de 04)

> Nota: ordem ajustada vs Phase mapping — TASK-04 sobe para antes de TASK-03 porque extrai o util compartilhado de validação que TASK-03 consome. Reduz retrabalho.

## 6. Planning Risks and Blockers

- **TASK-01 root cause incerto** — pode ser código ou configuração (admin sem `groupId`). Se for config, a "correção" pode ser um guard de UX + doc, não mudança de lógica. Diagnóstico primeiro.
- **TASK-05 quebra de contrato** — mudar `signupFormSchema` afeta testes existentes e o fluxo `/invite/[code]`. Maior task, maior risco. TDD recomendado.
- **TASK-04/03 acoplamento de util** — coordenar a extração do `resolveInvite` util para evitar drift de regra de validação entre Server Component e rota pública.
- **Rota pública `/resolve`** — risco baixo de enumeração; aceitar com rate-limit do App Hosting.
- plan-checker: rodaria (≥4 tasks + tasks high-risk), mas o breakdown é direto e goal-backward já cobre os 5 requisitos do PRD 1:1 (R1→T01, R2→T02, R5→T03, R3→T04+T05, R4→T05). Skip aceitável dado o mapeamento explícito requisito→task.
