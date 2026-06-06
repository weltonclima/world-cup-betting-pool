# REVIEW — Recuperação de Senha (PRD-01.1)

> Revisão adversarial das TASK-01..05. Refs: `gsd-code-reviewer.md` (BLOCKER/WARNING), `gsd-ui-auditor.md` (6 pilares, TASK-03/04). Diagnostics IDE: 0 erros nos arquivos da feature (única flag = `tsconfig.json baseUrl` deprecation, **pré-existente**, fora de escopo; `tsc --noEmit` limpo). Testes: 80 verdes. Build: 0 erros.

## Veredito: **approved with adjustments** (0 BLOCKER · 2 WARNING)

---

## TASK-01 — schemas + erros
**Veredito: approved.** Sem findings.
- `resetPasswordSchema`: min 8 + regex letra + regex dígito; refine no path `confirmPassword`. Traçado: senha `"        "` (8 espaços) → length ok, regex letra/dígito falham → rejeitada. `RESET_PASSWORD_MIN_LENGTH` isolado; `PASSWORD_MIN_LENGTH`/login/cadastro intactos. ✓
- `errors.ts`: 3 códigos action-code; demais inalterados; função pura. ✓

## TASK-02 — serviço reset
**Veredito: approved.** Sem findings.
- **Segurança R3 (anti-enumeração):** `sendPasswordReset` engole **só** `auth/user-not-found`; erro sem `code` → `code===undefined` ≠ match → propaga (correto). Narrowing `(error as { code?: string })` sem `any`. ✓
- `verifyResetCode` resolve e-mail; `confirmReset` propaga erros. Cobertos por T1-T7. ✓

## TASK-03 — tela esqueci-senha
**Veredito: approved.** Sem findings de código.
- Máquina form→enviado; sucesso sempre mostra confirmação (anti-enumeração herdada do serviço). Erro → toast traduzido, permanece no form. ✓
- Label↔input corrigido (ícone fora do `FormControl`); foco move p/ heading no `enviado` (`tabIndex=-1`); `role=status aria-live`. ✓

## TASK-04 — tela redefinir-senha
**Veredito: approved with adjustments** (1 WARNING).
- Máquina 4 estados traçada: `!oobCode || (mode!==null && mode!=="resetPassword")` → `invalido`; senão `verifyResetCode`. `onSubmit` guarda `!oobCode` (sem `!`-assertion). Cleanup `active` evita setState pós-unmount. ✓
- `form.setFocus("password")` em vez de ref manual (evita conflito com `field.ref` do RHF — bug que eu havia introduzido e corrigi). ✓
- **A2 honesto:** 3º item do checklist é `info` (ícone `Info`, `sr-only` "informativo, não validado"), nunca bloqueia. Real vs informativo separado e testado. ✓
- **[WARNING-1 · maintainability] ✅ RESOLVIDO** — extraído `ResetVerifying` (`src/features/auth/ResetVerifying.tsx`, presentacional puro) e reusado no `fallback` do Suspense e no estado `verificando` do form. Sem duplicação.

## TASK-05 — link no login
**Veredito: approved.** Placeholder `toast("Em breve")` removido; `<Link href="/esqueci-senha">`; teste atualizado. ✓

---

## UI/UX Review (TASK-03 + TASK-04) — 6 pilares + checklist 10 prioridades

| Pilar | Score (1-4) | Evidência |
|---|---|---|
| P1 Acessibilidade | 4 | labels associadas; `aria-live`/`role=status|alert`; foco gerenciado por estado; cor não é único canal (ícone+texto+`sr-only`); `motion-reduce` nos spinners. |
| P2 Touch/Interação | 4 | CTAs `h-11` (44px); toggle senha `h-11 w-11`; loading desabilita botão + spinner; erro→toast com mensagem acionável. |
| P3 Performance | 4 | `AuthLogo` via `next/image` (dims declaradas, `priority`); sem listas/imagens pesadas. |
| P4 Estilo | 4 | tokens semânticos (sem hex); Lucide only; 1 CTA primário por estado. |
| P5 Layout/Responsivo | 4 | mobile-first; `max-w-sm` (line-length ok); card `flex-1 rounded-t-3xl`; sem scroll horizontal. |
| P8 Forms/Feedback | 3 | labels visíveis; erro inline abaixo do campo (`FormMessage`); loading→sucesso/erro. Nota: sem indicador de campo obrigatório — **consistente com login/cadastro** do projeto, não é regressão. |

**Visual diff:** não executado — screen docs não têm seção `## Visual Analysis (from image)` e não há dev server rodando (auditoria code-only). Mockups validados manualmente contra layout.

- **Violations P1-2 (críticas):** 0
- **BLOCKER:** 0
- **WARNING:** 2 (WARNING-1 acima; WARNING-2 abaixo)
- **[WARNING-2 · P8]** Mockups 02-05 exibem BottomNav; removida por contrato do grupo `(auth)`. Divergência **intencional e aprovada** pelo solicitante (registrada nos screen docs) — listada por transparência, não exige ação.

### Top fixes (prioridade)
1. (WARNING-1) Extrair estado `verificando` compartilhado — DRY entre page fallback e form.
2. (WARNING-2) Nenhuma ação — divergência de BottomNav é intencional.
3. Opcional: exibir e-mail retornado por `verifyResetCode` na tela 04 (spec marcou como opcional).

---

## Conclusão
Nenhum BLOCKER. 2 WARNINGs (1 manutenção real, 1 informativo). Segurança (R3, oobCode, sem `any`), acessibilidade e máquina de estados **corretas e cobertas por teste**. Feature liberada para `/local-env` → `/release`. WARNING-1 pode ser endereçado agora ou virar follow-up.
