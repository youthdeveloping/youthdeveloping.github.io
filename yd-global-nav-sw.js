const CACHE_NAME = 'yd-global-nav-v1';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.filter(k=>k.startsWith('yd-global-nav-')&&k!==CACHE_NAME).map(k=>caches.delete(k))); await self.clients.claim(); })()); });
self.addEventListener('fetch', event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=='GET'||req.mode!=='navigate'||url.origin!==self.location.origin) return;
  if(/\/(google|naver)[^/]*\.html$/i.test(url.pathname)) return;
  event.respondWith((async()=>{
    const res=await fetch(req);
    const type=res.headers.get('content-type')||'';
    if(!res.ok||!type.includes('text/html')) return res;
    const html=await res.text();
    if(/id=["']yd-floating-nav["']/i.test(html)||/data-yd-global-nav/i.test(html)) return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});
    const tag='<script src="/floating-nav.js" defer data-yd-global-nav></script>';
    const rewritten=/<\/body\s*>/i.test(html)?html.replace(/<\/body\s*>/i,tag+'</body>'):html+tag;
    const headers=new Headers(res.headers);
    ['content-length','content-encoding','etag','content-range'].forEach(h=>headers.delete(h));
    return new Response(rewritten,{status:res.status,statusText:res.statusText,headers});
  })());
});