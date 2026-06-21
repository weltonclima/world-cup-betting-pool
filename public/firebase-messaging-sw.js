/* Service worker de Firebase Cloud Messaging (web-push-pwa TASK-02).
 *
 * Auto-registrado pelo FCM no seu próprio escopo (/firebase-cloud-messaging-
 * push-scope) — NÃO conflita com /sw.js (PWA base, escopo /).
 *
 * Usa o SDK compat via importScripts: o SW clássico não suporta imports ES.
 * Config pública inline (valores NEXT_PUBLIC_*, já públicos no bundle) — manter
 * em sincronia com src/firebase/env.ts.
 *
 * Contrato de payload (compartilhado com TASK-04, producer):
 *   notification: { title, body, icon? }
 *   data:         { url, type }
 * Como o payload traz `notification`, o FCM exibe a notificação automaticamente
 * em background (não re-exibimos aqui, evita duplicata). O `notificationclick`
 * abaixo foca/abre a rota de `data.url`.
 */

importScripts(
  "https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyDKadLZIBE2ykSWkVvbMIOSiAuPouUyUrk",
  authDomain: "world-cup-betting-pool-8e93c.firebaseapp.com",
  projectId: "world-cup-betting-pool-8e93c",
  storageBucket: "world-cup-betting-pool-8e93c.firebasestorage.app",
  messagingSenderId: "1036335199861",
  appId: "1:1036335199861:web:7a65001ad2b71715c76a3c",
});

// Inicializa o messaging no SW: habilita a exibição automática em background e
// anexa `data` à notificação (lido no notificationclick). Sem handler custom de
// onBackgroundMessage para não duplicar a notificação auto-exibida.
firebase.messaging();

// Clique na notificação: foca uma aba já aberta na MESMA rota (compara pathname,
// ignorando query/hash) e a navega para a URL de destino; senão abre uma nova.
// Fallback para "/" quando `data.url` ausente.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath =
    (event.notification.data && event.notification.data.url) || "/";
  const targetUrl = new URL(targetPath, self.location.origin).href;
  const targetPathname = new URL(targetUrl).pathname;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // Aba já aberta na mesma rota → navega (se necessário) e foca, em vez
          // de abrir uma nova janela.
          if (new URL(client.url).pathname === targetPathname) {
            const focused =
              "navigate" in client ? client.navigate(targetUrl) : Promise.resolve(client);
            return Promise.resolve(focused).then((c) =>
              c && "focus" in c ? c.focus() : client.focus(),
            );
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
