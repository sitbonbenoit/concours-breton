// Service Worker — Le Concours Breton
// Version "interrupteur" : désinstalle l'ancien service worker
// et vide tous les caches pour réparer les pages blanches.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});

// Aucune interception des requêtes — laisse tout passer normalement
