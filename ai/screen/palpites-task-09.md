# SCREEN — TASK-09: CTA contextual + bloco "Meu Palpite" no detalhe do jogo

> Gerado em: 2026-06-07 | Feature: Palpites (PRD-04) | Task: TASK-09
> Fonte de verdade: `docs/prd-04/PRD04-02-Detalhes-Jogo.png` (analisada)
> Contrato visual: `design-system/MASTER.md`
> Arquivo de implementação: `ai/spec/palpites-task-09.md`
> Componentes: `MatchDetail.tsx` (modificar) + `MatchDetailActions.tsx` (modificar)

---

## 1. Análise da imagem de referência (PRD04-02-Detalhes-Jogo.png)

A imagem mostra a tela "Detalhes do Jogo" com:

### Layout observado na imagem

1. **Header:** "Detalhes do Jogo" com ícone de sino (notificação) à direita.
2. **Subtítulo:** "Fase de Grupos" + badge "Agendado".
3. **Bloco de times:** bandeiras Brasil × França centralizadas; data/hora (02/06/2026 · 16:00); estádio (Lusail Stadium).
4. **"Status do do jogo":** badge verde "Agendado"; linha de informações (Fase, Rodada, Pontuação "5 Marcador (P0)", Expectativas 88.988).
5. **Bloco "Meu Palpite":** placar palpitado "**2 × 1**" em destaque (números grandes, fonte bold), com link em texto verde "Editar palpite" logo abaixo do placar.
6. **Botão "Editar palpite"** — botão verde primário full-width (fundo verde escuro, texto branco, ícone de lápis à esquerda), abaixo do bloco Meu Palpite.
7. **Botão "Ver últimos resultados"** — botão outline (borda preta, texto escuro) abaixo do botão primário.
8. **BottomNav:** Jogos (ativo), Palpites, Ranking, Perfil.

### Observações críticas da imagem

- **"Meu Palpite"** é um card/bloco distinto com label "Meu Palpite" e o placar palpitado em números grandes (tipo score de jogo — fonte bold, tamanho ≈ 4xl–5xl).
- O link "Editar palpite" aparece em verde dentro do bloco, como texto clicável (não botão).
- O botão primário "Editar palpite" (verde) aparece separado abaixo, como CTA full-width.
- **Pontuação "5 Marcador (P0)" / "88.988 expectativas"** — dados específicos de API (fora do escopo PRD-04, ignorar).
- **"Ver últimos resultados"** — botão outline que pode ser placeholder de PRD futuro (estatísticas).
- A paleta de cores da imagem mostra verde como cor primária (CTA, badge ativo, link). No design system do projeto, `--primary` é cinza escuro no light mode (não verde). A implementação segue `design-system/MASTER.md` (primário = `bg-primary` cinza escuro), não a cor da imagem.

---

## 2. Decisões de design

### 2.1 Fidelidade ao design system vs imagem

| Elemento | Imagem | Decisão final |
|---|---|---|
| Cor do botão primário | Verde | `bg-primary` (cinza escuro light / claro dark) — segue MASTER.md |
| Cor do badge "Agendado" | Verde | `GameStatusBadge` existente (sem alteração) |
| Link "Editar palpite" dentro do bloco | Texto verde | Omitir — o botão CTA abaixo cobre essa função sem duplicação |
| "Ver últimos resultados" | Botão outline | Manter como `disabled` placeholder (PRD futuro) ou omitir — ver §2.2 |
| Números do palpite | Grandes, bold | `text-4xl font-bold text-foreground` |
| Separador "×" do palpite | Médio, muted | `text-xl font-bold text-muted-foreground` |

### 2.2 Botão "Ver últimos resultados"

A imagem inclui este botão. Não faz parte do PRD-04. **Decisão:** omitir da implementação (TASK-09 é puramente CTA de palpite). Se mantido, deve ficar `disabled` como placeholder explícito.

### 2.3 Simplificação dos CTAs

A imagem mostra link + botão primário para a mesma ação (editar). **Decisão:** um único CTA primário full-width (`Button asChild Link`) — evita duplicação e é mais claro para o usuário.

---

## 3. Estados do CTA — especificação visual

### Estado A: Enviar Palpite (sem palpite + jogo scheduled)

```
┌─────────────────────────────────────────────────┐
│  [Send icon]  Enviar Palpite                    │  ← Button default (bg-primary)
└─────────────────────────────────────────────────┘
```

- **Componente:** `<Button variant="default" asChild><Link href="/matches/[id]/predict">`
- **Ícone:** `Send` (16px, `aria-hidden`)
- **Texto:** "Enviar Palpite"
- **Cor fundo:** `bg-primary` (cinza escuro light / quase branco dark)
- **Cor texto:** `text-primary-foreground`
- **Tamanho:** `w-full min-h-[44px]`
- **Alinhamento interno:** `justify-start gap-2`
- **Cursor:** pointer (herdado do `<a>`)
- **Focus ring:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (herdado do Button)
- **Hover:** `hover:bg-primary/90` (herdado)
- **aria-label:** "Enviar palpite para este jogo"
- **Sem bloco "Meu Palpite"** neste estado (sem palpite)

### Estado B: Editar Palpite (com palpite + jogo scheduled)

```
┌─ Meu Palpite ──────────────────────────────────┐
│                                                  │
│   Brasil          França                         │
│     2      ×        1                            │  ← números bold 4xl
│                                                  │
└──────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  [Pencil icon]  Editar Palpite                  │  ← Button default (bg-primary)
└─────────────────────────────────────────────────┘
```

- **Bloco "Meu Palpite":** card com label uppercase + placar em destaque (ver §5)
- **CTA:** `<Button variant="default" asChild><Link href="/matches/[id]/predict">`
- **Ícone:** `Pencil` (16px, `aria-hidden`)
- **Texto:** "Editar Palpite"
- Demais propriedades visuais: idênticas ao Estado A

### Estado C: Palpite bloqueado (jogo não-scheduled OU predictionStatus="bloqueado")

```
┌─ Meu Palpite ──────────────────────────────────┐  ← só se prediction existe
│   Brasil          França                         │
│     2      ×        1                            │
└──────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  [Lock icon]  Palpite bloqueado                 │  ← Button outline disabled
└─────────────────────────────────────────────────┘
```

- **Bloco "Meu Palpite":** exibido se `existingPrediction` existe (mesmo bloqueado)
- **CTA:** `<Button variant="outline" disabled aria-disabled="true">`
- **Ícone:** `Lock` (16px, `aria-hidden`)
- **Texto:** "Palpite bloqueado"
- **Opacidade:** `opacity-50` (herdado do Button disabled)
- **Cursor:** `cursor-not-allowed` (herdado do Button disabled)
- **Cor fundo:** `bg-background` (outline)
- **Cor borda:** `border-border`
- **Cor texto:** `text-muted-foreground` (via disabled)
- **aria-label:** "Palpite bloqueado — prazo encerrado"
- **Sem navegação** — botão, não link

---

## 4. Bloco "Meu Palpite" — especificação visual

### 4.1 Estrutura visual

```
┌────────────────────────────────────────────────────┐
│  MEU PALPITE                     (label uppercase) │
│                                                    │
│  Brasil              França      (nomes dos times) │
│  [ 2 ]      ×       [ 1 ]        (scores bold)    │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4.2 Especificação de componentes

```tsx
// Label da seção (acima do bloco, igual às outras seções do card)
<SectionHeading>Meu Palpite</SectionHeading>

// Bloco de placar
<div
  className="flex items-center justify-center gap-6 py-2"
  aria-label={`Seu palpite: ${homeTeamName} ${homeScore} a ${awayScore} ${awayTeamName}`}
  role="img"
>
  {/* Mandante */}
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs text-muted-foreground font-medium truncate max-w-20 text-center">
      {homeTeamName}
    </span>
    <span className="text-4xl font-bold text-foreground tabular-nums">
      {homeScore}
    </span>
  </div>

  {/* Separador */}
  <span
    className="text-xl font-bold text-muted-foreground"
    aria-hidden="true"
  >
    ×
  </span>

  {/* Visitante */}
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs text-muted-foreground font-medium truncate max-w-20 text-center">
      {awayTeamName}
    </span>
    <span className="text-4xl font-bold text-foreground tabular-nums">
      {awayScore}
    </span>
  </div>
</div>
```

### 4.3 Tipografia do placar

| Elemento | Classe | Racional |
|---|---|---|
| Label "Meu Palpite" | `text-base font-semibold text-foreground` | Padrão `SectionHeading` do card |
| Nomes dos times | `text-xs text-muted-foreground font-medium` | Auxiliar, não compete com o placar |
| Números do placar | `text-4xl font-bold text-foreground tabular-nums` | Destaque — linguagem visual de placar esportivo |
| Separador "×" | `text-xl font-bold text-muted-foreground` | Menor que os números; não compete |

### 4.4 Posição no card de status/ações

O bloco "Meu Palpite" é inserido **entre "Status do Palpite" e "Ações"**, separado por `<div className="border-t border-border" />` em ambos os lados:

```
Card de Status (rounded-xl border bg-card shadow-sm p-4 gap-4)
  ├── Status do Jogo (GameStatusBadge)
  ├── [divider border-t]
  ├── Status do Palpite (MatchStatusBadge + mensagem text-xs)
  ├── [divider border-t]         ← só se existingPrediction
  ├── Meu Palpite (bloco)        ← só se existingPrediction
  ├── [divider border-t]
  └── Ações (MatchDetailActions CTA)
```

### 4.5 Condicionalidade

- Bloco "Meu Palpite" **renderiza** somente quando `existingPrediction !== undefined`.
- No estado bloqueado **com** palpite: bloco é exibido (placar palpitado como referência).
- No estado bloqueado **sem** palpite: sem bloco "Meu Palpite" (usuário não palpitou antes do lock).
- No estado "finished": bloco exibido se palpite existir (contexto histórico).

---

## 5. Layout completo do card de status (after TASK-09)

### Mobile (< 768px)

```
┌──────────────────────────────────────┐
│  Status do Jogo                      │
│  [badge: Agendado]                   │
│  ──────────────────────────────────  │
│  Status do Palpite                   │
│  [badge: Enviado] (verde)            │
│  "Seu palpite foi enviado com sucesso│
│  ──────────────────────────────────  │
│  Meu Palpite                         │
│  Brasil       França                 │
│   [2]    ×    [1]                    │
│  ──────────────────────────────────  │
│  Ações                               │
│  [✏ Editar Palpite]   ← primário    │
└──────────────────────────────────────┘
```

### Desktop (≥ 768px — grid 2 colunas)

O card de status fica na coluna da direita ao lado do card de informações. O mesmo conteúdo se aplica. Sem alteração de layout grid (existente no PRD-03).

---

## 6. Comportamento de navegação

| CTA | Ação | Destino |
|---|---|---|
| "Enviar Palpite" | Click/tap → `<Link>` | `/matches/[id]/predict` |
| "Editar Palpite" | Click/tap → `<Link>` | `/matches/[id]/predict` |
| "Palpite bloqueado" | Bloqueado — sem ação | — |

- Navegação via `next/link` (prefetch automático, sem `<a>` direto).
- Transição de página: padrão Next.js (sem animação especial em TASK-09).
- Back navigation: a página `/matches/[id]/predict` tem botão "Voltar" para retornar ao detalhe.

---

## 7. Acessibilidade — especificação completa

### 7.1 Comunicação do estado bloqueado (não só por cor)

O estado bloqueado usa **três camadas** de comunicação, não apenas cor:

1. **Ícone `Lock`** — sinal visual universal de bloqueio.
2. **Texto "Palpite bloqueado"** — rótulo descritivo.
3. **`disabled` + `aria-disabled="true"`** — comunicado a tecnologias assistivas como inativo.
4. **`aria-label="Palpite bloqueado — prazo encerrado"`** — contexto adicional para screen readers.

### 7.2 Bloco "Meu Palpite" acessível

```tsx
<div
  role="img"
  aria-label={`Seu palpite: ${homeTeamName} ${homeScore} a ${awayScore} ${awayTeamName}`}
>
  {/* conteúdo visual */}
</div>
```

- `role="img"` com `aria-label` descritivo em linguagem natural (ex.: "Seu palpite: Brasil 2 a 1 França").
- O separador "×" tem `aria-hidden="true"` — o `aria-label` do container já descreve a relação.
- Números com `tabular-nums` — alinhamento visual consistente; sem impacto semântico.

### 7.3 Áreas de toque

- CTA primário ("Enviar/Editar Palpite"): `min-h-[44px]` — WCAG 2.5.5 ✓
- CTA bloqueado ("Palpite bloqueado"): `min-h-[44px]` — mesmo desabilitado, área de toque mantida ✓

### 7.4 Focus management

- CTAs ativos ("Enviar/Editar"): `Button asChild Link` herda focus ring de `Button` → `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` ✓
- CTA bloqueado: `disabled` remove do tab order (correto — não deve receber foco quando não interativo) ✓
- Sem `tabIndex` positivo ✓

### 7.5 Reduced motion

- Transições de `Button` (hover): `transition-colors duration-150` (CSS, não animation — sem impact em `prefers-reduced-motion`) ✓

---

## 8. Responsividade

### Mobile (base — `< 768px`)

- Card de status/ações: `flex flex-col gap-4` (existente, sem alteração).
- Bloco "Meu Palpite": `flex items-center justify-center gap-6 py-2` — placar centralizado.
- CTA: `w-full min-h-[44px]` — full-width, thumb-friendly.
- Nomes dos times: `max-w-20 truncate` — evita overflow em nomes longos.

### Desktop (`≥ md`)

- Grid de 2 colunas do `MatchDetail` (existente): sem alteração.
- O card de status (coluna direita) mostra os mesmos elementos, com `pb-4` ao invés de `pb-20`.
- Bloco "Meu Palpite": mesma estrutura horizontal.

---

## 9. Consistência com telas existentes

### 9.1 Reuso de padrões do PRD-03

| Padrão | Origem | Reuso em TASK-09 |
|---|---|---|
| `SectionHeading` | `MatchDetail.tsx` | Reutilizado para label "Meu Palpite" |
| `border-t border-border` como divider | `MatchDetail.tsx` (L407, L417) | Reutilizado para separar blocos |
| `rounded-xl border border-border bg-card shadow-sm p-4` | `MatchDetail.tsx` (L398) | Card de status existente — sem alteração |
| `Button variant="default"` para CTA primário | Design system §8 | CTAs Enviar/Editar |
| `Button variant="outline"` para CTA secundário | Design system §8 | Placeholder desabilitado |
| `min-h-[44px]` em botões | Design system §10.2 | CTAs TASK-09 |

### 9.2 Reuso de badges TASK-02

Os badges de `predictionLabels.ts` (`PREDICTION_DISPLAY_STATUS_LABEL`, `PREDICTION_DISPLAY_STATUS_COLOR`) existem para a Lista de Palpites (TASK-08). **Não são reutilizados em TASK-09** — o detalhe de jogo usa `MatchStatusBadge` (existente do PRD-03) que já exibe o status do palpite com as classes corretas.

---

## 10. Guia de implementação rápida

### Checklist de mudanças visuais em `MatchDetailActions.tsx`

- [ ] Remover `disabled aria-disabled="true"` dos CTAs Enviar/Editar.
- [ ] Envolver CTA primário em `<Button asChild><Link href={predictHref}>`.
- [ ] Manter `disabled` apenas no estado bloqueado.
- [ ] Substituir ícone do estado bloqueado por `Lock` (Lucide).
- [ ] Label do estado bloqueado: "Palpite bloqueado" (não "Visualizar Palpite").
- [ ] Remover botões placeholder que não pertencem ao PRD-04 (simplificação).

### Checklist de mudanças visuais em `MatchDetail.tsx`

- [ ] Adicionar imports: `useAuth`, `usePredictions`.
- [ ] Derivar `existingPrediction = predictions?.find(p => p.matchId === id)`.
- [ ] Inserir bloco "Meu Palpite" entre `border-t` e seção "Ações" (condicional).
- [ ] Passar `matchId={id}` e `prediction={existingPrediction}` para `<MatchDetailActions>`.
- [ ] Usar `SectionHeading` e `border-t border-border` seguindo padrão existente.

---

## 11. Tokens Tailwind utilizados (novos em TASK-09)

Nenhum token novo. Todos os tokens já existem no design system:

| Classe | Token | Uso |
|---|---|---|
| `text-4xl font-bold` | — | Números do placar "Meu Palpite" |
| `tabular-nums` | — | Alinhamento de números |
| `max-w-20 truncate` | — | Overflow de nomes longos |
| `text-xs text-muted-foreground` | `--muted-foreground` | Nomes dos times no bloco palpite |
| `gap-6` | — | Espaço entre elementos do placar |
| `py-2` | — | Padding vertical do placar |

---

## 12. Fluxo completo de UX (integrado com TASK-07)

```
Detalhe do Jogo (MatchDetail)
  └─ Estado: scheduled + sem palpite
       └─ CTA: [Enviar Palpite] ──────────────────────────► /matches/[id]/predict
                                                              └─ Formulário (TASK-07)
                                                                   └─ Sucesso → /matches (via "Voltar para Jogos")
  └─ Estado: scheduled + com palpite
       └─ Bloco "Meu Palpite": [2 × 1]
       └─ CTA: [Editar Palpite] ─────────────────────────► /matches/[id]/predict
                                                              └─ Formulário pré-preenchido (TASK-07)
  └─ Estado: não-scheduled (live/finished/etc.)
       └─ Bloco "Meu Palpite": [2 × 1] (se existir)
       └─ CTA: [Palpite bloqueado] (disabled)
```
