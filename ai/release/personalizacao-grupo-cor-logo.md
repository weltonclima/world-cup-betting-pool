# RELEASE PLAN — Personalização do grupo: cor primária e logo (por admin)

## 1. Resumo do release
Cada **admin de grupo** passa a personalizar a identidade visual do pool:
- **Logo** com upload validado (tipo/tamanho) e **editor de corte retangular**
  (proporção livre), compressão no client.
- **Cor primária por tema** (claro e escuro), que **se propaga visualmente** para
  as telas do grupo nos dois temas — sem flash na hidratação (SSR via cookie).
- **Seletor de cor completo**: picker nativo + **campo de HEX digitável** (`#RRGGBB`)
  + **paleta de atalho** (12 cores). O foreground do texto é escolhido por
  **contraste WCAG** (preto/branco) automaticamente.

Tarefas concluídas + follow-ups:
- **TASK-01** — logo do grupo (`logoBase64`) com validação de tipo (raster) e
  tamanho + `ImageCropModal` (corte retangular). Validação server-side por regex.
- **TASK-02** — persistência da cor por tema (`primaryColorLight/Dark`) + edição.
- **TASK-03** — propagação visual: rota as 8 classes `.*-theme` por
  `var(--pool-primary, verde)`; SSR sem flash (cookie `pool-primary` lido no
  layout de `(app)`); sync client em tempo real; foreground por contraste.
- **Follow-up (bug)** — estado "Concluído" na área de palpites seguia o verde
  semântico (`text-win`); passou a seguir a cor do pool (`text-primary`).
- **Follow-up (ajuste)** — destaques de palpite (classificados, melhores 3ºs,
  vencedor previsto) passam a seguir a cor do pool.
- **Follow-up (feature)** — entrada de HEX + paleta de cores no seletor.

## 2. Pré-requisitos de deploy
- Merge da branch `claude/resume-hdtif1` na `main`.
- Deploy padrão Firebase App Hosting (Cloud Run) — sem passos extras.
- **Nenhuma** variável de ambiente nova. **Nenhuma** feature flag global.

## 3. Considerações de dados e migração
- **Sem migração, sem backfill.** Todos os campos novos são **aditivos/opcionais**:
  - Pool: `logoBase64`, `primaryColorLight`, `primaryColorDark` (todos opcionais).
  - Payload `/api/rankings/pool`: `primaryColorLight`/`primaryColorDark` opcionais.
- **Cookie novo `pool-primary`** (não-httpOnly, formato `"lightHex|darkHex"`): setado
  no login (`/api/auth/session` POST), limpo no logout (DELETE) e refrescado ao mudar
  a cor. Ausente/inválido → fallback ao verde padrão (sem erro). Validado por
  `HEX_COLOR_REGEX` antes de virar CSS var (proteção contra CSS-injection).
- Pools antigos sem os campos continuam válidos (parse OK, telas no verde padrão).
- Limites: logo em base64 com teto (`MAX_POOL_LOGO_BASE64_LENGTH`, ~1MB doc
  Firestore); validação de bytes na compressão do client.

## 4. Estratégia de rollout
**Release direto.** A feature nasce **neutra**: sem cor/logo personalizados, as telas
ficam no verde padrão de sempre — zero impacto até um group_admin personalizar. Sem
flag global, rollout faseado ou migração-primeiro. Deploy padrão via merge → App
Hosting. Adoção controlada pelo próprio group_admin, por pool.

## 5. Monitoramento e validação
- Após deploy, confirmar que `/api/rankings/pool` responde com os campos de cor
  (aditivos) e que o cookie `pool-primary` é setado no login.
- Num pool de teste: definir cor (via paleta/hex/picker) e logo → verificar
  propagação nos dois temas (claro/escuro) nas telas do grupo, **sem flash** ao
  recarregar; conferir que o texto sobre a cor mantém contraste (preto/branco).
- Verificar que as páginas de auth (`/login`, `/cadastro`) seguem **estáticas**
  (cookie lido só no escopo `(app)`) e no verde de marca.
- Sem novas métricas obrigatórias.

## 6. Riscos
- **Baixo — timing do tema (SSR + next-themes):** a cor é injetada via cookie no
  layout de `(app)` antes da hidratação; o CSS escolhe light/dark por `.dark`.
  Mitigado por fallback ao verde e por `PoolThemeVars` não tocar na baseline do SSR
  durante o loading (evita flash). Coberto por testes.
- **Baixo — consistência cookie ↔ fetch:** o cookie dá a baseline; o
  `usePoolRanking` corrige em tempo real e refresca o cookie. Divergência transitória
  se resolve no primeiro fetch.
- **Baixo — verdes semânticos preservados:** acerto/erro (verde vs vermelho),
  sucesso e telas de auth **permanecem verdes por design** (não seguem o pool), para
  não quebrar a semântica win/loss caso a cor escolhida seja vermelha/laranja.
- **Baixo — tamanho do logo:** base64 no doc do pool tem teto; uploads grandes são
  comprimidos/validados no client e barrados no server por regex + `.max`.

## 7. Considerações de rollback
- **Simples:** reverter os commits da feature. Tudo é aditivo/opcional e sem
  migração — rollback só de código. Cookies `pool-primary` remanescentes são inócuos
  (ignorados sem o código de leitura) e expiram.
- Rollback parcial via produto: um group_admin pode limpar a cor/logo a qualquer
  momento → telas voltam ao verde padrão.

## 8. Checklist de release
- [x] Typecheck OK (`tsc --noEmit`)
- [x] Build de produção OK (`next build`, 61/61 páginas; auth estáticas, `(app)` dinâmicas)
- [x] Suíte completa: **3630/3630** testes passando
- [x] Review TASK-03 = approved with adjustments (H1/H2/L1/M1 corrigidos + pass adversarial opus)
- [ ] Merge `claude/resume-hdtif1` → `main`
- [ ] Deploy App Hosting (pipeline padrão)
- [ ] Smoke test: login seta `pool-primary`; `/api/rankings/pool` retorna cores
- [ ] Pool de teste: definir cor+logo → conferir propagação nos 2 temas sem flash

## Follow-ups (não bloqueiam)
- Preview ao vivo da cor aplicada numa tela de exemplo dentro das Configurações.
- (Opcional) trazer mais indicadores do "Bucket 3" para a cor do pool, caso se
  decida abrir mão da semântica win/loss em cores não-verdes.
