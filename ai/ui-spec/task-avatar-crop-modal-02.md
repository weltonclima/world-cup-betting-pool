# UI-SPEC — TASK-02: AvatarCropModal

## 1. Component Identity
- Name: `AvatarCropModal`
- Type: Modal
- Tech: Next.js 15 (App Router) / React 19, client component. `@base-ui/react/dialog` wrapper, Tailwind v4, lucide-react.
- Complexity: Standard

## 2. Visual Structure (ASCII)

```
DialogContent (max-w-lg, p-6)
┌──────────────────────────────────────────┐
│ Ajustar foto                          [X] │  ← DialogTitle + close
│ Arraste para escolher a área.             │  ← DialogDescription
│                                            │
│   ┌──────────────────────────────────┐     │  ← image stage (relative)
│   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│     │     img object-contain
│   │░░░░┌────────────────────┐░░░░░░░░░│     │     dimmed outside overlay
│   │░░░░│                    │░░░░░░░░░│     │
│   │░░░░│   crop overlay     │░░░░░░░░░│     │  ← square, draggable
│   │░░░░│   (1:1, ring)      │░░░░░░░░░│     │     border ring + grab cursor
│   │░░░░└────────────────────┘░░░░░░░░░│     │
│   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│     │
│   └──────────────────────────────────┘     │
│                                            │
│   ⚠ <erro inline, condicional>             │  ← text-destructive, role=alert
│                                            │
│ DialogFooter                               │
│            [ Cancelar ]  [ Salvar Foto ]   │  ← stack-reverse no mobile
└──────────────────────────────────────────┘
```

Mobile (<640px): `DialogContent` já é `max-w-[calc(100%-2rem)]`; footer empilha (`flex-col-reverse`) — "Salvar Foto" no topo (primário acima no empilhamento reverso).

## 3. Component Breakdown

| Component | Type | Props | States | Notes |
|---|---|---|---|---|
| `Dialog` | wrapper | `open`, `onOpenChange` | open/closed | `onOpenChange(false)`→`onCancel` |
| `DialogContent` | container | `className` | — | herda focus-trap/Escape/backdrop |
| `DialogTitle` | text | — | — | "Ajustar foto" |
| `DialogDescription` | text | — | — | "Arraste para escolher a área que será usada." |
| Image stage | `div` | `ref` | — | `relative`, mede displayW/H; `touch-none select-none` |
| `<img>` | media | `ref`, `src`, `onLoad` | loading/loaded | `object-contain`, `draggable={false}`, `pointer-events-none` |
| Dim overlay | `div` | — | — | 4 retângulos ou box-shadow escurecendo fora do recorte |
| Crop box | `div` | `style{left,top,size}`, pointer handlers | idle/dragging | `absolute`, `ring-2 ring-white`, `cursor-grab`/`grabbing`, `aria-label` |
| Erro inline | `p` | — | hidden/visible | `role="alert"`, `text-sm text-destructive` |
| "Cancelar" | `Button variant=outline` | `onClick` | default/focus/disabled | desabilitado durante loading |
| "Salvar Foto" | `Button` | `onClick` | default/focus/disabled/loading | disabled até img carregar; spinner no loading |

## 4. Interaction States

| Element | Default | Hover | Active | Focus | Disabled | Loading | Error |
|---|---|---|---|---|---|---|---|
| Crop box | `ring-white cursor-grab` | leve realce | `cursor-grabbing` | n/a (drag) | — | sem interação | — |
| "Salvar Foto" | primário | bg-hover | press | ring visível | dessaturado | spinner + "Salvando…" | reabilita |
| "Cancelar" | outline | bg-muted | press | ring visível | durante loading | — | — |
| Erro inline | oculto | — | — | — | — | — | texto visível |

## 5. Data Binding

| Field | Source | Transform | Update Trigger |
|---|---|---|---|
| `src` | `file` prop | `URL.createObjectURL(file)` | mudança de `file`/`open` (revogar no cleanup) |
| displayW/H | `<img>` onLoad | `clientWidth`/`clientHeight` | onLoad + resize |
| naturalW/H | `<img>` | `naturalWidth/Height` | onLoad |
| overlay {x,y,side} | estado local | init centralizado; clamp em drag | pointer move |
| cropNatural | overlay × scale | `displayCropToNatural()` | ao confirmar |
| dataUrl | `cropRectToCompressedDataUrl` | canvas→JPEG | clique "Salvar Foto" |

## 6. Responsive Behavior

| Breakpoint | Layout Change | Hidden/Shown |
|---|---|---|
| `<640px` | footer `flex-col-reverse`; modal quase full-width | tudo visível |
| `≥640px` | footer `flex-row justify-end`; `max-w-lg` | tudo visível |

Image stage: `w-full`, altura limitada (`max-h-[60vh]`) para caber em telas baixas; `<img>` `object-contain` centraliza.

## 7. Accessibility

- [ ] Foco entra no modal ao abrir; preso; retorna ao gatilho ao fechar (nativo `@base-ui/react/dialog`).
- [ ] Escape e clique no backdrop → `onCancel`.
- [ ] Crop box: `role="slider"` opcional ou `aria-label="Área de recorte — arraste para reposicionar"`. Mínimo: `aria-label`.
- [ ] Botões alcançáveis e operáveis por teclado (Tab/Enter/Space).
- [ ] Erro com `role="alert"` (anúncio em screen reader).
- [ ] Contraste do ring sobre imagem: usar `ring-white` + sombra/`outline` escuro para garantir visibilidade sobre qualquer foto (4.5:1 não se aplica a imagem, mas a borda deve ser perceptível).
- [ ] Touch targets dos botões ≥ 44×44 (Button default `h-9`+padding ok; garantir no mobile com `h-11` se necessário).
- [ ] `DialogTitle` + `DialogDescription` presentes → aria-labelledby/describedby automáticos.

## 8. Animation Spec

| Trigger | Animation | Duration | Easing | Tech |
|---|---|---|---|---|
| Abrir modal | fade+zoom-in (nativo) | ~150ms | ease-out | `data-open:animate-in` (já no `DialogContent`) |
| Fechar modal | fade+zoom-out | ~150ms | ease-in | `data-closed:animate-out` |
| Drag overlay | sem transição (segue ponteiro 1:1) | — | — | atualização direta de `style` |
| Loading botão | spinner rotativo | — | linear | `lucide Loader2 animate-spin` |

Drag NÃO deve ter transição CSS (causaria lag perceptível). Apenas posição direta.

## 9. Edge Cases

| Case | Condition | Behavior |
|---|---|---|
| Img não carregada | onLoad pendente | "Salvar Foto" disabled; stage pode mostrar área neutra |
| Falha ao carregar img | `onError` | erro inline "Não foi possível ler a imagem."; "Salvar Foto" fica disabled |
| Compressão falha | `AvatarImageError` | erro inline com a mensagem; modal permanece; sai do loading |
| Imagem ~quadrada | displayW≈displayH | overlay quase preenche; movimento mínimo (ok) |
| Imagem muito estreita/alta | aspecto extremo | overlay = menor lado; desliza no eixo maior; `max-h-[60vh]` evita estouro |
| `file` null com `open` | inconsistência do pai | render seguro (sem img); não quebrar |

## 10. Tech-Specific Notes (Next.js / React 19)

- `"use client"` obrigatório (Pointer Events, refs, object URL).
- **Não** usar `next/image` para o preview — é um object URL transitório; `<img>` cru com `object-contain`.
- Object URL: criar em `useEffect([file, open])`, `return () => URL.revokeObjectURL(url)`.
- Pointer drag:
  - `onPointerDown`: `e.currentTarget.setPointerCapture(e.pointerId)`; salvar offset (ponteiro − canto do overlay).
  - `onPointerMove`: se capturando, `newPos = pointer − offset`; clamp `[0, displaySize − side]`; setState.
  - `onPointerUp`/`onPointerCancel`: `releasePointerCapture`.
  - Stage com `touch-none` (Tailwind `touch-none`) p/ evitar scroll/gesto do browser durante drag em mobile.
- Posição dinâmica do overlay via `style={{ left, top, width, height }}` — exceção justificada ao "no inline styles" (valores computados em runtime).
- Função pura `displayCropToNatural(overlay, display, natural): CropRect` isolada no mesmo arquivo (ou em `../lib/imageToDataUrl` se preferir colocar junto das utils — porém spec da TASK-01 está fechada; manter no componente ou em util novo). Recomendado: util pequena exportada do próprio componente p/ teste.
- Estados: `useState` para `overlay`, `loading`, `error`, `dims` (display+natural). `useRef` para `<img>` e stage.

## 11. Files to Create/Modify

```
src/features/profile/components/
├── AvatarCropModal.tsx              (novo)
├── __tests__/AvatarCropModal.test.tsx (novo — jsdom)
└── index.ts                          (export AvatarCropModal)
```

## 12. Acceptance Criteria (UI)

- [ ] Modal abre/fecha com animação nativa; Escape/backdrop/Cancelar → `onCancel`.
- [ ] Overlay quadrado visível e arrastável por mouse e toque, restrito aos limites.
- [ ] "Salvar Foto" disabled até img carregar; loading com spinner; sucesso → `onConfirm(dataUrl)`.
- [ ] Erro de compressão/carregamento exibido inline (`role="alert"`), modal permanece.
- [ ] Footer responsivo (empilha no mobile); touch targets adequados.
- [ ] `displayCropToNatural` coberta por testes; render/cancel/confirm-sucesso/confirm-erro testados.
- [ ] typecheck/lint/test verdes; sem nova dependência; TS strict.
