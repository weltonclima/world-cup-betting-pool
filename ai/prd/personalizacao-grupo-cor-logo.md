# PRD — Personalização do grupo: cor primária (por tema) e logo

## 1. Resumo da feature
Permitir que o `group_admin` personalize o próprio grupo (pool) com:
1. **Cor primária por tema** — duas cores (uma para o tema claro, outra para o
   escuro), aplicadas visualmente nas telas do grupo (substituindo o `--primary`
   padrão do app enquanto o usuário navega dentro daquele pool).
2. **Logo** — campo novo e distinto da foto do grupo já existente (`photoBase64`),
   com validação de tipo/tamanho e um **editor de corte** (reaproveitando o
   componente já existente `AvatarCropModal`).

Escopo confirmado com o usuário: (a) cor **propaga visualmente** pelas telas do
grupo (não é só um selo decorativo); (b) logo é **campo novo** (`logoBase64`),
coexistindo com `photoBase64`.

## 2. Escopo consolidado
- Dois novos campos de cor no pool: `primaryColorLight` e `primaryColorDark`
  (hex `#RRGGBB`), editáveis só pelo `group_admin`/`super_admin` do próprio grupo.
- Mecanismo de propagação: como **não existe hoje nenhum mecanismo de "tema por
  pool"**, é preciso criar um Provider/componente que injete a cor do pool como
  CSS custom property (`--primary` ou uma var dedicada, ex. `--pool-primary`)
  escopada às telas do grupo, respeitando o tema claro/escuro atual do usuário
  (`next-themes`).
- Novo campo `logoBase64` no pool — reaproveita 100% a infraestrutura existente
  de upload/crop/compressão (`imageToDataUrl.ts`, `AvatarCropModal.tsx`), com
  validação de tipo (mimetype) e tamanho antes do crop.
- Editor de corte: reusar `AvatarCropModal` (recorte quadrado 1:1 via canvas,
  sem libs externas) — já é genérico (`File` → dataURL), só adaptando textos/label
  e o teto de compressão para o caso de logo.

## 3. Entendimento do sistema relevante
- **Infra de imagem (100% reaproveitável):** `src/features/profile/lib/imageToDataUrl.ts`
  — `AvatarImageError`, `validateImageInput` (mimetype `image/*` + teto de 10MB de
  entrada), `CropRect`/`squareCrop`/`clampCropRect`, `cropRectToCompressedDataUrl`
  (comprime tentando qualidades decrescentes até caber no teto de bytes, saída
  limitada a 256px). `src/features/profile/components/AvatarCropModal.tsx` — modal
  controlado (`open`, `file`, `onConfirm`, `onCancel`), drag-only (sem zoom),
  canvas nativo. Único consumidor hoje: `EditProfileForm.tsx` (avatar do usuário).
- **Foto do grupo (existente, sem crop manual):** `GroupSettingsForm.tsx`
  (`onPickPhoto`) usa `fileToCompressedDataUrl` direto — recorte central
  automático, sem modal. É o precedente de "upload de imagem de pool", mas
  **sem** editor de corte manual — a nova feature de logo introduz isso.
- **Schema do pool:** `poolSchema`/`poolEditSchema`/`poolInputSchema`
  (`src/schemas/pools.ts`), `.strict()`, campos aditivos opcionais (padrão já
  usado por `splitPhaseRanking`/`ignoreOvertimeGoals`). `MAX_POOL_PHOTO_BASE64_LENGTH`
  = 700_000 chars (~512KB binário, margem do teto de 1MB do doc Firestore).
- **Rota de settings:** `PATCH /api/group/settings` — `settingsSchema` local
  espelha os campos editáveis; monta patch campo a campo (`!== undefined`);
  padrão de disparo condicional de efeito colateral já existe (recalc ao mudar
  `ignoreOvertimeGoals`).
- **Cor/tema:** só existe tema **global** claro/escuro via `next-themes`
  (`ThemeSelector`, `ThemeSync`, `users/{uid}.themePreference`). `globals.css`
  define `--primary`/`--primary-foreground` fixos em oklch por tema. **Nenhum**
  mecanismo de cor por pool/tenant existe — este é o principal território novo
  da feature.

## 4. Análise de impacto técnico
- **Schema (`pools.ts`):** `logoBase64?`, `primaryColorLight?`, `primaryColorDark?`
  aditivos em `poolSchema` + `poolEditSchema`. Nova constante de teto de bytes
  para o logo (pode reusar `MAX_POOL_PHOTO_BASE64_LENGTH` ou ter a própria).
  Validação de formato hex nas cores via regex Zod.
- **Rota (`route.ts`):** estender `settingsSchema` + montagem do patch com os 3
  campos novos. Validar tipo/tamanho do logo **no client** (como hoje) — o
  `.max()` de chars no Zod é a defesa server-side (mesmo padrão de `photoBase64`).
- **Form (`GroupSettingsForm.tsx`):** nova seção "Logo" (upload → `AvatarCropModal`
  → `cropRectToCompressedDataUrl`) + novo bloco de 2 color pickers (claro/escuro),
  com preview.
- **Propagação de cor (NOVO mecanismo, maior risco/esforço):**
  - Precisa de um componente/Provider que, dentro do escopo das telas do grupo
    (provavelmente toda a área autenticada do participante, já que cada usuário
    pertence a um pool), injete a cor do tema ativo do pool como CSS var,
    sobrescrevendo `--primary` (ou uma var derivada usada pelos componentes de
    UI/Tailwind).
  - Precisa reagir à troca de tema claro/escuro em tempo real (usar a cor certa).
  - Fallback: pool sem cor definida → usa o `--primary` padrão do app (zero
    regressão para pools que não personalizarem).
  - Contraste/acessibilidade: fora do escopo mínimo validar contraste
    automaticamente (anotar como risco, não bloqueia o MVP).
- **Onde a cor se aplica:** precisa decidir se é a área autenticada inteira do
  usuário (mais simples, pois hoje não há "layout por pool" separado) ou só
  componentes específicos (mais trabalho de mapear). Recomendação: aplicar
  globalmente para o usuário logado (via CSS var no root do layout autenticado),
  já que cada usuário pertence a exatamente um pool.

## 5. Riscos
- **Mecanismo de tema por pool é novo do zero** — maior risco/esforço da feature.
  Precisa não regredir o tema claro/escuro existente (`next-themes`) nem quebrar
  componentes que hardcodam classes Tailwind de cor (`bg-primary` etc. usam a CSS
  var, então devem funcionar; verificar se algum componente usa cor fixa fora da
  var).
- **Contraste ruim:** admin escolhe uma cor com baixo contraste sobre
  `--primary-foreground` → texto ilegível em botões. Fora do MVP (anotar como
  gap), mas é um risco de UX real.
- **Validação de tipo de arquivo do logo:** aceitar SVG traz risco de XSS (SVG
  pode conter script); recomendação técnica: restringir a raster (`image/png`,
  `image/jpeg`, `image/webp`), excluindo `image/svg+xml`, mesmo que
  `validateImageInput` hoje aceite qualquer `image/*`.
- **Tamanho do documento Firestore:** logo + foto do grupo somados não podem
  ultrapassar o teto de 1MB do doc `pools/{id}`. Precisa recalibrar o teto de
  bytes de cada campo (não pode simplesmente dobrar o limite atual).
- **Retrocompatibilidade:** pools existentes sem `logoBase64`/cores continuam
  válidos (aditivo); telas devem cair no fallback padrão.

## 6. Ambiguidades e lacunas
1. **Onde exatamente a cor se aplica** (toda a área autenticada vs. componentes
   específicos) — recomendação registrada (global via CSS var), a confirmar no
   plano/spec.
2. **Formato de arquivo aceito para o logo** — recomendação: PNG/JPEG/WebP,
   excluir SVG (risco XSS). A confirmar no spec.
3. **Validação de contraste** — fora do MVP; anotar como follow-up.
4. **Teto de bytes do logo** — reusar o mesmo teto da foto do grupo ou um valor
   próprio menor (logo tende a ser mais simples que foto)? Decidir no spec,
   respeitando o limite de 1MB do doc Firestore somado à foto existente.

## 7. Recomendações para o planejamento
- Separar em tarefas independentes onde possível:
  1. **Logo com crop** (schema + route + form + reuso do `AvatarCropModal`) —
     menor risco, reaproveita infra existente quase inteira.
  2. **Cor primária (persistência)** — schema + route + form (2 color pickers).
  3. **Propagação visual da cor (tema por pool)** — a tarefa de maior risco/esforço,
     mecanismo novo do zero; depende da tarefa 2 (persistência) mas é
     independente da 1 (logo).
- TDD onde houver regra de negócio: validação de tipo/tamanho do logo, resolução
  da cor efetiva (fallback quando ausente, seleção por tema ativo).
- Sem migração; tudo aditivo.
