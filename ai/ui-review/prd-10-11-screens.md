# UI REVIEW — PRD-10 / PRD-11 (13 telas novas)

**Data:** 2026-06-11 · **Branch:** `prd-09` · **Stack:** Next.js 15 App Router · React 19 · Tailwind v4 · shadcn/base-ui
**Fonte de verdade:** PNGs em `docs/prd-10/*`, `docs/prd-11/*` (sem ui-spec artifact — telas construídas direto das PNGs na execução noturna)
**Método:** 4 subagentes paralelos, cada tela PNG↔componente.

## 1. Veredito base
⚠ **Approved with adjustments** — nenhum blocker de merge; fidelidade estrutural boa; pendências concentradas em (a) error-surfacing de mutações, (b) tokens vs hex hardcoded, (c) divergências de cópia/affordance vs PNG, (d) a11y de selects/validação.

## 2. Compliance por aspecto

| Aspecto | Status | Nota |
|---|---|---|
| Estrutura de layout | ✅ | Esqueleto bate com PNGs na maioria; divergências pontuais (foto config, KPI chrome, kebab) |
| Estados de interação | ⚠ | Loading só no botão aprovar (não rejeitar); erros de mutação silenciosos |
| Responsivo | ✅ | Sem scroll horizontal; touch targets 44px (`size-11`) — abaixo do alvo 48px |
| Acessibilidade | ⚠ | KebabMenu/dialogs excelentes; gaps em selects nativos (sem label visível), validação como hint, botão filtro falso |
| Edge cases | ⚠ | Empty/loading ok; **error de mutação não exibido** (pior na exclusão irreversível) |

## 3. Achados por severidade

### Critical (bloqueia merge)
- Nenhum.

### High (corrigir antes do merge)
1. **Falhas silenciosas de mutação** — `useUpdateGroupStatus` / `useDeleteGroup` / `useChangeGroupAdmin` (`src/features/superAdmin/hooks/useAdminGroups.ts:59-89`) sem `onError`; `ConfirmActionDialog` e `ChangeAdminDialog` só reagem a `onSuccess`. Aprovar/Rejeitar/Bloquear/Reativar/**Excluir**/Trocar-admin falham sem toast/`role="alert"`. Pior na exclusão irreversível (`GroupsBlocked.tsx:117`). *(confirma §10 do relatório de pendências)*
2. **Botão de filtro falso** — `GroupSearchInput.tsx:40-49` (funil) é focável, com `aria-label`, mas sem `onClick`/painel. Afeta as 3 listas group-admin. Wire ou `aria-disabled`/remover.
3. **Título errado em Aprovados** — `GroupApprovedUsers.tsx:71` mostra "Participantes"; PNG PRD10-03 diz **"Usuários Aprovados"**.
4. **Controle de foto refeito** — `GroupSettingsForm.tsx:138-176` substitui o shield + botão "Alterar foto" + helper "PNG, JPG até 2MB" da PNG por um círculo com badge de câmera centralizado. Maior miss de fidelidade.
5. **Botão "Sincronizar agora" morto no Dashboard Global** — `SuperAdminDashboard.tsx:110-119` hardcoded `disabled`+cinza; PNG PRD11-01 mostra botão verde ativo. Sync **já existe** (`POST /api/admin/worldcup/sync`, §4.5) — botão deveria ligar ou ser removido.
6. **Logs omitem o ator** — `GlobalLogs.tsx:128-130` não renderiza "Executado por: …" que a PNG PRD11-07 mostra na linha; detalhe (`:157-163`) exibe **UID cru** em vez de nome.
7. **Hex hardcoded em vez de tokens** — `logMeta.tsx` (`bg-emerald-100/text-emerald-700`, `sky`, `amber`) + badges de status (`GroupsActive.tsx:86`, `GroupsBlocked.tsx:82-84`). Risco de contraste em dark-mode.
8. **Validação do EditMatchDialog como hint, não erro** — `EditMatchDialog.tsx:157-161` usa `text-muted-foreground`; `aria-invalid` (`:136,:150`) sem texto de erro vinculado (`aria-describedby`). Screen reader não anuncia por que Save está desabilitado. Usar `text-destructive` + `aria-describedby`.

### Medium (corrigir em breve)
- **Kebab vs PNG-03/04** — `GroupsActive.tsx:97` / `GroupsBlocked.tsx:90` adicionam KebabMenu (Visualizar/Alterar Admin/Bloquear · Reativar/Excluir) que as PNGs não mostram (só o pill de status na borda). **Precisa ruling de produto:** PNG sub-especificada vs ação fora de escopo. *Mesma questão em Administradores (`AdminsList.tsx:90`).*
- **Contador de rodapé ignora busca** — `GroupPendingUsers.tsx:64` e `GroupBlockedUsers.tsx:66` usam `data.length` (total) em vez de `filtered.length`; Aprovados usa `filtered.length` → convenção inconsistente entre telas.
- **Loading só no botão aprovar** — `GroupPendingUsers.tsx:113-130` e `GroupsPending.tsx:90-106`: rejeitar fica `X` estático durante mutação. Espelhar spinner no botão ativo.
- **Settings: headers de seção ausentes + cópia do toggle errada** — `GroupSettingsForm.tsx:34-45` sem "Informações do grupo"/"Configurações"; toggle (`:250`) diz "Habilita a geração de links…" vs PNG "Permitir que membros convidem outros usuários para o grupo". Label `Nome *` vs PNG "Nome do Grupo *".
- **Convites: "Ver todos" ausente** — `GroupInvites.tsx:357-394` sem o link no header de "Convites ativos".
- **Link de convite não selecionável por teclado** — `GroupInvites.tsx:161-179` usa `<span>` truncado; só o botão copiar é focável. Usar `<Input readOnly>`.
- **Dashboard Global: KPI sem delta nem tile colorido** — `SuperAdminDashboard.tsx:58-72` omite os badges "+N" verdes e os tiles coloridos por métrica da PNG; ícones todos `text-primary`.
- **Selects nativos sem label visível (WCAG 3.3.2)** — `WorldCupMatches.tsx:269-281`, `EditMatchDialog.tsx:109-123`, `GlobalLogs.tsx:69-80` só com `aria-label`.
- **Placeholder de busca divergente** — `AdminsList.tsx:51` "Buscar por nome ou grupo" vs PNG "Buscar usuário ou grupo".
- **Filtro de logs: select full-width vs funil** — `GlobalLogs.tsx:69-80` diverge do funil compacto da PNG.
- **EditMatchDialog: erro de servidor não limpa ao editar** — `EditMatchDialog.tsx:163-167` persiste erro stale; resetar no `onChange`.
- **"Excluir do grupo" em Bloqueados não está na PNG** — `GroupBlockedUsers.tsx:138-149` adiciona KebabMenu "Excluir do grupo" (soft-delete D4). Confirmar adição aprovada.

### Low (nice to have)
- Cópia/casing: "Últimos Cadastros" vs "Últimos cadastros" (`GroupDashboard.tsx:103`); emoji 👋 ausente no greeting (`SuperAdminDashboard.tsx:27`); "Nível"/`level` não traduzido (`GlobalLogs.tsx:159`).
- `text-emerald-600` hardcoded em mensagens de sucesso (`GroupSettingsForm.tsx:270`, `GroupInvites.tsx:174`).
- Skeleton 3 linhas vs `PREVIEW_COUNT=4` → pop de layout (`RecentActivity.tsx:33`).
- Posição de ranking `aria-hidden` em Aprovados (`GroupApprovedUsers.tsx:158`) — AT perde o ranking.
- Cópia-clipboard falha silenciosa (`GroupInvites.tsx:128-136`).
- "Reativar" sem confirmação (`GroupsBlocked.tsx:96`) enquanto "Excluir" confirma.
- JSDoc com nº de PNG errado (`useAdminMatches.ts:22`, `useAdminLogs.ts`).
- Mensagem de log sem `truncate` (`GlobalLogs.tsx:127`).

## 4. Confirmações (não-problemas verificados)
- **"Seleção"/filtro de time NÃO existe na PNG nem no código** — `WorldCupMatches.tsx:183-202` tem Grupo/Fase/Status, idêntico à PNG PRD11-06. Item de §10 do relatório **resolvido como falso-positivo**.
- **Placar só para finished/live; scheduled mostra horário** — `WorldCupMatches.tsx:316,330-334`. Correto.
- **KebabMenu a11y exemplar** — roving tabindex, Arrow/Home/End/Esc/Tab, focus-return, `aria-haspopup`/`expanded`/`role=menu`. Melhor a11y do conjunto.
- **Dialogs base-ui** — focus trap, Esc, focus-return, scroll-lock nativos. Sólido.
- **Boundary server/client correto** — pages server finas → feature components `"use client"`; keys de lista estáveis.

## 5. Performance
- Sem virtualização nas listas — ok para escala atual (<50 itens típicos); reavaliar se grupos/usuários crescerem.
- `useModerateGroupUser`/`usePromoteGroupAdmin` instanciados por linha em Aprovados (`GroupApprovedUsers.tsx:126`) — aceitável com cache React Query.
- Sem `index` keys. Boundary correto.

## 6. Ajustes recomendados (ordem de impacto)
1. Adicionar `onError` consistente (toast + `role="alert"`) a todas mutações super/group-admin; exibir erro dentro de `ConfirmActionDialog`/`ChangeAdminDialog`. **(High #1 — também §10)**
2. Resolver botão de filtro falso (`GroupSearchInput`) e selects sem label visível. **(High #2 + a11y)**
3. Corrigir cópias vs PNG: título "Usuários Aprovados", toggle de convites, placeholder Administradores, headers de seção em Settings, "Ver todos" em Convites.
4. Tokenizar cores: criar variantes `success`/`info`/`warning` no badge + `logMeta`; eliminar emerald/sky/amber hardcoded.
5. Ligar ou remover "Sincronizar agora" do Dashboard Global (sync já existe).
6. Logs: renderizar "Executado por" na linha + resolver UID→nome no detalhe.
7. EditMatchDialog: validação como `text-destructive` + `aria-describedby`.
8. **Ruling de produto:** kebab em Grupos Ativos/Bloqueados/Administradores (manter ação rica vs PNG estática).
9. Contador de rodapé → `filtered.length` uniforme; spinner no botão ativo (aprovar/rejeitar).

## 7. Nota de escopo
Review estático código↔PNG. Estados runtime (hover/focus visíveis, contraste real, navegação teclado ponta-a-ponta) não validados em browser — recomendado smoke a11y no `/local-env`.
