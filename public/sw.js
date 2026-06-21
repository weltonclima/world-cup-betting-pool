// Service worker MÍNIMO — base PWA (TASK-01).
// SEM fetch handler / SEM cache de navegação: evita servir build antigo (stale app).
// skipWaiting + clients.claim => atualização de SW ativa imediatamente.
// TASK-02 adiciona aqui: import do firebase-messaging-sw e handler `notificationclick`.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
