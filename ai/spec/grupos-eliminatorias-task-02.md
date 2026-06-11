# SPEC

## 1. Task id and title
- Task: TASK-02
- Title: Domínio — cálculo de classificação dos grupos

## 2. Objective
Função pura `computeGroupStandings(matches, teams)` que produz `GroupTable[]` (contrato TASK-01) a partir dos jogos de grupo e das seleções, com critério de desempate FIFA (1–4 + fallback) e status de qualificação travado no PRD.

## 3. In scope
- `src/server/worldcup/standings.ts` — módulo novo, lógica pura (sem I/O, sem `server-only` import de dados; pode marcar `import "server-only"` seguindo convenção de `src/server/*`).
  - `computeGroupStandings(matches: MatchWithId[], teams: TeamWithId[]): GroupTable[]`
- `src/server/worldcup/__tests__/standings.test.ts` — suíte TDD exaustiva.

## 4. Out of scope
- Rotas API, fetch de dados, cache, flag `hasLiveGroupMatch` (TASK-04).
- Bracket (TASK-03). UI. Alterações em schemas/contratos (TASK-01 fechada).

## 5. Main technical areas involved
- Novo `src/server/worldcup/`. Consome `MatchWithId` (`@/types/matches`), `TeamWithId` (`@/types/teams`), produz `GroupTable`/`GroupStanding` (`@/types/worldcup`).
- Fatos do mapper (verificados): jogos de grupo têm `stage === "grupos"`, `groupId ∈ "A".."L"`, `homeTeamId`/`awayTeamId` = id do registry (code FIFA); `status` openfootball só assume `"scheduled" | "finished"` (sem live); placares não-null somente quando `finished`.

## 6. Business rules and behavior
1. **Inclusão:** somente matches `stage === "grupos"` com `groupId` não-null. Grupos vêm dos `teams` (campo `groupId`); todo time com `groupId` aparece na tabela do seu grupo mesmo com 0 jogos (linha zerada).
2. **Estatísticas:** somente jogos `status === "finished"` contam para J/V/E/D/GP/GC/SG/PTS. Vitória 3 pts, empate 1, derrota 0. SG = GP − GC.
3. **Ordenação (desempate):**
   - Critérios gerais: (a) pontos desc, (b) SG desc, (c) GP desc — sobre todos os jogos do grupo.
   - Empate persistente entre subconjunto: **confronto direto** — mini-tabela só com os jogos finalizados entre os empatados, reordenando por (a′) pontos, (b′) SG, (c′) GP da mini-tabela.
   - Se a mini-tabela separa parcialmente: **recursão** sobre cada sub-subconjunto ainda empatado (nova mini-tabela restrita a ele). Se a mini-tabela não separa ninguém (sub-conjunto idêntico), parar recursão.
   - Fallback terminal (fair play/sorteio não computáveis — documentar em comentário): ordem alfabética por `name` (pt-BR, `localeCompare`), determinística.
4. **Position:** 1..N sequencial pós-ordenação (sem posição compartilhada).
5. **Qualification (decisão travada PRD §6.3):**
   - Grupo **incompleto** (existe match do grupo com `status !== "finished"` OU menos de 6 matches do grupo presentes nos dados) → todas as posições `"indefinido"`.
   - Grupo **completo** → 1º/2º `"classificado"`, 3º `"possivel"`, 4º `"eliminado"`; posições >4 (defensivo) `"eliminado"`.
6. **Saída:** grupos ordenados por `groupId` asc; `standings` por `position` asc. Times: `{ id, name, code, flagUrl? }` copiados de `TeamWithId`.
7. **Robustez:** match de grupo referenciando teamId ausente em `teams` → ignorar o match (defensivo, não lançar); placares null em jogo finished não ocorrem por contrato (`matchSchema` refine) — não tratar.

## 7. Contracts and interfaces
- Entrada: `MatchWithId[]`, `TeamWithId[]` (contratos existentes).
- Saída: `GroupTable[]` validável por `groupTableSchema` (TASK-01).
- Função exportada nomeada; helpers internos não exportados (exceto se úteis a teste — preferir testar pela API pública).

## 8. Data and persistence impact
Nenhum.

## 9. Required tests
TDD — escrever antes da implementação; testar pela API pública:
1. Grupo zerado (0 finished): 4 linhas zeradas, ordem alfabética, todas `"indefinido"`.
2. Grupo parcial (alguns finished): stats corretas, `"indefinido"` em todas.
3. Grupo completo sem empates: ordenação por pontos, badges 1º/2º classificado, 3º possivel, 4º eliminado.
4. Desempate por SG; desempate por GP.
5. Empate duplo resolvido por confronto direto (par com pontos/SG/GP gerais iguais, vencedor do confronto na frente).
6. Empate triplo: mini-tabela separa totalmente.
7. Empate triplo com separação parcial → recursão (mini-tabela separa 1, sub-par re-resolvido por novo confronto direto).
8. Empate total (mini-tabela não separa) → fallback alfabético.
9. Vitória=3/empate=1 nos pontos; SG negativo correto.
10. Multi-grupos: 12 grupos ordenados A–L; times sem groupId ignorados; match com teamId desconhecido ignorado sem lançar.
11. Saída valida contra `groupTableSchema` (parse passa).

## 10. Acceptance criteria
- Suíte TDD escrita primeiro, falhando antes da implementação (red), verde depois (green).
- `npm test` integral verde; `npx tsc --noEmit` limpo; eslint limpo.
- Função pura: sem fetch, sem Date.now, sem efeitos.
- Comentário documentando exclusão de fair play/sorteio e o fallback alfabético.

## 11. Constraints
- TypeScript strict, zero `any`, alias `@/*`, comentários pt-BR.
- Sem dependência nova.
- Não alterar arquivos das TASK-01/03+.

## 12. Execution cost profile
- tdd: opus/high
- implement: opus/high
- test: sonnet/high
- review: opus/high

## 13. Frontend indicator
- is_frontend: false
- reason: domínio puro server-side.

## 14. Open questions
Nenhuma — regra de desempate e qualification travadas (PRD §6.3/§6.4, plan-checker fold).
