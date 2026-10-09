
const $=id=>document.getElementById(id);

/* ---------- 공통 유틸 ---------- */
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},
  set(k,v){try{localStorage.setItem(k,v)}catch{}}
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=s=>s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function randInt(n){const lim=Math.floor(4294967296/n)*n,buf=new Uint32Array(1);let x;do{crypto.getRandomValues(buf);x=buf[0]}while(x>=lim);return x%n}
function pad2(n){return String(n).padStart(2,'0')}
function fmt(s){s=Math.max(0,s);return pad2(Math.floor(s/60))+':'+pad2(Math.floor(s%60))}

/* ---------- 소리 (AudioContext 하나만 재사용) ---------- */
let audioCtx=null;
function getAudio(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  if(!audioCtx)audioCtx=new AC();
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}
function beep(freq=440,d=0.12){
  const a=getAudio();if(!a)return;
  const o=a.createOscillator(),g=a.createGain(),t=a.currentTime;
  o.frequency.value=freq;
  o.connect(g);g.connect(a.destination);
  g.gain.setValueAtTime(.06,t);
  g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.start(t);o.stop(t+d+.02);
}
function tone(f){beep(f,.35)}

/* ---------- 타이머 ---------- */
let timerId=null,timerLeft=null;
function timerRender(){$('timerOut').textContent=fmt(timerLeft===null?(Number($('timerSec').value)||60):timerLeft)}
function timerStart(){
  if(timerId)return;
  getAudio();
  if(timerLeft===null||timerLeft<=0)timerLeft=Number($('timerSec').value)||60;
  timerRender();
  timerId=setInterval(()=>{
    timerLeft--;timerRender();
    if(timerLeft<=0){timerStop();beep(900,.4)}
  },1000);
}
function timerStop(){clearInterval(timerId);timerId=null}
function timerReset(){timerStop();timerLeft=null;timerRender()}
if($('timerSec'))$('timerSec').addEventListener('input',()=>{if(!timerId&&timerLeft===null)timerRender()});

/* ---------- 알람 ---------- */
let alarmId=null;
function setAlarm(){
  clearAlarm();
  const t=$('alarmTime').value;
  if(!t){$('alarmOut').textContent='시간을 선택하세요.';return}
  getAudio();
  try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()}catch{}
  alarmId=setInterval(()=>{
    const n=new Date();
    if(pad2(n.getHours())+':'+pad2(n.getMinutes())===t){
      beep(880,.5);
      $('alarmOut').textContent='알람: '+t;
      try{if('Notification' in window&&Notification.permission==='granted')new Notification('알람',{body:t})}catch{}
      clearAlarm();
    }
  },1000);
  $('alarmOut').textContent=t+' 에 설정됨';
}
function clearAlarm(manual){
  clearInterval(alarmId);alarmId=null;
  if(manual)$('alarmOut').textContent='알람 없음';
}

/* ---------- 스톱워치 ---------- */
let swId=null,swStartAt=0,swElapsed=0;
function swRender(){
  const x=swElapsed+(swId?performance.now()-swStartAt:0);
  const t=Math.floor(x/100),m=Math.floor(t/600),s=Math.floor((t%600)/10),d=t%10;
  $('swOut').textContent=pad2(m)+':'+pad2(s)+'.'+d;
}
function swStart(){if(!swId){swStartAt=performance.now();swId=setInterval(swRender,50)}}
function swStop(){if(swId){swElapsed+=performance.now()-swStartAt;clearInterval(swId);swId=null;swRender()}}
function swLap(){
  if(!swId)return;
  const box=$('swLaps'),n=box.textContent?box.textContent.split('\n').length+1:1;
  box.textContent+=(box.textContent?'\n':'')+n+'. '+$('swOut').textContent;
}
function swReset(){swStop();swElapsed=0;$('swLaps').textContent='';swRender()}

/* ---------- 랜덤 / 룰렛 / 가위바위보 ---------- */
function randomPick(){
  const a=lines($('randomItems').value);
  $('randomOut').textContent=a.length?a[randInt(a.length)]:'항목 없음';
}
function roulettePick(){
  const a=$('rouletteItems').value.split(',').map(x=>x.trim()).filter(Boolean);
  $('rouletteOut').textContent=a.length?'🎡 '+a[randInt(a.length)]:'항목 없음';
}
function rps(me){
  const a=['가위','바위','보'],pc=a[randInt(3)];
  const win=(me==='가위'&&pc==='보')||(me==='바위'&&pc==='가위')||(me==='보'&&pc==='바위');
  $('rpsOut').textContent=`나: ${me} / 컴퓨터: ${pc} → ${me===pc?'무승부':win?'승리':'패배'}`;
}

/* ---------- 계산기 ---------- */
let expr='';
function calcAdd(x){expr+=x;$('calcOut').value=expr}
function calcClear(){expr='';$('calcOut').value=''}
function calcBack(){expr=expr.slice(0,-1);$('calcOut').value=expr}
function calcRun(){
  try{
    if(!expr||!/^[0-9+*/(). %\-]+$/.test(expr))throw 0;
    const r=Function('"use strict";return ('+expr+')')();
    if(!Number.isFinite(r))throw 0;
    expr=String(+r.toFixed(10));
    $('calcOut').value=expr;
  }catch{expr='';$('calcOut').value='ERROR'}
}

/* ---------- 단위 변환기 ---------- */
function convertUnit(){
  const v=Number($('unitVal').value),a=$('unitFrom').value,b=$('unitTo').value;
  const len={m:1,km:1000,cm:.01},mass={kg:1000,g:1};
  let r;
  if(a===b)r=v;
  else if(a in len&&b in len)r=v*len[a]/len[b];
  else if(a in mass&&b in mass)r=v*mass[a]/mass[b];
  else if(a==='c'&&b==='f')r=v*9/5+32;
  else if(a==='f'&&b==='c')r=(v-32)*5/9;
  else r=null;
  $('unitOut').textContent=r===null||!Number.isFinite(r)?'변환할 수 없는 조합입니다.':`${v} ${a} = ${+r.toFixed(6)} ${b}`;
}

/* ---------- 비밀번호 ---------- */
async function makePassword(){
  const s='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const n=Math.min(128,Math.max(4,Number($('pwLen').value)||16));
  let o='';for(let i=0;i<n;i++)o+=s[randInt(s.length)];
  let note='';
  try{await navigator.clipboard.writeText(o);note='\n(클립보드에 복사됨)'}catch{}
  $('pwOut').textContent=o+note;
}

/* ---------- 메모장 ---------- */
function saveMemo(){store.set('youthMemo',$('memoText').value);$('memoOut').textContent='저장됨'}
function loadMemo(){$('memoText').value=store.get('youthMemo','');$('memoOut').textContent='불러옴'}

/* ---------- 할 일 목록 ---------- */
let todos;try{todos=JSON.parse(store.get('youthTodos','[]'));if(!Array.isArray(todos))todos=[]}catch{todos=[]}
function saveTodos(){store.set('youthTodos',JSON.stringify(todos))}
function drawTodo(){
  $('todoOut').innerHTML=todos.length?todos.map((x,i)=>
    `<div class="todo-row ${x.done?'done':''}"><input type="checkbox" ${x.done?'checked':''} onchange="toggleTodo(${i},this.checked)" aria-label="완료"><span>${esc(x.text)}</span><button type="button" onclick="delTodo(${i})" aria-label="삭제">X</button></div>`
  ).join(''):'할 일 없음';
}
function addTodo(){
  const x=$('todoText').value.trim();
  if(!x)return;
  todos.push({text:x,done:false});saveTodos();$('todoText').value='';drawTodo();
}
function toggleTodo(i,v){todos[i].done=v;saveTodos();drawTodo()}
function delTodo(i){todos.splice(i,1);saveTodos();drawTodo()}
if($('todoText')){$('todoText').addEventListener('keydown',e=>{if(e.key==='Enter')addTodo();});drawTodo();}

/* ---------- 캘린더 ---------- */
function calRender(){
  const v=$('calDate').value;
  if(!v){$('calOut').textContent='날짜를 선택하세요.';return}
  const d=new Date(v+'T00:00:00'),today=new Date();today.setHours(0,0,0,0);
  const diff=Math.round((d-today)/864e5);
  const dday=diff===0?'D-Day':diff>0?'D-'+diff:'D+'+(-diff);
  $('calOut').textContent=d.toLocaleDateString('ko-KR',{dateStyle:'full'})+'\n'+dday;
}
if($('calDate')){(()=>{const t=new Date();$('calDate').value=t.getFullYear()+'-'+pad2(t.getMonth()+1)+'-'+pad2(t.getDate());calRender()})();$('calDate').addEventListener('change',calRender);}

/* ---------- URL 도구 ---------- */
function parseUrl(){
  let v=$('urlIn').value.trim();
  if(!v){$('urlOut').textContent='주소를 입력하세요.';return}
  let u;
  try{u=new URL(v)}catch{try{u=new URL('https://'+v)}catch{$('urlOut').textContent='올바른 URL을 입력하세요.';return}}
  $('urlOut').textContent=`protocol: ${u.protocol}\nhost: ${u.host}\npath: ${u.pathname}\nquery: ${u.search||'없음'}\nhash: ${u.hash||'없음'}`;
}

/* ---------- QR ---------- */
function makeQR(){
  const v=$('qrIn').value.trim(),box=$('qrOut');
  if(!v){box.textContent='내용 없음';return}
  box.textContent='';
  const img=new Image();
  img.alt='QR 코드';img.width=180;img.height=180;
  img.onerror=()=>{box.textContent='QR 생성 서버에 연결할 수 없습니다.'};
  img.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(v);
  box.appendChild(img);
}

/* ---------- 색상 도구 ---------- */
function colorRender(){
  const h=$('colorIn').value,r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
  $('colorOut').textContent=`${h.toUpperCase()}\nrgb(${r}, ${g}, ${b})`;
}
if($('colorIn')){$('colorIn').addEventListener('input',colorRender);colorRender();}

/* ---------- 이미지 압축 ---------- */
function compressImage(){
  const f=$('imgIn').files[0];
  if(!f){$('imgOut').textContent='이미지를 선택하세요.';return}
  $('imgOut').textContent='처리 중...';
  const im=new Image(),r=new FileReader();
  r.onerror=()=>{$('imgOut').textContent='파일을 읽을 수 없습니다.'};
  r.onload=e=>{
    im.onerror=()=>{$('imgOut').textContent='이미지를 불러올 수 없습니다.'};
    im.onload=()=>{
      const c=document.createElement('canvas'),m=Math.min(1,1600/im.width);
      c.width=Math.round(im.width*m);c.height=Math.round(im.height*m);
      const ctx=c.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height); // 투명 PNG가 검게 나오지 않도록
      ctx.drawImage(im,0,0,c.width,c.height);
      c.toBlob(b=>{
        if(!b){$('imgOut').textContent='압축에 실패했습니다.';return}
        $('imgOut').innerHTML=`원본 ${(f.size/1024).toFixed(0)}KB → ${(b.size/1024).toFixed(0)}KB <a download="compressed.jpg" href="${URL.createObjectURL(b)}">저장</a>`;
      },'image/jpeg',Number($('imgQuality').value));
    };
    im.src=e.target.result;
  };
  r.readAsDataURL(f);
}

/* ---------- 메트로놈 ---------- */
let metroId=null;
function metroStart(){
  const bpm=Math.min(240,Math.max(30,Number($('bpm').value)||100));
  clearInterval(metroId);
  beep(880,.06);
  metroId=setInterval(()=>beep(880,.06),60000/bpm);
  $('metroOut').textContent=bpm+' BPM 재생 중';
}
function metroToggle(){
  if(metroId){clearInterval(metroId);metroId=null;$('metroOut').textContent='정지됨'}
  else metroStart();
}
if($('bpm'))$('bpm').addEventListener('change',()=>{if(metroId)metroStart()});

/* ---------- 에임 / 반응속도 / CPS ---------- */
let aimAt=0;
function aimStart(){
  const a=$('aimArea');a.innerHTML='';
  const b=document.createElement('button');
  b.textContent='•';b.setAttribute('aria-label','목표');
  b.style.left=Math.random()*80+'%';b.style.top=Math.random()*70+'%';
  aimAt=performance.now();
  b.onclick=()=>{$('aimOut').textContent=Math.round(performance.now()-aimAt)+' ms';a.innerHTML=''};
  a.appendChild(b);
}

let reactionTimer=null,reactionReady=false,reactionAt=0;
function reactionStart(){
  const a=$('reactionArea');
  clearTimeout(reactionTimer);reactionReady=false;
  a.style.background='rgba(255,102,125,.15)';
  $('reactionOut').textContent='기다리세요... 초록색이 되면 클릭';
  a.onclick=()=>{
    a.onclick=null;
    clearTimeout(reactionTimer);
    a.style.background='';
    if(!reactionReady){$('reactionOut').textContent='너무 빨랐습니다. START를 다시 누르세요.';return}
    $('reactionOut').textContent=Math.round(performance.now()-reactionAt)+' ms';
    reactionReady=false;
  };
  reactionTimer=setTimeout(()=>{
    reactionReady=true;reactionAt=performance.now();
    a.style.background='rgba(97,255,154,.3)';
  },1000+Math.random()*3000);
}

let cpsActive=false,cpsN=0;
function cpsClick(){
  if(!cpsActive){
    cpsActive=true;cpsN=0;
    $('cpsOut').textContent='측정 중... 5초 동안 클릭!';
    setTimeout(()=>{
      cpsActive=false;
      $('cpsOut').textContent=`${cpsN}번 클릭 · ${(cpsN/5).toFixed(2)} CPS\n다시 시작하려면 클릭하세요.`;
    },5000);
  }
  cpsN++;
}

/* ---------- 점수판 / 순위표 ---------- */
let score={a:0,b:0};
function scoreAdd(t,n){score[t]+=n;$('scoreOut').textContent=`A ${score.a} : ${score.b} B`}
function scoreReset(){score={a:0,b:0};scoreAdd('a',0)}

let ranks=[];
function rankAdd(){
  const n=$('rankName').value.trim(),s=Number($('rankScore').value);
  if(!n)return;
  ranks.push({n,s:Number.isFinite(s)?s:0});
  ranks.sort((a,b)=>b.s-a.s);
  $('rankOut').textContent=ranks.map((x,i)=>`${i+1}. ${x.n} — ${x.s}`).join('\n');
  $('rankName').value='';$('rankScore').value='';
}

/* ---------- 팀 나누기 / 제비뽑기 / 폭탄 ---------- */
function makeTeams(){
  const a=shuffle(lines($('teamNames').value)),n=Math.max(2,Number($('teamCount').value)||2);
  if(!a.length){$('teamOut').textContent='이름을 입력하세요.';return}
  const o=Array.from({length:n},()=>[]);
  a.forEach((x,i)=>o[i%n].push(x));
  $('teamOut').textContent=o.map((x,i)=>`TEAM ${i+1}: ${x.join(', ')||'-'}`).join('\n');
}
function lottery(){
  const a=shuffle(lines($('lotteryNames').value));
  if(!a.length){$('lotteryOut').textContent='이름을 입력하세요.';return}
  const n=Math.min(a.length,Math.max(1,Number($('lotteryCount').value)||1));
  $('lotteryOut').textContent=a.slice(0,n).join('\n');
}
let bombId=null;
function bombStart(){
  clearInterval(bombId);
  getAudio();
  const max=Math.max(3,Number($('bombMax').value)||10),x=randInt(max)+1;
  let t=0;
  $('bombOut').textContent='...';
  bombId=setInterval(()=>{
    t++;$('bombOut').textContent=t;
    if(t>=x){clearInterval(bombId);bombId=null;$('bombOut').textContent='💥 BOOM';beep(100,.5)}
  },350);
}

/* ---------- Per-page initialization ---------- */
if($('timerSec'))timerRender();if($('swOut'))swRender();