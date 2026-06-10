# PRD — Persistência de Sessão + Login Biométrico/Facial

> Origem: pedido direto — "a parte de autenticação precisa persistir, precisamos fazer uma análise de como está no projeto. Adicionar no login o acesso ao sistema com biometria/facial."
> Fundação de auth já entregue em PRD-01 (`ai/prd/auth.md`). Esta PRD constrói sobre `AuthProvider`, `services/auth.ts`, Route Handler `/api/auth/session` e `middleware.ts` — **não os reconstrói**.

---

## 1. Resumo da feature

Duas frentes acopladas pela camada de autenticação:

1. **Persistência de sessão (análise + correção).** Auditar como a sessão persiste hoje e fechar a lacuna identificada: o estado do Firebase Auth no client persiste indefinidamente (`browserLocalPersistence` padrão), mas o session cookie `__session` server/edge expira **fixo em 5 dias sem renovação**. Resultado: após 5 dias o usuário continua "logado" no client, porém rotas protegidas por servidor (`/admin/*` e APIs que exigem cookie) o tratam como deslogado — uma divergência client↔server que aparece como logout inesperado em superfícies server-side.

2. **Login biométrico/facial.** Permitir entrar no sistema usando o autenticador de plataforma do dispositivo (digital/face Android, Face ID/Touch ID iOS, Windows Hello no desktop) em vez de digitar e-mail+senha a cada acesso. Em stack **web** isso é **WebAuthn / Passkeys** — não há API nativa de "reconhecimento facial"; o "facial" é o que o autenticador da plataforma oferecer, abstraído pelo browser (a aplicação nunca vê dados biométricos crus).

### Plataformas-alvo (prioridade)
- **PRIORIDADE — celulares:** **Android** (Chrome/WebView, biometria + face) e **iOS** (Safari 16+, Face ID/Touch ID) acessando o app **pelo navegador mobile**. A biometria/facial PRECISA funcionar nos dois.
- **Secundário/opcional — desktop:** funciona via WebAuthn (Windows Hello etc.) onde disponível, mas **não é requisito** — nem todo computador tem autenticador. Sem biometria no desktop, o fallback e-mail+senha cobre.
- **Premissa de arquitetura:** continua sendo o **app web Next.js acessado pelo navegador do celular** (e, opcionalmente, instalado como PWA). **NÃO** é app nativo Android/iOS (a stack não tem React Native/Expo; nativo seria reescrita fora de escopo). WebAuthn em Safari iOS / Chrome Android cobre a biometria do device sem app nativo.

---

## 2. Escopo consolidado

### Dentro do escopo

**Frente A — Persistência**
- Documentar o modelo de persistência atual (client vs server) como achado de auditoria.
- Definir e aplicar política de persistência client explícita (`setPersistence`) em vez de depender do default implícito.
- Resolver o mismatch de validade: alinhar/renovar o cookie `__session` para que a sessão server-side não expire antes da sessão client (renovação deslizante do cookie e/ou re-mint a partir de token fresco).
- Comportamento de sessão consistente entre client (`AuthProvider`), edge (`middleware.ts`) e APIs.

**Frente B — Login biométrico (WebAuthn/Passkeys)**
- **Cadastro de credencial (enrollment):** usuário já autenticado (e-mail+senha) registra um passkey no dispositivo; a chave pública + `credentialId` são gravadas server-side (Admin SDK) vinculadas ao `uid`. Ponto de partida provável: tela de configurações de perfil/segurança.
- **Login por biometria:** na tela de login, se houver credencial registrada, oferecer "Entrar com biometria" → `navigator.credentials.get()` → assertion verificada no servidor → emissão de **Firebase custom token** (`adminAuth.createCustomToken(uid)`) → client faz `signInWithCustomToken` → fluxo de session cookie já existente segue igual.
- **Gestão da credencial:** ver/remover passkeys registrados (revogação).
- Detecção de disponibilidade (`isUserVerifyingPlatformAuthenticatorAvailable`) para mostrar/ocultar a opção.
- Fallback sempre disponível para e-mail+senha.

### Fora do escopo
- Reconhecimento facial proprietário/custom (câmera + modelo próprio). Não é WebAuthn e não é desejável (privacidade, manutenção). "Facial" = autenticador de plataforma.
- 2FA/MFA por SMS/TOTP, login social (Google/Apple).
- Transformar o app em PWA instalável (recomendável para UX de passkey, mas tratado como concern separado, não requisito desta PRD).
- Reescrever PRD-01.

---

## 3. Entendimento do sistema relevante

- **Persistência client:** `src/firebase/client.ts` faz `getAuth(firebaseApp)` sem `setPersistence` → default web = `browserLocalPersistence` (IndexedDB), sobrevive a reload/fechar aba. `AuthProvider` reidrata via `onAuthStateChanged`.
- **Sessão server/edge:** `POST /api/auth/session` troca ID token por session cookie `__session` (httpOnly, `secure` em prod, `sameSite=lax`, `maxAge=5 dias`). `middleware.ts` verifica o cookie no edge com `jose` para `/admin/*`. `DELETE` limpa no logout. Criação do cookie é **best-effort** (`services/auth.ts`) — não derruba o login client se falhar.
- **`__session` é o único cookie repassado pelo CDN do App Hosting** ao backend — nome fixo, compartilhado edge+node (`@/server/auth/sessionCookie`).
- **Admin SDK** já disponível em Route Handlers (Node runtime) → `createCustomToken`, `verifyIdToken`, `createSessionCookie` já em uso. Base pronta para o bridge WebAuthn→custom token.
- **Defense-in-depth (4 camadas):** middleware edge → API Routes (re-check `status==="approved"`) → Firestore Rules → client guards. Login biométrico não pode furar essas camadas: precisa terminar num usuário Firebase Auth real + perfil `approved`.
- **Stack:** Next.js 15 / React 19, web. `firebase` 12.14, `firebase-admin` 13.10, `jose` presente. **Sem lib WebAuthn** (ex.: `@simplewebauthn/{server,browser}`) instalada. Sem PWA manifest.
- **WebAuthn em mobile (alvo prioritário):** **iOS Safari 16+** suporta passkeys com Face ID/Touch ID; **Android Chrome** suporta com biometria do device. Ambos exigem **HTTPS** (ok em prod App Hosting; dev usa `localhost`, tratado como origem segura) e **gesto do usuário** para acionar `navigator.credentials`. O `rpId` precisa casar exatamente com o domínio servido no celular — passkey registrado num domínio não funciona em outro.
- **Deploy:** Firebase App Hosting (Cloud Run); pipeline de `functions` existe (`deploy:functions`).

## 4. Análise de impacto técnico

- **Módulos afetados:**
  - `src/firebase/client.ts` — `setPersistence` explícito.
  - `src/services/auth.ts` — novo caminho `signInWithCustomToken`; enrollment/assertion helpers; possível renovação de cookie.
  - `src/app/api/auth/session/route.ts` — renovação deslizante / re-mint do cookie.
  - **Novos Route Handlers** para WebAuthn: gerar opções de registro/autenticação (challenge), verificar attestation/assertion, emitir custom token. (challenge precisa de armazenamento de curta duração — Firestore TTL ou cookie assinado.)
  - `middleware.ts` — possivelmente ajuste se a estratégia de renovação mudar a leitura do cookie.
  - `src/features/auth/LoginForm.tsx` + `(auth)/login` — botão "Entrar com biometria".
  - `src/features/profile/*` ou `(app)/profile/configuracoes` — tela de gerenciar passkeys.
- **Contratos/dados:**
  - **Nova coleção/subcoleção** de credenciais WebAuthn (`credentialId`, `publicKey`, `counter`, `transports`, `deviceLabel`, `createdAt`, `uid`) — novo schema Zod + tipos derivados + **Firestore Security Rules** (cliente NÃO escreve direto; só Admin SDK, como `predictions`).
  - Novo schema para payloads dos endpoints WebAuthn.
- **Integrações:** WebAuthn é API do browser (sem terceiro). Verificação de assinatura exige biblioteca server (`@simplewebauthn/server` ou equivalente) — nova dependência. `rpId`/`origin` dependem do domínio de produção (App Hosting) e do `localhost` em dev.
- **Persistência:** sem migração de dados existente; só adição da coleção de credenciais. Mudança de validade do cookie é runtime, sem migração.
- **Performance/consistência:** challenge WebAuthn precisa de janela curta + uso único (anti-replay). `counter` da credencial deve aumentar monotonicamente (detecção de clonagem).

## 5. Riscos

- **Segurança (crítico):** WebAuthn mal verificado = bypass de auth. Verificação de assinatura, validação de `challenge` (uso único, expiração), `origin`/`rpId` e `counter` precisam estar corretos. Custom token só pode ser emitido após assertion válida E perfil `approved` (manter as 4 camadas).
- **Mismatch de persistência (médio):** a correção do cookie deslizante não pode reduzir segurança (renovar exige token válido; não estender cegamente). Risco de sessão "imortal" se renovada sem revalidar.
- **`rpId`/origin (médio):** passkeys são atrelados ao domínio. Divergência dev/prod ou mudança de domínio invalida credenciais registradas. Subdomínios do App Hosting precisam de atenção.
- **Compatibilidade (médio):** nem todo dispositivo/browser tem autenticador de plataforma. Fallback e-mail+senha obrigatório; UI condicional à detecção.
- **Mobile-specific (médio, alvo prioritário):** iOS Safari exige gesto do usuário + HTTPS e tem histórico de quirks em WebAuthn (ex.: comportamento em WebView/in-app browsers de redes sociais difere do Safari). Android Chrome é mais permissivo, mas WebViews também variam. `rpId`/origin devem casar com o domínio acessado no celular. Teste obrigatório em device real iOS + Android (não só desktop emulado).
- **PWA (médio):** sem manifest, o app abre como aba de navegador no celular. Passkeys funcionam assim mesmo, mas a experiência "app instalado" (e a permanência de sessão percebida) melhora com PWA. Avaliar se entra no escopo.
- **Recuperação (médio):** usuário que registrou só biometria e troca/perde dispositivo precisa de caminho de recuperação (e-mail+senha continua válido — manter).
- **Dependência nova:** lib WebAuthn server adiciona superfície; escolher madura e auditada.

## 6. Ambiguidades e lacunas

- **A1 — Onde fica o enrollment?** Configurações de perfil (provável) e/ou oferta pós-login. Definir no `/plan`.
- **A2 — Política de validade do cookie:** renovação deslizante a cada request? Re-mint periódico no client? Qual TTL alvo (manter 5d, aumentar)? Precisa decisão.
- **A3 — Persistência client:** manter `local` (default atual) explícito, ou oferecer toggle "manter conectado" (`local` vs `session`)? O pedido diz "precisa persistir" → provavelmente `local` fixo.
- **A4 — Biblioteca WebAuthn:** `@simplewebauthn` (padrão de mercado) vs implementação manual. Recomendado `@simplewebauthn`. Confirmar.
- **A5 — Armazenamento do challenge:** Firestore com TTL vs cookie assinado httpOnly de curta duração. Definir no `/plan`.
- **A6 — Múltiplos passkeys por usuário:** permitir N dispositivos (recomendado) ou 1? Assumir N.
- **A7 — Naming do "facial": RESOLVIDO.** Confirmado pelo usuário: biometria do dispositivo via WebAuthn (Face ID/Touch ID/Windows Hello/digital). NÃO é reconhecimento facial custom com câmera.
- **A8 — PWA:** passkey funciona em browser puro no celular, mas instalação melhora UX/persistência. Com mobile virando prioridade, faz mais sentido — entra nesta entrega ou fica como follow-up? (Plano atual: follow-up; biometria não depende dela.)
- **A9 — WebView/in-app browsers:** usuários que abrem o link via Instagram/WhatsApp caem num WebView, onde WebAuthn pode falhar. Tratar com mensagem "abra no navegador" ou aceitar como limitação? Definir no /plan/ui-spec.

## 7. Recomendações para o planejamento

- Separar claramente as duas frentes: **(A) persistência** pode ser tarefa pequena e de baixo risco (setPersistence + renovação de cookie); **(B) biometria** é o grosso, alto risco de segurança.
- Frente B sugere sequência: schema+rules da credencial → endpoints de registro (challenge/verify) → enrollment UI → endpoints de login (challenge/verify→custom token) → botão de login → gestão/revogação.
- TDD obrigatório nos verificadores WebAuthn e na lógica de renovação de cookie (regras de segurança, anti-replay, counter).
- Tratar `rpId`/origin como configuração por ambiente desde o início.
- Manter e-mail+senha como caminho de primeira classe (fallback e recuperação).
- Confirmar A7 (escopo "facial") com o usuário antes de planejar — evita expectativa de reconhecimento facial proprietário.
