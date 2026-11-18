/* আরবি শিখি – সার্ভিস ওয়ার্কার. VERSION বদলাতে release.js ব্যবহার করুন */
const VERSION='1.4.4';
const CACHE='arabi-shikhi-'+VERSION;
const CORE=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('arabi-shikhi-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  const fresh=req.mode==='navigate'||(url.origin===location.origin&&/(version\.json|index\.html)$/.test(url.pathname));
  if(fresh){
    e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{if(r.ok&&url.pathname.indexOf('version.json')<0){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r}).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));
    return;
  }
  if(url.origin===location.origin||/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r})));
  }
});
