# PLAN — Autenticação e Aprovação (PRD-01)

> Insumo: `ai/prd/auth.md`. Fonte de verdade visual: `docs/prd-01/PRD01-Layout-Autenticacao.png`, `docs/prd-01/login.png`, `docs/prd-01/cadastro.png`, `docs/prd-01/aguardando.png`. Design system: `design-system/MASTER.md` (já existe — referenciar, não regenerar). Não confundir com `ai/plan/feature.md` (plano do PRD-00 / fundação).

---

## 1. Planning summary

PRD-01 entrega o fluxo de autenticação sobre a fundação PRD-00 (AuthProvider, useAuth, userSchema, AuthGuard, AuthLayout, PendingApprovalScreen, Security Rules ativas). Escopo desta PRD após decisões:

- **Login** (`(auth)/login`) — formulário real RHF+Zod, `signInWithEmailAndPassword`, logo dourado.
- **Cadastro** (`(auth)/cadastro`) — nova rota, formulário RHF+Zod, `createUserWithEmailAndPassword` + `setDoc` com rollback, logo verde.
- **Primeiro usuário vira admin (A1)** — Cloud Function trigger Firestore `onCreate users/{uid}` (Admin SDK) promove o doc inaugural para `role=admin`/`status=approved`. Necessário porque as Security Rules **bloqueiam** o client de escrever `admin`/`approved` no auto-cadastro (`allow create` força `pending`/`user`).
- **Pending** (`(auth)/pending`) — botão "Atualizar Status" que força releitura do perfil via `refreshProfile` exposto no AuthProvider.
- **Infra de suporte** — schemas de formulário, mapeamento de erros Firebase→pt-BR, serviços de auth, componentes UI compartilhados (logo + input de senha com toggle).

**Fora de escopo (outras PRDs):** recuperação de senha (A4), painel admin aprovar/bloquear (A7), edição de perfil, notificação ao admin, emailVerified obrigatório, unicidade de apelido.

### Decisões de design travadas
- **Logo:** `public/logo-login.png` (troféu **dourado**) na tela de Login; `public/logo-cadastro.png` (troféu **verde**) na tela de Cadastro. (Ambos já gerados a partir de `docs/prd-01/logo.png`.)
- **Sem BottomNav** nas telas de auth — a fonte de verdade não exibe nav inferior; nav é exclusivo do app shell interno.
- **Fundo:** Login/Cadastro escuro (verde gradiente); Pending fundo claro. Aplicar tema dark localmente nas telas de auth (não depende do tema global).
- **Termos de Uso (A5):** checkbox obrigatório (Zod `refine` exige `true`), gate client-only. Links apontam para placeholder (`#` ou rota futura). Aceite **não** é persistido no Firestore (`userSchema` é `.strict()`, sem campo de termos).
- **Confirmar senha (A6):** validação só frontend (Zod `refine`); não vai ao Firebase Auth nem ao Firestore.

---

## 2. Recommended execution phases

1. **Fundação** — schemas de formulário, erros pt-BR, primitivos UI, `refreshProfile`, Cloud Function first-admin (independentes, paralelizáveis).
2. **Serviços** — camada de auth (`signIn`, `signUp` com rollback, `signOut`) consumindo schemas.
3. **Telas** — Login, Cadastro, expansão do Pending, consumindo serviços + primitivos.

---

## 3. Tasks

### TASK-01 – Schemas de formulário (login + cadastro)
- Type: domain
- Goal: schemas Zod independentes para validar os formulários, distintos do `userSchema` (doc Firestore).
- Scope: `loginFormSchema` (email, password); `signupFormSchema` (name, nickname, email, password, confirmPassword, acceptTerms) com `refine` confirmando password===confirmPassword e acceptTerms===true; tipos derivados via `z.infer`.
- Main modules/files: `src/features/auth/schemas.ts`
- Dependencies: nenhuma (reusa `@/schemas/shared` se aplicável)
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: yes — regras de validação (refine senha/termos, formato email, mínimo 6 chars)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: senha mínimo 6 caracteres (regra do `cadastro.png`). Não contaminar `src/schemas/users.ts`.

### TASK-02 – Mapeamento de erros Firebase Auth → pt-BR
- Type: application
- Goal: traduzir códigos de erro do Firebase Auth para mensagens amigáveis em português.
- Scope: função `mapAuthError(code: string): string` cobrindo `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-credential`, `auth/email-already-in-use`, `auth/weak-password`, `auth/too-many-requests`, `auth/network-request-failed`, fallback genérico. Email-already-in-use com mensagem que não confirma existência (privacidade — R6).
- Main modules/files: `src/features/auth/errors.ts`
- Dependencies: nenhuma
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD: yes — tabela de mapeamento (entrada→saída)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: usado pelas telas via `toast.error` (Sonner).

### TASK-03 – Primitivos UI de auth (AuthLogo + PasswordInput)
- Type: ui
- Goal: componentes compartilhados entre Login e Cadastro.
- Scope: `AuthLogo` (recebe `variant: "login" | "cadastro"` → renderiza `/logo-login.png` ou `/logo-cadastro.png` via `next/image`, com `alt`); `PasswordInput` (Input Shadcn + botão `ghost` toggle `Eye`/`EyeOff` Lucide, `aria-label` de mostrar/ocultar, encaminha `ref` para RHF).
- Main modules/files: `src/components/auth/AuthLogo.tsx`, `src/components/auth/PasswordInput.tsx`
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no — componente visual; teste leve de toggle no /test
- Recommended screen: yes – web – componentes visuais reutilizáveis (input com toggle, logo)
- Design domains: style, ux
- Design complexity: low
- Accessibility level: enhanced — toggle de senha precisa de `aria-label` e foco gerenciado
- Notes: referenciar `design-system/MASTER.md`. `PasswordInput` deve funcionar com `react-hook-form` (forwardRef).

### TASK-04 – Expor `refreshProfile` no AuthProvider
- Type: application
- Goal: permitir releitura manual do perfil `users/{uid}` sem depender de `onAuthStateChanged` (necessário para o botão "Atualizar Status").
- Scope: extrair a leitura/parse do perfil para função reutilizável; adicionar `refreshProfile(): Promise<void>` ao `AuthContextValue`; atualiza `profile`/`error`/`loading` de forma segura (guard de `active`/usuário corrente). Sem quebrar consumidores atuais (AuthGuard, AuthLayout).
- Main modules/files: `src/providers/AuthProvider.tsx`
- Dependencies: nenhuma
- Story points: 3
- Criticality: high
- Technical risk: medium — concorrência com o ciclo do `onAuthStateChanged`; evitar race/stale state
- Recommended TDD: yes — refresh atualiza profile; no-op se deslogado; lida com not-found→approved
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: R4. Não alterar o contrato existente, apenas estender.

### TASK-05 – Cloud Function: primeiro usuário vira admin (A1)
- Type: integration
- Goal: promover automaticamente o primeiro doc `users/{uid}` criado para `role=admin`/`status=approved`.
- Scope: trigger Firestore `onDocumentCreated("users/{uid}")` (firebase-functions v2); verifica se é o usuário inaugural via transação sobre `system_settings/bootstrap` (`{ firstAdminAssigned: true }`); se ainda não atribuído, `update({ role: "admin", status: "approved", updatedAt })` no doc via Admin SDK (bypassa rules por design) e marca a flag. Idempotente e seguro contra reentrância/corrida.
- Main modules/files: `functions/src/functions/promoteFirstAdmin.ts`, export em `functions/src/index.ts`
- Dependencies: nenhuma
- Story points: 3
- Criticality: critical — sem isso o sistema não tem admin (R1, bloqueante de produção)
- Technical risk: medium — corrida em cadastros simultâneos (mitigado pela transação na flag)
- Recommended TDD: yes — 1º user→admin/approved; 2º user→inalterado (pending/user); idempotência/transação
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: padrão de export `./functions/<nome>` (igual `syncTeams`/`scheduledSync`). Documentar no /release: deploy da function **antes** do 1º cadastro real.

### TASK-06 – Serviços de auth (signIn / signUp / signOut)
- Type: application
- Goal: camada de serviço que encapsula Firebase Auth + Firestore para os formulários.
- Scope: `signIn(email, password)` → `signInWithEmailAndPassword`; `signUp(payload)` → `createUserWithEmailAndPassword` seguido de `setDoc(users/{uid}, { uid, name, nickname, email, role:"user", status:"pending", createdAt })` com **rollback `user.delete()` se o `setDoc` falhar** (R2); `signOut()`. Erros propagados com código para o form mapear (TASK-02).
- Main modules/files: `src/services/auth.ts` (+ reexport em `src/services/index.ts`)
- Dependencies: TASK-01 (tipos do payload de signup)
- Story points: 3
- Criticality: critical
- Technical risk: medium — atomicidade signup (rollback); se o próprio rollback falhar, logar/avisar (estado órfão)
- Recommended TDD: yes — signUp cria auth+doc; rollback ao falhar setDoc; signIn sucesso/erro
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: cliente sempre escreve `pending`/`user` (rules exigem). Promoção a admin é da TASK-05. `createdAt` em ISO.

### TASK-07 – LoginForm + tela de Login
- Type: ui
- Goal: substituir o placeholder por formulário de login funcional.
- Scope: `LoginForm` (RHF + `loginFormSchema`, campos Email/Senha via `PasswordInput`, botão "Entrar" `w-full` com estado loading, link "Esqueci minha senha" alinhado à direita como **placeholder inativo** — A4 em outra PRD, link "Não tem conta? Cadastre-se" → `/cadastro`); página integra `AuthLogo variant="login"` (dourado), "Bem-vindo de volta!", chama `signIn` (TASK-06) e mapeia erro (TASK-02) via toast. Sucesso → AuthLayout/AuthGuard cuidam do redirect.
- Main modules/files: `src/features/auth/LoginForm.tsx`, `src/app/(auth)/login/page.tsx`
- Dependencies: TASK-01, TASK-02, TASK-03, TASK-06
- Story points: 3
- Criticality: high
- Technical risk: low
- Recommended TDD: no — UI; cobertura via /test (submit, validação inline, erro→toast)
- Recommended screen: yes – web – nova implementação de tela (substitui placeholder)
- Design domains: style, color, typography, ux
- Design complexity: medium
- Accessibility level: critical — formulário com validação, labels, foco, erros anunciados
- Notes: fundo escuro verde; card central max-w ~360–400px; sem BottomNav. Fonte de verdade: `docs/prd-01/login.png`.

### TASK-08 – SignupForm + rota de Cadastro
- Type: ui
- Goal: nova rota e formulário de criação de conta.
- Scope: `SignupForm` (RHF + `signupFormSchema`: Nome completo, Apelido, Email, Senha + Confirmar senha via `PasswordInput`, checkbox Termos obrigatório com links placeholder; botão "Criar conta" desabilitado até válido, estado loading); página integra `AuthLogo variant="cadastro"` (verde), "Criar sua conta", chama `signUp` (TASK-06), mapeia erro pt-BR (TASK-02, incl. email-already-in-use), link "Já tem conta? Entrar" → `/login`. Sucesso → usuário pending cai na tela Pending.
- Main modules/files: `src/features/auth/SignupForm.tsx`, `src/app/(auth)/cadastro/page.tsx`
- Dependencies: TASK-01, TASK-02, TASK-03, TASK-06
- Story points: 5
- Criticality: high
- Technical risk: medium — feedback de rollback e de email duplicado; validação visual de confirmar senha
- Recommended TDD: no — UI; /test cobre validação (senha≠confirm, termos não aceito, email inválido) e fluxo de erro
- Recommended screen: yes – web – nova rota e formulário
- Design domains: style, color, typography, ux
- Design complexity: high
- Accessibility level: critical — múltiplos campos, validação inline, checkbox com links, toggles de senha
- Notes: fundo escuro verde; sem BottomNav. Fonte de verdade: `docs/prd-01/cadastro.png`. Termos não persistidos.

### TASK-09 – Expansão da tela Pending (Atualizar Status)
- Type: ui
- Goal: adicionar refresh de status à `PendingApprovalScreen`.
- Scope: botão "Atualizar Status" (outline) que chama `refreshProfile` (TASK-04); estado loading no botão; se após refresh `status==="approved"` → `router.push("/home")`; se continua pending → toast informativo ("Ainda aguardando aprovação."). Manter botão "Sair" existente. Ajustar layout ao mock (fundo claro, ícone Clock, textos).
- Main modules/files: `src/components/layout/PendingApprovalScreen.tsx`
- Dependencies: TASK-04
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no — UI; /test cobre clique→refresh→redirect quando approved
- Recommended screen: yes – web – alteração de layout/comportamento de tela existente
- Design domains: style, ux
- Design complexity: low
- Accessibility level: enhanced — botão com estado loading e feedback
- Notes: fundo claro (quebra o padrão dark). Fonte de verdade: `docs/prd-01/aguardando.png`.

---

## 4. Dependency map

```
TASK-01 (schemas) ───────────────┐
TASK-02 (errors) ────────────────┤
TASK-03 (UI primitivos) ─────────┤
                                  ├──► TASK-07 (LoginForm)
TASK-06 (services) ◄── TASK-01 ───┤
                                  └──► TASK-08 (SignupForm)

TASK-04 (refreshProfile) ────────────► TASK-09 (Pending)

TASK-05 (Cloud Function 1º admin) ── independente
```

- TASK-01: sem deps
- TASK-02: sem deps
- TASK-03: sem deps
- TASK-04: sem deps
- TASK-05: sem deps
- TASK-06: depende de TASK-01
- TASK-07: depende de TASK-01, 02, 03, 06
- TASK-08: depende de TASK-01, 02, 03, 06
- TASK-09: depende de TASK-04

---

## 5. Execution waves (parallel groups)

- **Wave 1** (independentes): TASK-01, TASK-02, TASK-03, TASK-04, TASK-05
- **Wave 2**: TASK-06 (dep TASK-01) · TASK-09 (dep TASK-04)
- **Wave 3**: TASK-07, TASK-08 (dep TASK-06 + primitivos/erros)

---

## 6. Recommended execution order (sequential fallback)

1. TASK-01 — schemas de formulário
2. TASK-02 — erros pt-BR
3. TASK-03 — primitivos UI (logo + senha)
4. TASK-04 — refreshProfile
5. TASK-05 — Cloud Function 1º admin
6. TASK-06 — serviços de auth
7. TASK-07 — LoginForm
8. TASK-08 — SignupForm
9. TASK-09 — Pending refresh

Início sugerido: **TASK-01** (desbloqueia serviços e formulários). **TASK-05** pode rodar em paralelo desde já (backend isolado, criticidade máxima).

---

## 7. Planning risks and blockers

| # | Item | Severidade | Mitigação no plano |
|---|---|---|---|
| R1 | Sem admin, ninguém aprova usuários | Crítica | TASK-05 (Cloud Function 1º admin). Deploy da function **antes** do 1º cadastro real — documentar no /release. |
| R2 | Cadastro órfão (auth sem doc) | Alta | TASK-06: rollback `user.delete()` se `setDoc` falhar; logar se o próprio rollback falhar. |
| R4 | Refresh de status sem `onAuthStateChanged` | Média | TASK-04: `refreshProfile` com guard de concorrência. |
| R6 | Vazar existência de email no signup | Baixa | TASK-02: mensagem neutra para `email-already-in-use`. |
| B1 | Race no bootstrap do 1º admin | Média | TASK-05: transação sobre `system_settings/bootstrap` em vez de contagem simples. |
| B2 | Termos de Uso sem documento real (A5) | Baixa | Checkbox obrigatório client-only; links placeholder; aceite não persistido. Confirmar com produto se exige persistência futura. |
| B3 | `emailVerified` ignorado (A2) | Baixa | Aprovação do admin substitui verificação nesta PRD. |
| B4 | Apelido não único (A8) | Baixa | Sem constraint nesta PRD; revisitar se virar requisito. |

---

*Plano gerado a partir de `ai/prd/auth.md` e da inspeção da fundação real (Security Rules, AuthProvider, AuthGuard, AuthLayout, functions/). Próximo passo: `/spec` por tarefa.*
