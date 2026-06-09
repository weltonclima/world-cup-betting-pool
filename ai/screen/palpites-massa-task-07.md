# SCREEN SPEC – Hub de Palpites
## Task: TASK-07 (palpites-massa)
## Platform: web (mobile-first → desktop)

> Spec: `ai/spec/palpites-massa-task-07.md` · Design contract: `design-system/MASTER.md` + decisão de tema `.palpites-theme` (`ai/screen/palpites-massa-task-06.md` §6).
> Ferramenta: scripts Python do `ui-ux-pro-max` indisponíveis neste ambiente (sem Python). Direção derivada de `design-system/MASTER.md` + wireframes PNG.

## Visual Analysis (from images)

### PRD03-01 — Hub de Palpites
- **Layout:** header verde escuro cheio (app shell) com "Meus Palpites" centralizado; abaixo, card branco "Meus Palpites" com fração "72/104" à esquerda e "44%" à direita + barra de progresso verde; lista vertical de cards de fase (Fase de Grupos, 16 Avos de Final, Oitavas de Final, Quartas de Final, …) cada um com ícone de troféu à esquerda, título + contagem ("72 palpites"), fração da fase à direita ("14/72") e chevron; um CTA verde cheio "Continuar Palpites" no rodapé do conteúdo.
- **Componentes:** ProgressBar (fração + %), PhaseCard (×7), Button primário verde (CTA).
- **Style signals:** verde escuro no header (shell), verde médio no CTA e na barra; cards brancos elevados arredondados; fases bloqueadas com cadeado e tom esmaecido.
- **States visíveis:** fase em andamento (com contagem), fase bloqueada (cadeado, esmaecida).

### PRD03-13 — Estado Sem Palpites (vazio)
- Ilustração de troféu (outline cinza), título "Ainda não há palpites", subtítulo "Escolha uma fase para começar a palpitar.", CTA verde "Ir para Fase de Grupos". Progresso 0%.

### PRD03-14 — Em Andamento
- Card de topo "Palpites em andamento" com troféu + "Você já enviou 32 de 104 palpites"; ProgressBar "32/104 · 30%"; cards de fase com fração por fase ("14 / 72", "0 / 16", "0 / 8").

### PRD03-15 — Enviado/Completo
- Confete + troféu dourado, "Palpites enviados!", "Todos os seus 104 palpites foram enviados com sucesso.", card "Total de Palpites 104 / 104 · 100%", CTA verde "Ver Resumo Final".

### PRD03-16 — Bloqueado (variante deadline global)
- Cadeado grande, "Edição encerrada", "O prazo para edição dos palpites encerrou.", "Data limite 10/06/2026 18:00", CTA "Ver Resumo Final" + botão outline "Ver Regulamento".
- **Decisão (A9):** NÃO há deadline global nesta entrega — o lock é por kickoff de cada jogo. Portanto a *tela* PRD03-16 (deadline global + "Ver Regulamento") fica **fora de escopo**. O estado "bloqueado" do Hub é representado **por card de fase** (`PhaseCard status="bloqueado"`, cadeado, esmaecido, sem navegação) — o bloqueio A6 de fase futura. Documentado em Design Gaps.

**Assumptions:** o "verde" do header/CTA/barra é o verde da identidade (troféu) reusado de `.auth-theme`; cards internos permanecem em superfície clara neutra (branca). O header verde é o **app shell** (Header global), tematizado pelo escopo `.palpites-theme` aplicado no container da rota — o Hub não desenha header próprio.

---

## 1. User and Business Goals
Ponto de entrada da jornada de palpites em massa. O usuário precisa, em um relance: (1) ver **quanto já completou** da Copa (progresso global X/104), (2) escolher **por onde continuar** (cards por fase, com contagem e bloqueio das fases futuras), e (3) disparar o **modo contínuo** "⚡ Completar Copa". KPI: taxa de conclusão. A tela é escaneável, com CTA dominante e estados claros (nada feito / em andamento / tudo enviado / fase bloqueada).

## 2. Design System Reference
- Master: `design-system/MASTER.md` (baseline canônico).
- Override de área: **escopo `.palpites-theme`** (remapeia `--primary`/`--primary-foreground`/`--ring`/`--sidebar-primary` para o verde AA validado em `.auth-theme`). Adicionado em `globals.css` nesta task; registrar no MASTER §2.4-palpites.
- Sem `design-system/pages/*` — o override vive em `globals.css` como classe de escopo.

```css
/* Área de Palpites em Massa — shell verde dos wireframes (PRD03-01..16).
   Escopo local; remapeia apenas primary/ring/sidebar-primary. Reusa o verde
   validado de .auth-theme (mesma decisão de contraste AA). */
.palpites-theme {
    --primary: oklch(0.46 0.16 150);
    --primary-foreground: oklch(0.985 0 0);
    --ring: oklch(0.46 0.16 150);
    --sidebar-primary: oklch(0.46 0.16 150);
}
```

## 3. User Flow
- **Entrada:** item "Palpites" do BottomNav/SideNav (reaponta em TASK-16; aqui a rota `/predictions` já é o Hub).
- **Happy path:** Hub → toca em "Fase de Grupos" (ou no CTA "⚡ Completar Copa") → `/predictions/grupos` (TASK-08).
- **Saídas:** card de fase navegável → tela da fase; CTA → primeiro passo pendente; estado completo → "Ver Resumo Final" (rota futura — TASK-15).
- **Edge cases:** loading (skeleton), erro (retry), vazio (CTA "Ir para Fase de Grupos"), fase futura bloqueada (card cadeado, sem navegação).

```
[BottomNav: Palpites] → /predictions (Hub)
   ├─ loading → skeleton (role=status)
   ├─ error   → mensagem + "Tentar novamente"
   ├─ vazio (0/Y)        → trofeu outline + "Ir para Fase de Grupos"
   ├─ andamento (0<f<T)  → ProgressBar + cards + "⚡ Completar Copa"
   └─ completo (f===T)   → confete/✓ + "Copa completa!" + "Ver Resumo Final"
        card de fase navegável → tela da fase
        card bloqueado (A6)    → sem navegação
```

## 4. Information Architecture
1. **(Topo) Card de progresso** — fração "X / 104" (primário) + "%" (secundário) + barra. No estado completo, vira banner de conclusão (troféu/✓ + "Palpites enviados!").
2. **Lista de cards de fase** — 7 fases na ordem fixa; cada card: ícone (troféu/cadeado) → título da fase → contagem "N jogos"/"pendentes" → fração da fase "X / Y" → chevron/✓/cadeado.
3. **CTA primário** — "⚡ Completar Copa" (andamento) / "Ir para Fase de Grupos" (vazio) / "Ver Resumo Final" (completo).

## 5. Layout and Components

### Container da rota (`page.tsx`)
- `<div className="palpites-theme flex flex-col gap-4 pb-20 md:pb-4 max-w-2xl mx-auto">` — escopo de tema + ritmo de espaço + compensação do BottomNav (`pb-20`) + largura legível no desktop.
- Header global (app shell) herda o verde via o token remapeado no escopo (já é o "header verde" dos wireframes).

### Título
- `<h1 className="text-2xl font-semibold text-foreground">Meus Palpites</h1>` (Heading 1 do MASTER §3.2). Visível e único h1 da tela.

### Card de progresso global (`PredictionsHub` interno)
- `section` `rounded-xl border border-border bg-card p-4 shadow-sm`.
- Subtítulo opcional ("Você já enviou X de Y palpites", PRD03-14) `text-sm text-muted-foreground`.
- `ProgressBar` (primitiva TASK-06): `value={filled} total={total}` → fração "X / Y" + "%". Barra `bg-primary` (verde no escopo).
- **Estado completo (PRD03-15):** este card vira **banner de conclusão**: ícone `Trophy` (`size={24} text-primary`) + título `text-lg font-semibold text-foreground` "Copa completa!" + subtítulo "Todos os seus N palpites foram enviados.". Mantém a ProgressBar em 100%. (Sem confete animado obrigatório — opcional/decorativo; respeitar reduced-motion se incluído.)
- **Estado vazio (PRD03-13):** card de progresso com 0/Y; abaixo, bloco de incentivo: ícone `Trophy` (outline, `text-muted-foreground`), `text-lg font-semibold` "Ainda não há palpites", `text-sm text-muted-foreground` "Escolha uma fase para começar.".

### Lista de cards de fase
- Container `flex flex-col gap-3`.
- `PhaseCard` (primitiva TASK-06) por fase, props derivadas no `page.tsx`:
  - `icon={Trophy}` para todas as fases (ícone do wireframe). Bloqueada → a primitiva já troca para `Lock`.
  - `title`, `gamesCount`, `pendingCount`, `status`, `href`.
  - Subtítulo gerado pela primitiva ("N pendentes · M jogos" / "Concluído" / "Bloqueado").
- **Fração por fase (PRD03-14 mostra "14 / 72"):** a primitiva PhaseCard atual exibe "N pendentes · M jogos", não a fração "preenchidos/total". Para fidelidade ao wireframe sem alterar a primitiva, o subtítulo "N pendentes · M jogos" é semanticamente equivalente e aceito (a fração exata por fase é redundante com pendentes+total). **Decisão:** manter a primitiva como está (não reabrir TASK-06); a fração visual fica como melhoria opcional futura. Registrado em Design Gaps.

### CTA primário
- `Button` (`@/components/ui/button`, variant `default`) renderizado como link via `asChild`+`<Link>` **ou** `<Link className={buttonVariants(...)}>` (padrão já usado no Header). Altura ≥ 44px (`h-11` em mobile).
- Conteúdo por estado:
  - vazio → ícone `Zap`/`ChevronRight` + "Ir para Fase de Grupos", `href="/predictions/grupos"`.
  - andamento → ícone `Zap` (`aria-hidden`) + "⚡ Completar Copa" (o emoji ⚡ é textual no rótulo do wireframe; usar **ícone Lucide `Zap`** + texto "Completar Copa" — sem emoji como ícone, regra MASTER §14), `href={completeHref}`.
  - completo → "Ver Resumo Final", `href` de resumo (rota futura TASK-15; placeholder de convenção).
- Largura total no mobile (`w-full`), auto no desktop (`md:w-auto md:self-start`).

### Loading / Error (no `page.tsx`/`PredictionsHub`)
- **Loading:** `div role="status" aria-live="polite"` com skeletons: barra cinza (`h-2 bg-muted rounded-full`) + 4 blocos de card (`h-16 bg-muted rounded-xl animate-pulse motion-reduce:animate-none`). Texto sr-only "Carregando palpites".
- **Error:** `div role="alert"` com `text-sm text-destructive` "Não foi possível carregar seus palpites." + `Button variant="outline"` "Tentar novamente" (`onClick={onRetry}`).

## 6. Typography and Color Tokens
- Título "Meus Palpites": `text-2xl font-semibold text-foreground`.
- Título de conclusão/vazio: `text-lg font-semibold text-foreground`.
- Subtítulos/metadados: `text-sm`/`text-xs text-muted-foreground`.
- Fração da barra: `text-sm font-medium text-foreground`; "%": `text-sm font-semibold`.
- **Cor:** shell/CTA/barra/realce = `--primary` (verde no escopo `.palpites-theme`). ✓ de fase concluída = `text-win` (semântica esportiva, não shell). Erro = `text-destructive`. Zero hex; zero `style` (exceto largura geométrica encapsulada na ProgressBar).
- Contraste: branco sobre verde `~0.46` e verde sobre branco ambos ≥ AA (validado em auth). Neutros do MASTER ≥ AA em light/dark.

## 7. UI States

| Estado | Tratamento |
|---|---|
| **Loading** | skeleton (barra + 4 cards) `role="status"` `aria-live="polite"`; `animate-pulse motion-reduce:animate-none`. |
| **Empty (PRD03-13)** | `filled===0`: progresso 0/Y, bloco "Ainda não há palpites" + CTA "Ir para Fase de Grupos". |
| **Populated / Em andamento (PRD03-14)** | `0<filled<total`: card progresso + 7 cards de fase (status derivado + bloqueio A6) + CTA "⚡ Completar Copa". |
| **Complete / Enviado (PRD03-15)** | `filled===total && total>0`: banner conclusão (✓/troféu) + cards concluídos + CTA "Ver Resumo Final". |
| **Blocked por card (PRD03-16/A6)** | fase futura `status="bloqueado"`: cadeado, `opacity-60`, `aria-disabled`, sem `<a>`. |
| **Error** | `role="alert"` + mensagem + "Tentar novamente". |
| **Disabled** | CTA desabilitado durante loading (`disabled`/`aria-disabled`, opacidade reduzida). |

## 8. Accessibility Requirements (Priority 1)
- **Contraste:** texto ≥ 4.5:1, componentes ≥ 3:1 — verde escopado + neutros do MASTER atendem AA (light/dark).
- **Touch targets:** PhaseCard (`p-4`) e CTA (`h-11`) ≥ 44×44px; gap ≥ 8px (`gap-3`).
- **Labels:** `h1` "Meus Palpites" (único h1; hierarquia sem pulo). ProgressBar com `role="progressbar"` + `aria-valuemin/max/now/valuetext` (primitiva). Cards com `aria-label` resumido ("Fase de Grupos, 12 pendentes · 72 jogos"). CTA com rótulo textual. Ícones decorativos `aria-hidden="true"`.
- **Estado bloqueado:** `aria-disabled="true"` + texto "Bloqueado" (cor não-exclusiva: cadeado + texto).
- **Foco:** ordem natural do DOM (card progresso → cards de fase → CTA); `focus-visible:ring-2 ring-ring ring-offset-2`; sem tabIndex positivo.
- **Screen reader:** loading `role="status" aria-live="polite"`; error `role="alert"`.
- **Reduced motion:** `motion-reduce:transition-none` (barra/hover) e `motion-reduce:animate-none` (skeleton).
- **Cor não-exclusiva:** ✓ "Concluído", 🔒 "Bloqueado" sempre com ícone + texto.

## 9. Animation and Motion (Priority 7)
- ProgressBar: `transition-[width] duration-300` (primitiva), interrompível, `motion-reduce:transition-none`.
- Hover de cards/CTA: `transition-colors duration-150`.
- Skeleton: `animate-pulse` com fallback `motion-reduce:animate-none`.
- Confete de conclusão (PRD03-15): **decorativo e opcional** — se implementado, transform/opacity apenas, ≤ 400ms, respeitar `prefers-reduced-motion` (não animar em reduced-motion). Não é requisito de aceite.

## 10. Navigation Patterns (Priority 9)
- Cards e CTA usam `next/link` (`href`); card bloqueado não navega.
- BottomNav/SideNav inalterados nesta task (reaponte é TASK-16); a localização atual ("Palpites") já é destacada pela nav existente.
- Deep-link: `/predictions` é o Hub. Rotas de fase eliminatória (`/predictions/chave/[stage]`) e resumo (TASK-15) ainda não existem — `href` de convenção, fases nascem bloqueadas (A6) até grupos concluir.

## 11. Pre-Delivery Checklist Status
- Ícones SVG (Lucide: `Trophy`, `Zap`, `Lock`, `ChevronRight`, `CheckCircle2`), import nomeado — OK.
- Emoji ⚡ do wireframe substituído por ícone `Zap` + texto (regra MASTER §14) — OK.
- Pressed/focus não deslocam layout (ring com offset) — OK.
- Tokens semânticos; zero hex; `style` só largura geométrica da barra (exceção documentada) — OK.
- Touch ≥ 44px, gap ≥ 8px — OK.
- Light/dark: tokens neutros + `text-win` com variante dark — OK.
- Acessibilidade (labels, estados, cor não-exclusiva, reduced motion, h1 único) — OK.
- Todos os estados definidos (loading/empty/populated/complete/blocked/error/disabled) — OK.

## 12. Design Gaps and Assumptions
- **PRD03-16 (deadline global) fora de escopo (A9):** sem deadline global; lock é por kickoff. O estado "bloqueado" no Hub é por card de fase (A6). A tela cheia "Edição encerrada / Data limite / Ver Regulamento" não é construída nesta entrega.
- **Fração por fase no PhaseCard:** wireframe mostra "14 / 72"; a primitiva exibe "N pendentes · M jogos" (equivalente semântico). Mantida a primitiva sem alteração (não reabrir TASK-06); fração exata fica como melhoria opcional.
- **CTA no estado completo:** "Ver Resumo Final" aponta para rota de resumo ainda inexistente (TASK-15) — placeholder de convenção; não bloqueia esta entrega.
- **Confete (PRD03-15):** tratado como decorativo opcional, não requisito.
- **Header próprio:** o Hub não desenha header; reusa o app shell tematizado pelo escopo verde.
