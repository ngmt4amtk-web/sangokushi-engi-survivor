// engi-survivor Service Worker
// 方針: コード(html/js/css/json)=ネットワーク優先(更新が即届く)・アセット(画像/フォント)=キャッシュ優先(オフライン高速)
const CACHE_VERSION = 'engi-v3-20260613';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  const isCode = req.mode === 'navigate' || /\.(js|css|json|webmanifest|html)$/.test(url.pathname);
  if(isCode){
    // ネットワーク優先: 成功したらキャッシュ更新、オフライン時のみキャッシュ
    e.respondWith(
      fetch(req).then(res => {
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    // アセット: キャッシュ優先+裏で補充
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
