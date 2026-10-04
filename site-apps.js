/*
 * site-apps.js
 * data/apps.json 을 읽어 메인 페이지와 서비스 페이지에 반영합니다.
 * 파일을 불러오지 못하면 페이지에 이미 들어 있는 기본 내용을 그대로 사용합니다.
 */
(() => {
  'use strict';

  const DATA_URL = '/data/apps.json';

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

  function link(app, cls) {
    const a = el('a', cls);
    const url = cleanUrl(app.url);
    a.href = url || '#';
    a.setAttribute('aria-label', app.name);
    if (!url) {
      a.addEventListener('click', (e) => e.preventDefault());
    } else if (/^https?:\/\//i.test(url) && new URL(url).origin !== location.origin) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  /* ---------- 메인 페이지 ---------- */
  function renderIndex(apps) {
    const visible = apps.filter(a => a.status !== 'off');
    const tools = visible.filter(a => a.cat !== 'server');
    const servers = visible.filter(a => a.cat === 'server');
    const featured = tools.filter(a => a.featured);

    const grid = document.querySelector('.featured-grid');
    if (grid) {
      grid.textContent = '';
      featured.forEach(app => {
        const a = link(app, 'service-card');
        const top = el('div', 'service-top');
        top.append(el('span', 'service-icon', app.icon || '🧩'), el('span', 'service-state', app.url ? 'READY' : 'SOON'));
        a.append(top, el('h3', '', app.name), el('p', '', app.desc || ''), el('span', 'service-arrow', '→'));
        grid.appendChild(a);
      });
    }

    function fillList(container, list) {
      if (!container) return;
      container.textContent = '';
      list.forEach(app => {
        const a = link(app, '');
        a.append(el('span', '', app.icon || '🧩'), el('strong', '', app.name), el('small', '', app.desc || ''));
        container.appendChild(a);
      });
    }

    fillList(document.querySelector('.service-list'), tools);
    fillList(document.querySelector('.server-tool-grid'), servers);

    const count = document.querySelector('#all-services .all-services-head .section-status');
    if (count) count.textContent = tools.length + ' TOOLS';

    const serverBox = document.querySelector('.server-tools');
    if (serverBox) serverBox.hidden = servers.length === 0;
  }

  /* ---------- 서비스 페이지 ---------- */
  function renderServices(apps) {
    const style = document.createElement('style');
    style.textContent = '.card.admin-hide{display:none!important}';
    document.head.appendChild(style);

    const byId = new Map(apps.map(a => [a.id, a]));
    const tags = { utility: 'UTILITY', game: 'GAME', creative: 'CREATIVE' };

    document.querySelectorAll('#grid .card').forEach(card => {
      const app = byId.get(card.id);
      if (!app || app.status === 'off') {
        card.classList.add('admin-hide');
        return;
      }
      const h2 = card.querySelector('.cardhead h2');
      if (h2) h2.textContent = (app.icon ? app.icon + ' ' : '') + app.name;
      if (tags[app.cat]) {
        card.dataset.cat = app.cat;
        const tag = card.querySelector('.cardhead .tag');
        if (tag) tag.textContent = tags[app.cat];
      }
    });

    // 해시로 들어온 경우, 목록이 정리된 뒤 해당 도구로 다시 이동
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target && !target.classList.contains('admin-hide')) target.scrollIntoView();
    }
  }

  /* ---------- 시작 ---------- */
  fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' })
    .then(res => { if (!res.ok) throw new Error('not found'); return res.json(); })
    .then(data => {
      const list = Array.isArray(data) ? data : data && data.apps;
      if (!Array.isArray(list)) return;
      const apps = list.filter(a => a && a.id && a.name);
      if (!apps.length) return;
      if (document.getElementById('all-services')) renderIndex(apps);
      if (document.getElementById('grid')) renderServices(apps);
    })
    .catch(() => { /* 기본 내용 유지 */ });
})();
