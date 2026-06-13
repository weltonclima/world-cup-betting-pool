# PRD — Invite Flow Fix & Auth Screen Refinements

## 1. Feature Summary

Corrige e fecha o fluxo de convite (PRD-10): investigar e corrigir o bug de geração de link, remover o acesso de cadastro direto (sem convite) na tela de login, transformar `/signup` de "seleção de grupo" para "entrada de código de convite", e diferenciar visualmente a tela de convite expirado.

Objetivo: toda entrada de novos usuários passa obrigatoriamente por um código de convite, eliminando o cadastro livre sem vínculo de grupo.

---

## 2. Consolidated Scope

### R1 — Investigar e corrigir bug de geração do link de convite
O botão "Gerar novo link" em `GroupInvites.tsx` não funciona como esperado. O root cause precisa ser diagnosticado durante a implementação. Candidatos prováveis:
- `POST /api/group/invites` retorna erro (403 se `groupId` não está no doc do admin, 409 se `allowInvites === false`, erro de schema Zod se o doc Firestore tem campos extras).
- `inviteSchema.strict()` falha ao ler o doc de volta na página `/invite/[code]` se o doc persistido contém campos não mapeados.
- A URL gerada por `inviteUrl()` usa `window.location.origin` — correto, mas precisa de verificação em prod vs emulador.

**Critério de aceitação:** um `group_admin` consegue gerar um convite pelo painel, copiar o link, abrir em incógnito e chegar na tela de cadastro com o grupo pré-selecionado.

### R2 — Remover link "Cadastre-se" da tela de login
Remover o `<footer>` com o link "Não tem conta? Cadastre-se" de `src/app/(auth)/login/page.tsx`. O cadastro passa a ser exclusivamente via convite. Sem outras mudanças na tela de login.

**Critério de aceitação:** a tela de login não exibe nenhum caminho para cadastro sem convite.

### R3 — Tela de cadastro aceita código de convite em vez de seletor de grupo
A rota `/signup` deixa de usar `GroupSelectField` (busca e seleção de pool) e passa a exibir um campo de texto para o código de convite (6 chars `[A-Z0-9]`).

Fluxo de submit:
1. Valida formato do código (client-side, regex `inviteCodeSchema`).
2. Chama `GET /api/invite/[code]/resolve` (nova rota pública) que retorna `{ groupId, groupName }` ou erro.
3. Chama `signUp({ name, nickname, email, password, groupId })` com o groupId resolvido.
4. Chama `redeemInvite(code)` (best-effort, igual ao fluxo `/invite/[code]`).
5. Toast de sucesso: "Conta criada! Aguarde a aprovação do administrador."

O `signupFormSchema` precisa substituir o campo `groupId` por `inviteCode` (validado pelo `inviteCodeSchema`). O `groupId` real é resolvido durante o submit, não armazenado no estado do formulário.

**Critério de aceitação:** usuário entra em `/signup`, digita um código válido de 6 chars, cadastra com sucesso, e o `usedCount` do convite é incrementado.

### R4 — Contabilizar uso do convite no cadastro direto via `/signup`
Idêntico ao que já existe no fluxo `/invite/[code]`: após `signUp` bem-sucedido, chamar `redeemInvite(inviteCode)` (best-effort). O `redeemInvite` existente já funciona para isso — só precisa ser acionado pelo formulário de `/signup`.

**Critério de aceitação:** após cadastro via `/signup` com código, `invites/{code}.usedCount` é incrementado de 1 via `POST /api/invite/[code]/redeem`.

### R5 — Página de convite expirado com UI dedicada
Em `src/app/(auth)/invite/[code]/page.tsx`, o estado de convite expirado (`Date.parse(expiresAt) <= Date.now()`) precisa de uma UI visual distinta dos demais estados de erro genérico ("Convite indisponível").

A tela de expirado deve:
- Título: "Este link expirou" (ou equivalente claro).
- Ícone visual de tempo/expiração (ex.: `Clock` ou `Timer` do lucide).
- Mensagem: "Este link de convite não está mais disponível. Peça ao administrador do grupo para gerar um novo."
- Sem link para `/signup` (pois o usuário não tem convite válido).
- Link para `/login` se já tiver conta.

Os outros estados de falha (não encontrado, inativo, cheio, grupo bloqueado) mantêm o tratamento genérico atual.

**Critério de aceitação:** acessar `/invite/ABCDE1` com convite expirado exibe a tela de expirado, não o fallback genérico.

---

## 3. System Understanding Relevant to This Feature

### Arquivos-chave impactados
| Arquivo | Papel |
|---|---|
| `src/app/(auth)/login/page.tsx` | R2: remover footer "Cadastre-se" |
| `src/app/(auth)/signup/page.tsx` | R3: nenhuma mudança de page (só SignupForm prop) |
| `src/app/(auth)/invite/[code]/page.tsx` | R1 (debug) + R5: UI expirada dedicada |
| `src/features/auth/SignupForm.tsx` | R3: substituir GroupSelectField por invite code input |
| `src/features/auth/schemas.ts` | R3: substituir `groupId` por `inviteCode` no `signupFormSchema` |
| `src/app/api/invite/[code]/resolve/route.ts` | R3: nova rota pública de resolução de código |
| `src/services/invites.ts` | R3: adicionar `resolveInvite(code)` client service |
| `src/app/api/group/invites/route.ts` | R1: investigar e corrigir se necessário |

### Fluxo atual (funcionando) — `/invite/[code]`
```
User → GET /invite/CODE
  → Server Component (Node runtime)
  → Admin SDK: db.collection("invites").doc(code).get()
  → Admin SDK: db.collection("pools").doc(groupId).get()
  → Render SignupForm com presetGroup={id, name} + inviteCode={code}
    → onSubmit → signUp(groupId=presetGroup.id) → redeemInvite(code)
```

### Fluxo novo — `/signup` com código
```
User → GET /signup
  → render SignupForm (sem presetGroup)
  → User digita código de 6 chars
  → onSubmit:
    1. GET /api/invite/{code}/resolve → { groupId, groupName } | error
    2. signUp({ ..., groupId })
    3. redeemInvite(code)
```

### `redeemInvite` e seu endpoint
`services/invites.ts::redeemInvite(code)` → `POST /api/invite/[code]/redeem` com `{ idToken }`.
O endpoint valida que `users/{uid}.groupId === invite.groupId` antes de incrementar `usedCount`. Esta validação passa pois o `signUp` já gravou `groupId` no doc do usuário antes do redeem.

### `authorizeGroupAdminOfPool` (para R1)
Requer: sessão aprovada + role `group_admin|super_admin` + `users/{uid}.groupId` preenchido. Se o admin não tem `groupId` no doc, retorna 403.

### `inviteSchema.strict()`
A flag `.strict()` rejeita campos extras. O doc criado pelo POST está correto (campos exatos = schema). O risco é se alguma atualização posterior (`isActive: false` update) causar leitura de doc "stale" com campos não mapeados — improvável, mas a verificar.

---

## 4. Technical Impact Analysis

### Módulos afetados
- **`features/auth`**: `SignupForm.tsx`, `schemas.ts` — mudança de contrato do formulário.
- **`app/(auth)`**: `login/page.tsx` (remoção), `invite/[code]/page.tsx` (novo estado), `signup/page.tsx` (nenhuma mudança necessária na page em si).
- **`app/api/invite`**: nova rota `[code]/resolve/route.ts`.
- **`services/invites`**: nova função `resolveInvite`.

### Contrato de dados
- `signupFormSchema` muda: campo `groupId` (obrigatório) → `inviteCode` (string regex `^[A-Z0-9]{6}$`). O `groupId` real não é mais coletado pelo form; é resolvido no submit.
- Nova rota `GET /api/invite/[code]/resolve`: pública (sem auth), retorna `{ groupId: string, groupName: string }` ou `{ error: string }` com status 4xx. **Não expõe** `usedCount`, `maxUses`, `createdBy`, `expiresAt` — apenas o suficiente para o cadastro.

### Segurança
- A rota `/resolve` é pública. Expõe apenas `groupId` e `groupName` de convites ativos/não-expirados. Não vaza dados sensíveis.
- O `redeemInvite` continua protegido por `idToken` + validação de `groupId` no doc do usuário.
- A remoção do "Cadastre-se" é defense-in-depth: o `/signup` ainda é acessível via URL direta, mas agora exige código de convite válido.

### Impacto em testes existentes
- `src/features/auth/__tests__/SignupForm.test.tsx`: precisa atualizar para o novo campo `inviteCode`.
- Nenhuma quebra nos outros testes (mudanças são aditivas/de UI).

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Bug R1 pode ser no Firestore Security Rules (leitura de `invites` no client) | Alto | Admin SDK no Server Component já bypassa Rules — verificar se alguma leitura está sendo feita no client por engano |
| `signupFormSchema` muda → testes existentes do SignupForm quebram | Médio | Atualizar testes junto com a mudança |
| Nova rota `/resolve` pode ser explorada para enumerar códigos válidos | Baixo | Códigos de 32^6 ≈ 1 bilhão de combinações; rate-limit do App Hosting mitiga brute-force |
| `redeemInvite` no `/signup` falha silenciosamente (best-effort) | Baixo | Comportamento já aceito na PRD-10; admin aprova manualmente |
| Remover "Cadastre-se" do login sem outra forma de acesso | Médio | Garantir que o link expirado aponte para suporte, não para `/signup` sem convite |

---

## 6. Ambiguities and Gaps

1. **Root cause do bug R1 não confirmado.** A investigação faz parte da TASK-01. Pode ser: (a) `groupId` ausente no doc do admin; (b) `allowInvites === false` no pool; (c) Zod schema strict falhando; (d) erro de CORS/cookie no ambiente de prod.

2. **UI de expirado para outros estados de falha.** O PRD especifica tela dedicada apenas para expirado. Os demais estados (não encontrado, inativo, cheio) mantêm o genérico. Se o PO quiser estados dedicados para todos, é escopo adicional.

3. **Cadastro sem convite — o que acontece?** Se `/signup` exige código e o usuário tenta registrar sem um convite válido, ele simplesmente não consegue. Isso é o comportamento desejado, mas precisa de mensagem de erro clara na tela.

4. **Validação de código antes do submit.** A spec pede resolução só no submit. UX alternativa: resolver no blur do campo (melhor feedback imediato). Deixar para o implementador decidir, mas mencionar o trade-off.

5. **`/signup` acessível sem convite** — agora retorna erro de "código inválido". Não há redirecionamento. Manter comportamento para simplicidade.

---

## 7. Recommended Implementation Concerns

- **TASK-01 (bug/diagnose first):** Antes de qualquer UI, diagnosticar e corrigir o bug de geração de convite. Testar o fluxo completo em dev/staging antes de avançar.
- **TASK-02 (nova rota `/resolve`):** Implementar `GET /api/invite/[code]/resolve` com validação completa (ativo, não expirado, não cheio, pool ativo). Reutilizar a lógica de `resolveInvite()` já existente no Server Component — extrair em função utilitária server-only compartilhada.
- **TASK-03 (SignupForm + schema):** Substituir `GroupSelectField` por input de código. Atualizar `signupFormSchema`. Chamar `/resolve` no submit. Chamar `redeemInvite` após signup. Atualizar testes.
- **TASK-04 (login page):** Remoção simples do footer — 1 linha de JSX. Baixo risco.
- **TASK-05 (expired UI):** Diferenciar `resolution.reason` em `invite/[code]/page.tsx` para renderizar UI distinta no caso expirado.
- **Ordem sugerida:** TASK-01 → TASK-04 → TASK-05 → TASK-02 → TASK-03 (do menor para o maior risco).
