/* Navigator service worker: keeps the app shell available offline.
   Network first for the page itself, cache first for the map library. */
var CACHE = 'navigator-v1';
var SHELL = ['/navigator.html', '/navigator.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return Promise.all(SHELL.map(function(u){ return c.add(u).catch(function(){}); })); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var url = e.request.url;
  if (e.request.method !== 'GET') return;
  var isShell = SHELL.some(function(s){ return url.indexOf(s) >= 0 || url === s; }) || url.indexOf('/navigator.html') >= 0;
  if (!isShell) return;
  if (url.indexOf('cdnjs') >= 0){
    e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request).then(function(res){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); return res; }); }));
    return;
  }
  e.respondWith(fetch(e.request).then(function(res){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); return res; }).catch(function(){ return caches.match(e.request); }));
});
