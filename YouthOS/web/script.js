// YouthOS Web Experience — - by ChatGPT AI
(() => {
  const $ = (id) => document.getElementById(id);
  const boot = $("boot"), desktop = $("desktop"), win = $("appWindow");
  const launcher = $("launcher"), launcherPanel = $("launcherPanel"), quickPanel = $("quickPanel");
  const title = $("windowTitle"), icon = $("windowIcon"), content = $("windowContent");
  const toast = $("toast");
  let activeApp = null, toastTimer = null, drag = null;

  const apps = {
    explorer: {name:"파일",icon:"▰",html:()=>`<div class="content-heading"><h3>내 파일</h3><span class="muted">홈 / 사용자</span></div><div class="file-list"><div class="file-row">📁 <b>문서</b><span>폴더</span></div><div class="file-row">📁 <b>다운로드</b><span>폴더</span></div><div class="file-row">📁 <b>프로젝트</b><span>폴더</span></div><div class="file-row">🖼️ <b>배경화면.png</b><span>이미지</span></div><div class="file-row">📄 <b>환영합니다.txt</b><span>텍스트</span></div></div><p class="muted" style="margin-top:18px;font-size:11px">이 화면은 웹 체험판의 예시 파일 시스템이야.</p>`},
    terminal: {name:"터미널",icon:"⌘",html:()=>`<div class="terminal"><div><span class="green">youth@os</span>:<span style="color:#91baff">~</span>$ neofetch</div><pre style="color:#8fb5ff">   __   __          _   _  ____  ____
   \\ \\ / /__  _   _| |_| |/ ___||  _ \\ 
    \\ V / _ \\| | | | __| |\\___ \\| |_) |
     | | (_) | |_| | |_| | ___) |  __/
     |_|\\___/ \\__,_|\\__|_||____/|_|
</pre><div>YouthOS Web Experience</div><div class="muted">Browser-based desktop preview</div><div class="terminal-input"><span class="green">youth@os:~$</span><input id="terminalInput" placeholder="help 입력 후 Enter" autocomplete="off"></div></div>`},
    editor: {name:"코드 편집기",icon:"</>",html:()=>`<div class="editor"><div class="editor-bar">● &nbsp; welcome.py &nbsp; — &nbsp; YouthOS Code</div><textarea spellcheck="false" aria-label="코드 편집기"># YouthOS에서 첫 번째 코드를 작성해 봐요
# - by ChatGPT AI

def hello():
    print("Hello, YouthOS!")

hello()</textarea></div>`},
    settings: {name:"설정",icon:"⚙",html:()=>`<div class="content-heading"><h3>시스템 설정</h3><span class="muted">개인화</span></div><div class="settings-list"><div class="setting-row"><b>테마</b><button id="themeToggle">다크 모드 켜짐</button></div><div class="setting-row"><b>배경화면</b><span>Midnight Blue</span></div><div class="setting-row"><b>언어</b><span>한국어</span></div><div class="setting-row"><b>시스템</b><span>YouthOS Web 0.1</span></div><div class="setting-row"><b>개발팀</b><span>청소년개발자</span></div></div>`},
    about: {name:"YouthOS 정보",icon:"Y",html:()=>`<div style="text-align:center;padding:24px"><div class="mini-mark" style="margin:auto;width:48px;height:48px;font-size:22px">Y</div><h2>YouthOS</h2><p class="muted">Web Experience · Preview 0.1</p><p style="line-height:1.8">청소년 개발자를 위한 개발 친화적 운영체제 프로젝트.<br>Debian 기반 실제 OS와 웹 체험판을 함께 개발하고 있어.</p><p class="muted" style="font-size:10px">Designed for creators · by YouthDeveloper</p></div>`},
    calculator: {name:"계산기",icon:"＋",html:()=>`<div style="max-width:300px;margin:auto"><h3>간단 계산기</h3><input id="calcInput" placeholder="예: 12 * (3 + 4)" style="width:100%;padding:13px;background:#0a1424;border:1px solid #ffffff22;border-radius:8px;color:white"><button id="calcRun" class="primary-button" style="margin-top:12px">계산하기</button><p id="calcResult" class="muted"></p></div>`}
  };

  function notify(message) {
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  function openApp(key) {
    const app = apps[key]; if (!app) return;
    activeApp = key; title.textContent = app.name; icon.textContent = app.icon;
    content.innerHTML = app.html(); win.classList.remove("hidden");
    launcherPanel.classList.add("hidden"); quickPanel.classList.add("hidden");
    bindApp(key);
  }
  function bindApp(key) {
    if (key === "terminal") {
      const input = $("terminalInput");
      input?.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        const command = input.value.trim().toLowerCase();
        const output = command === "help" ? "사용 가능한 명령어: help, date, whoami, clear, about" :
          command === "whoami" ? "youth — YouthOS Web demo user" :
          command === "date" ? new Date().toLocaleString("ko-KR") :
          command === "about" ? "YouthOS Web Experience 0.1" :
          command === "clear" ? "" : command ? "웹 체험판에서는 실제 시스템 명령을 실행하지 않아." : "";
        const term = content.querySelector(".terminal");
        if (command === "clear") { term.innerHTML = ""; }
        else { const line = document.createElement("div"); line.textContent = output; term.insertBefore(line, term.querySelector(".terminal-input")); }
        input.value = "";
      });
    }
    if (key === "settings") $("themeToggle")?.addEventListener("click", () => notify("테마 설정은 다음 업데이트에서 적용할 예정이야."));
    if (key === "calculator") $("calcRun")?.addEventListener("click", () => {
      const raw = $("calcInput").value.trim();
      if (!/^[0-9+\-*/(). %]+$/.test(raw)) { $("calcResult").textContent = "숫자와 기본 연산자만 입력해 줘."; return; }
      try { const value = Function('"use strict";return (' + raw + ')')(); $("calcResult").textContent = Number.isFinite(value) ? "= " + value : "계산할 수 없는 값이야."; }
      catch { $("calcResult").textContent = "수식을 확인해 줘."; }
    });
  }
  document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => openApp(button.dataset.open)));
  launcher.addEventListener("click", () => { launcherPanel.classList.toggle("hidden"); quickPanel.classList.add("hidden"); });
  $("quickToggle").addEventListener("click", () => { quickPanel.classList.toggle("hidden"); launcherPanel.classList.add("hidden"); });
  $("close").addEventListener("click", () => win.classList.add("hidden"));
  $("minimize").addEventListener("click", () => win.classList.add("hidden"));
  $("maximize").addEventListener("click", () => win.classList.toggle("maximized"));
  $("powerButton").addEventListener("click", () => { launcherPanel.classList.add("hidden"); notify("YouthOS 웹 체험을 종료하려면 브라우저 탭을 닫아 줘."); });
  $("appSearch").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".app-grid button").forEach(b => b.style.display = b.textContent.toLowerCase().includes(q) ? "" : "none");
  });
  document.querySelectorAll(".quick-tile").forEach(b => b.addEventListener("click", () => b.classList.toggle("active")));
  document.querySelectorAll(".quick-tile").forEach(b => b.addEventListener("click", () => notify(b.textContent.trim() + " 설정을 변경했어.")));
  $("windowDrag").addEventListener("pointerdown", e => {
    if (e.target.closest(".window-controls") || win.classList.contains("maximized")) return;
    const rect = win.getBoundingClientRect(); drag = {x:e.clientX-rect.left,y:e.clientY-rect.top};
    $("windowDrag").setPointerCapture(e.pointerId);
  });
  $("windowDrag").addEventListener("pointermove", e => {
    if (!drag) return;
    win.style.left = Math.max(8,Math.min(innerWidth-win.offsetWidth-8,e.clientX-drag.x))+"px";
    win.style.top = Math.max(55,Math.min(innerHeight-win.offsetHeight-90,e.clientY-drag.y))+"px";
    win.style.transform = "none";
  });
  $("windowDrag").addEventListener("pointerup", () => drag = null);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { launcherPanel.classList.add("hidden"); quickPanel.classList.add("hidden"); } });
  function updateClock() {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
    $("topDate").textContent = now.toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"});
  }
  updateClock(); setInterval(updateClock,15000);
  setTimeout(() => { boot.classList.add("hidden"); desktop.classList.remove("hidden"); }, 1900);
})();