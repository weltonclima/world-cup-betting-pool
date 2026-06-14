# DIAGNOSIS — Perfil → /login → /home (ping-pong de auth)

## 1. Bug summary
- **Reportado:** clicar na aba Perfil dentro do app redireciona para `/login` e logo volta para `/home` (flash visível de pingue-pongue).
- **Repro:** navegação client-side (sem reload) + `npm run dev` local.
- **Real:** dois redirects encadeados disparam sozinhos — `AuthGuard → push(/login)` seguido de `AuthLayout → push(/home)`.

## 2. Root cause
**`onAuthStateChanged` (em `AuthProvider`) não aguarda `authPersistenceReady`, então atua sobre um `null` TRANSIENTE emitido antes da restauração da sessão persistida.**

Cadeia exata:
1. `client.ts:78` — `setPersistence(firebaseAuth, browserLocalPersistence)` é **assíncrono**. Até resolver, a instância de Auth usa a persistência **default (in-memory)**, sem usuário restaurado.
2. `AuthProvider.tsx:125` — listener registra **sem** `await authPersistenceReady`. Na inicialização, dispara com `uid: null` ANTES da troca de persistência + restauração do user persistido.
3. `AuthProvider.tsx:146-153` — ramo `if (!nextUser)` trata esse null como "deslogado": `setProfile(null); setLoading(false)`. **Aqui mora o gatilho**: `loading` cai pra `false` num estado falso-negativo.
4. `AuthGuard.tsx:43` — vê `{loading:false, hasUser:false}` → `push("/login")` (perna 1).
5. Um tick depois, persistência resolve, `onAuthStateChanged` re-emite com `uid` válido → `AuthLayout.tsx:45` vê `status:'approved'` → `push("/home")` (perna 2).

O comentário em `client.ts:60-65` está **incorreto**: afirma que o caminho de leitura lê o mesmo `FirebaseUser` independente da persistência. Falso na janela pré-`setPersistence` — a restauração só ocorre **após** a troca de persistência; antes disso o listener vê `null`.

### Evidência decisiva (`[AUTHDBG]`, ruído filtrado)
```
AuthProvider effect MOUNT                         ← UMA vez, sem UNMOUNT
onAuthStateChanged {uid: null,    mounted: true}  ← null transiente (mesmo mount)
AuthGuard effect {loading:false, hasUser:false}
AuthGuard -> push(/login)                         ← perna 1
onAuthStateChanged {uid:'J0v...', mounted: true}  ← mesmo uid volta (não houve logout real)
AuthLayout approved -> push(/home) {path:'/login'}← perna 2
```
- `MOUNT` aparece **1× e nunca `UNMOUNT`** → provider **não remonta**. **Candidato B (remontagem) DESCARTADO.**
- `onAuthStateChanged` emite `null` → mesmo `uid` dentro do mesmo mount → **null transiente. Candidato A CONFIRMADO.**
- uid sempre o mesmo (`J0vZ3pHbP1V4md5EddihRM5k0kr2`) → não há logout real.

> Nota: no log local o ciclo repete N vezes porque o Fast Refresh (Turbopack HMR) re-avalia o módulo do firebase a cada rebuild da instrumentação, amplificando. Em produção/sem-HMR é **um** null transiente de init → **um** pingue-pongue — exatamente o sintoma reportado.

## 3. Affected code
- `src/firebase/client.ts:78-83` — `authPersistenceReady` (persistência assíncrona).
- `src/providers/AuthProvider.tsx:125-156` — listener não-gated; ramo `!nextUser` zera `loading` no null transiente.
- `src/components/layout/AuthGuard.tsx:43` — redirect `/login` em `!firebaseUser && !loading`.
- `src/app/(auth)/layout.tsx:45` — redirect `/home` em `firebaseUser && approved`.

## 4. Reproduction path
`init Auth (persistência default)` → `onAuthStateChanged(null)` → `setLoading(false)` → `AuthGuard push(/login)` → `setPersistence resolve` + restore → `onAuthStateChanged(user)` → `AuthLayout push(/home)`.

## 5. Blast radius
- Qualquer rota protegida no **primeiro paint** após carga fria/restauração: flash `/login` antes de assentar.
- Pior em navegação entre grupos `(app)`↔`(auth)` (prefetch re-roda guards no meio do restore).
- Mascara possível confusão com a divergência cookie `__session` 5 dias (TASK-02) — mas **é independente**; este é puro client-side.

## 6. Risk level
**Médio** — sem perda de dados nem logout real; é UX (flash) + risco de loop visível. Correção é pequena e localizada.

## 7. Recommended fix direction
Eliminar a ação sobre o null pré-restauração. Direção (NÃO implementar agora):
- **Gate na leitura:** no effect do `AuthProvider`, `await authPersistenceReady` ANTES de `onAuthStateChanged`, OU
- **Manter `loading=true`** até a persistência resolver — não deixar o ramo `!nextUser` baixar `loading` enquanto a restauração ainda não ocorreu (distinguir "ainda restaurando" de "deslogado de fato").
- Corrigir o comentário enganoso em `client.ts:60-65`.
- Manter fix mínimo e escopado; não tocar lógica de status/role.

## Instrumentação temporária a remover no FIX
Linhas `[AUTHDBG]` (`console.log`) em:
- `AuthProvider.tsx` (MOUNT/UNMOUNT + onAuthStateChanged)
- `AuthGuard.tsx` (effect + push)
- `(auth)/layout.tsx` (push approved)
