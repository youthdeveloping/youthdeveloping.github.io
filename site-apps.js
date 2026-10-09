/*
 * site-apps.js
 * data/apps.json 을 읽어 메인 페이지의 서비스 카드(대표 / 전체 / 서버 도구)를 그립니다.
 * 파일을 불러오지 못하면 index.html 에 들어 있는 기본 카드를 그대로 보여줍니다.
 */
(() => {
  'use strict';

  const featuredBox = document.getElementById('appFeatured');
  if (!featuredBox) return; // 메인 페이지가 아니면 아무것도 하지 않음

  const allBox = document.getElementById('appAll');
  const serverBox = document.getElementById('appServer');
  const serverWrap = document.getElementById('serverTools');
  const countEl = document.getElementById('toolCount');

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function cleanUrl(u) {
    u = String(u || '').trim();
    if (!u || /^(javascript|data|vbscript):/i.test(u)) return '';
    return u;
  }

  function isImage(icon) {
    return /^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|gif|webp);)/i.test(icon);
  }

  function tile(icon) {
    const t = el('span', 'tile');
    icon = String(icon || '').trim();
    if (icon && isImage(icon)) {
      const img = document.createElement('img');
      img.src = icon;
      img.alt = '';
      img.loading = 'lazy';
      t.appendChild(img);
    } else {
      t.textContent = icon || '🧩';
    }
    return t;
  }

  function card(app) {
    const url = cleanUrl(app.url);
    const c = el(url ? 'a' : 'div', 'card' + (url ? '' : ' off'));
    if (url) c.href = url;

    const info = el('div', 'info');
    info.appendChild(el('h3', 'name', app.name));
    if (app.desc) info.appendChild(el('p', 'desc', app.desc));
    c.append(tile(app.icon), info);

    if (url) {
      const chev = el('span', 'chev', '›');
      chev.setAttribute('aria-hidden', 'true');
      c.appendChild(chev);
    } else {
      c.appendChild(el('span', 'badge', '준비 중'));
    }
    return c;
  }

  function soonCard() {
    const c = el('div', 'card soon');
    const info = el('div', 'info');
    info.append(el('h3', 'name', 'Coming Soon'), el('p', 'desc', '새로운 서비스가 추가될 예정입니다'));
    c.append(el('span', 'tile', '+'), info);
    return c;
  }

  function fill(box, list, extra) {
    if (!box) return;
    box.textContent = '';
    list.forEach(a => box.appendChild(card(a)));
    if (extra) box.appendChild(extra);
  }

  function groupOf(a) {
    return a.group === 'server' || a.cat === 'server' ? 'server' : 'tool';
  }

  fetch('/data/apps.json?t=' + Date.now(), { cache: 'no-store' })
    .then(res => { if (!res.ok) throw new Error('not found'); return res.json(); })
    .then(data => {
      const list = Array.isArray(data) ? data : data && data.apps;
      if (!Array.isArray(list)) return;
      const apps = list.filter(a => a && a.name);
      if (!apps.length) return;

      const visible = apps.filter(a => a.status !== 'off');
      const tools = visible.filter(a => groupOf(a) === 'tool');
      const servers = visible.filter(a => groupOf(a) === 'server');
      const featured = tools.filter(a => a.featured);

      fill(featuredBox, featured, soonCard());
      fill(allBox, tools);
      fill(serverBox, servers);

      if (countEl) countEl.textContent = tools.length + ' TOOLS';
      if (serverWrap) serverWrap.hidden = servers.length === 0;
    })
    .catch(() => { /* 기본 카드 유지 */ });
})();
