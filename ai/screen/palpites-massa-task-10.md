# SCREEN SPEC – Classificação Prevista do Grupo
## Task: TASK-10 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-10.md` · Design contract: `design-system/MASTER.md` + `ai/screen/palpites-massa-task-06.md`
> Ferramenta: scripts Python do `ui-ux-pro-max` não rodam neste ambiente (sem Python). Direção de design derivada de `design-system/MASTER.md` + primitivas TASK-06 + wireframe PNG.

## Visual Analysis (from image)
- Source: `docs/prd-03-1/PRD03-04-Classificacao-Prevista.png`
- Layout: header verde "Grupo C" (com voltar); título de seção "Classificação Prevista"; tabela com colunas **Pos | Seleção | Pts | SG | GP**; cada linha tem um chip de posição colorido (verde para 1–2, vermelho para 3–4), bandeira + nome; abaixo, seção "Classificados" listando os 2 primeiros com ícone de check verde e rótulo de posição ("Brasil (1º)", "França (2º)"); CTA verde cheio "Confirmar Grupo"; link secundário "Editar Resultados".
- Components: tabela de classificação; chip de posição; lista de classificados com check; Button primário verde; link/botão secundário.
- Style signals: shell verde; superfície branca/neutra; números à direita (tabular); chip de posição como único uso de cor semântica (reforçado por texto na seção "Classificados").
- States visible: populated (4 times preenchidos).
- Assumptions: o "SG" exibe sinal (+4/+1); chip de cor é reforçado por ícone+texto na seção Classificados (cor não-exclusiva); "Editar Resultados" volta ao grid de preenchimento (toggle/colapso na mesma rota). 3º como "candidato a melhor terceiro" não está explícito no wireframe (mostra só os 2 classificados) — adicionado por requisito do spec, com marcação textual discreta.

## 1. User and Business Goals
Após preencher os 6 jogos de um grupo, o usuário quer **conferir** quem ele classificou (1º/2º) e quem ficou como candidato a melhor terceiro, antes de seguir. É uma tela de confirmação/feedback: read-only, derivada dos palpites (não pontuada — A2). Negócio: dar clareza e confiança no preenchimento, incentivando a conclusão da Copa.

## 2. Design System Reference
- Master: `design-system/MASTER.md` (baseline).
- Tema de área: `.palpites-theme` (já em `globals.css`) — herdado do container da rota do grupo (TASK-09).
- Tokens semânticos esportivos do MASTER (`--color-win`/`text-win`) para o destaque de classificado (já usado em ✓ de grupo concluído na TASK-06/08). Posição eliminada/3º sem verde.

## 3. User Flow
Entrada: na rota `/predictions/grupos/[groupId]` (TASK-09), a seção de classificação aparece **abaixo** do grid — automaticamente após "Salvar Grupo" (save com `saved>0`) ou ao acionar o toggle "Ver classificação prevista".

```
/predictions/grupos/{id}  (grid de preenchimento — TASK-09)
        │
        ├─ "Salvar Grupo" (saved>0) ─┐
        ├─ toggle "Ver classificação"┘──▶ seção Classificação Prevista (read-only)
        │                                   │
        │                                   ├─ "Confirmar Classificação" ─▶ avança (placeholder: /predictions/grupos)
        │                                   └─ "Editar Resultados" ─▶ colapsa a seção (volta ao grid)
        └─ (sem standings) ─▶ seção não renderizada
```
Edge: classificação parcial (nem todos os 6 jogos preenchidos) → tabela renderiza + nota informativa. Sem standings (0 times) → seção oculta.

## 4. Information Architecture
1. **Título "Classificação Prevista"** (primário) — orienta o que a tabela representa.
2. **Tabela** (núcleo): por linha, dado primário = posição + seleção; secundário = Pts; terciário = SG, GP.
3. **Lista "Classificados"** (reforço) — os 2 primeiros com ícone+texto (cor não-exclusiva); 3º marcado como candidato a melhor terceiro.
4. **Nota parcial** (condicional) — quando faltam palpites.
5. **CTA "Confirmar Classificação"** (ação principal) + **"Editar Resultados"** (ação secundária/voltar ao grid).

## 5. Layout and Components

### Seção na rota (dentro do container `.palpites-theme`)
- Envolvida em `<section aria-labelledby="standings-heading" className="flex flex-col gap-4">` abaixo do grid.

### PredictedStandings (apresentacional)
- Cabeçalho: `h2#standings-heading text-lg font-semibold text-foreground` ("Classificação Prevista").
- **Tabela** `table.w-full text-sm border-collapse` + `<caption className="sr-only">Classificação prevista do Grupo {id}</caption>`.
  - `<thead>`: `<th scope="col">` para Pos / Seleção / Pts / SG / GP. Rótulos curtos com `<abbr title="...">` quando útil (SG = "Saldo de gols", GP = "Gols pró"). Numéricas `text-right`; Seleção `text-left`.
  - `<tbody>`: uma `<tr>` por entry (ordem `position`). Célula de posição = chip `inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold`:
    - `qualified` (pos 1–2): `bg-win/15 text-win` (token esportivo) + número.
    - `best-third-candidate` (pos 3): `bg-muted text-foreground` + número + `aria-label="3º — candidato a melhor terceiro"`.
    - `eliminated` (pos ≥4): `bg-muted text-muted-foreground` + número.
  - Célula Seleção: `flex items-center gap-2` → bandeira (`<img>` igual ao padrão MatchCard: `width/height`, `loading=lazy`, `alt=""` aria-hidden) + `span truncate text-foreground` nome.
  - Pts: `font-semibold tabular-nums`. SG: `tabular-nums` com sinal (`formatSigned`: "+4"/"0"/"-2"). GP: `tabular-nums`.
- **Lista "Classificados"** `div flex flex-col gap-2`:
  - `h3 text-sm font-medium text-foreground` "Classificados".
  - Para cada classificado (pos 1–2): `div inline-flex items-center gap-2 rounded-lg border border-border bg-card p-2` → `CheckCircle2 size={16} text-win aria-hidden` + `span text-sm` "{nome} ({pos}º)".
  - 3º: `div ... text-muted-foreground` → ícone neutro (ex.: `CircleDot`/`Star` size16 aria-hidden) + "{nome} (3º) — candidato a melhor terceiro".
- **Nota parcial** (se `isPartial`): `p text-xs text-muted-foreground` "Classificação parcial — baseada nos jogos já preenchidos.".
- **CTAs**: `button` "Confirmar Classificação" (`buttonVariants default lg`, `min-h-[44px] w-full md:w-auto`) → `onConfirm`. Secundário "Editar Resultados" (`buttonVariants ghost/link`, `min-h-[44px]`) → handler de colapso (na rota).

### Responsividade
- Mobile (375): tabela compacta sem scroll horizontal — colunas Pos(chip)/Seleção(flex-1, truncate)/Pts/SG/GP estreitas (`tabular-nums`, rótulos curtos). Bandeira `w-6`.
- ≥768: mais respiro; CTA alinhado à esquerda/largura automática.
- Conteúdo em `max-w-2xl` (herdado da rota).

## 6. Typography and Color Tokens
- Título seção: `text-lg font-semibold text-foreground`; subtítulo lista: `text-sm font-medium`.
- Células: `text-sm text-foreground`; metadados/nota: `text-xs text-muted-foreground`.
- Números: `tabular-nums` (alinhamento de colunas numéricas).
- Classificado: `text-win` / `bg-win/15` (token esportivo do MASTER; tem variante dark).
- CTA: `bg-primary text-primary-foreground` (verde no escopo).
- Sem hex; sem `style` inline (sem largura geométrica). Contraste AA (tokens MASTER + verde escopado).

## 7. UI States

| Estado | Tratamento |
|---|---|
| Populated | tabela 1º–4º + lista de classificados + CTAs |
| Partial | tabela + nota "Classificação parcial" |
| Hidden/empty | sem standings → seção não renderiza (toggle oculto) |
| Success (pós-save) | seção revelada automaticamente após save com saved>0 |
| Read-only | toda a tabela é read-only por natureza (sem inputs) |
| Disabled | n/a (CTA sempre habilitado quando há standings) |
| Loading/Error | herdados da rota (TASK-09); a seção só aparece em estado populated da página |

## 8. Accessibility Requirements (Priority 1)
- **Tabela semântica:** `<table>` com `<caption>` (sr-only) e `<th scope="col">`; abreviações via `<abbr title>`.
- **Cor não-exclusiva:** o chip de posição colorido é **reforçado** pela seção "Classificados" com ícone+texto e pelo `aria-label` do chip ("1º — classificado", "3º — candidato a melhor terceiro", "4º"). Nenhum estado depende só de cor.
- **SG com sinal:** sempre exibe "+/−/0" textual (não só cor).
- **Contraste:** texto ≥4.5:1; `text-win` sobre `bg-win/15` validado AA (token MASTER); chips ≥3:1.
- **Touch targets:** CTAs ≥44×44px; "Editar Resultados" ≥44px; gap ≥8px entre CTAs.
- **Heading hierarchy:** `h1` (Grupo {id}) já na rota; aqui `h2` (Classificação Prevista) → `h3` (Classificados). Sem pular níveis.
- **Bandeiras:** `alt=""` + aria-hidden (nome textual presente na célula).
- **Foco:** ordem natural; foco visível nos CTAs (`focus-visible:ring-2 ring-ring ring-offset-2`).
- **Reduced motion:** transição de revelação respeita `motion-reduce`.
- **Escape:** "Editar Resultados" volta ao grid; voltar via header/BottomNav.

## 9. Animation and Motion (Priority 7)
- Revelação da seção pós-save: simples (sem animar height/layout); se houver transição, usar `opacity` curto (≤200ms) + `motion-reduce:transition-none`. Preferir aparecer sem animação custosa.
- CTA hover/press: `transition-colors duration-150 motion-reduce:transition-none` (via Button).
- Sem animação decorativa.

## 10. Navigation Patterns (Priority 9)
- A tela é uma seção da rota do grupo — não introduz nova rota nem nav.
- "Confirmar Classificação" avança o fluxo (placeholder `/predictions/grupos` até o wizard TASK-16 definir o destino).
- "Editar Resultados" colapsa a seção (volta ao grid de preenchimento na mesma rota).
- Localização atual ("Palpites") destacada pelo shell (não responsabilidade desta tela).

## 11. Pre-Delivery Checklist Status
- Ícones SVG (Lucide `CheckCircle2` / ícone neutro para 3º), import nomeado, família consistente — OK.
- Pressed/focus não deslocam layout — OK.
- Tokens semânticos; zero hex; sem `style` inline — OK.
- Touch ≥44px (CTAs), gap ≥8px — OK.
- Light/dark: tokens neutros + `text-win` (variante dark) + `text-muted-foreground` cobrem ambos — OK.
- Acessibilidade: tabela semântica, caption, scope, cor não-exclusiva (chip + lista ícone+texto), SG com sinal — OK.
- Todos os estados definidos (populated/partial/hidden/success/read-only) — OK.

## 12. Design Gaps and Assumptions
- **3º "candidato a melhor terceiro":** não aparece explicitamente no wireframe (que mostra só os 2 classificados). Adicionado por requisito do spec — marcação **discreta** (ícone neutro + texto), sem competir com os classificados. A definição real dos 8 melhores terceiros é da TASK-12.
- **Cor do chip de posição:** wireframe usa verde (1–2) e vermelho (3–4). Adotado: verde via `text-win`/`bg-win/15` para classificados; 3º e 4º em neutro (`bg-muted`) para não sugerir "erro" semântico (`--color-loss` significa derrota de palpite). A informação de classificação fica garantida pela lista "Classificados" (ícone+texto). Se o reviewer quiser o vermelho do wireframe no 4º, é troca localizada de token — mantida a opção neutra por consistência semântica.
- **"Editar Resultados":** mapeado para colapsar a seção (voltar ao grid na mesma rota), coerente com o fluxo single-route da TASK-09.
- **Fonte de dados (Q1 do spec):** standings computados na rota a partir de `useGroupMatches` + `currentScores` dos items; o componente recebe `standings` + `resolveTeamName` por props (apresentacional puro).
- **Destino do "Confirmar" (Q2):** placeholder até TASK-16; contrato do componente (`onConfirm`) não muda.
