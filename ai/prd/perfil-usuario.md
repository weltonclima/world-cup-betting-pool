# PRD — Perfil do Usuário (PRD-06)

> Fonte: `docs/prd-06/PRD-06-Perfil-Usuario.md` + PNGs `PRD06-01..06` (fonte de verdade visual).
> Feature slug: `perfil-usuario`.

## 1. Feature summary

Área de Perfil acessível pela aba "Perfil" do BottomNav. Hub com dados pessoais do usuário e
navegação para sub-telas: Estatísticas Pessoais, Histórico de Palpites, Alterar Senha,
Configurações e Encerrar Sessão (logout). Permite visualizar identidade/status da conta,
consultar desempenho, revisar palpites passados, trocar senha e sair.

## 2. Consolidated scope

Seis telas (fonte de verdade = PNGs):

1. **Meu Perfil** (`PRD06-01`) — hub. Avatar + botão câmera, Nome, @apelido, "Participante desde {data}",
   badge "Participante Ativo" (status), ícone engrenagem (→ Configurações). Lista de navegação:
   Estatísticas Pessoais, Histórico de Palpites, Alterar Senha, Configurações. Botão vermelho
   "Encerrar Sessão" (→ tela Logout).
2. **Estatísticas Pessoais** (`PRD06-02`) — card "Posição Geral #N de M participantes"; grid de
   métricas: Pontos, Acertos, Erros, Aproveitamento (% + "X de Y jogos"), Acertos Exatos,
   Acerto Vencedor; gráfico de barras "Desempenho por Fase" (Grupos/Oitavas/Quartas/Semi/Final).
3. **Histórico de Palpites** (`PRD06-03`) — tabs Todos/Acertos/Erros; ícone filtro; lista de cards
   por jogo: data + fase, times + placar previsto, badge pontuação (+N pts / 0 pt), label de
   resultado (Acertou Resultado / Acertou Vencedor / Errou Resultado).
4. **Alterar Senha** (`PRD06-04`) — ícone escudo; form: Senha Atual, Nova Senha, Confirmar Nova Senha
   (todos com toggle olho); caixa de regras (mín. 6 chars, maiúsc+minúsc, números+especiais);
   botão "Salvar Nova Senha".
5. **Configurações** (`PRD06-05`) — seções: Geral (Editar Perfil), Notificações (Gerenciar
   Notificações → PRD-08), Tema (Tema do Aplicativo "Claro" — futuro), Sobre (Sobre o Bolão v1.0.0),
   Ajuda e Suporte (Central de Ajuda).
6. **Encerrar Sessão** (`PRD06-06`) — confirmação: ícone logout, "Deseja realmente encerrar sua
   sessão?", botão vermelho "Sim, encerrar sessão" + botão "Cancelar". Ao confirmar: signOut +
   limpar cache local + redirect login.

Critérios de aceite (PRD): visualizar dados, alterar senha, consultar estatísticas, consultar
histórico, logout, funcionar mobile+desktop.

## 3. System understanding (relevant parts only)

Infra existente reutilizável:
- `src/services/users.ts` + `src/schemas/users.ts` — perfil (uid, name, nickname, email, role, status).
  PRD-06 adiciona `avatarUrl` (já no schema?) e `createdAt` ("Participante desde").
- `src/services/statistics.ts` + `src/schemas/statistics.ts` — métricas por usuário.
- `src/features/rankings/` — **forte sobreposição** com Estatísticas Pessoais:
  - `components/MyRanking.tsx`, `PoolStatsScreen.tsx`, `Evolution.tsx`
  - `lib/accuracy.ts`, `lib/distribution.ts`, `lib/evolution.ts`
  - `hooks/useMyRanking.ts`, `usePoolStats.ts`, `useParticipantProfile.ts`
  - rota existente `(app)/rankings/estatisticas`, `(app)/rankings/eu`, `(app)/rankings/perfil/[uid]`
  - charts: `DistributionBars`, `EvolutionLineChart` (Recharts via `ui/chart.tsx`).
- `src/services/predictions.ts` — base p/ Histórico de Palpites.
- `src/services/auth.ts` — signOut, reauth, updatePassword (Firebase).
- `src/components/auth/PasswordInput.tsx` — input com toggle olho + regras (reuso direto Alterar Senha).
- `src/components/layout/`: Header, BottomNav, AppShell, AuthGuard. UI base: avatar, badge, dialog,
  tabs, button, input, form, sheet.
- Rota atual `(app)/profile/page.tsx` = placeholder a substituir.

## 4. Technical impact analysis

- **Módulos:** preencher `src/features/profile/` (hoje só index+README). Telas vivem sob
  `(app)/profile/*` (sub-rotas: `/profile/estatisticas`, `/profile/historico`, `/profile/senha`,
  `/profile/configuracoes`). Logout pode ser dialog ou rota `/profile/logout`.
- **Persistência:** leitura `users`, `statistics`, `predictions`, `matches` (resultado oficial p/
  comparar no histórico). Escrita: `updatePassword` (Firebase Auth, não Firestore); avatar upload
  é **fora do escopo confirmado** (badge câmera presente no layout mas sem backend Spark/Storage —
  ver Ambiguidades).
- **Navegação:** aba Perfil já existe no BottomNav. Adicionar sub-navegação interna (voltar/chevron).
- **Auth:** Alterar Senha exige reautenticação Firebase (`reauthenticateWithCredential`) antes de
  `updatePassword` — senha atual obrigatória.
- **Cache:** React Query keys novas (`["profile", uid]`, `["prediction-history", uid]`); reusar
  keys de statistics/ranking onde possível. Logout limpa `queryClient.clear()` + localStorage.
- **Reuso vs duplicação:** Estatísticas Pessoais deve reusar libs/hooks de rankings em vez de
  recriar. Layout PRD06-02 ≈ combinação de MyRanking (posição) + PoolStats (grid) + distribution
  por fase. Decisão de plan: compor a partir do existente.

## 5. Risks

- **Conflito de pontuação:** PRD-06 lista "Acertos de Vencedor" / "Acerto Vencedor" e histórico
  mostra label "Acertou Vencedor / +1 pt", mas `CLAUDE.md` define pontuação **binária** (placar
  exato +1, qualquer outro 0; sem acerto de vencedor/parcial). Layout PRD06-03 mostra "+3 pts",
  "+1 pt" — inconsistente com regra oficial. **Risco alto de regra de negócio.** → ver Ambiguidades.
- **Avatar upload:** Firebase Spark sem Storage pago; mecanismo de upload indefinido.
- **Reautenticação:** fluxo de erro (senha atual incorreta, sessão expirada) precisa de mensagens claras.
- **Duplicação de stats:** risco de recriar lógica já em `features/rankings` — exige reuso explícito no plan.

## 6. Ambiguities and gaps

| # | Ambiguidade | Resolução adotada (modo automático) |
|---|---|---|
| A1 | Pontuação: binária (CLAUDE.md) vs "+3/+1 pts" e "Acerto Vencedor" (PRD/PNG) | ✅ **RESOLVIDO: BINÁRIO.** Placar exato=+1, senão 0. Telas **ocultam** "Acerto Vencedor". Mocks divergentes desconsiderados. |
| A2 | Upload de avatar (badge câmera no PRD06-01) | ✅ **RESOLVIDO: upload via base64 no Firestore** (`users.avatarUrl` = data URL comprimido via canvas; sem Storage). Botão câmera funcional. Rules: usuário atualiza próprio `avatarUrl`. Validar tamanho < ~700KB (doc 1MB). |
| A3 | "Editar Perfil" (Configurações) — quais campos editáveis | ✅ Editar **apelido (nickname) + avatar**. Nome/email read-only V1. |
| A4 | Tema claro/escuro | PRD marca "(futuro)". Item visível mas desabilitado/somente-leitura "Claro". |
| A5 | Central de Ajuda / Sobre o Bolão | Telas estáticas simples (conteúdo placeholder), sem backend. |
| A6 | "Encerrar sessões ativas" (PRD seção Segurança) | Firebase web não suporta listar sessões no Spark sem custo. Fora do escopo V1; logout local apenas. |

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first; PNGs são mobile)
- **Screens:** Meu Perfil, Estatísticas Pessoais, Histórico de Palpites, Alterar Senha,
  Configurações, Encerrar Sessão (6 telas, todas com layout-fonte-de-verdade)
- **Product type:** mobile-first web app — área de perfil/conta (account & profile dashboard)
- **Recommended style direction:** consistente com design system existente (verde Copa, cards
  brancos, badges status, BottomNav). Reusar `design-system/MASTER.md` se existir.
- **Design complexity:** medium (6 telas, mas alto reuso de componentes/charts existentes)

## 8. Implementation concerns (high-level, no tasks yet)

- Estabelecer `src/features/profile/` com hooks/components/lib; compor stats a partir de `rankings`.
- Sub-rotas sob `(app)/profile/`; sub-navegação com header "voltar".
- Alterar Senha: reuso `PasswordInput`, schema Zod (atual/nova/confirma + regras), RHF, reauth Firebase.
- Histórico: hook sobre `predictions` + `matches`; derivação de acerto conforme regra binária (A1);
  tabs Todos/Acertos/Erros; estados loading/empty/error.
- Logout: dialog de confirmação reutilizável; `queryClient.clear()` + limpar localStorage + redirect.
- Configurações: tela-menu com itens navegáveis; "Gerenciar Notificações" liga ao PRD-08 (placeholder
  até PRD-08 implementado).
- Acessibilidade/touch targets, estados de loading (skeleton), responsividade mobile→desktop.
