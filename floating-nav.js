(() => {
  if (document.getElementById('yd-floating-nav')) return;
  const style = document.createElement('style');
  style.id = 'yd-floating-nav-style';
  style.textContent = `
    body { padding-bottom: calc(116px + env(safe-area-inset-bottom, 0px)) !important; }
    #yd-floating-nav { position:fixed; z-index:10000; left:50%; bottom:calc(18px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); display:flex; align-items:center; justify-content:center; gap:5px; width:max-content; max-width:calc(100vw - 28px); padding:8px; border:1px solid rgba(150,177,195,.2); border-radius:20px; background:rgba(8,12,18,.90); box-shadow:0 14px 48px rgba(0,0,0,.48),0 0 28px rgba(97,255,154,.07); -webkit-backdrop-filter:blur(22px) saturate(145%); backdrop-filter:blur(22px) saturate(145%); font-family:system-ui,-apple-system,"Segoe UI",sans-serif; }
    #yd-floating-nav a,#yd-floating-nav summary { min-width:76px; min-height:54px; padding:7px 12px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:1px solid transparent; border-radius:13px; color:#aab6c2; text-decoration:none; font-size:11px; font-weight:650; line-height:1.2; white-space:nowrap; cursor:pointer; list-style:none; }
    #yd-floating-nav summary::-webkit-details-marker { display:none; }
    #yd-floating-nav .yd-nav-icon { font-size:19px; line-height:1; }
    #yd-floating-nav a:hover,#yd-floating-nav summary:hover,#yd-floating-nav a[aria-current="page"] { color:#61ff9a; border-color:rgba(97,255,154,.2); background:rgba(97,255,154,.09); }
    #yd-floating-nav a:focus-visible,#yd-floating-nav summary:focus-visible { outline:2px solid #67d9ff; outline-offset:2px; }
    #yd-floating-nav details { position:relative; }
    #yd-floating-nav .yd-more-links { position:absolute; right:0; bottom:calc(100% + 12px); display:grid; grid-template-columns:repeat(2,minmax(130px,1fr)); gap:5px; width:min(310px,calc(100vw - 32px)); padding:9px; border:1px solid rgba(150,177,195,.2); border-radius:16px; background:rgba(8,12,18,.97); box-shadow:0 16px 48px rgba(0,0,0,.5); -webkit-backdrop-filter:blur(22px); backdrop-filter:blur(22px); }
    #yd-floating-nav .yd-more-links a { min-width:0; min-height:44px; flex-direction:row; justify-content:flex-start; padding:10px 12px; border-radius:10px; font-size:12px; }
    @media(max-width:560px) { body { padding-bottom:calc(104px + env(safe-area-inset-bottom,0px)) !important; } #yd-floating-nav { bottom:calc(10px + env(safe-area-inset-bottom,0px)); gap:1px; padding:6px; border-radius:17px; max-width:calc(100vw - 16px); } #yd-floating-nav a,#yd-floating-nav summary { min-width:0; min-height:49px; padding:6px 9px; font-size:10px; } #yd-floating-nav .yd-nav-icon { font-size:17px; } #yd-floating-nav .yd-more-links { right:-2px; } }
    @media(prefers-reduced-motion:reduce) { #yd-floating-nav * { scroll-behavior:auto !important; transition:none !important; } }
  `;
  document.head.appendChild(style);
  const nav = document.createElement('nav');
  nav.id = 'yd-floating-nav';
  nav.setAttribute('aria-label','빠른 이동');
  nav.innerHTML = `
    <a href="/"><span class="yd-nav-icon" aria-hidden="true">⌂</span><span>홈</span></a>
    <a href="/youthcraft/"><span class="yd-nav-icon" aria-hidden="true">✳</span><span>YouthCraft</span></a>
    <a href="/services.html"><span class="yd-nav-icon" aria-hidden="true">▦</span><span>웹 도구</span></a>
    <a href="/server-tools/"><span class="yd-nav-icon" aria-hidden="true">⌘</span><span>서버 도구</span></a>
    <details><summary><span class="yd-nav-icon" aria-hidden="true">•••</span><span>더보기</span></summary><div class="yd-more-links">
      <a href="/guides/">📚 개발 가이드</a><a href="/sns/">◎ SNS</a><a href="/notices/">▤ 공지사항</a><a href="/account/">◉ 계정</a><a href="/about.html">ⓘ 프로젝트 소개</a><a href="/contact.html">✉ 문의하기</a>
    </div></details>`;
  document.body.appendChild(nav);
  const path = location.pathname.replace(/index\.html$/,'');
  let active = '/';
  if (path.startsWith('/youthcraft/')) active='/youthcraft/';
  else if (path.startsWith('/services/') || path==='/services.html' || path.startsWith('/editor/') || path.startsWith('/games/')) active='/services.html';
  else if (path.startsWith('/server-tools/')) active='/server-tools/';
  nav.querySelectorAll('a[href]').forEach(a => { if (a.getAttribute('href')===active) a.setAttribute('aria-current','page'); });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click',()=>{ const d=nav.querySelector('details'); if(d) d.open=false; }));
})();