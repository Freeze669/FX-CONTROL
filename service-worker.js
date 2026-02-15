const CACHE = 'miniatc-v2';
const ASSETS = ['./','./index.html','./css/style.css','./js/app.js','./manifest.json','./service-worker.js'];

self.addEventListener('install', e=>{
	e.waitUntil(
		caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>{})
	);
});

self.addEventListener('activate', e=>{
	// remove old caches
	e.waitUntil(
		caches.keys().then(keys=>Promise.all(keys.map(k=>{ if(k!==CACHE) return caches.delete(k); }))).then(()=>self.clients.claim())
	);
});

// Serve cached assets when available; fall back to network.
self.addEventListener('fetch', e=>{
	e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
