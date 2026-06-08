# SCREEN SPEC — Ranking Geral (Tela 01)
## Task: TASK-08
## Platform: web (mobile-first)

## Visual Analysis (from image)
- Source: `docs/prd-05/PRD05-01-Ranking-Geral.png` (visto diretamente).
- Layout: header da seção + segmented tabs (Geral/Por Fase/Por Grupo) = `RankingSubNav` (TASK-07); **pódio top-3** (2º à esquerda, 1º central elevado com **coroa**, 3º à direita — avatares circulares + nome + "N pts"); **lista** de classificação iniciando em **#4** com colunas `# | PARTICIPANTE (avatar+nome+apelido) | PTS | ACERTOS | APROV.`; linha do usuário logado **destacada (faixa verde clara)** com badge "Você".
- Style signals: verde primário (pódio do 1º, destaque), branco/cinza claro, números em negrito, avatares circulares, badges arredondados.
- States visible: apenas populado (loading/empty/error derivados do padrão do app).
- Assumptions: top-3 só no pódio (lista começa em #4); colunas Pts e Acertos eram do modelo 3/1/0 (ver Design Gaps — sob binário são iguais).

## 1. User and Business Goals
Participante vê a classificação geral, identifica rapidamente sua posição (destaque "Você") e os líderes (pódio), e navega ao perfil de qualquer participante. Suporta o objetivo central do bolão: acompanhar a competição.

## 2. Design System Reference
- Master: `design-system/MASTER.md` (§2.4-ranking — escopo verde `.ranking-theme`; §10 acessibilidade).
- Tokens: `bg-primary`/`text-primary-foreground` (pódio 1º, badge "Você"), `bg-primary/10` (faixa do destaque), `text-foreground`/`text-muted-foreground`, `bg-card`, `border-border`. Sem hex/inline.

## 3. User Flow
- Entrada: Bottom Tab Bar → Ranking → `/rankings` (aba Geral ativa na sub-nav).
- Happy path: vê pódio → rola lista → encontra sua linha destacada → (opcional) toca numa linha → `/rankings/perfil/[uid]`; pagina com Anterior/Próxima se >20.
- Saída: trocar aba (sub-nav) ou Bottom Tab.
- Edge: carregando → skeleton; sem participantes → empty; falha → error+retry.

## 4. Information Architecture
1. (Sub-nav — já no layout TASK-07.)
2. **Pódio top-3** (destaque visual primário).
3. **Lista** de classificação (#4+), com a linha "Você" realçada onde estiver.
4. **Paginação** (rodapé da lista) quando >20.
Estados substituem 2–4 conforme a query.

## 5. Layout and Components

### RankingPodium
- 3 colunas: ordem visual `2º | 1º | 3º`; 1º com `Crown` (Lucide, `aria-hidden`) acima do avatar e card elevado (`bg-primary text-primary-foreground rounded-2xl`), 2º/3º `bg-card border`.
- Cada: `Avatar` (Shadcn, fallback iniciais do nome), nome (`text-sm font-medium`, truncate), "N pts" (`text-lg font-bold tabular-nums`).
- Avatares ≥56px; toque no card → perfil do uid. Mobile: 3 colunas lado a lado (compactas); ≥768px maiores.

### RankingList
- `<ol>` semântica (continua a numeração a partir de #4 com `start={4}` ou exibe `position` explícito). Cada item = `<li>` com:
  - `#position` (`tabular-nums w-8 text-muted-foreground`),
  - `Avatar` (40px) + coluna nome (`font-medium`) / apelido (`text-xs text-muted-foreground`),
  - `Pts` (`font-bold tabular-nums`),
  - `Aprov.` (`text-sm tabular-nums`; `accuracy`% ou "—" se ausente).
- Item é `next/link` → `/rankings/perfil/{uid}`; `min-h-11`; hover/active `bg-accent`.
- **Destaque "Você"** (`entry.uid === firebaseUser?.uid`): `bg-primary/10` + `Badge` "Você" (`bg-primary text-primary-foreground`) ao lado do nome. Contraste AA. Cor não é único indicador (badge textual).
- Cabeçalho de colunas opcional (`text-xs uppercase text-muted-foreground`): "Participante / Pts / Aprov.".

### Pagination
- 20/página. Controles `Button` (variant outline) "Anterior"/"Próxima" + "Página X de Y" (`text-sm`). Alvos ≥44px. Oculto se ≤20 participantes (pódio+lista cabem). Página inicial = 1.

### Estados (TASK-07)
- `RankingSkeleton` (loading), `RankingEmptyState` "Nenhum participante encontrado" (empty), `RankingErrorState` + "Tentar Novamente" (error, `onRetry=refetch`).

## 6. Typography and Color Tokens
- Pts destaque `text-lg/text-xl font-bold tabular-nums`. Nomes `text-sm font-medium`. Apelido/metadados `text-xs text-muted-foreground`. Header de seção já no layout.
- Cores: `--primary` (verde escopo), `--primary-foreground`, `--foreground`, `--muted-foreground`, `--card`, `--accent`, `--border`. Sem hex.

## 7. UI States
| Estado | Tratamento |
|---|---|
| Loading | `RankingSkeleton` (>300ms) |
| Empty | `RankingEmptyState` ("Nenhum participante encontrado") |
| Error | `RankingErrorState` + "Tentar Novamente" |
| Populated | Pódio + lista + (paginação) |
| Destaque "Você" | faixa `bg-primary/10` + badge |
| Disabled | botões de paginação desabilitados nos limites |

## 8. Accessibility Requirements (Priority 1)
- Lista semântica `<ol>`/`<li>`; pódio com ordem de leitura lógica (1º→2º→3º no DOM mesmo que visual 2-1-3, via order CSS — garantir DOM = ranking).
- Contraste: badge/pódio verde + branco ≥AA (validado); faixa `bg-primary/10` mantém texto `text-foreground` ≥AA.
- Avatares: `alt`/fallback textual (iniciais); coroa `aria-hidden`.
- `tabular-nums` p/ alinhamento de números. Foco visível nas linhas-link; ordem de tab = visual. Cor não é único indicador (badge "Você"). Suporta text scaling. Paginação com `aria-label`.

## 9. Animation and Motion (Priority 7)
- Hover/press de linha `transition-colors duration-150`. Skeleton `animate-pulse` (reduced-motion off). Sem animar layout.

## 10. Navigation Patterns (Priority 9)
- Linha → perfil (deep-link real). Sub-nav (TASK-07) destaca "Geral". Back previsível. Bottom Tab intacto.

## 11. Pre-Delivery Checklist Status
- Ícones Lucide (Crown) sem emoji ✓ · tokens semânticos ✓ · alvos ≥44px ✓ · estados definidos ✓ · reduced-motion ✓ · foco/aria ✓ · mobile-first ✓ · números tabular-nums ✓.

## 12. Design Gaps and Assumptions
- **G1 (resolvido):** Pódio top-3 separado; **lista começa em #4** (não repete top-3).
- **G2 (decisão binário):** O screenshot mostra colunas **Pts E Acertos** (modelo 3/1/0). Sob **pontuação binária** `points===acertos exatos` → exibir só **Pts** + **Aprov.** na lista (omitir "Acertos" duplicado). Divergência consciente do mock, fiel à regra do sistema. Em telas de detalhe (Meu Ranking/Perfil), "Erros" aparece.
- **G3 (resolvido):** Paginação 20/página, inicia na página 1.
- **G4:** Avatar — não há campo de foto no schema (`RankingEntry` não tem avatarUrl). Usar `Avatar` Shadcn com **fallback de iniciais** do nome. Sem imagem real (sem PII). Documentado.
