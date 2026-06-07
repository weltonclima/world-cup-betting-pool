# SPEC — TASK-08 · Ajuste tela 02 (Aguardando aprovação)

> Origem: `ai/plan/aprovacao-usuarios.md` §3 TASK-08 · PRD: `ai/prd/aprovacao-usuarios.md` (A6) · Mock fonte-de-verdade: `docs/prd-01-2/02-aguardando-aprovacao.png`.
> Tipo: UI pequena · SP: 1 · Criticality: medium · Risk: low · TDD: no · Screen: yes (web).

## 1. Objetivo

Alinhar `PendingApprovalScreen` ao mock 02 e à decisão A6:
1. **Adicionar** botão **Sair** (logout → `/login`) abaixo do botão "Atualizar status".
2. **Remover** a frase "Você receberá um email quando sua conta for liberada" (A6 — não há envio de email de aprovação).
3. **Manter** a tela sem AppShell/BottomTabBar e o layout claro (`auth-light`) já existentes (constraint: tela 02 não tem nav).

Fora de escopo: qualquer mudança em roteamento por status, AuthGuard, AuthLayout, ou no comportamento de "Atualizar status".

## 2. Arquivo único a alterar

- `src/components/layout/PendingApprovalScreen.tsx` (componente `"use client"`).

Nenhum outro arquivo muda. A rota `src/app/(auth)/pending/page.tsx` apenas renderiza o componente — não tocar.

## 3. Contexto de roteamento (load-bearing — justifica o redirect explícito)

> Diferença crítica em relação ao `BlockedScreen`: a `BlockedScreen` é renderizada **dentro** do `AuthGuard`/`AuthLayout`, que reagem à mudança de auth e cuidam do roteamento após `signOut`. Já a `/pending` vive no grupo `(auth)`, e o `(auth)/layout.tsx` **não** redireciona um usuário deslogado para fora de `/pending` (ele renderiza `children` quando `firebaseUser` é `null`). Logo, após o `signOut` o `firebaseUser` vira `null` mas a tela 02 permaneceria visível.
>
> **Conclusão:** o handler de logout DEVE fazer `router.push("/login")` explícito após o `signOut` bem-sucedido. (TASK-08 já especifica "→ `/login`".)

## 4. Mudanças de implementação

### 4.1 Imports

- Adicionar `LogOut` ao import de `lucide-react` (já importa `Clock`, `LoaderCircle`).
- Adicionar `import { firebaseAuth } from "@/firebase";` (mesmo path usado por `BlockedScreen.tsx`).
- `useRouter`, `toast`, `Button`, `useState` já estão importados — reusar.

### 4.2 Estado

Adicionar um estado de "saindo" para desabilitar o botão e refletir `aria-busy` durante o logout, espelhando o padrão de `refreshing`:

```ts
const [signingOut, setSigningOut] = useState(false);
```

### 4.3 Handler de logout (espelha `BlockedScreen.handleSignOut`, + redirect explícito)

```ts
/** Efetua o logout via Firebase Auth e retorna à tela de login. */
async function handleSignOut() {
  setSigningOut(true);
  try {
    await firebaseAuth.signOut();
    router.push("/login");
  } catch {
    toast.error("Não foi possível sair. Tente novamente.");
    setSigningOut(false);
  }
}
```

Notas:
- Em sucesso, **não** resetar `signingOut` (a navegação desmonta a tela; manter o botão desabilitado evita duplo clique durante o redirect).
- Em falha, resetar `signingOut` e exibir toast (string idêntica à de `BlockedScreen` para consistência: `"Não foi possível sair. Tente novamente."`).
- Mensagens de erro **não** são traduzidas em camada de serviço — a UI mapeia (padrão do projeto).

### 4.4 Remoção da promessa de email (A6)

Remover por completo o terceiro parágrafo do bloco de mensagens:

```tsx
<p className="text-sm text-muted-foreground">
  Você receberá um email quando sua conta for liberada.
</p>
```

Manter os dois parágrafos anteriores ("Cadastro realizado!" e "Seu acesso está aguardando aprovação do administrador."). O `<div className="flex max-w-sm flex-col gap-2">` permanece.

### 4.5 Botão "Sair" (abaixo de "Atualizar status")

Inserir **logo após** o `<Button>` de "Atualizar status", dentro do mesmo container raiz, agrupando as duas ações na base. Variante e cor:

- Mock 02: "Sair" é um botão **secundário/neutro** (fundo claro, sem destaque verde nem vermelho destrutivo). Diferente do `BlockedScreen` (lá é `variant="destructive"` porque o contexto é bloqueio). Aqui o logout é uma ação benigna → usar `variant="ghost"` (ou `outline` neutro), **sem** as classes `border-primary text-primary`.

Estrutura recomendada (envolver os dois botões para espaçamento consistente):

```tsx
{/* Ações — base: releitura do perfil + logout */}
<div className="flex flex-col gap-3">
  <Button
    variant="outline"
    onClick={() => void handleRefresh()}
    disabled={refreshing || signingOut}
    aria-busy={refreshing}
    className="h-11 w-full border-primary text-primary hover:bg-primary/10 hover:text-primary"
  >
    {refreshing ? (
      <LoaderCircle
        size={16}
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
      />
    ) : null}
    {refreshing ? "Atualizando..." : "Atualizar status"}
  </Button>

  <Button
    variant="ghost"
    onClick={() => void handleSignOut()}
    disabled={refreshing || signingOut}
    aria-busy={signingOut}
    className="h-11 w-full"
  >
    {signingOut ? (
      <LoaderCircle
        size={16}
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
      />
    ) : (
      <LogOut size={16} aria-hidden="true" />
    )}
    {signingOut ? "Saindo..." : "Sair"}
  </Button>
</div>
```

- Ambos os botões ganham `disabled={refreshing || signingOut}` para evitar ações concorrentes (atualizar enquanto sai / sair enquanto atualiza).
- O ícone `LogOut` segue o padrão do `BlockedScreen` (`size={16} aria-hidden="true"`).
- A largura full + `h-11` mantém paridade visual com o botão existente.

### 4.6 JSDoc do componente

Atualizar o bloco de comentário do topo: remover a afirmação "Sem botão 'Sair' (segue o mock)." e registrar que agora há logout (`firebaseAuth.signOut` → `router.push("/login")`), espelhando `BlockedScreen`. Atualizar a referência de mock para `docs/prd-01-2/02-aguardando-aprovacao.png`.

## 5. Acessibilidade

- Cada `<Button>` é focável por teclado (Shadcn `Button` já é `<button>`); manter ordem de foco natural: "Atualizar status" → "Sair".
- `aria-busy` reflete o estado de carregamento de **cada** botão individualmente (`refreshing` no primeiro, `signingOut` no segundo).
- Ícones decorativos (`LoaderCircle`, `LogOut`) com `aria-hidden="true"` (já é o padrão).
- O texto visível do botão ("Sair") serve de nome acessível — **não** adicionar `aria-label` redundante.
- `disabled` durante operações em voo previne disparo duplicado e remove o botão do fluxo de interação.
- `motion-reduce:animate-none` no spinner preservado (respeita `prefers-reduced-motion`).
- Container raiz mantém `role="main"` + `aria-label="Aguardando aprovação"`.

## 6. Restrições do projeto (obrigatórias)

- TypeScript strict, **sem `any`**.
- **Sem estilos inline** — somente Tailwind (classes utilitárias) / tokens do tema. Reusar tokens existentes (`text-primary`, `bg-muted`, etc.).
- **Sem AppShell / BottomTabBar** — a tela permanece standalone no grupo `(auth)` (constraint: tela 02 não tem nav).
- Manter a classe `auth-light` no container raiz (dá `--primary` verde aos controles com contraste AA).
- Logout reusa `firebaseAuth.signOut` (mesmo serviço e import de `BlockedScreen`) — sem novo serviço.

## 7. Critérios de aceite

1. A frase "Você receberá um email quando sua conta for liberada." não existe mais no componente.
2. Existe um botão "Sair" visível abaixo de "Atualizar status".
3. Clicar em "Sair" chama `firebaseAuth.signOut()` e, em sucesso, navega para `/login`.
4. Em falha de logout, exibe toast `"Não foi possível sair. Tente novamente."` e o botão volta a ficar habilitado.
5. Durante o logout, o botão "Sair" fica desabilitado, com spinner e `aria-busy`; "Atualizar status" também fica desabilitado (e vice-versa).
6. O comportamento de "Atualizar status" (refresh + decisão via `refreshTick`/efeito) permanece inalterado.
7. A tela continua sem AppShell/nav e com layout claro preservado.
8. `rtk tsc` e `rtk lint` sem erros novos no arquivo.

## 8. Verificação manual

- Logar com um usuário `status: pending` → cair em `/pending`.
- Confirmar ausência da frase de email e presença do botão "Sair".
- Clicar "Sair" → redireciona para `/login`; usuário deslogado (não volta a `/pending` ao recarregar).
- Navegação por teclado: Tab alcança ambos os botões na ordem correta; Enter/Espaço acionam.
