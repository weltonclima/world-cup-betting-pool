# PLAN — Perfil do Usuário (PRD-06)

> Origem: `ai/prd/perfil-usuario.md`. Alto reuso de `features/rankings`, `services/statistics`,
> `services/auth`, `components/auth/PasswordInput`. Decisões A1–A6 do PRD aplicadas.

## 1. Planning summary

10 tarefas. Núcleo: hub de Perfil + 5 sub-telas. Fundação (schema senha, service profile, sub-rota
layout) paralelizável; telas dependem dela. Estatísticas Pessoais **compõe** a partir de
`features/rankings` (não recria). Alterar Senha = ponto de maior risco (reauth Firebase). Avatar =
base64 no Firestore (TASK-10, decisão D-A2).

- Tasks com `/screen`: 6 (TASK-04, 05, 06, 07, 08, 09)
- Tasks com TDD recomendado: 4 (TASK-01 password schema, TASK-02 history derivation, TASK-03 service, TASK-10 avatar/profile)
- Domínios de design: product (account/profile), ux (hub, listas, form), style/color/typography (MASTER.md)

## 2. Recommended execution phases

1. **Fundação** — schema senha + service/profile + sub-rota layout (TASK-01, 02, 03)
2. **Hub + Logout** — Meu Perfil + Encerrar Sessão (TASK-04, 09)
3. **Sub-telas leitura** — Estatísticas + Histórico (TASK-05, 06)
4. **Sub-telas ação** — Alterar Senha + Configurações (TASK-07, 08)

## 3. Tasks

### TASK-01 – Schema Zod de alteração de senha + helper de regras
- Type: domain / validation
- Goal: Validar senha atual/nova/confirmação com regras do PRD06-04 (mín. 6, maiúsc+minúsc, número+especial).
- Scope: `schemas/changePassword.ts` — `{currentPassword, newPassword, confirmPassword}` com refine
  (newPassword passa nas regras; confirm === new; new !== current). Helper `passwordRules` reutilizável.
- Files: `src/schemas/changePassword.ts`, `src/schemas/index.ts`
- Dependencies: nenhuma
- Story points: 2 · Criticality: high · Risk: low
- TDD: yes (cada regra; mismatch; nova==atual)
- Screen: no – n/a

### TASK-02 – Lib de derivação do histórico de palpites
- Type: domain
- Goal: Derivar status de cada palpite (acerto/erro + pontos) conforme regra **binária** (A1: placar exato=+1, senão 0).
- Scope: `features/profile/lib/predictionHistory.ts` — combina `prediction` + `match` (resultado oficial);
  retorna `{matchId, date, stage, home, away, predictedScore, officialScore, isExact, points, resultLabel}`.
  `resultLabel`: "Acertou Resultado" (exato) / "Errou Resultado". **Não** usar "Acerto Vencedor"
  (A1 — flag p/ confirmação). Filtros Todos/Acertos/Erros derivam daqui.
- Files: `src/features/profile/lib/predictionHistory.ts`
- Dependencies: nenhuma (tipos de `schemas/predictions`,`matches`)
- Story points: 3 · Criticality: high · Risk: medium
- TDD: yes (exato→+1; não-exato→0; sem resultado oficial→pendente; filtros)
- Screen: no – n/a

### TASK-03 – Service: profile read + change password (reauth)
- Type: persistence / application
- Goal: Expor leitura de perfil enriquecido e troca de senha com reautenticação.
- Scope: estender `services/users.ts` (`getUserProfile(uid)` já via schema; garantir `createdAt`,`avatarUrl`).
  `services/auth.ts`: `changePassword(currentPassword, newPassword)` =
  `reauthenticateWithCredential` + `updatePassword`. Mapear erros (wrong-password, requires-recent-login).
- Files: `src/services/auth.ts`, `src/services/users.ts`
- Dependencies: nenhuma
- Story points: 3 · Criticality: high · Risk: medium
- TDD: yes (reauth chamado antes de updatePassword; erro de senha atual propaga)
- Screen: no – n/a

### TASK-04 – Hub "Meu Perfil" + sub-rota layout (PRD06-01)
- Type: ui
- Goal: Renderizar hub com identidade + navegação para sub-telas; estrutura de sub-rotas.
- Scope: `(app)/profile/page.tsx` (substitui placeholder). Card: avatar (iniciais/avatarUrl;
  botão câmera **funcional** → upload base64 via TASK-10), Nome, @apelido, "Participante desde {createdAt}" (date-fns), badge
  "Participante Ativo" (status). Engrenagem → Configurações. Lista navegável: Estatísticas, Histórico,
  Alterar Senha, Configurações. Botão "Encerrar Sessão" (→ TASK-09). Layout/sub-nav com header voltar.
- Files: `src/app/(app)/profile/page.tsx`, `src/features/profile/components/ProfileHub.tsx`,
  `src/features/profile/hooks/useProfile.ts`, `src/features/profile/components/ProfileMenuItem.tsx`
- Dependencies: TASK-03
- Story points: 5 · Criticality: high · Risk: low
- TDD: no · Screen: **yes** – nova página/hub, fonte `PRD06-01`
- Design: product, ux, style · complexity: medium · a11y: enhanced

### TASK-05 – Estatísticas Pessoais (PRD06-02) — composição de rankings
- Type: ui / application
- Goal: Tela de estatísticas reusando libs/hooks de `features/rankings`.
- Scope: `(app)/profile/estatisticas/page.tsx`. Compor: card "Posição Geral #N de M"
  (`useMyRanking`), grid Pontos/Acertos/Erros/Aproveitamento(+X de Y)/Acertos Exatos/Acerto Vencedor
  (A1: "Acerto Vencedor" = 0 fixo ou oculto — flag), barras "Desempenho por Fase" (`DistributionBars`
  + `lib/distribution`). Reusar `lib/accuracy`. Estados loading/empty/error.
- Files: `src/app/(app)/profile/estatisticas/page.tsx`, `src/features/profile/components/PersonalStats.tsx`
- Dependencies: TASK-04 (sub-nav), reuso `features/rankings`
- Story points: 5 · Criticality: medium · Risk: medium
- TDD: no (lógica vem de rankings já testado) · Screen: **yes** – fonte `PRD06-02`
- Design: product, ux, charts · complexity: medium · a11y: enhanced
- Notes: **Não duplicar** lógica de rankings; importar. Confirmar "Acerto Vencedor" (A1).

### TASK-06 – Histórico de Palpites (PRD06-03)
- Type: ui / application
- Goal: Lista de palpites com tabs Todos/Acertos/Erros e cards por jogo.
- Scope: `(app)/profile/historico/page.tsx`. Hook `usePredictionHistory(uid)` (predictions+matches via
  React Query). Cards: data + fase, times + placar previsto, badge pontuação (+N/0), label resultado
  (TASK-02). Tabs filtram. Ícone filtro. Estados loading/empty/error.
- Files: `src/app/(app)/profile/historico/page.tsx`,
  `src/features/profile/components/PredictionHistory.tsx`,
  `src/features/profile/hooks/usePredictionHistory.ts`
- Dependencies: TASK-02, TASK-04
- Story points: 5 · Criticality: medium · Risk: medium
- TDD: no (derivação coberta em TASK-02) · Screen: **yes** – fonte `PRD06-03`
- Design: product, ux, style · complexity: medium · a11y: enhanced

### TASK-07 – Alterar Senha (PRD06-04)
- Type: ui / application
- Goal: Form de troca de senha com reauth e feedback.
- Scope: `(app)/profile/senha/page.tsx`. RHF + `changePassword` schema (TASK-01). 3 campos com toggle
  olho (reusar `PasswordInput`). Caixa de regras (checklist visual). Botão "Salvar Nova Senha" →
  `changePassword` (TASK-03). Toast Sonner sucesso/erro; mapear wrong-password/requires-recent-login.
- Files: `src/app/(app)/profile/senha/page.tsx`, `src/features/profile/components/ChangePasswordForm.tsx`
- Dependencies: TASK-01, TASK-03
- Story points: 3 · Criticality: high · Risk: medium
- TDD: no (schema/service já com TDD) · Screen: **yes** – fonte `PRD06-04`
- Design: ux, forms, style · complexity: low · a11y: critical (labels, erros aria-live)

### TASK-08 – Configurações (PRD06-05)
- Type: ui
- Goal: Tela-menu de configurações com itens navegáveis.
- Scope: `(app)/profile/configuracoes/page.tsx`. Seções: Geral (Editar Perfil — editar apelido, A3),
  Notificações (Gerenciar Notificações → placeholder/link PRD-08), Tema (Tema "Claro" disabled — A4),
  Sobre (Sobre o Bolão v1.0.0 — estático A5), Ajuda (Central de Ajuda — estático A5). Itens como
  lista navegável reutilizável.
- Files: `src/app/(app)/profile/configuracoes/page.tsx`,
  `src/features/profile/components/SettingsMenu.tsx`
- Dependencies: TASK-04
- Story points: 3 · Criticality: low · Risk: low
- TDD: no · Screen: **yes** – fonte `PRD06-05`
- Design: ux, product · complexity: low · a11y: standard
- Notes: "Gerenciar Notificações" liga ao PRD-08 (link pode ficar inativo até PRD-08).

### TASK-10 – Avatar (base64 Firestore) + editar perfil [NOVA — decisão D-A2]
- Type: application / persistence / security
- Goal: Permitir trocar avatar (upload→base64) e editar apelido, gravando no próprio doc `users`.
- Scope:
  - `features/profile/lib/imageToDataUrl.ts`: ler `File` → `<canvas>` redimensiona (máx ~256px) →
    `toDataURL("image/jpeg", q)` ajustando qualidade até `< ~700KB` (margem do limite 1MB do doc).
    Validar MIME (image/*) e tamanho de entrada.
  - `services/users.ts`: `updateProfile(uid, {nickname?, avatarUrl?})` (`updateDoc` só desses campos
    + `updatedAt`).
  - **Firestore Rules:** usuário pode `update` o **próprio** doc alterando SOMENTE `nickname`,
    `avatarUrl`, `updatedAt` — **nunca** `role`/`status`/`email`/`uid`. Teste de rules.
- Files: `src/features/profile/lib/imageToDataUrl.ts`, `src/services/users.ts`, `firestore.rules`,
  `test/rules/firestore.rules.test.ts`
- Dependencies: nenhuma (consumido por TASK-04 e TASK-08)
- Story points: 5 · Criticality: high · Risk: medium
- TDD: yes (compressão respeita teto de bytes; updateProfile só toca campos permitidos; rules negam role/status)
- Screen: no – n/a
- Notes: Limite 1MB do doc Firestore é o risco — comprimir agressivo + barrar imagem grande com erro claro.
  Botão câmera do PRD06-01 (TASK-04) e "Editar Perfil" do PRD06-05 (TASK-08) consomem esta camada.

### TASK-09 – Encerrar Sessão / Logout (PRD06-06)
- Type: ui / application
- Goal: Confirmação de logout que limpa sessão + cache.
- Scope: Dialog/tela confirmação (ícone logout, "Deseja realmente encerrar sua sessão?", botão
  vermelho "Sim, encerrar sessão" + "Cancelar"). Ação: `signOut` (auth) + `queryClient.clear()` +
  limpar localStorage (preferências/filtros) + redirect `/login`. Reutilizável (também usado em
  Configurações se preciso).
- Files: `src/features/profile/components/LogoutConfirm.tsx`,
  `(app)/profile/page.tsx` (trigger) ou `(app)/profile/logout/page.tsx`
- Dependencies: TASK-04
- Story points: 2 · Criticality: medium · Risk: low
- TDD: no · Screen: **yes** – fonte `PRD06-06`
- Design: ux, style · complexity: low · a11y: critical (dialog foco/esc, ação destrutiva)

## 4. Dependency map

```
TASK-01 (pwd schema) ─┐
TASK-03 (service) ────┼─> TASK-07 (alterar senha)
TASK-02 (history lib) ─> TASK-06 (histórico)
TASK-03 ─> TASK-04 (hub) ─┬─> TASK-05 (estatísticas)
                          ├─> TASK-06
                          ├─> TASK-08 (config)
                          └─> TASK-09 (logout)
```

## 5. Execution waves

- **Wave 1** (fundação): TASK-01, TASK-02, TASK-03
- **Wave 2**: TASK-04 (←03)
- **Wave 3**: TASK-05, TASK-06, TASK-07, TASK-08, TASK-09 (←04; 06←02; 07←01,03)

## 6. Sequential fallback

TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-09 → TASK-05 → TASK-06 → TASK-07 → TASK-08

Início recomendado: **TASK-01** (schema isolado, destrava Alterar Senha).

## 7. Planning risks

- **B1 — Regra de pontuação (A1):** "Acerto Vencedor"/"+3 pts" no PNG conflita com binário. Plano usa
  binário; **confirmar com usuário** antes de finalizar telas 05/06. (Pendência no relatório.)
- **B2 — RESOLVIDO (A2):** avatar = base64 no Firestore (TASK-10). Risco residual = limite 1MB/doc →
  compressão agressiva + barrar imagem grande. Câmera funcional.
- **B3 — RESOLVIDO (A3):** Editar Perfil = apelido + avatar (TASK-10). Nome/email read-only V1.
- **R1 — Reauth Firebase:** `requires-recent-login` pode exigir re-login; mapear erro com mensagem clara.
- **R2 — Reuso rankings:** garantir import (não duplicar) — validar no /review.
