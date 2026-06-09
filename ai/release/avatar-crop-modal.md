# RELEASE PLAN — PRD-09: Modal de Recorte de Avatar

## 1. Release summary

Adiciona modal interativo de recorte (crop 1:1 arrastável) ao fluxo de upload de avatar nas duas telas de perfil. Substitui o center-crop automático por escolha manual da área antes de salvar. Mantém persistência base64 no doc Firestore do usuário (≤700KB, 256px). **Mudança 100% client-side; frontend-only.**

Tarefas entregues:
- **TASK-01** — `imageToDataUrl.ts`: `clampCropRect`, `cropRectToCompressedDataUrl`, refactor `drawAndCompress`; suite de testes corrigida (`scaledDimensions`→`squareCrop`).
- **TASK-02** — `AvatarCropModal.tsx`: modal com overlay arrastável (Pointer Events), conversão display→natural, loading/erro/empty.
- **TASK-03** — Integração em `EditProfileForm` **e** `ProfileHub` (escopo estendido); fix de duplo-envio (await `onConfirm` + `isPending` guard); fix de crash pré-existente (`FormLabel`→`Label`).

Arquivos:
```
src/features/profile/lib/imageToDataUrl.ts            (M)
src/features/profile/lib/__tests__/imageToDataUrl.test.ts (M)
src/features/profile/components/AvatarCropModal.tsx   (新)
src/features/profile/components/__tests__/AvatarCropModal.test.tsx (新)
src/features/profile/components/__tests__/EditProfileForm.test.tsx (新)
src/features/profile/components/__tests__/ProfileHub.test.tsx (新)
src/features/profile/components/EditProfileForm.tsx   (M)
src/features/profile/components/ProfileHub.tsx        (M)
src/features/profile/components/index.ts              (M)
```

## 2. Deployment prerequisites

- Nenhuma nova dependência npm.
- Nenhuma nova env var.
- Nenhuma mudança em Firestore Rules, indexes, Functions ou Route Handlers.
- Deploy padrão: Firebase App Hosting (`deploy:hosting`) — SSR, sem passos extras.

## 3. Data and migration considerations

- **Sem migração.** Contrato de persistência inalterado: `updateProfile.mutateAsync({ avatarUrl })` grava data URL base64 como antes.
- Avatares já salvos continuam válidos (mesmo formato).
- Sem backfill. Sem ordenação de deploy.

## 4. Rollout strategy

**Release direto** (sem feature flag). Justificativa:
- Mudança isolada em 2 componentes de UI + 1 util; sem impacto em backend/dados.
- Degradação graciosa: em falha do canvas/imagem, o modal exibe erro inline e não salva — não corrompe estado.
- Build de produção verde; suite completa 1845/1845.

Não requer rollout faseado nem migration-first.

## 5. Monitoring and validation

- **Pré-deploy (manual, obrigatório)**: smoke test em browser real, especialmente **iOS Safari** — drag de toque do overlay (`setPointerCapture`), pois não é cobrível em jsdom.
  - Selecionar imagem (paisagem, retrato, ~quadrada) → arrastar → Salvar → avatar atualiza.
  - Cancelar / Escape / backdrop → fecha sem salvar.
  - Imagem >10MB → toast de rejeição.
- **Pós-deploy**: observar relatos de falha ao salvar foto; conferir que o tamanho do doc do usuário permanece <1MB (teto 700KB mantido).

## 6. Risks

| Risco | Sev | Mitigação |
|---|---|---|
| Drag de toque iOS Safari não testado em CI | Média | Smoke test manual obrigatório pré-deploy; `setPointerCapture` + `touch-none` aplicados |
| `box-shadow`/ring pouco visível sobre fotos muito claras | Baixa | `ring-white` + `outline-black/40`; validar no smoke test |
| Conversão display→natural incorreta em layout extremo | Baixa | `clampCropRect` (lib) é rede de segurança; coberta por testes |
| `fileToCompressedDataUrl` agora órfã em produção | Baixa | Mantida exportada; sem efeito em runtime; candidata a limpeza futura |

## 7. Rollback considerations

- **Rollback trivial**: reverter o deploy de hosting para a release anterior (App Hosting). Sem dados/schema afetados → rollback sem efeito colateral.
- Nenhuma escrita irreversível introduzida.
- Avatares salvos durante a vigência permanecem válidos após rollback (mesmo formato base64).

## 8. Release checklist

- [x] `tsc --noEmit` = 0
- [x] `npm run lint` = 0
- [x] `vitest run` = 1845/1845
- [x] `next build` = 0
- [ ] Smoke test manual em **iOS Safari** (drag de toque) — **bloqueante**
- [ ] Smoke test manual em Chrome/Android (drag de mouse + toque)
- [ ] Verificar visual do dim/ring sobre foto clara e escura
- [ ] Commit + PR na branch `feat/prd-06-07-08-perfil-admin-notif`
- [ ] `deploy:hosting` após merge
- [ ] (Opcional) remover `fileToCompressedDataUrl` se confirmada órfã
