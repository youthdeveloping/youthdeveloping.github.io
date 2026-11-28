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

    #yd-floating-nav .yd-language { position:relative; }
    #yd-floating-nav .yd-language-menu { position:absolute; right:0; bottom:calc(100% + 12px); width:min(230px,calc(100vw - 32px)); max-height:min(55vh,420px); overflow:auto; padding:10px; border:1px solid rgba(150,177,195,.2); border-radius:14px; background:rgba(8,12,18,.98); box-shadow:0 16px 48px rgba(0,0,0,.5); }
    #yd-floating-nav .yd-language-menu label { display:block; color:#aab6c2; font-size:11px; margin:0 0 7px; }
    #yd-floating-nav .yd-language-menu select { width:100%; padding:11px; color:#edf2f7; background:#101821; border:1px solid rgba(150,177,195,.25); border-radius:9px; font:12px system-ui,sans-serif; }
    #yd-google-translate { position:absolute!important; width:1px!important; height:1px!important; overflow:hidden!important; clip-path:inset(50%)!important; }
    .goog-te-banner-frame,.skiptranslate { display:none!important; }
    body { top:0!important; }
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
    <details class="yd-language"><summary><span class="yd-nav-icon" aria-hidden="true">文</span><span>언어</span></summary><div class="yd-language-menu"><label for="yd-language-select">언어 선택 / Select language</label><select id="yd-language-select"><option value="ko">🇰🇷 한국어</option><option value="en">🇺🇸 English</option><option value="ja">🇯🇵 日本語</option><option value="zh-CN">🇨🇳 简体中文</option><option value="zh-TW">🇹🇼 繁體中文</option><option value="es">🇪🇸 Español</option><option value="fr">🇫🇷 Français</option><option value="de">🇩🇪 Deutsch</option><option value="ru">🇷🇺 Русский</option><option value="pt">🇧🇷 Português</option><option value="hi">🇮🇳 हिन्दी</option><option value="ar">🇸🇦 العربية</option><option value="it">🇮🇹 Italiano</option><option value="nl">🇳🇱 Nederlands</option><option value="pl">🇵🇱 Polski</option><option value="tr">🇹🇷 Türkçe</option><option value="vi">🇻🇳 Tiếng Việt</option><option value="th">🇹🇭 ไทย</option><option value="id">🇮🇩 Bahasa Indonesia</option><option value="ms">🇲🇾 Bahasa Melayu</option><option value="bn">🇧🇩 বাংলা</option><option value="ur">🇵🇰 اردو</option><option value="fa">🇮🇷 فارسی</option><option value="he">🇮🇱 עברית</option><option value="uk">🇺🇦 Українська</option><option value="el">🇬🇷 Ελληνικά</option><option value="sv">🇸🇪 Svenska</option><option value="da">🇩🇰 Dansk</option><option value="no">🇳🇴 Norsk</option><option value="fi">🇫🇮 Suomi</option><option value="cs">🇨🇿 Čeština</option><option value="ro">🇷🇴 Română</option><option value="hu">🇭🇺 Magyar</option><option value="sw">🌍 Kiswahili</option><option value="af">🇿🇦 Afrikaans</option><option value="auto">🌐 자동 감지</option></select></div></details><details><summary><span class="yd-nav-icon" aria-hidden="true">•••</span><span>더보기</span></summary><div class="yd-more-links">
      <a href="/guides/">📚 개발 가이드</a><a href="/sns/">◎ SNS</a><a href="/notices/">▤ 공지사항</a><a href="/account/">◉ 계정</a><a href="/about.html">ⓘ 프로젝트 소개</a><a href="/contact.html">✉ 문의하기</a>
    </div></details>`;
  document.body.appendChild(nav);

  const translateHost=document.createElement('div');
  translateHost.id='yd-google-translate';
  document.body.appendChild(translateHost);
  window.googleTranslateElementInit=function(){
    if(!window.google||!google.translate)return;
    new google.translate.TranslateElement({pageLanguage:'ko',autoDisplay:false},'yd-google-translate');
    const select=document.getElementById('yd-language-select');
    if(!select)return;
    const saved=localStorage.getItem('yd-language')||'';
    const browser=(navigator.language||'').toLowerCase();
    const detected=browser.startsWith('zh-tw')||browser.startsWith('zh-hk')?'zh-TW':browser.split('-')[0];
    const supported=[...select.options].map(o=>o.value);
    const initial=saved||((detected!=='ko'&&supported.includes(detected))?detected:'ko');
    select.value=supported.includes(initial)?initial:'ko';
    function applyLanguage(code){
      localStorage.setItem('yd-language',code);
      const combo=document.querySelector('.goog-te-combo');
      if(code==='auto'||code==='ko'){
        document.cookie='googtrans=/ko/ko;path=/;max-age=31536000';
        document.cookie='googtrans=/ko/ko;domain='+location.hostname+';path=/;max-age=31536000';
        location.reload();
        return;
      }
      if(combo){combo.value=code;combo.dispatchEvent(new Event('change'));}
      else {setTimeout(()=>applyLanguage(code),300);}
    }
    select.addEventListener('change',()=>applyLanguage(select.value));
    if(initial!=='ko'&&initial!=='auto')setTimeout(()=>applyLanguage(initial),700);
  };
  const translateScript=document.createElement('script');
  translateScript.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  translateScript.async=true;
  document.head.appendChild(translateScript);

  const path = location.pathname.replace(/index\.html$/,'');
  let active = '/';
  if (path.startsWith('/youthcraft/')) active='/youthcraft/';
  else if (path.startsWith('/services/') || path==='/services.html' || path.startsWith('/editor/') || path.startsWith('/games/')) active='/services.html';
  else if (path.startsWith('/server-tools/')) active='/server-tools/';
  nav.querySelectorAll('a[href]').forEach(a => { if (a.getAttribute('href')===active) a.setAttribute('aria-current','page'); });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click',()=>{ const d=nav.querySelector('details'); if(d) d.open=false; }));
})();