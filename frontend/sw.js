var CACHE_NAME = 'ledgr-v1';
var STATIC_ASSETS = [
  '/',
  '/dashboard.html',
  '/expenses.html',
  '/categories.html',
  '/projects.html',
  '/budgets.html',
  '/reports.html',
  '/receipts.html',
  '/settings.html',
  '/login.html',
  '/signup.html',
  '/css/style.css',
  '/css/dashboard.css',
  '/js/api.js',
  '/js/main.js',
  '/js/theme.js',
  '/images/favicon.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request).then(function (response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(e.request, clone);
      });
      return response;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
