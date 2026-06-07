/**
 * Constante compartilhada do nome do cookie de sessão.
 *
 * Este módulo NÃO importa nada de runtime (sem firebase-admin, sem
 * `server-only`, sem Route Handlers) — é só uma string literal — para poder
 * ser importado com segurança tanto no Node (Route Handler `route.ts`) quanto
 * no edge (`middleware.ts`), evitando puxar `firebase-admin` para o bundle edge.
 *
 * `__session` é o ÚNICO cookie repassado pelo CDN do Firebase Hosting /
 * App Hosting ao backend — por isso o nome é fixo e compartilhado.
 */
export const SESSION_COOKIE_NAME = "__session";
