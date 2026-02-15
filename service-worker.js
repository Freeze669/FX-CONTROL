const CACHE = 'miniatc-v1';
const ASSETS = ['.','index.html','miniatc-standalone.html','css/style.css','js/app.js','manifest.json','service-worker.js'];
self.addEventListener('install', e=>{
	e.waitUntil(
		caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>{})
	);
});

self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });

// Serve cached assets when available; fall back to network.
self.addEventListener('fetch', e=>{
	e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
