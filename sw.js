
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('lab-assistant-cache').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './style/theme.css',
        './js/appLogic.js',
        './js/protocolLoader.js',
        './protocols/default_protocol.json'
      ]);
    })
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
