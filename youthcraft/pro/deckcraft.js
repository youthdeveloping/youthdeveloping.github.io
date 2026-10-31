/* DeckCraft Pro — 발표 자료 작업실. 브라우저 안에서만 처리하며 AI 기능은 없습니다. */
(()=>{'use strict';
if(!window.YC)return;
const {el}=YC,say=YC.say,SW=960,SH=540;
const root=YC.workspace({title:'DeckCraft',intro:'슬라이드를 만들고 발표하고, PPTX·HTML·PNG·PDF로 내보냅니다.',subtitle:'모든 편집과 파일 변환은 이 브라우저 안에서 이뤄집니다.'}).root;
const THEMES={
  night:{name:'어두운 밤',bg:'#14161c',fg:'#f4f4f6',acc:'#70f0bd'},
  paper:{name:'종이',bg:'#fbfaf6',fg:'#222222',acc:'#c0392b'},
  ocean:{name:'바다',bg:'#0e2a47',fg:'#ffffff',acc:'#ffd166'},
  forest:{name:'숲',bg:'#173a2a',fg:'#f3f7f4',acc:'#f2c14e'}};
const FONTS=['Noto Sans KR','Noto Serif KR','Arial','Georgia','Courier New'];
let deck={theme:'night',slides:[]},cur=0,selId=null,ver=0;
const uid=()=>YC.uid();
const T=()=>THEMES[deck.theme]||THEMES.night;
const mk=(type,o={})=>({id:uid(),type,x:80,y:80,w:300,h:80,text:'',size:28,color:null,fill:null,bold:false,italic:false,align:'left',font:'Noto Sans KR',...o});
function layoutSlide(kind){
  const t=T();
  if(kind==='title')return[mk('text',{x:80,y:170,w:800,h:120,text:'발표 제목',size:60,bold:true,align:'center'}),mk('text',{x:80,y:310,w:800,h:60,text:'부제목 또는 발표자',size:28,align:'center',color:t.acc})];
  if(kind==='bullets')return[mk('text',{x:60,y:40,w:840,h:80,text:'제목',size:44,bold:true,color:t.acc}),mk('text',{x:60,y:140,w:840,h:340,text:'• 첫 번째 항목\n• 두 번째 항목\n• 세 번째 항목',size:30})];
  if(kind==='two')return[mk('text',{x:60,y:40,w:840,h:80,text:'제목',size:44,bold:true,color:t.acc}),mk('text',{x:60,y:140,w:410,h:340,text:'왼쪽 내용',size:26}),mk('text',{x:490,y:140,w:410,h:340,text:'오른쪽 내용',size:26})];
  if(kind==='section')return[mk('rect',{x:0,y:0,w:24,h:540,fill:t.acc}),mk('text',{x:80,y:210,w:800,h:120,text:'섹션 제목',size:54,bold:true})];
  return[];
}
const newSlide=k=>({id:uid(),notes:'',bg:null,els:layoutSlide(k)});
deck.slides.push(newSlide('title'),newSlide('bullets'));
const S=()=>deck.slides[cur],E=()=>S().els.find(e=>e.id===selId);

/* ---------- 요소 DOM 그리기 ---------- */
function elNode(e,t){
  const d=document.createElement('div');d.className='dk-el';d.dataset.id=e.id;
  d.style.cssText=`left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;`;
  if(e.type==='rect'||e.type==='ellipse'){d.style.background=e.fill||t.acc;if(e.type==='ellipse')d.style.borderRadius='50%'}
  else if(e.type==='line'){d.style.background=e.fill||t.fg;d.style.height=Math.max(2,e.h)+'px'}
  else if(e.type==='image'){const i=document.createElement('img');i.src=e.src;i.alt=e.text||'이미지';i.draggable=false;i.style.cssText='width:100%;height:100%;object-fit:contain;pointer-events:none';d.append(i)}
  else{d.style.cssText+=`color:${e.color||t.fg};font:${e.italic?'italic ':''}${e.bold?'700':'400'} ${e.size}px/1.3 '${e.font}',system-ui,sans-serif;text-align:${e.align};white-space:pre-wrap;overflow:hidden;`;if(e.fill)d.style.background=e.fill;d.textContent=e.text}
  return d;
}
function slideNode(s,scale=1,interactive=false){
  const t=T(),n=document.createElement('div');n.className='dk-slide';n.style.cssText=`width:${SW}px;height:${SH}px;background:${s.bg||t.bg};transform:scale(${scale});transform-origin:0 0`;
  for(const e of s.els)n.append(elNode(e,t));return n;
}
/* ---------- 화면 구성 ---------- */
const css=el('style',null,`
.dk{display:grid;grid-template-columns:170px minmax(0,1fr) 250px;gap:10px;margin-top:8px}
@media(max-width:980px){.dk{grid-template-columns:1fr}}
.dk-list{max-height:620px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.dk-th{position:relative;width:150px;height:84px;border:2px solid #36363f;border-radius:6px;overflow:hidden;cursor:pointer;background:#000;flex:none}
.dk-th.on{border-color:#70f0bd}.dk-th .no{position:absolute;left:3px;bottom:2px;font-size:10px;background:#000a;color:#fff;padding:0 4px;border-radius:3px;z-index:2}
.dk-th .dk-slide{pointer-events:none}
.dk-stagewrap{background:#2a2a32;border-radius:8px;padding:10px;overflow:auto}
.dk-fit{position:relative;margin:0 auto}
.dk-slide{position:absolute;left:0;top:0;overflow:hidden;box-shadow:0 2px 12px #0008}
.dk-el{position:absolute;box-sizing:border-box;cursor:move;user-select:none;padding:2px 4px}
.dk-el.sel{outline:2px solid #70f0bd}
.dk-h{position:absolute;right:0;bottom:0;width:12px;height:12px;background:#70f0bd;border:1px solid #000;cursor:nwse-resize;z-index:5}
.dk-ins{display:flex;flex-direction:column;gap:6px;font-size:12px}
.dk-ins label{display:grid;grid-template-columns:70px minmax(0,1fr);gap:6px;align-items:center;color:#aaaab4}
.dk-ins input,.dk-ins select,.dk-ins textarea{font:inherit;background:#101014;color:#f6f6f8;border:1px solid #36363f;border-radius:6px;padding:4px 6px;min-width:0}
.dk-bar{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.dk-pres{position:fixed;inset:0;background:#000;z-index:3000;display:grid;place-items:center}
.dk-pres .dk-fit{margin:0}
`);document.head.append(css);
const stageHold=el('div',{class:'dk-fit'}),stageWrap=el('div',{class:'dk-stagewrap'},stageHold),list=el('div',{class:'dk-list',role:'listbox','aria-label':'슬라이드 목록'}),ins=el('div',{class:'dk-ins'});
let scale=1;
function fit(){const w=Math.max(300,stageWrap.clientWidth-20);scale=Math.min(1.2,w/SW);stageHold.style.width=SW*scale+'px';stageHold.style.height=SH*scale+'px'}
function renderStage(){
  fit();stageHold.replaceChildren();const n=slideNode(S(),scale);stageHold.append(n);
  const e=E();if(e){const d=n.querySelector(`[data-id="${e.id}"]`);if(d){d.classList.add('sel');const h=el('div',{class:'dk-h','data-h':'1',title:'크기 조절'});d.append(h)}}
  n.addEventListener('pointerdown',onDown);n.addEventListener('dblclick',onDbl);
}
function renderList(){
  list.replaceChildren(...deck.slides.map((s,i)=>{const th=el('div',{class:'dk-th'+(i===cur?' on':''),role:'option','aria-selected':String(i===cur),tabindex:0,draggable:true},el('span',{class:'no'},String(i+1)));
    th.append(slideNode(s,150/SW));
    th.addEventListener('click',()=>{cur=i;selId=null;all()});th.addEventListener('keydown',e=>{if(e.key==='Enter')th.click()});
    th.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',String(i)));th.addEventListener('dragover',e=>e.preventDefault());
    th.addEventListener('drop',e=>{e.preventDefault();const f=+e.dataTransfer.getData('text/plain');if(isNaN(f)||f===i)return;const[m]=deck.slides.splice(f,1);deck.slides.splice(i,0,m);cur=i;commit();all()});return th}));
}
function renderIns(){
  ins.replaceChildren();const e=E(),s=S();
  const row=(l,node)=>el('label',null,l,node);
  const num=(k,min,max)=>{const i=el('input',{type:'number',value:Math.round(e[k]),min,max});i.addEventListener('input',()=>{e[k]=+i.value;renderStage();renderList()});i.addEventListener('change',commit);return i};
  if(!e){
    const th=el('select',{'aria-label':'테마'},Object.entries(THEMES).map(([k,v])=>el('option',{value:k,selected:k===deck.theme},v.name)));th.addEventListener('change',()=>{deck.theme=th.value;commit();all()});
    const bg=el('input',{type:'color',value:s.bg||T().bg,'aria-label':'이 슬라이드 배경'});bg.addEventListener('input',()=>{s.bg=bg.value;renderStage();renderList()});bg.addEventListener('change',commit);
    const nt=el('textarea',{rows:6,'aria-label':'발표자 노트'});nt.value=s.notes;nt.addEventListener('input',()=>{s.notes=nt.value;YC.dirty()});nt.addEventListener('change',commit);
    ins.append(el('b',null,'슬라이드 '+(cur+1)),row('테마',th),row('배경',bg),row('노트',nt),el('p',{class:'ycp-note'},'요소를 클릭하면 속성이 나타납니다.'));return}
  ins.append(el('b',null,{text:'텍스트',rect:'사각형',ellipse:'원',line:'선',image:'이미지'}[e.type]));
  if(e.type==='text'){
    const tx=el('textarea',{rows:4,'aria-label':'텍스트'});tx.value=e.text;tx.addEventListener('input',()=>{e.text=tx.value;renderStage();renderList()});tx.addEventListener('change',commit);ins.append(row('내용',tx));
    const fs=el('select',{'aria-label':'글꼴'},FONTS.map(f=>el('option',{selected:f===e.font},f)));fs.addEventListener('change',()=>{e.font=fs.value;commit();all()});ins.append(row('글꼴',fs),row('크기',num('size',8,200)));
    const al=el('select',{'aria-label':'정렬'},[['left','왼쪽'],['center','가운데'],['right','오른쪽']].map(([v,t])=>el('option',{value:v,selected:v===e.align},t)));al.addEventListener('change',()=>{e.align=al.value;commit();all()});ins.append(row('정렬',al));
    const b=el('input',{type:'checkbox',checked:e.bold,'aria-label':'굵게'});b.addEventListener('change',()=>{e.bold=b.checked;commit();all()});const i=el('input',{type:'checkbox',checked:e.italic,'aria-label':'기울임'});i.addEventListener('change',()=>{e.italic=i.checked;commit();all()});ins.append(row('굵게',b),row('기울임',i));
    const c=el('input',{type:'color',value:e.color||T().fg,'aria-label':'글자색'});c.addEventListener('input',()=>{e.color=c.value;renderStage();renderList()});c.addEventListener('change',commit);ins.append(row('글자색',c));
  }
  if(e.type!=='image'){const f=el('input',{type:'color',value:e.fill||(e.type==='text'?'#000000':T().acc),'aria-label':'채우기 색'});f.addEventListener('input',()=>{e.fill=f.value;renderStage();renderList()});f.addEventListener('change',commit);ins.append(row('채우기',f));
    if(e.type==='text'&&e.fill)ins.append(YC.btn('채우기 없애기',()=>{e.fill=null;commit();all()}))}
  else{const a=el('input',{type:'text',value:e.text||'','aria-label':'대체 텍스트'});a.addEventListener('input',()=>{e.text=a.value});a.addEventListener('change',commit);ins.append(row('대체 텍스트',a))}
  ins.append(row('X',num('x',-2000,3000)),row('Y',num('y',-2000,3000)),row('너비',num('w',4,3000)),row('높이',num('h',2,3000)));
  ins.append(YC.row(YC.btn('앞으로',()=>zmove(1)),YC.btn('뒤로',()=>zmove(-1)),YC.btn('복제',dup),YC.btn('삭제',del)),YC.row(YC.btn('가로 가운데',()=>{e.x=(SW-e.w)/2;commit();all()}),YC.btn('세로 가운데',()=>{e.y=(SH-e.h)/2;commit();all()})));
}
function all(){renderStage();renderList();renderIns();stat.textContent='슬라이드 '+(cur+1)+' / '+deck.slides.length;}
function commit(){hist.commit();YC.dirty()}
/* ---------- 조작 ---------- */
let drag=null;
function onDown(ev){
  const h=ev.target.closest('.dk-h'),d=ev.target.closest('.dk-el');
  if(!d){selId=null;renderStage();renderIns();return}
  selId=d.dataset.id;const e=E();
  drag={mode:h?'size':'move',sx:ev.clientX,sy:ev.clientY,ox:e.x,oy:e.y,ow:e.w,oh:e.h,moved:false};
  if(!h){renderStage();renderIns()}
  window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp,{once:true});ev.preventDefault();
}
function onMove(ev){
  if(!drag)return;const e=E(),dx=(ev.clientX-drag.sx)/scale,dy=(ev.clientY-drag.sy)/scale;drag.moved=true;
  if(drag.mode==='move'){e.x=Math.round(drag.ox+dx);e.y=Math.round(drag.oy+dy)}else{e.w=Math.max(4,Math.round(drag.ow+dx));e.h=Math.max(2,Math.round(drag.oh+dy))}
  const d=stageHold.querySelector(`[data-id="${e.id}"]`);if(d){d.style.left=e.x+'px';d.style.top=e.y+'px';d.style.width=e.w+'px';d.style.height=e.h+'px'}
}
function onUp(){window.removeEventListener('pointermove',onMove);if(drag&&drag.moved){commit();renderList();renderIns()}else renderIns();drag=null}
function onDbl(ev){
  const d=ev.target.closest('.dk-el'),e=d&&E();if(!e||e.type!=='text')return;
  d.contentEditable='plaintext-only';d.style.cursor='text';d.style.userSelect='text';d.focus();
  const fin=()=>{e.text=d.innerText.replace(/\n$/,'');d.contentEditable='false';commit();all()};
  d.addEventListener('blur',fin,{once:true});d.addEventListener('keydown',k=>{k.stopPropagation();if(k.key==='Escape')d.blur()});
}
function add(type,o){const e=mk(type,o);S().els.push(e);selId=e.id;commit();all();return e}
function del(){const s=S();s.els=s.els.filter(x=>x.id!==selId);selId=null;commit();all()}
function dup(){const e=E();if(!e)return;const c=YC.clone(e);c.id=uid();c.x+=20;c.y+=20;S().els.push(c);selId=c.id;commit();all()}
function zmove(d){const a=S().els,i=a.findIndex(x=>x.id===selId),j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];commit();all()}
function addSlide(kind){deck.slides.splice(cur+1,0,newSlide(kind));cur++;selId=null;commit();all()}
function delSlide(){if(deck.slides.length<2){say('슬라이드는 최소 한 장이 필요합니다.',true);return}deck.slides.splice(cur,1);cur=Math.max(0,cur-1);selId=null;commit();all()}
function dupSlide(){const c=YC.clone(S());c.id=uid();c.els.forEach(e=>e.id=uid());deck.slides.splice(cur+1,0,c);cur++;selId=null;commit();all()}
async function addImage(){
  const f=(await YC.pick('image/png,image/jpeg,image/gif,image/webp'))[0];if(!f)return;if(f.size>4*1024*1024){say('이미지는 4MB 이하만 넣을 수 있습니다.',true);return}
  const src=await YC.readDataURL(f),im=await YC.loadImage(src),r=Math.min(600/im.naturalWidth,400/im.naturalHeight,1);
  add('image',{src,text:f.name,w:Math.round(im.naturalWidth*r),h:Math.round(im.naturalHeight*r),x:100,y:100});say('이미지를 넣었습니다.');
}
document.addEventListener('keydown',ev=>{
  if(!root.contains(document.activeElement)&&document.activeElement!==document.body)return;
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable)return;
  const e=E(),k=ev.key,mod=ev.ctrlKey||ev.metaKey;
  if(mod&&k.toLowerCase()==='d'&&e){ev.preventDefault();dup();return}
  if(!e)return;
  if(k==='Delete'||k==='Backspace'){ev.preventDefault();del()}
  else if(k.startsWith('Arrow')){ev.preventDefault();const s=ev.shiftKey?10:1;if(k==='ArrowLeft')e.x-=s;if(k==='ArrowRight')e.x+=s;if(k==='ArrowUp')e.y-=s;if(k==='ArrowDown')e.y+=s;commit();all()}
});
/* ---------- 발표 ---------- */
function present(){
  let i=cur;const ov=el('div',{class:'dk-pres',role:'dialog','aria-label':'발표 화면','aria-modal':'true',tabindex:0}),hold=el('div',{class:'dk-fit'});ov.append(hold);
  const draw=()=>{const sc=Math.min(innerWidth/SW,innerHeight/SH);hold.style.width=SW*sc+'px';hold.style.height=SH*sc+'px';hold.replaceChildren(slideNode(deck.slides[i],sc));ov.setAttribute('aria-label','발표 화면 '+(i+1)+' / '+deck.slides.length)};
  const close=()=>{ov.remove();removeEventListener('resize',draw);document.exitFullscreen&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{});cur=i;all()};
  ov.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if(['ArrowRight','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();if(i<deck.slides.length-1){i++;draw()}}else if(['ArrowLeft','PageUp','Backspace'].includes(e.key)){e.preventDefault();if(i>0){i--;draw()}}else if(e.key==='Home'){i=0;draw()}else if(e.key==='End'){i=deck.slides.length-1;draw()}});
  ov.addEventListener('click',e=>{if(e.clientX>innerWidth/2){if(i<deck.slides.length-1){i++;draw()}}else if(i>0){i--;draw()}});
  addEventListener('resize',draw);document.body.append(ov);draw();ov.focus();ov.requestFullscreen&&ov.requestFullscreen().catch(()=>{});
}
/* ---------- 내보내기 ---------- */
const hex=c=>(c||'#000000').replace('#','').toUpperCase().padStart(6,'0');
function wrapLines(ctx,text,w){const out=[];for(const para of String(text).split('\n')){if(para==='')out.push('');else{let line='';for(const ch of para){const t=line+ch;if(ctx.measureText(t).width>w&&line){out.push(line);line=ch}else line=t}out.push(line)}}return out}
async function drawSlide(ctx,s,k){
  const t=T();ctx.save();ctx.scale(k,k);ctx.fillStyle=s.bg||t.bg;ctx.fillRect(0,0,SW,SH);
  for(const e of s.els){
    if(e.type==='rect'){ctx.fillStyle=e.fill||t.acc;ctx.fillRect(e.x,e.y,e.w,e.h)}
    else if(e.type==='ellipse'){ctx.fillStyle=e.fill||t.acc;ctx.beginPath();ctx.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,7);ctx.fill()}
    else if(e.type==='line'){ctx.fillStyle=e.fill||t.fg;ctx.fillRect(e.x,e.y,e.w,Math.max(2,e.h))}
    else if(e.type==='image'){const im=await YC.loadImage(e.src),r=Math.min(e.w/im.naturalWidth,e.h/im.naturalHeight),w=im.naturalWidth*r,h=im.naturalHeight*r;ctx.drawImage(im,e.x+(e.w-w)/2,e.y+(e.h-h)/2,w,h)}
    else{if(e.fill){ctx.fillStyle=e.fill;ctx.fillRect(e.x,e.y,e.w,e.h)}
      ctx.fillStyle=e.color||t.fg;ctx.font=`${e.italic?'italic ':''}${e.bold?'700':'400'} ${e.size}px '${e.font}',sans-serif`;ctx.textBaseline='top';
      ctx.textAlign={left:'left',center:'center',right:'right'}[e.align];const lines=wrapLines(ctx,e.text,e.w-8),ax=e.align==='left'?e.x+4:e.align==='center'?e.x+e.w/2:e.x+e.w-4;
      lines.forEach((l,i)=>{const y=e.y+2+i*e.size*1.3;if(y<e.y+e.h)ctx.fillText(l,ax,y)})}
  }
  ctx.restore();
}
async function slidePng(i,k=2){const c=document.createElement('canvas');c.width=SW*k;c.height=SH*k;await drawSlide(c.getContext('2d'),deck.slides[i],k);return YC.canvasBlob(c)}
async function exportPng(){say('PNG를 만드는 중입니다…');const files=[];for(let i=0;i<deck.slides.length;i++){const b=await slidePng(i);files.push({name:'slide-'+String(i+1).padStart(2,'0')+'.png',data:new Uint8Array(await b.arrayBuffer())})}YC.download(YC.zip(files),'slides-png.zip');say(deck.slides.length+'장을 PNG ZIP으로 저장했습니다.')}
function exportHtml(){
  const t=T(),slides=deck.slides.map(s=>slideNode(s,1).outerHTML.replace('transform:scale(1);transform-origin:0 0','')).map(h=>'<section>'+h+'</section>').join('');
  const h=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeckCraft 발표</title><style>html,body{margin:0;background:#000;height:100%;overflow:hidden}section{display:none;position:absolute;inset:0;place-items:center}section.on{display:grid}.f{position:relative;width:${SW}px;height:${SH}px;transform-origin:center}.dk-slide{position:absolute;left:0;top:0;overflow:hidden}.dk-el{position:absolute;box-sizing:border-box;padding:2px 4px}</style></head><body>${slides}<script>var s=[].slice.call(document.querySelectorAll('section')),i=0;s.forEach(function(x){var f=document.createElement('div');f.className='f';while(x.firstChild)f.appendChild(x.firstChild);x.appendChild(f)});function fit(){var k=Math.min(innerWidth/${SW},innerHeight/${SH});s.forEach(function(x){x.firstChild.style.transform='scale('+k+')'})}function show(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(x,j){x.className=j==i?'on':''})}addEventListener('resize',fit);addEventListener('keydown',function(e){if(['ArrowRight','PageDown',' '].indexOf(e.key)>=0)show(i+1);if(['ArrowLeft','PageUp'].indexOf(e.key)>=0)show(i-1)});addEventListener('click',function(e){show(e.clientX>innerWidth/2?i+1:i-1)});fit();show(0);<\/script></body></html>`;
  YC.download(new Blob([h],{type:'text/html;charset=utf-8'}),'presentation.html');say('발표용 HTML로 저장했습니다. 화살표 키나 클릭으로 넘길 수 있습니다.');
}
function exportPdf(){
  const w=el('div',{id:'dk-print'});deck.slides.forEach(s=>{const p=el('div',{class:'dk-pp'});p.append(slideNode(s,1));w.append(p)});
  const st=el('style',null,'@media screen{#dk-print{display:none}}@page{size:960px 540px;margin:0}@media print{body>*:not(#dk-print){display:none!important}#dk-print .dk-pp{width:960px;height:540px;position:relative;page-break-after:always;overflow:hidden}#dk-print .dk-slide{box-shadow:none}}');
  document.body.append(w,st);const done=()=>{w.remove();st.remove();removeEventListener('afterprint',done)};addEventListener('afterprint',done);setTimeout(()=>window.print(),50);say('인쇄 창에서 "PDF로 저장"을 선택해 주세요.');
}
async function exportPptx(){
  const k=12192000/SW; // 슬라이드 폭 960 -> 12192000 EMU
  const em=v=>Math.round(v*k);const files=[];const rels=[],media=[];let mi=0;
  const slideXml=(s,idx)=>{let sp='',rid=1,rel='<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';let id=2;const t=T();
    for(const e of s.els){const xf=`<a:xfrm><a:off x="${em(e.x)}" y="${em(e.y)}"/><a:ext cx="${em(e.w)}" cy="${em(Math.max(e.h,2))}"/></a:xfrm>`;
      if(e.type==='image'){const m=/^data:image\/(png|jpe?g|gif|webp);base64,(.*)$/.exec(e.src);if(!m||m[1]==='webp')continue;const ext=m[1]==='jpeg'?'jpg':m[1];const name='image'+(++mi)+'.'+ext;media.push({name:'ppt/media/'+name,data:Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0))});rid++;rel+=`<Relationship Id="rId${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`;
        sp+=`<p:pic><p:nvPicPr><p:cNvPr id="${++id}" name="Picture ${id}" descr="${x(e.text||'')}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xf}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;continue}
      const geom=e.type==='ellipse'?'ellipse':'rect';const fill=e.type==='text'?(e.fill?`<a:solidFill><a:srgbClr val="${hex(e.fill)}"/></a:solidFill>`:'<a:noFill/>'):`<a:solidFill><a:srgbClr val="${hex(e.fill||(e.type==='line'?t.fg:t.acc))}"/></a:solidFill>`;
      let body='<p:txBody><a:bodyPr wrap="square" lIns="50800" tIns="25400" rIns="50800" bIns="25400"/><a:lstStyle/><a:p><a:endParaRPr lang="ko-KR"/></a:p></p:txBody>';
      if(e.type==='text'){const al={left:'l',center:'ctr',right:'r'}[e.align];body='<p:txBody><a:bodyPr wrap="square" lIns="50800" tIns="25400" rIns="50800" bIns="25400"/><a:lstStyle/>'+String(e.text).split('\n').map(l=>`<a:p><a:pPr algn="${al}"/>${l?`<a:r><a:rPr lang="ko-KR" sz="${Math.round(e.size*75)}" b="${e.bold?1:0}" i="${e.italic?1:0}"><a:solidFill><a:srgbClr val="${hex(e.color||t.fg)}"/></a:solidFill><a:latin typeface="${x(e.font)}"/><a:ea typeface="${x(e.font)}"/></a:rPr><a:t>${x(l)}</a:t></a:r>`:`<a:endParaRPr lang="ko-KR" sz="${Math.round(e.size*75)}"/>`}</a:p>`).join('')+'</p:txBody>'}
      sp+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Shape ${id}"/><p:cNvSpPr${e.type==='text'?' txBox="1"':''}/><p:nvPr/></p:nvSpPr><p:spPr>${xf}<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${fill}<a:ln><a:noFill/></a:ln></p:spPr>${body}</p:sp>`}
    const bg=`<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(s.bg||t.bg)}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
    return{xml:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${sp}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,rels:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`}};
  const NS='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const n=deck.slides.length;let ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>';
  const sl=[];deck.slides.forEach((s,i)=>{const o=slideXml(s,i);ct+=`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;files.push({name:`ppt/slides/slide${i+1}.xml`,data:o.xml},{name:`ppt/slides/_rels/slide${i+1}.xml.rels`,data:o.rels})});
  ct+='</Types>';
  const theme=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="DeckCraft"><a:themeElements><a:clrScheme name="D"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="4E79A7"/></a:accent1><a:accent2><a:srgbClr val="F28E2B"/></a:accent2><a:accent3><a:srgbClr val="E15759"/></a:accent3><a:accent4><a:srgbClr val="76B7B2"/></a:accent4><a:accent5><a:srgbClr val="59A14F"/></a:accent5><a:accent6><a:srgbClr val="EDC948"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="D"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="D"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const master=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;
  const layout=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${NS} type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const pres=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${deck.slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>${deck.slides.map((_,i)=>`<Relationship Id="rId${i+2}" Type="${R}/slide" Target="slides/slide${i+1}.xml"/>`).join('')}<Relationship Id="rId${n+2}" Type="${R}/theme" Target="theme/theme1.xml"/></Relationships>`;
  const rel=(id,type,target)=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/></Relationships>`;
  const masterRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${R}/theme" Target="../theme/theme1.xml"/></Relationships>`;
  files.push({name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:rel('rId1','officeDocument','ppt/presentation.xml')},{name:'ppt/presentation.xml',data:pres},{name:'ppt/_rels/presentation.xml.rels',data:presRels},{name:'ppt/slideMasters/slideMaster1.xml',data:master},{name:'ppt/slideMasters/_rels/slideMaster1.xml.rels',data:masterRels},{name:'ppt/slideLayouts/slideLayout1.xml',data:layout},{name:'ppt/slideLayouts/_rels/slideLayout1.xml.rels',data:rel('rId1','slideMaster','../slideMasters/slideMaster1.xml')},{name:'ppt/theme/theme1.xml',data:theme},...media);
  const blob=YC.zip(files);YC.download(new Blob([blob],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),'presentation.pptx');
  say('.pptx 로 저장했습니다. 슬라이드 요소는 편집 가능한 상태로 들어가며 WebP 이미지는 제외됩니다. 발표자 노트는 담기지 않습니다.');
}
const x=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
YC.quickExport(exportPptx);
/* ---------- 기록·저장 ---------- */
const hist=YC.history(()=>deck,s=>{deck=s;cur=Math.min(cur,deck.slides.length-1);if(!E())selId=null;all()},60);
YC.bindHistoryKeys(hist,root);
YC.adapter({export:()=>deck,async import(s){if(!s||!Array.isArray(s.slides)||!s.slides.length)throw new Error('슬라이드가 없는 프로젝트입니다.');deck=s;cur=0;selId=null;hist.reset();all()}});
/* ---------- 도구 막대 ---------- */
const stat=el('div',{class:'ycp-note',role:'status'});
const lay=el('select',{'aria-label':'새 슬라이드 레이아웃'},el('option',{value:''},'+ 새 슬라이드'),...[['title','제목'],['bullets','제목과 목록'],['two','두 단'],['section','섹션'],['blank','빈 슬라이드']].map(([v,t])=>el('option',{value:v},t)));lay.addEventListener('change',()=>{if(lay.value)addSlide(lay.value);lay.value=''});
const ex=el('select',{'aria-label':'내보내기'},el('option',{value:''},'내보내기'),...[['pptx','.pptx'],['html','발표용 HTML'],['png','PNG (ZIP)'],['pdf','PDF (인쇄)']].map(([v,t])=>el('option',{value:v},t)));ex.addEventListener('change',()=>{const v=ex.value;ex.value='';({pptx:exportPptx,html:exportHtml,png:exportPng,pdf:exportPdf})[v]()});
const bar=el('div',{class:'dk-bar',role:'toolbar','aria-label':'도구'},lay,YC.btn('슬라이드 복제',dupSlide),YC.btn('슬라이드 삭제',delSlide),
  YC.btn('텍스트',()=>add('text',{text:'텍스트',w:300,h:60})),YC.btn('사각형',()=>add('rect',{w:200,h:120,x:120,y:120})),YC.btn('원',()=>add('ellipse',{w:140,h:140,x:140,y:140})),YC.btn('선',()=>add('line',{w:300,h:4,x:100,y:300})),YC.btn('이미지',addImage),
  YC.btn('실행 취소',()=>hist.undo()),YC.btn('다시 실행',()=>hist.redo()),YC.btn('발표',present,{primary:true}),ex);
const grid=el('div',{class:'dk'},list,stageWrap,ins);
const st=YC._status;for(const n of[bar,grid,stat])root.insertBefore(n,st);
root.insertBefore(el('p',{class:'ycp-note'},'사용법: 요소를 끌어 옮기고 오른쪽 아래 모서리로 크기를 바꿉니다. 텍스트는 두 번 클릭해 편집하고, 방향키로 1px(Shift는 10px) 이동, Delete로 삭제, Ctrl+D로 복제합니다. 지원하지 않는 항목: 애니메이션, 화면 전환, 표, 차트, 요소 회전.'),st);
addEventListener('resize',YC.debounce(()=>{renderStage()},120));
hist.reset();all();
window.__deckcraft={get deck(){return deck},get cur(){return cur},get selId(){return selId},add,addSlide,exportPptx,slidePng,hist,all};
})();
