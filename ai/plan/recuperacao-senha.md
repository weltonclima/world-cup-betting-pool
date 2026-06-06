# PLAN — Recuperação de Senha (PRD-01.1)

> Insumo: `ai/prd/recuperacao-senha.md`. Tasks nomeadas `recuperacao-senha-task-NN`.
> Constraint global: telas vivem no grupo `(auth)` → **sem `AppShell`/`BottomNav`**. Reuso obrigatório: `PasswordInput`, `AuthLogo`, `services/auth.ts`, `errors.ts`, `features/auth/schemas.ts`.

---

## 1. Resumo do planejamento

5 tasks, 2 fundação (lógica pura, sem UI) + 2 UI (as 4 telas dos mockups) + 1 wiring no login. Toda a senha vive no Firebase Auth; **zero escrita no Firestore**, **zero alteração de Security Rules**. Risco principal é operacional (R1: Action URL do e-mail) e é tratado no `/release`, não em código.

- **Total story points:** 14
- **Tasks com `/screen`:** 2 (TASK-03, TASK-04)
- **Tasks com TDD:** 3 (TASK-01, TASK-02, TASK-04)
- **Início recomendado:** TASK-01 + TASK-02 em paralelo (Wave 1)

---

## 2. Fases de execução recomendadas

1. **Fundação** (lógica testável, sem UI): schemas/erros + serviço Firebase.
2. **Exposição UI** (telas): solicitação (02+03) e redefinição (04+05).
3. **Wiring**: ligar o link do login ao novo fluxo.

---

## 3. Tasks

### TASK-01 – Schemas de form + mapeamento de erros de reset
- **Type:** domain
- **Goal:** validar entradas das 2 telas de form e traduzir os erros Firebase de action-code para pt-BR.
- **Scope:** adicionar `forgotPasswordSchema` (e-mail, reusa `emailField`) e `resetPasswordSchema` (nova senha ≥8 + letra + número via regex; `confirmPassword` com `refine`). Estender `mapAuthError` com `auth/invalid-action-code`, `auth/expired-action-code`, `auth/user-disabled`; ajustar texto de `auth/weak-password` para refletir 8 caracteres **apenas no contexto de reset** (sem quebrar login/cadastro). **NÃO** alterar `PASSWORD_MIN_LENGTH` (login/cadastro = 6; reset = constante própria `RESET_PASSWORD_MIN_LENGTH = 8`).
- **Main modules/files:** `src/features/auth/schemas.ts`, `src/features/auth/errors.ts` (+ testes).
- **Dependencies:** nenhuma.
- **Story points:** 2
- **Criticality:** high
- **Technical risk:** low
- **Recommended TDD:** yes (regex de senha, `refine` de confirmação, tabela de erros — lógica pura, regression-prone).
- **Recommended screen:** no – n/a – lógica pura, sem UI.
- **Design domains:** n/a
- **Design complexity:** n/a
- **Accessibility level:** n/a
- **Notes:** A2 — a regra "diferente da anterior" **não** entra no schema bloqueante (app não conhece a senha atual). Tratar como item visual informativo na TASK-04, não como validação Zod.

### TASK-02 – Camada de serviço: reset de senha (Firebase Auth)
- **Type:** application
- **Goal:** encapsular as chamadas Firebase de reset, mantendo a convenção existente (propaga `error.code` cru; UI traduz).
- **Scope:** em `services/auth.ts` adicionar:
  - `sendPasswordReset(email: string): Promise<void>` → `sendPasswordResetEmail`. **Anti-enumeração (R3):** capturar `auth/user-not-found` e resolver como sucesso (não relançar); demais erros propagam.
  - `verifyResetCode(oobCode: string): Promise<string>` → `verifyPasswordResetCode` (retorna e-mail do código).
  - `confirmReset(oobCode: string, newPassword: string): Promise<void>` → `confirmPasswordReset`.
- **Main modules/files:** `src/services/auth.ts`, `src/services/__tests__/auth.test.ts`.
- **Dependencies:** nenhuma.
- **Story points:** 3
- **Criticality:** critical
- **Technical risk:** medium (mock do Firebase Auth; comportamento anti-enumeração precisa de teste explícito).
- **Recommended TDD:** yes (swallow de `user-not-found`, propagação dos demais — comportamento de segurança).
- **Recommended screen:** no – n/a – serviço, sem UI.
- **Design domains:** n/a
- **Design complexity:** n/a
- **Accessibility level:** n/a
- **Notes:** `actionCodeSettings` opcional fica como parâmetro/constante preparada, mas a config real da Action URL é operacional (R1, `/release`).

### TASK-03 – Tela & form de solicitação: `(auth)/esqueci-senha` (telas 02 + 03)
- **Type:** ui
- **Goal:** usuário deslogado informa e-mail, recebe link, vê confirmação.
- **Scope:** rota `src/app/(auth)/esqueci-senha/page.tsx` + `ForgotPasswordForm`. Dois estados na mesma rota: `form` (tela 02: campo e-mail, "Enviar link", "Voltar para o login") → `enviado` (tela 03: ícone confirmação, e-mail digitado exibido, instrução checar spam/inbox, "Voltar para o login"). RHF+Zod (`forgotPasswordSchema`), submit via `sendPasswordReset`, erros via `toast.error(mapAuthError(code))`. Reusar padrão hero+card do login e `AuthLogo`. **Sem bottom nav.**
- **Main modules/files:** `src/app/(auth)/esqueci-senha/page.tsx`, `src/features/auth/ForgotPasswordForm.tsx` (+ teste).
- **Dependencies:** TASK-01, TASK-02.
- **Story points:** 3
- **Criticality:** high
- **Technical risk:** low
- **Recommended TDD:** no (form de UI; cobrir com teste de componente no `/test`).
- **Recommended screen:** yes – web – nova rota com 2 estados (form + confirmação), fonte mockups 02/03.
- **Design domains:** style, color, typography, ux, forms
- **Design complexity:** medium
- **Accessibility level:** critical (form com validação + estados de feedback).
- **Notes:** transição form→enviado é estado local (não nova rota). E-mail exibido na tela 03 = valor digitado (A4).

### TASK-04 – Tela & form de redefinição: `(auth)/redefinir-senha` (telas 04 + 05)
- **Type:** ui
- **Goal:** via link do e-mail (`oobCode`), usuário define nova senha e vê sucesso.
- **Scope:** rota `src/app/(auth)/redefinir-senha/page.tsx` + `ResetPasswordForm`. Lê `oobCode`/`mode` da query string. Estados: `verificando` (valida com `verifyResetCode` no mount) → `valido` (tela 04: Nova senha + Confirmar nova senha com `PasswordInput`, **checklist ao vivo** das regras [min 8, letras e números, ≠ anterior*], "Redefinir senha") → `sucesso` (tela 05: ícone ✓, "Senha alterada com sucesso", "Ir para o login") → `invalido` (oobCode ausente/expirado/usado: mensagem + CTA voltar a `/esqueci-senha`). RHF+Zod (`resetPasswordSchema`), submit via `confirmReset`. **Sem bottom nav.**
- **Main modules/files:** `src/app/(auth)/redefinir-senha/page.tsx`, `src/features/auth/ResetPasswordForm.tsx`, componente de checklist de senha (+ testes).
- **Dependencies:** TASK-01, TASK-02.
- **Story points:** 5
- **Criticality:** critical
- **Technical risk:** medium (4 estados, leitura de query, `verifyResetCode` assíncrono no mount, checklist reativo).
- **Recommended TDD:** yes (máquina de estados do oobCode + lógica do checklist reativo são regression-prone; testar a lógica antes da casca visual).
- **Recommended screen:** yes – web – nova rota multi-estado, fonte mockups 04/05.
- **Design domains:** style, color, typography, ux, forms
- **Design complexity:** high
- **Accessibility level:** critical (dupla senha, checklist ao vivo com `aria-live`, estados de erro).
- **Notes:** *A2 — "≠ anterior" é **indicador visual informativo**, não validação bloqueante (não verificável sem a senha atual). Deixar claro no `/screen` que o checklist é informativo.

### TASK-05 – Wiring do link "Esqueci minha senha" no login (tela 01)
- **Type:** refactor-support
- **Goal:** substituir o placeholder por navegação real para `/esqueci-senha`.
- **Scope:** em `LoginForm.tsx` remover `handleForgotPassword` (`toast("Em breve")`, linhas 55-58) e trocar o `<Button onClick>` (104-115) por `<Link href="/esqueci-senha">` estilizado como link (ou `Button asChild`). Manter posição/estilo atuais. Atualizar/ajustar teste do LoginForm que cobre o placeholder.
- **Main modules/files:** `src/features/auth/LoginForm.tsx`, `src/features/auth/__tests__/LoginForm.test.tsx`.
- **Dependencies:** TASK-03 (rota destino precisa existir).
- **Story points:** 1
- **Criticality:** medium
- **Technical risk:** low
- **Recommended TDD:** no
- **Recommended screen:** no – web – alteração mínima de um link num form existente; sem mudança de layout. (Se o `/screen` da TASK-03 já cobrir o estado do link, dispensável.)
- **Design domains:** n/a
- **Design complexity:** low
- **Accessibility level:** standard
- **Notes:** sem bottom nav (login já não tem). Verificar `autoComplete`/foco mantidos.

---

## 4. Dependency map

```
TASK-01 (schemas/erros) ─┐
                         ├─→ TASK-03 (esqueci-senha) ─→ TASK-05 (login link)
TASK-02 (serviço)      ──┤
                         └─→ TASK-04 (redefinir-senha)
```

- TASK-01, TASK-02: sem dependências (fundação).
- TASK-03, TASK-04: dependem de 01 + 02; independentes entre si.
- TASK-05: depende de 03 (rota destino).

## 5. Execution waves (grupos paralelos)

- **Wave 1:** TASK-01, TASK-02 *(fundação, independentes)*
- **Wave 2:** TASK-03, TASK-04 *(UI, dependem da Wave 1; independentes entre si)*
- **Wave 3:** TASK-05 *(depende de TASK-03)*

## 6. Ordem sequencial (fallback)

TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-05

## 7. Riscos e bloqueios do plano

| # | Item | Mitigação |
|---|---|---|
| R1 | **Action URL do e-mail** não customizada → telas 04/05 inacessíveis no fluxo real | **Não bloqueia código.** TASK-04 funciona com `oobCode` na URL (testável manualmente colando link). Configuração documentada e executada no `/release`. |
| A2 | "Senha ≠ anterior" não verificável | Decidido: checklist **informativo** (não-bloqueante) na TASK-04. Confirmar no `/screen`. |
| R6 | Divergência 6 (cadastro) vs 8 (reset) chars | Aceito nesta PRD; constante isolada `RESET_PASSWORD_MIN_LENGTH`. |
| — | Mock do Firebase Auth nos testes (TASK-02) | Seguir padrão de mock já usado em `services/__tests__/auth.test.ts`. |
| — | Início UI antes do `/screen` | TASK-03 e TASK-04 exigem `/screen` antes do `/implement` (gate do flow). |
```
