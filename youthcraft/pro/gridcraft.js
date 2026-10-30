/* GridCraft Pro — 스프레드시트 작업실. 계산 엔진은 gridcalc.js, 파일 입출력은 gridio.js. AI 기능은 없습니다. */
(()=>{'use strict';
if(!window.YC||!window.YCGridCalc||!window.YCGridIO)return;
const {el}=YC,G=window.YCGridCalc,IO=window.YCGridIO,{Engine,formatValue,isErr,colName,colNum}=G;
const DEF_W=90,DEF_H=24,HEAD_H=24,HEAD_W=52,MAXR=G.MAXR,MAXC=G.MAXC,PAL=['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7'];
let eng=new Engine(),meta=[],si=0,sel={r1:0,c1:0,r2:0,c2:0,ar:0,ac:0},ver=0,editing=null,clip=null,colLeft=null,rowTop=null,mergeAt=new Map(),mergeCover=new Set();
const newMeta=()=>({colW:{},rowH:{},merges:[],freeze:{r:0,c:0},cf:[],dv:[],notes:{},charts:[],filter:null,color:'',pivot:null});
meta=[newMeta()];
const S=()=>eng.sheets[si],M=()=>meta[si],say=YC.say;
const rngStr=(r)=>colName(r.c1)+(r.r1+1)+(r.r1===r.r2&&r.c1===r.c2?'':':'+colName(r.c2)+(r.r2+1));
const norm=s=>({r1:Math.min(s.r1,s.r2),r2:Math.max(s.r1,s.r2),c1:Math.min(s.c1,s.c2),c2:Math.max(s.c1,s.c2)});
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const cellOf=(r,c,create)=>{const sh=S(),k=r+','+c;let x=sh.cells[k];if(!x&&create){x=sh.cells[k]={raw:'',v:null};if(r+1>sh.maxR)sh.maxR=r+1;if(c+1>sh.maxC)sh.maxC=c+1}return x};
const rawOf=(r,c)=>{const x=S().cells[r+','+c];return x?x.raw||'':''};

/* ================= 스타일(CSS) ================= */
const css=el('style',null,`
.gc-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.gc-bar select,.gc-bar input[type=text]{height:28px}
.gc-fx{display:flex;gap:6px;align-items:center;margin:6px 0}
.gc-fx input{flex:1;min-width:0;height:30px;font-family:ui-monospace,Menlo,Consolas,monospace}
.gc-name{width:96px!important;flex:none!important;text-align:center}
.gc-scroll{position:relative;overflow:auto;height:min(62vh,560px);background:#101014;border:1px solid #36363f;border-radius:8px;outline:none}
.gc-sizer{position:relative}
.gc-c,.gc-h{position:absolute;box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:clip;font-size:12px;line-height:23px;padding:0 4px;border-right:1px solid #2a2a33;border-bottom:1px solid #2a2a33;color:#f0f0f4;background:#14141a;user-select:none}
.gc-c.wrap{white-space:normal;line-height:1.25;padding-top:2px}
.gc-h{background:#1f1f27;color:#a8a8b2;text-align:center;font-size:11px;z-index:6;cursor:pointer;border-color:#383842}
.gc-h.on{background:#254337;color:#70f0bd}
.gc-corner{z-index:9}
.gc-fz{z-index:4}
.gc-sel{position:absolute;pointer-events:none;border:2px solid #70f0bd;background:rgba(112,240,189,.08);z-index:8;box-sizing:border-box}
.gc-fill{position:absolute;width:8px;height:8px;background:#70f0bd;border:1px solid #101014;z-index:9;cursor:crosshair}
.gc-ref{position:absolute;pointer-events:none;border:2px solid;z-index:7;box-sizing:border-box}
.gc-edit{position:absolute;z-index:12;box-sizing:border-box;font:12px/1.3 ui-monospace,Menlo,Consolas,monospace;background:#101014;color:#fff;border:2px solid #70f0bd;padding:2px 4px;resize:none;overflow:hidden;min-height:24px}
.gc-note{position:absolute;right:0;top:0;border-left:7px solid transparent;border-top:7px solid #ff6b6b;width:0;height:0}
.gc-dd{position:absolute;right:1px;top:1px;width:18px;height:20px;padding:0!important;line-height:1;font-size:10px;z-index:10}
.gc-bar-d{position:absolute;left:0;top:3px;bottom:3px;opacity:.55;pointer-events:none}
.gc-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;align-items:center}
.gc-tab{border:1px solid #454550;background:#25252d;color:#f6f6f8;border-radius:7px 7px 0 0;padding:5px 12px;font-size:12px;cursor:pointer;border-bottom:3px solid transparent}
.gc-tab.on{background:#1d2a26;border-color:#70f0bd}
.gc-back{position:fixed;inset:0;background:#000b;z-index:2000;display:grid;place-items:center;padding:14px}
.gc-dlg{background:#1a1a20;border:1px solid #454550;border-radius:12px;padding:16px;width:min(520px,100%);max-height:86vh;overflow:auto;color:#f6f6f8}
.gc-dlg h3{margin:0 0 10px;font-size:15px}
.gc-dlg label{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;align-items:center;margin:6px 0;font-size:12px;color:#aaaab4}
.gc-dlg input,.gc-dlg select,.gc-dlg textarea{font:inherit;font-size:12px;background:#101014;color:#f6f6f8;border:1px solid #36363f;border-radius:6px;padding:6px 8px;min-width:0}
.gc-pop{position:fixed;z-index:1500;background:#1a1a20;border:1px solid #454550;border-radius:8px;padding:8px;max-height:320px;overflow:auto;min-width:180px;font-size:12px}
.gc-pop label{display:flex;gap:6px;align-items:center;padding:2px 0}
.gc-charts{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));margin-top:10px}
.gc-chart{background:#fff;color:#222;border-radius:8px;padding:6px;position:relative}
.gc-chart .gc-ct{display:flex;gap:4px;justify-content:flex-end;margin-bottom:2px}
.gc-chart button{background:#eee!important;color:#222!important;border-color:#ccc!important}
.gc-chart svg{display:block;width:100%;height:auto}
.gc-stat{font-size:11px;color:#aaaab4;margin-top:4px;min-height:16px}
.gc-hide-r{display:none}
`);
document.head.append(css);

/* ================= 레이아웃 계산 ================= */
function layout(){
  const m=M();colLeft=new Float64Array(MAXC+1);for(let c=0;c<MAXC;c++)colLeft[c+1]=colLeft[c]+(m.colW[c]??DEF_W);
  rowTop=new Float64Array(MAXR+1);const hid=hiddenRows();for(let r=0;r<MAXR;r++)rowTop[r+1]=rowTop[r]+(hid.has(r)?0:(m.rowH[r]??DEF_H));
  mergeAt=new Map();mergeCover=new Set();
  for(const g of m.merges){mergeAt.set(g.r1+','+g.c1,g);const area=(g.r2-g.r1+1)*(g.c2-g.c1+1);if(area<=40000)for(let r=g.r1;r<=g.r2;r++)for(let c=g.c1;c<=g.c2;c++)if(r!==g.r1||c!==g.c1)mergeCover.add(r+','+c)}
  sizer.style.width=(HEAD_W+colLeft[MAXC])+'px';sizer.style.height=(HEAD_H+rowTop[MAXR])+'px';
}
let hidCache=null,hidVer=-1;
function hiddenRows(){
  const f=M().filter;if(!f||!f.on)return new Set();
  if(hidCache&&hidVer===ver&&hidCache.si===si)return hidCache.s;
  const s=new Set(),sh=S();
  for(let r=f.r0+1;r<=f.r2;r++){for(const c in f.ex){const v=dispText(r,+c);if(f.ex[c].includes(v)){s.add(r);break}}}
  hidCache={s,si};hidVer=ver;return s;
}
const bs=(arr,x)=>{let lo=0,hi=arr.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(arr[mid]<=x)lo=mid;else hi=mid-1}return lo};
const colAt=x=>Math.min(MAXC-1,bs(colLeft,Math.max(0,x)));
const rowAt=y=>{let r=Math.min(MAXR-1,bs(rowTop,Math.max(0,y)));while(r<MAXR-1&&rowTop[r+1]===rowTop[r])r++;return r};

/* ================= 값 표시 ================= */
function dispText(r,c){
  const x=S().cells[r+','+c],v=eng.get(si,r,c),fmt=x&&x.s&&x.s.fmt||x&&x.autoFmt||null;
  if(v&&v.__spark)return '';
  if(fmt==='@')return G.toStr(v);
  try{return formatValue(v,fmt)}catch(_){return String(v)}
}
/* ================= 조건부 서식 ================= */
const cfCache=new Map();
function cfStats(rule){const k=rule.id+':'+ver;if(cfCache.has(k))return cfCache.get(k);const g=rule.range;let mn=Infinity,mx=-Infinity;const rr=Math.min(g.r2,S().maxR+5);for(let r=g.r1;r<=rr;r++)for(let c=g.c1;c<=g.c2;c++){const v=eng.get(si,r,c);if(typeof v==='number'){if(v<mn)mn=v;if(v>mx)mx=v}}const o={mn,mx};if(cfCache.size>200)cfCache.clear();cfCache.set(k,o);return o}
const mix=(a,b,t)=>{const A=YC.rgb(a),B=YC.rgb(b);return YC.hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t)};
function cfApply(r,c,v){
  let out=null;
  for(const rule of M().cf){const g=rule.range;if(r<g.r1||r>g.r2||c<g.c1||c>g.c2)continue;
    if(rule.type==='cell'){const a=+rule.v1,b=+rule.v2;let ok=false;const n=typeof v==='number'?v:NaN,sv=String(v??'');
      const cmp=(x,y)=>typeof v==='number'&&!isNaN(y)?x:null;
      if(rule.op==='between')ok=typeof v==='number'&&v>=Math.min(a,b)&&v<=Math.max(a,b);
      else if(typeof v==='number'&&!isNaN(a))ok={'>':n>a,'<':n<a,'>=':n>=a,'<=':n<=a,'=':n===a,'<>':n!==a}[rule.op];
      else if(rule.op==='='||rule.op==='<>'){const eq=sv.toLowerCase()===String(rule.v1).toLowerCase();ok=rule.op==='='?eq:!eq}
      if(ok)out=Object.assign(out||{},{bg:rule.bg,col:rule.col})}
    else if(rule.type==='text'){if(typeof v==='string'&&v.toLowerCase().includes(String(rule.v1).toLowerCase()))out=Object.assign(out||{},{bg:rule.bg,col:rule.col})}
    else if(typeof v==='number'){const st=cfStats(rule),t=st.mx>st.mn?(v-st.mn)/(st.mx-st.mn):0.5;
      if(rule.type==='scale')out=Object.assign(out||{},{bg:mix(rule.lo,rule.hi,t)});
      else if(rule.type==='bar')out=Object.assign(out||{},{bar:{t,col:rule.bg}});
      else if(rule.type==='icon')out=Object.assign(out||{},{icon:t<1/3?['▼','#ff6b6b']:t<2/3?['■','#edc948']:['▲','#59d98e']})}}
  return out;
}
/* ================= 렌더링 ================= */
const root=YC.workspace({title:'GridCraft',intro:'수식·서식·차트·피벗을 지원하는 브라우저 스프레드시트입니다. CSV와 .xlsx를 가져오고 내보낼 수 있습니다.',subtitle:'모든 계산과 파일 처리는 이 브라우저 안에서 이뤄집니다. 논리 크기는 '+MAXR.toLocaleString()+'행 × '+MAXC+'열이며, 보이는 영역만 그립니다.'}).root;
const scroller=el('div',{class:'gc-scroll',tabindex:0,role:'grid','aria-label':'스프레드시트 격자. 방향키로 이동하고 입력하면 셀을 편집합니다.'});
const sizer=el('div',{class:'gc-sizer'});scroller.append(sizer);
const live=el('div',{class:'ycp-sr',role:'status','aria-live':'polite'});
let layer=el('div');sizer.append(layer);
function render(){
  if(!colLeft)layout();
  const sc=scroller,st=sc.scrollTop,sl=sc.scrollLeft,vw=sc.clientWidth,vh=sc.clientHeight,fz=M().freeze,fr=fz.r,fc=fz.c;
  const c0=colAt(sl-0),c1=colAt(sl+vw),r0=rowAt(st),r1=rowAt(st+vh);
  const cols=[],rows=[];for(let c=0;c<fc;c++)cols.push(c);for(let c=Math.max(fc,c0);c<=c1+1&&c<MAXC;c++)cols.push(c);
  for(let r=0;r<fr;r++)rows.push(r);for(let r=Math.max(fr,r0);r<=r1+1&&r<MAXR;r++)rows.push(r);
  const frag=document.createDocumentFragment(),N=norm(sel),fcOff=fc?colLeft[fc]:0;
  const X=c=>HEAD_W+colLeft[c]+(c<fc?sl:0),Y=r=>HEAD_H+rowTop[r]+(r<fr?st:0),W=c=>colLeft[c+1]-colLeft[c],H=r=>rowTop[r+1]-rowTop[r];
  // 틀 고정 경계에 가려지는 일반 영역을 위해, 일반 셀은 고정 영역 뒤로 스크롤됨(z-index 로 처리)
  const flt=M().filter;
  for(const r of rows){const h=H(r);if(h<=0)continue;
    for(const c of cols){
      const key=r+','+c;if(mergeCover.has(key))continue;
      const g=mergeAt.get(key);let w=W(c),hh=h;if(g){w=colLeft[g.c2+1]-colLeft[g.c1];hh=rowTop[g.r2+1]-rowTop[g.r1]}
      const x=S().cells[key],v=eng.get(si,r,c),s=x&&x.s||null,cf=cfApply(r,c,v);
      const d=el('div',{class:'gc-c'+(s&&s.wrap?' wrap':'')+(r<fr||c<fc?' gc-fz':''),'data-r':r,'data-c':c,role:'gridcell','aria-colindex':c+1,'aria-rowindex':r+1});
      d.style.cssText=`left:${X(c)}px;top:${Y(r)}px;width:${w}px;height:${hh}px;`;
      let txt=dispText(r,c);
      const isNum=typeof v==='number';let al=s&&s.al?{l:'left',c:'center',r:'right'}[s.al]:(isNum?'right':typeof v==='boolean'||isErr(v)?'center':'left');
      d.style.textAlign=al;
      if(s){if(s.b)d.style.fontWeight='700';if(s.i)d.style.fontStyle='italic';if(s.col)d.style.color=s.col;if(s.bg)d.style.background=s.bg;
        if(s.bd){const b='1px solid #d8d8e0';if(s.bd.includes('l'))d.style.borderLeft=b;if(s.bd.includes('r'))d.style.borderRight=b;if(s.bd.includes('t'))d.style.borderTop=b;if(s.bd.includes('b'))d.style.borderBottom=b}}
      if(cf){if(cf.bg)d.style.background=cf.bg;if(cf.col)d.style.color=cf.col}
      if(isErr(v))d.style.color='#ff8795';
      if(v&&v.__spark){d.innerHTML=sparkSvg(v,w,hh)}
      else{if(cf&&cf.bar){const b=el('div',{class:'gc-bar-d'});b.style.cssText=`width:${Math.max(2,cf.bar.t*(w-6))}px;background:${cf.bar.col||'#4e79a7'};left:3px`;d.append(b)}
        const t=el('span',{style:'position:relative'},(cf&&cf.icon?'':'')+txt);if(cf&&cf.icon){const ic=el('span',{style:'color:'+cf.icon[1]+';margin-right:4px'},cf.icon[0]);d.append(ic)}d.append(t)}
      if(M().notes[key])d.append(el('span',{class:'gc-note'}));
      if(flt&&flt.on&&r===flt.r0&&c>=flt.c1&&c<=flt.c2){const b=el('button',{type:'button',class:'gc-dd','aria-label':colName(c)+' 열 필터','data-filter':c},flt.ex[c]&&flt.ex[c].length?'▼*':'▼');d.append(b)}
      frag.append(d)}}
  // 머리글
  for(const c of cols){const w=W(c);const d=el('div',{class:'gc-h'+(N.c1<=c&&c<=N.c2?' on':''),'data-hc':c},colName(c));d.style.cssText=`left:${X(c)}px;top:${st}px;width:${w}px;height:${HEAD_H}px;line-height:${HEAD_H-1}px;`;if(c<fc)d.style.zIndex=8;frag.append(d)}
  for(const r of rows){const h=H(r);if(h<=0)continue;const d=el('div',{class:'gc-h'+(N.r1<=r&&r<=N.r2?' on':''),'data-hr':r},String(r+1));d.style.cssText=`left:${sl}px;top:${Y(r)}px;width:${HEAD_W}px;height:${h}px;line-height:${h-1}px;`;if(r<fr)d.style.zIndex=8;frag.append(d)}
  const corner=el('div',{class:'gc-h gc-corner','data-corner':'1'},'');corner.style.cssText=`left:${sl}px;top:${st}px;width:${HEAD_W}px;height:${HEAD_H}px`;frag.append(corner);
  // 선택 영역
  const sx=HEAD_W+colLeft[N.c1],sy=HEAD_H+rowTop[N.r1],sw=colLeft[N.c2+1]-colLeft[N.c1],sh2=rowTop[N.r2+1]-rowTop[N.r1];
  const box=el('div',{class:'gc-sel'});box.style.cssText=`left:${sx-1}px;top:${sy-1}px;width:${sw+1}px;height:${sh2+1}px`;frag.append(box);
  const fh=el('div',{class:'gc-fill','data-fill':'1',title:'끌어서 채우기'});fh.style.cssText=`left:${sx+sw-4}px;top:${sy+sh2-4}px`;frag.append(fh);
  // 수식 편집 중 참조 색상
  if(editing&&editing.ta.value.startsWith('=')){let k=0;try{for(const t of G.tokenize(editing.ta.value.slice(1))){let g=null;if((t.t==='ref'&&(!t.sheet||G.Engine&&eng.sheetIdx(t.sheet)===si)))g={r1:t.r,r2:t.r,c1:t.c,c2:t.c};else if(t.t==='ref')continue;
      if(!g&&t.t==='colrange')g={r1:0,r2:MAXR-1,c1:t.a,c2:t.b};if(!g)continue;
      // 범위 A1:B2 는 토크나이저가 두 개의 ref 로 나누므로 단순 셀만 색칠
      const col=PAL[k++%PAL.length],b=el('div',{class:'gc-ref'});b.style.cssText=`left:${HEAD_W+colLeft[g.c1]}px;top:${HEAD_H+rowTop[g.r1]}px;width:${colLeft[g.c2+1]-colLeft[g.c1]}px;height:${rowTop[g.r2+1]-rowTop[g.r1]}px;border-color:${col}`;frag.append(b)}}catch(_){}}
  {const n=el('div');n.append(frag);layer.replaceWith(n);layer=n}
  if(editing)positionEditor();
  updateStat();
}
const rr=YC.raf(render);
function sparkSvg(v,w,h){const a=v.vals;if(!a.length)return '';const mn=Math.min(...a),mx=Math.max(...a),pad=3,ww=w-8,hh=h-pad*2,sc=x=>mx===mn?hh/2:hh-(x-mn)/(mx-mn)*hh;
  if(v.kind==='column'||v.kind==='bar'){const bw=ww/a.length;return `<svg width="${ww}" height="${h}" style="display:block">${a.map((x,i)=>`<rect x="${i*bw+1}" y="${pad+sc(x)}" width="${Math.max(1,bw-2)}" height="${Math.max(1,hh-sc(x))}" fill="#70f0bd"/>`).join('')}</svg>`}
  return `<svg width="${ww}" height="${h}" style="display:block"><polyline fill="none" stroke="#70f0bd" stroke-width="1.6" points="${a.map((x,i)=>(a.length>1?i*ww/(a.length-1):ww/2).toFixed(1)+','+(pad+sc(x)).toFixed(1)).join(' ')}"/></svg>`}

/* ================= 편집 ================= */
const fxInput=el('input',{type:'text','aria-label':'수식 입력줄',spellcheck:'false'});
const nameBox=el('input',{type:'text',class:'gc-name','aria-label':'이름 상자',list:'gc-names'});
const nameList=el('datalist',{id:'gc-names'});
function syncFx(){const n=norm(sel);nameBox.value=(n.r1===n.r2&&n.c1===n.c2)?colName(sel.ac)+(sel.ar+1):rngStr(n);if(!editing)fxInput.value=rawOf(sel.ar,sel.ac)}
function positionEditor(){const{ta,r,c}=editing;const g=mergeAt.get(r+','+c);const w=Math.max(colLeft[(g?g.c2:c)+1]-colLeft[c],120),x=HEAD_W+colLeft[c],y=HEAD_H+rowTop[r];ta.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${Math.max(24,Math.min(160,ta.scrollHeight))}px`}
function startEdit(initial){
  if(editing)return;const r=sel.ar,c=sel.ac;if(mergeCover.has(r+','+c))return;
  const ta=el('textarea',{class:'gc-edit',spellcheck:'false','aria-label':colName(c)+(r+1)+' 셀 편집'});ta.value=initial!==undefined?initial:rawOf(r,c);
  editing={r,c,ta,fromBar:false};sizer.append(ta);positionEditor();ta.focus();if(initial===undefined)ta.setSelectionRange(ta.value.length,ta.value.length);
  ta.addEventListener('input',()=>{fxInput.value=ta.value;positionEditor();rr()});
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.altKey){e.preventDefault();endEdit(true,e.shiftKey?-1:1,0)}
    else if(e.key==='Enter'&&e.altKey){ta.setRangeText('\n',ta.selectionStart,ta.selectionEnd,'end');ta.dispatchEvent(new Event('input'))}
    else if(e.key==='Tab'){e.preventDefault();endEdit(true,0,e.shiftKey?-1:1)}
    else if(e.key==='Escape'){e.preventDefault();endEdit(false)}
    else if(e.key==='F4'){e.preventDefault();cycleAbs(ta)}
    e.stopPropagation()});
  fxInput.value=ta.value;rr();
}
function cycleAbs(ta){const v=ta.value,p=ta.selectionStart;try{for(const t of G.tokenize(v.slice(1))){if(t.t==='ref'&&p>=t.s+1&&p<=t.e+1){const o=[[0,0],[1,1],[0,1],[1,0]],i=o.findIndex(x=>x[0]===+!!t.ra&&x[1]===+!!t.ca);const n=o[(i+1)%4];const pre=v.slice(t.s+1,t.e+1).match(/^(.*!)?/)[0];const s2=pre+(n[1]?'$':'')+colName(t.c)+(n[0]?'$':'')+(t.r+1);ta.value=v.slice(0,t.s+1)+s2+v.slice(t.e+1);ta.setSelectionRange(t.s+1+s2.length,t.s+1+s2.length);ta.dispatchEvent(new Event('input'));return}}}catch(_){}}
function endEdit(commit,dr=0,dc=0){
  if(!editing)return;const{r,c,ta}=editing;const val=ta.value;ta.remove();editing=null;
  if(commit){if(!setCellChecked(r,c,val))say('입력값이 데이터 유효성 검사 규칙에 맞지 않아 취소했습니다.',true);else commitHist()}
  scroller.focus();if(dr||dc)moveSel(dr,dc,false);else{syncFx();rr()}
}
function setCellChecked(r,c,raw){
  const old=rawOf(r,c),oldAuto=(S().cells[r+','+c]||{}).autoFmt;
  setCell(r,c,raw);
  const dv=M().dv.find(d=>r>=d.range.r1&&r<=d.range.r2&&c>=d.range.c1&&c<=d.range.c2);
  if(dv&&raw!==''&&!validOk(dv,r,c)){setCell(r,c,old);const x=S().cells[r+','+c];if(x)x.autoFmt=oldAuto;return false}
  return true;
}
function setCell(r,c,raw){
  const sh=S();let x=sh.cells[r+','+c];if(x)delete x.autoFmt;eng.setRaw(si,r,c,raw);ver++;
}
function validOk(dv,r,c){
  const v=eng.get(si,r,c);if(v===null)return true;
  if(dv.type==='list'){const items=dvItems(dv);return items.some(i=>String(i).toLowerCase()===String(v).toLowerCase())}
  if(dv.type==='number'){if(typeof v!=='number')return false;if(dv.min!==''&&v<+dv.min)return false;if(dv.max!==''&&v>+dv.max)return false;return true}
  if(dv.type==='int'){if(typeof v!=='number'||!Number.isInteger(v))return false;if(dv.min!==''&&v<+dv.min)return false;if(dv.max!==''&&v>+dv.max)return false;return true}
  if(dv.type==='date'){if(typeof v!=='number')return false;const lo=dv.min?Engine.parseInput(dv.min).v:-Infinity,hi=dv.max?Engine.parseInput(dv.max).v:Infinity;return v>=lo&&v<=hi}
  if(dv.type==='len'){const n=String(v).length;return n>=(+dv.min||0)&&n<=(dv.max===''?Infinity:+dv.max)}
  return true;
}
function dvItems(dv){const s=String(dv.items||'').trim();if(/^=?[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(s)){const m=/([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)/.exec(s);const o=[];for(let r=+m[2]-1;r<=+m[4]-1;r++)for(let c=colNum(m[1]);c<=colNum(m[3]);c++){const v=eng.get(si,r,c);if(v!==null)o.push(G.toStr(v))}return o}return s.split(',').map(x=>x.trim()).filter(Boolean)}

/* ================= 선택·이동 ================= */
function setSel(r,c,extend){
  r=cl(r,0,MAXR-1);c=cl(c,0,MAXC-1);
  if(extend){sel.r2=r;sel.c2=c}else{sel={r1:r,c1:c,r2:r,c2:c,ar:r,ac:c}}
  if(!extend){sel.r1=sel.r2=sel.ar=r;sel.c1=sel.c2=sel.ac=c}
  ensureVisible(extend?sel.r2:r,extend?sel.c2:c);syncFx();rr();
}
function moveSel(dr,dc,extend){
  const hid=hiddenRows();let r=(extend?sel.r2:sel.ar)+dr,c=(extend?sel.c2:sel.ac)+dc;
  while(dr&&hid.has(r)&&r>0&&r<MAXR-1)r+=dr>0?1:-1;
  const g=[...M().merges].find(m=>r>=m.r1&&r<=m.r2&&c>=m.c1&&c<=m.c2);if(g&&!extend){r=dr>0?g.r2+(dr?0:0):g.r1;c=g.c1;if(dr>0)r=Math.min(MAXR-1,g.r2+0)}
  setSel(r,c,extend);
}
function ensureVisible(r,c){
  const sc=scroller,fz=M().freeze,x=colLeft[c],x2=colLeft[c+1],y=rowTop[r],y2=rowTop[r+1],fx=fz.c?colLeft[fz.c]:0,fy=fz.r?rowTop[fz.r]:0;
  if(c>=fz.c){if(x-fx<sc.scrollLeft)sc.scrollLeft=x-fx;else if(x2>sc.scrollLeft+sc.clientWidth-HEAD_W)sc.scrollLeft=x2-sc.clientWidth+HEAD_W+2}
  if(r>=fz.r){if(y-fy<sc.scrollTop)sc.scrollTop=y-fy;else if(y2>sc.scrollTop+sc.clientHeight-HEAD_H)sc.scrollTop=y2-sc.clientHeight+HEAD_H+2}
}
function jump(dr,dc,extend){ // Ctrl+방향키
  let r=extend?sel.r2:sel.ar,c=extend?sel.c2:sel.ac;const sh=S(),filled=(r,c)=>{const x=sh.cells[r+','+c];return x&&(x.raw!==''||x.f)||eng.get(si,r,c)!==null};
  const mr=Math.max(0,sh.maxR-1),mc=Math.max(0,sh.maxC-1);
  if(dr){let n=r+dr;if(n<0||n>MAXR-1)return;if(filled(r,c)&&filled(n,c)){while(n+dr>=0&&n+dr<=mr&&filled(n+dr,c))n+=dr}else{while(n>=0&&n<=mr&&!filled(n,c))n+=dr;if(n<0)n=0;if(n>mr)n=dr>0?mr:n}r=n}
  if(dc){let n=c+dc;if(n<0||n>MAXC-1)return;if(filled(r,c)&&filled(r,n)){while(n+dc>=0&&n+dc<=mc&&filled(r,n+dc))n+=dc}else{while(n>=0&&n<=mc&&!filled(r,n))n+=dc;if(n<0)n=0;if(n>mc)n=dc>0?mc:n}c=n}
  setSel(r,c,extend);
}
/* ================= 입력 이벤트 ================= */
let drag=null,fillDrag=null;
function cellFromEvent(e){const rc=scroller.getBoundingClientRect(),x=e.clientX-rc.left+scroller.scrollLeft-HEAD_W,y=e.clientY-rc.top+scroller.scrollTop-HEAD_H;return{r:rowAt(y),c:colAt(x),x,y}}
scroller.addEventListener('mousedown',e=>{
  const t=e.target;
  if(t.dataset.fill){e.preventDefault();fillDrag={};scroller.focus();return}
  if(t.closest('.gc-dd')){return}
  if(t.dataset.corner){sel={r1:0,c1:0,r2:MAXR-1,c2:MAXC-1,ar:0,ac:0};rr();return}
  if(t.dataset.hc!==undefined){const c=+t.dataset.hc,rc=t.getBoundingClientRect();
    if(e.clientX>rc.right-6){startResize('c',c,e);return}
    if(e.shiftKey)sel.c2=c;else sel={r1:0,c1:c,r2:MAXR-1,c2:c,ar:0,ac:c};drag={hc:true,c0:sel.ac};syncFx();rr();scroller.focus();return}
  if(t.dataset.hr!==undefined){const r=+t.dataset.hr,rc=t.getBoundingClientRect();
    if(e.clientY>rc.bottom-5){startResize('r',r,e);return}
    if(e.shiftKey)sel.r2=r;else sel={r1:r,c1:0,r2:r,c2:MAXC-1,ar:r,ac:0};drag={hr:true};syncFx();rr();scroller.focus();return}
  if(e.offsetX>scroller.clientWidth||e.offsetY>scroller.clientHeight)return;
  const p=cellFromEvent(e);
  if(editing){const tx=editing.ta;if(tx.value.startsWith('=')&&/[=+\-*/^(,&<>:;]$/.test(tx.value.slice(0,tx.selectionStart))){e.preventDefault();const ref=colName(p.c)+(p.r+1);tx.setRangeText(ref,tx.selectionStart,tx.selectionEnd,'end');tx.dispatchEvent(new Event('input'));tx.focus();return}endEdit(true)}
  closePop();
  if(e.shiftKey)setSel(p.r,p.c,true);else setSel(p.r,p.c,false);drag={};scroller.focus();e.preventDefault();
});
window.addEventListener('mousemove',e=>{
  if(resize){const d=(resize.axis==='c'?e.clientX-resize.x:e.clientY-resize.y);if(resize.axis==='c')M().colW[resize.i]=Math.max(24,Math.round(resize.start+d));else M().rowH[resize.i]=Math.max(14,Math.round(resize.start+d));layout();rr();return}
  if(fillDrag){const p=cellFromEvent(e);fillDrag.to=p;const n=norm(sel);fillDrag.preview=true;rr();return}
  if(!drag)return;const p=cellFromEvent(e);
  if(drag.hc){sel.c2=p.c;sel.r2=MAXR-1}else if(drag.hr){sel.r2=p.r;sel.c2=MAXC-1}else{sel.r2=p.r;sel.c2=p.c}
  rr();
});
window.addEventListener('mouseup',()=>{
  if(resize){resize=null;commitHist();return}
  if(fillDrag){if(fillDrag.to)doFill(fillDrag.to);fillDrag=null}
  drag=null;syncFx();
});
let resize=null;
function startResize(axis,i,e){e.preventDefault();resize={axis,i,x:e.clientX,y:e.clientY,start:axis==='c'?(M().colW[i]??DEF_W):(M().rowH[i]??DEF_H)}}
scroller.addEventListener('dblclick',e=>{
  const t=e.target;
  if(t.dataset.hc!==undefined){const c=+t.dataset.hc,rc=t.getBoundingClientRect();if(e.clientX>rc.right-6){autofit(c);return}}
  if(t.closest&&t.closest('.gc-dd'))return;
  if(e.offsetX>scroller.clientWidth)return;const p=cellFromEvent(e);if(p.x>=0&&p.y>=0){setSel(p.r,p.c,false);startEdit()}
});
function autofit(c){const cv=document.createElement('canvas').getContext('2d');cv.font='12px Arial';let w=40;const sh=S();for(let r=0;r<Math.min(sh.maxR,2000);r++){const t=dispText(r,c);if(t)w=Math.max(w,cv.measureText(t).width+16)}M().colW[c]=Math.min(600,Math.ceil(w));layout();rr();commitHist()}
scroller.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.gc-dd');if(!b)return;e.stopPropagation();
  if(b.dataset.filter!==undefined)openFilter(+b.dataset.filter,b);else if(b.dataset.list!==undefined)openListDD(b)});
scroller.addEventListener('scroll',rr);
scroller.addEventListener('keydown',e=>{
  if(editing)return;
  const mod=e.ctrlKey||e.metaKey,k=e.key;
  if(mod){
    const kk=k.toLowerCase();
    if(kk==='z'&&!e.shiftKey){e.preventDefault();hist.undo();return}
    if(kk==='y'||(kk==='z'&&e.shiftKey)){e.preventDefault();hist.redo();return}
    if(kk==='b'){e.preventDefault();toggleStyle('b');return}if(kk==='i'){e.preventDefault();toggleStyle('i');return}
    if(kk==='a'){e.preventDefault();sel={r1:0,c1:0,r2:Math.max(0,S().maxR-1),c2:Math.max(0,S().maxC-1),ar:0,ac:0};syncFx();rr();return}
    if(kk==='f'||kk==='h'){e.preventDefault();openFind(kk==='h');return}
    if(kk==='d'){e.preventDefault();fillDir('down');return}if(kk==='r'){e.preventDefault();fillDir('right');return}
    if(k==='ArrowDown'||k==='ArrowUp'||k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();jump(k==='ArrowDown'?1:k==='ArrowUp'?-1:0,k==='ArrowRight'?1:k==='ArrowLeft'?-1:0,e.shiftKey);return}
    if(k==='Home'){e.preventDefault();setSel(0,0,false);return}
    return}
  switch(k){
    case 'ArrowDown':e.preventDefault();moveSel(1,0,e.shiftKey);break;case 'ArrowUp':e.preventDefault();moveSel(-1,0,e.shiftKey);break;
    case 'ArrowLeft':e.preventDefault();moveSel(0,-1,e.shiftKey);break;case 'ArrowRight':e.preventDefault();moveSel(0,1,e.shiftKey);break;
    case 'Tab':e.preventDefault();moveSel(0,e.shiftKey?-1:1,false);break;
    case 'Enter':e.preventDefault();if(e.shiftKey)moveSel(-1,0,false);else startEdit();break;
    case 'F2':e.preventDefault();startEdit();break;
    case 'Delete':case 'Backspace':e.preventDefault();clearSel();break;
    case 'Home':e.preventDefault();setSel(sel.ar,0,e.shiftKey);break;
    case 'End':e.preventDefault();setSel(sel.ar,Math.max(0,S().maxC-1),e.shiftKey);break;
    case 'PageDown':e.preventDefault();moveSel(Math.floor(scroller.clientHeight/DEF_H)-2,0,e.shiftKey);break;
    case 'PageUp':e.preventDefault();moveSel(-(Math.floor(scroller.clientHeight/DEF_H)-2),0,e.shiftKey);break;
    case 'Escape':clip&&clip.cut&&(clip=null);rr();break;
    default:if(k.length===1&&!e.altKey){e.preventDefault();startEdit(k);}
  }
});
fxInput.addEventListener('focus',()=>{if(!editing&&(sel))startEdit();if(editing)editing.fromBar=true;});
fxInput.addEventListener('input',()=>{if(editing){editing.ta.value=fxInput.value;positionEditor();rr()}});
fxInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();endEdit(true,1,0)}else if(e.key==='Escape'){e.preventDefault();endEdit(false)}});
nameBox.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();gotoName(nameBox.value.trim())});
function gotoName(s){
  const d=eng.names[s.toUpperCase()];if(d)s=d.ref.replace(/^.*!/,'').replace(/\$/g,'');
  const m=/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/.exec(s.replace(/\$/g,''));if(!m){say('이름이나 주소를 인식하지 못했습니다.',true);syncFx();return}
  const r1=+m[2]-1,c1=colNum(m[1]),r2=m[4]?+m[4]-1:r1,c2=m[3]?colNum(m[3]):c1;sel={r1,c1,r2,c2,ar:r1,ac:c1};ensureVisible(r1,c1);syncFx();rr();scroller.focus();
}
/* 복사·잘라내기·붙여넣기 */
function selCells(){const n=norm(sel),sh=S(),r2=Math.min(n.r2,Math.max(n.r1,sh.maxR-1)),c2=Math.min(n.c2,Math.max(n.c1,sh.maxC-1)),rows=[];for(let r=n.r1;r<=r2;r++){const row=[];for(let c=n.c1;c<=c2;c++){const x=sh.cells[r+','+c];row.push(x?{raw:x.raw||'',s:x.s?{...x.s}:null,autoFmt:x.autoFmt}:{raw:'',s:null})}rows.push(row)}return{rows,r0:n.r1,c0:n.c1}}
function tsvOf(rows){return rows.map(r=>r.map(x=>{const t=x.disp!==undefined?x.disp:x.raw;return /[\t\n"]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t}).join('\t')).join('\n')}
scroller.addEventListener('copy',e=>{if(editing)return;e.preventDefault();doCopy(false,e)});
scroller.addEventListener('cut',e=>{if(editing)return;e.preventDefault();doCopy(true,e)});
function doCopy(cut,e){
  const sc=selCells(),n=norm(sel);
  const disp=sc.rows.map((row,i)=>row.map((x,j)=>({disp:x.raw.startsWith('=')?dispText(n.r1+i,n.c1+j):x.raw})));
  const text=tsvOf(disp);clip={...sc,cut,text,si};
  if(e&&e.clipboardData)e.clipboardData.setData('text/plain',text);else if(navigator.clipboard)navigator.clipboard.writeText(text).catch(()=>{});
  say(cut?'잘라냈습니다. 붙여넣을 위치에서 Ctrl+V 를 누르세요.':'복사했습니다 ('+rngStr(n)+').')
}
scroller.addEventListener('paste',e=>{if(editing)return;e.preventDefault();const t=e.clipboardData?e.clipboardData.getData('text/plain'):'';doPaste(t)});
function parseTSV(t){const rows=[];let row=[],cur='',q=false;t=t.replace(/\r\n/g,'\n').replace(/\r/g,'\n');if(t.endsWith('\n'))t=t.slice(0,-1);for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}else if(ch==='"'&&cur==='')q=true;else if(ch==='\t'){row.push(cur);cur=''}else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=ch}row.push(cur);rows.push(row);return rows}
function doPaste(text){
  const r0=norm(sel).r1,c0=norm(sel).c1;
  if(clip&&(text===''||text===clip.text)){
    const dr=r0-clip.r0,dc=c0-clip.c0;
    clip.rows.forEach((row,i)=>row.forEach((x,j)=>{const r=r0+i,c=c0+j;if(r>=MAXR||c>=MAXC)return;
      const raw=!clip.cut&&x.raw.startsWith('=')?shiftRefs(x.raw,dr,dc):x.raw;setCell(r,c,raw);const cell=cellOf(r,c,true);cell.s=x.s?{...x.s}:null;if(!cell.s)delete cell.s;if(x.autoFmt&&!raw.startsWith('='))cell.autoFmt=x.autoFmt}));
    if(clip.cut){const sh=S(),sv=si;if(clip.si===si){clip.rows.forEach((row,i)=>row.forEach((x,j)=>{const r=clip.r0+i,c=clip.c0+j;const inside=r>=r0&&r<r0+clip.rows.length&&c>=c0&&c<c0+row.length;if(!inside){setCell(r,c,'');const cc=sh.cells[r+','+c];if(cc)delete cc.s}}))}clip=null}
    sel={r1:r0,c1:c0,r2:r0+clip?.rows?.length-1||r0,c2:c0,ar:r0,ac:c0};
    const n=clip?null:null;
  }else if(text!==''){
    const rows=parseTSV(text);rows.forEach((row,i)=>row.forEach((v,j)=>{const r=r0+i,c=c0+j;if(r<MAXR&&c<MAXC)setCell(r,c,v)}));
    sel={r1:r0,c1:c0,r2:r0+rows.length-1,c2:c0+Math.max(...rows.map(r=>r.length))-1,ar:r0,ac:c0};
  }else return;
  commitHist();syncFx();layoutIfMerges();rr();say('붙여넣었습니다.');
}
function layoutIfMerges(){layout()}
function clearSel(){const n=norm(sel),sh=S();const r2=Math.min(n.r2,sh.maxR);for(let r=n.r1;r<=r2;r++)for(let c=n.c1;c<=Math.min(n.c2,sh.maxC);c++){const x=sh.cells[r+','+c];if(x&&(x.raw!==''||x.f))setCell(r,c,'')}commitHist();syncFx();rr()}
/* 참조 이동(채우기·붙여넣기) */
function shiftRefs(raw,dr,dc){
  let toks;try{toks=G.tokenize(raw.slice(1))}catch(_){return raw}const src=raw.slice(1);let out='=',last=0;
  const pre=t=>t.sheet?(/[^\w.]/.test(t.sheet)?"'"+t.sheet.replace(/'/g,"''")+"'":t.sheet)+'!':'';
  for(const t of toks){out+=src.slice(last,t.s);last=t.e;
    if(t.t==='ref'){const r=t.ra?t.r:t.r+dr,c=t.ca?t.c:t.c+dc;out+=(r<0||c<0||c>=MAXC+50)?'#REF!':pre(t)+(t.ca?'$':'')+colName(c)+(t.ra?'$':'')+(r+1)}
    else if(t.t==='colrange'){const a=t.aa?t.a:t.a+dc,b=t.ba?t.b:t.b+dc;out+=a<0||b<0?'#REF!':pre(t)+(t.aa?'$':'')+colName(a)+':'+(t.ba?'$':'')+colName(b)}
    else if(t.t==='rowrange'){const a=t.aa?t.a:t.a+dr,b=t.ba?t.b:t.b+dr;out+=a<0||b<0?'#REF!':pre(t)+(t.aa?'$':'')+(a+1)+':'+(t.ba?'$':'')+(b+1)}
    else out+=src.slice(t.s,t.e)}
  return out+src.slice(last);
}
/* 채우기 */
function seriesNext(vals,isDate,n){ // vals: 숫자 배열(원본). n 번째 이후 값을 만든다
  const a=vals;if(a.length>=2){const step=a[a.length-1]-a[a.length-2];return a[a.length-1]+step*n}return a[0]+(isDate?0:0)*n}
function fillLine(cells,count,dir){ // cells: 원본 raw 배열(길이 k), 반환: 새 raw count 개
  const k=cells.length,out=[];
  const nums=cells.map(x=>{const p=Engine.parseInput(x.raw);return typeof p.v==='number'&&!x.raw.startsWith('=')?p.v:null});
  const allNum=nums.every(v=>v!==null);
  const trail=cells.map(x=>/^(.*?)(\d+)$/.exec(x.raw));
  for(let i=0;i<count;i++){const src=cells[i%k];
    if(src.raw.startsWith('=')){out.push({raw:null,from:src,i,k});continue}
    if(allNum&&k>=2){const step=nums[k-1]-nums[k-2];out.push({raw:String(+(nums[k-1]+step*(i+1)).toPrecision(15)),from:src});continue}
    if(allNum&&k===1){const p=Engine.parseInput(src.raw);out.push({raw:src.raw,from:src});continue}
    if(k===1&&trail[0]&&!src.raw.startsWith('=')&&isNaN(+src.raw)){const m=trail[0];out.push({raw:m[1]+String(+m[2]+(i+1)).padStart(m[2].length,'0'),from:src});continue}
    out.push({raw:src.raw,from:src});
  }
  return out;
}
function doFill(to){
  const n=norm(sel);let tr=to.r,tc=to.c;
  const vert=Math.abs(tr-(tr<n.r1?n.r1:n.r2))>=Math.abs(tc-(tc<n.c1?n.c1:n.c2));
  if(vert){
    if(tr>n.r2){const cnt=tr-n.r2;for(let c=n.c1;c<=n.c2;c++){const col=[];for(let r=n.r1;r<=n.r2;r++)col.push({raw:rawOf(r,c),s:(cellOf(r,c)||{}).s,r});const res=fillLine(col,cnt);res.forEach((x,i)=>{const r=n.r2+1+i;writeFill(r,c,x,r-x.from.r||(r-col[i%col.length].r),0,col[i%col.length])})}sel={...sel,r1:n.r1,r2:tr,c1:n.c1,c2:n.c2,ar:n.r1,ac:n.c1}}
    else if(tr<n.r1){const cnt=n.r1-tr;for(let c=n.c1;c<=n.c2;c++){const col=[];for(let r=n.r2;r>=n.r1;r--)col.push({raw:rawOf(r,c),s:(cellOf(r,c)||{}).s,r});const res=fillLine(col,cnt);res.forEach((x,i)=>{const r=n.r1-1-i;writeFill(r,c,x,r-col[i%col.length].r,0,col[i%col.length])})}sel={...sel,r1:tr,r2:n.r2,ar:tr}}
  }else{
    if(tc>n.c2){const cnt=tc-n.c2;for(let r=n.r1;r<=n.r2;r++){const row=[];for(let c=n.c1;c<=n.c2;c++)row.push({raw:rawOf(r,c),s:(cellOf(r,c)||{}).s,c});const res=fillLine(row,cnt);res.forEach((x,i)=>{const c=n.c2+1+i;writeFill(r,c,x,0,c-row[i%row.length].c,row[i%row.length])})}sel={...sel,c1:n.c1,c2:tc,ac:n.c1}}
    else if(tc<n.c1){const cnt=n.c1-tc;for(let r=n.r1;r<=n.r2;r++){const row=[];for(let c=n.c2;c>=n.c1;c--)row.push({raw:rawOf(r,c),s:(cellOf(r,c)||{}).s,c});const res=fillLine(row,cnt);res.forEach((x,i)=>{const c=n.c1-1-i;writeFill(r,c,x,0,c-row[i%row.length].c,row[i%row.length])})}sel={...sel,c1:tc,c2:n.c2,ac:tc}}
  }
  commitHist();syncFx();rr();
}
function writeFill(r,c,x,dr,dc,src){if(r<0||c<0||r>=MAXR||c>=MAXC)return;const raw=x.raw===null?shiftRefs(src.raw,dr,dc):x.raw;setCell(r,c,raw);const cell=cellOf(r,c,true);if(src.s)cell.s={...src.s};const o=Engine.parseInput(raw);if(src.raw&&(cellOf(r-dr,c-dc)||{}).autoFmt)cell.autoFmt=(cellOf(r-dr,c-dc)).autoFmt}
function fillDir(dir){const n=norm(sel);if(dir==='down'){if(n.r2===n.r1)return;for(let c=n.c1;c<=n.c2;c++){const src=rawOf(n.r1,c),cell=cellOf(n.r1,c);for(let r=n.r1+1;r<=n.r2;r++){setCell(r,c,src.startsWith('=')?shiftRefs(src,r-n.r1,0):src);if(cell&&cell.s)cellOf(r,c,true).s={...cell.s}}}}
  else{if(n.c2===n.c1)return;for(let r=n.r1;r<=n.r2;r++){const src=rawOf(r,n.c1),cell=cellOf(r,n.c1);for(let c=n.c1+1;c<=n.c2;c++){setCell(r,c,src.startsWith('=')?shiftRefs(src,0,c-n.c1):src);if(cell&&cell.s)cellOf(r,c,true).s={...cell.s}}}}
  commitHist();rr()}

/* ================= 서식 ================= */
function eachSel(fn){const n=norm(sel),sh=S(),last=Math.min(n.r2,Math.max(n.r1,sh.maxR+200)),lastC=Math.min(n.c2,Math.max(n.c1,sh.maxC+30));let k=0;for(let r=n.r1;r<=last;r++)for(let c=n.c1;c<=lastC;c++){if(++k>300000)return;fn(cellOf(r,c,true),r,c)}}
function patchStyle(p){eachSel(x=>{const s={...(x.s||{}),...p};for(const k in s)if(s[k]===''||s[k]===false||s[k]===undefined||s[k]===null)delete s[k];if(Object.keys(s).length)x.s=s;else delete x.s});ver++;commitHist();rr()}
function toggleStyle(k){const x=cellOf(sel.ar,sel.ac),on=!(x&&x.s&&x.s[k]);patchStyle({[k]:on?1:false})}
function applyFmt(f){if(f==='custom'){ask('사용자 지정 숫자 형식',[{k:'f',label:'형식 코드',value:'#,##0.00',hint:'예: #,##0 "원"  /  0.0%  /  yyyy-mm-dd'}]).then(v=>{if(v&&v.f)patchStyle({fmt:v.f})});return}patchStyle({fmt:f==='General'?'':f});}
function decimals(d){const x=cellOf(sel.ar,sel.ac),cur=(x&&x.s&&x.s.fmt)||'0';const m=/^([^.]*?)(?:\.(0+))?([^0]*)$/.exec(cur)||[];let dec=(m[2]||'').length+d;dec=Math.max(0,Math.min(10,dec));const base=/0/.test(cur)?cur.replace(/\.0+/,''):'#,##0';const nf=base.replace(/0(?!.*0)/,'0'+(dec?'.'+'0'.repeat(dec):''));patchStyle({fmt:/0/.test(cur)?cur.replace(/\.0+/,'').replace(/0(?!.*0)/,'0'+(dec?'.'+'0'.repeat(dec):'')):'0'+(dec?'.'+'0'.repeat(dec):'')})}
function mergeSel(){const n=norm(sel);if(n.r1===n.r2&&n.c1===n.c2){say('병합하려면 두 개 이상의 셀을 선택해 주세요.',true);return}
  M().merges=M().merges.filter(g=>g.r2<n.r1||g.r1>n.r2||g.c2<n.c1||g.c1>n.c2);M().merges.push({...n});
  for(let r=n.r1;r<=n.r2;r++)for(let c=n.c1;c<=n.c2;c++)if(r!==n.r1||c!==n.c1){const x=cellOf(r,c);if(x&&x.raw)setCell(r,c,'')}
  layout();commitHist();rr();say('셀을 병합했습니다. 왼쪽 위 값만 유지됩니다.')}
function unmergeSel(){const n=norm(sel);const before=M().merges.length;M().merges=M().merges.filter(g=>g.r2<n.r1||g.r1>n.r2||g.c2<n.c1||g.c1>n.c2);layout();commitHist();rr();say(before!==M().merges.length?'병합을 해제했습니다.':'선택 영역에 병합된 셀이 없습니다.')}
function borders(kind){const n=norm(sel);eachSel((x,r,c)=>{let b=new Set((x.s&&x.s.bd||'').split(''));
  if(kind==='none')b=new Set();else if(kind==='all')['l','r','t','b'].forEach(k=>b.add(k));
  else if(kind==='outer'){if(c===n.c1)b.add('l');if(c===n.c2)b.add('r');if(r===n.r1)b.add('t');if(r===n.r2)b.add('b')}else if(kind==='bottom'){if(r===n.r2)b.add('b')}
  const s={...(x.s||{})};const str=[...b].join('');if(str)s.bd=str;else delete s.bd;if(Object.keys(s).length)x.s=s;else delete x.s});ver++;commitHist();rr()}

/* ================= 행·열 ================= */
function shiftMeta(axis,at,count){
  const m=M(),mv=(v)=>{if(count>0)return v>=at?v+count:v;if(v>=at&&v<at-count)return -1;return v>=at-count?v+count:v};
  const mapObj=o=>{const n={};for(const k in o){const nk=mv(+k);if(nk>=0)n[nk]=o[k]}return n};
  if(axis==='c')m.colW=mapObj(m.colW);else m.rowH=mapObj(m.rowH);
  const sh=g=>{const a=axis==='r'?[g.r1,g.r2]:[g.c1,g.c2];let x=mv(a[0]),y=mv(a[1]);if(count<0){if(x<0&&y<0)return null;if(x<0)x=at;if(y<0)y=at-1;if(y<x)return null}return axis==='r'?{...g,r1:x,r2:y}:{...g,c1:x,c2:y}};
  m.merges=m.merges.map(sh).filter(Boolean);
  m.cf=m.cf.map(g=>{const rg=sh(g.range);return rg?{...g,range:rg}:null}).filter(Boolean);m.dv=m.dv.map(g=>{const rg=sh(g.range);return rg?{...g,range:rg}:null}).filter(Boolean);
  m.charts=m.charts.map(g=>{const rg=sh(g.range);return rg?{...g,range:rg}:null}).filter(Boolean);
  const nn={};for(const k in m.notes){const[r,c]=k.split(',').map(Number);const v=axis==='r'?mv(r):mv(c);if(v>=0)nn[axis==='r'?v+','+c:r+','+v]=m.notes[k]}m.notes=nn;
  if(axis==='r'&&m.freeze.r>at&&count>0)m.freeze.r+=count;if(axis==='c'&&m.freeze.c>at&&count>0)m.freeze.c+=count;
}
function insDel(axis,count){
  const n=norm(sel);let at=axis==='r'?n.r1:n.c1;const size=(axis==='r'?n.r2-n.r1:n.c2-n.c1)+1;
  if(count>0){eng.shiftSheet(si,axis,at,size);shiftMeta(axis,at,size)}else{eng.shiftSheet(si,axis,at,-size);shiftMeta(axis,at,-size)}
  ver++;layout();commitHist();syncFx();rr();say((axis==='r'?'행 ':'열 ')+(count>0?'삽입':'삭제')+' 완료. 수식의 참조도 함께 조정했습니다.');
}
/* ================= 정렬·필터 ================= */
function usedRegion(){const sh=S();return{r1:0,c1:0,r2:Math.max(0,sh.maxR-1),c2:Math.max(0,sh.maxC-1)}}
function sortBy(col,asc,hasHeader){
  const n=norm(sel),single=n.r1===n.r2&&n.c1===n.c2,g=single?usedRegion():n,top=g.r1+(hasHeader?1:0);if(g.r2<=top-(hasHeader?0:1)&&g.r2===g.r1){say('정렬할 데이터가 부족합니다.',true);return}
  const rows=[];for(let r=top;r<=g.r2;r++){const row=[];for(let c=g.c1;c<=g.c2;c++){const x=cellOf(r,c);row.push({raw:x?x.raw||'':'',s:x&&x.s?{...x.s}:null,v:eng.get(si,r,c),autoFmt:x&&x.autoFmt})}rows.push({r,row})}
  const key=r=>r.row[col-g.c1]&&r.row[col-g.c1].v,ord=v=>v===null||v===''?3:typeof v==='number'?0:typeof v==='string'?1:2;
  const cmp=(a,b)=>{const x=key(a),y=key(b),ox=ord(x),oy=ord(y);if(ox===3||oy===3)return ox-oy;if(ox!==oy)return ox-oy;const d=typeof x==='string'?x.toLowerCase().localeCompare(y.toLowerCase(),'ko'):x<y?-1:x>y?1:0;return asc?d:-d};
  const sorted=rows.slice().map((x,i)=>({...x,i})).sort((a,b)=>{const c=cmp(a,b);return c||a.i-b.i});
  sorted.forEach((x,i)=>{const r=top+i;x.row.forEach((cell,j)=>{const c=g.c1+j;const raw=cell.raw.startsWith('=')?shiftRefs(cell.raw,r-x.r,0):cell.raw;setCell(r,c,raw);const cc=cellOf(r,c,true);if(cell.s)cc.s=cell.s;else delete cc.s;if(cell.autoFmt)cc.autoFmt=cell.autoFmt})});
  commitHist();rr();say('정렬했습니다 ('+rngStr(g)+', '+colName(col)+' 열 '+(asc?'오름차순':'내림차순')+').');
}
function toggleFilter(){
  const m=M();if(m.filter&&m.filter.on){m.filter=null;ver++;layout();commitHist();rr();say('필터를 해제했습니다.');return}
  const n=norm(sel),g=(n.r1===n.r2&&n.c1===n.c2)?usedRegion():n;m.filter={on:true,r0:g.r1,c1:g.c1,c2:g.c2,r2:g.r2,ex:{}};ver++;layout();commitHist();rr();say('첫 행에 필터를 만들었습니다. 열 머리글의 ▼ 를 눌러 값을 고르세요.');
}
let pop=null;function closePop(){if(pop){pop.remove();pop=null}}
document.addEventListener('mousedown',e=>{if(pop&&!pop.contains(e.target)&&!e.target.closest('.gc-dd'))closePop()});
function openFilter(c,btn){
  closePop();const f=M().filter,vals=new Map();for(let r=f.r0+1;r<=f.r2;r++){const t=dispText(r,c);vals.set(t,(vals.get(t)||0)+1)}
  const rect=btn.getBoundingClientRect(),ex=new Set(f.ex[c]||[]);
  const list=[...vals.keys()].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true})),box=el('div',{class:'gc-pop',role:'dialog','aria-label':colName(c)+' 열 필터'});
  const search=el('input',{type:'text',placeholder:'검색','aria-label':'필터 값 검색',style:'width:100%;margin-bottom:6px'});const body=el('div');
  const draw=()=>{body.replaceChildren(...list.filter(v=>!search.value||v.toLowerCase().includes(search.value.toLowerCase())).slice(0,500).map(v=>{const cb=el('input',{type:'checkbox',checked:!ex.has(v)});cb.addEventListener('change',()=>{cb.checked?ex.delete(v):ex.add(v)});return el('label',null,cb,v===''?'(빈 값)':v+' ('+vals.get(v)+')')}))};
  search.addEventListener('input',draw);draw();
  box.append(el('div',{class:'ycp-row'},YC.btn('오름차순',()=>{closePop();sortBy(c,true,true)}),YC.btn('내림차순',()=>{closePop();sortBy(c,false,true)})),search,body,el('div',{class:'ycp-row'},
    YC.btn('모두 선택',()=>{ex.clear();draw()}),YC.btn('적용',()=>{if(ex.size)f.ex[c]=[...ex];else delete f.ex[c];closePop();ver++;layout();commitHist();rr()},{primary:true}),YC.btn('이 열 해제',()=>{delete f.ex[c];closePop();ver++;layout();commitHist();rr()})));
  box.style.left=Math.min(rect.left,innerWidth-230)+'px';box.style.top=(rect.bottom+4)+'px';document.body.append(box);pop=box;
}
function openListDD(btn){
  closePop();const dv=M().dv.find(d=>d.type==='list'&&sel.ar>=d.range.r1&&sel.ar<=d.range.r2&&sel.ac>=d.range.c1&&sel.ac<=d.range.c2);if(!dv)return;
  const rect=btn.getBoundingClientRect(),box=el('div',{class:'gc-pop',role:'listbox','aria-label':'입력 가능한 값'});
  for(const it of dvItems(dv))box.append(el('div',{role:'option',tabindex:0,style:'padding:4px 6px;cursor:pointer',onclick:()=>{closePop();setCell(sel.ar,sel.ac,it);commitHist();syncFx();rr()},onkeydown:e=>{if(e.key==='Enter')e.target.click()}},it));
  box.style.left=Math.min(rect.left,innerWidth-200)+'px';box.style.top=(rect.bottom+4)+'px';document.body.append(box);pop=box;
}
/* ================= 대화상자 ================= */
function ask(title,fields,ok='확인',extra){
  return new Promise(res=>{
    const back=el('div',{class:'gc-back'}),box=el('div',{class:'gc-dlg',role:'dialog','aria-modal':'true','aria-label':title},el('h3',null,title)),inputs={};
    for(const f of fields){let inp;
      if(f.type==='select')inp=el('select',null,f.opts.map(o=>{const[v,t]=Array.isArray(o)?o:[o,o];return el('option',{value:v,selected:String(v)===String(f.value)},t)}));
      else if(f.type==='check'){inp=el('input',{type:'checkbox',checked:!!f.value})}
      else if(f.type==='textarea'){inp=el('textarea',{rows:f.rows||4});inp.value=f.value??''}
      else if(f.type==='color'){inp=el('input',{type:'color',value:f.value||'#70f0bd'})}
      else{inp=el('input',{type:f.type||'text',value:f.value??''});}
      inputs[f.k]=inp;box.append(el('label',null,f.label,inp));if(f.hint)box.append(el('p',{class:'ycp-note',style:'margin:-2px 0 4px 138px'},f.hint))}
    if(extra)box.append(extra);
    const done=v=>{back.remove();document.removeEventListener('keydown',onKey,true);scroller.focus();res(v)};
    const collect=()=>{const o={};for(const f of fields){const i=inputs[f.k];o[f.k]=f.type==='check'?i.checked:f.type==='number'?(i.value===''?'':+i.value):i.value}return o};
    const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();done(null)}};document.addEventListener('keydown',onKey,true);
    box.append(el('div',{class:'ycp-row',style:'justify-content:flex-end;margin-top:12px'},YC.btn('취소',()=>done(null)),YC.btn(ok,()=>done(collect()),{primary:true})));
    box.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();done(collect())}});
    back.append(box);document.body.append(back);const first=box.querySelector('input,select,textarea');first&&first.focus();
  });
}
function info(title,body){return new Promise(res=>{const back=el('div',{class:'gc-back'}),box=el('div',{class:'gc-dlg',role:'dialog','aria-modal':'true','aria-label':title},el('h3',null,title),body);const done=()=>{back.remove();document.removeEventListener('keydown',k,true);scroller.focus();res()};const k=e=>{if(e.key==='Escape')done()};document.addEventListener('keydown',k,true);box.append(el('div',{class:'ycp-row',style:'justify-content:flex-end'},YC.btn('닫기',done,{primary:true})));back.append(box);document.body.append(back)})}
/* 찾기/바꾸기 */
let lastFind={q:'',i:-1};
async function openFind(replace){
  const v=await ask(replace?'찾기 및 바꾸기':'찾기',[{k:'q',label:'찾을 내용',value:lastFind.q},...(replace?[{k:'rep',label:'바꿀 내용',value:''}]:[]),{k:'cs',label:'대/소문자 구분',type:'check'},{k:'whole',label:'전체 셀 일치',type:'check'},{k:'fx',label:'수식 안에서도 찾기',type:'check'},...(replace?[{k:'mode',label:'동작',type:'select',opts:[['next','다음 찾기'],['all','모두 바꾸기']],value:'all'}]:[])],replace?'실행':'찾기');
  if(!v||!v.q)return;lastFind.q=v.q;
  const sh=S(),hits=[];const test=t=>{const a=v.cs?t:t.toLowerCase(),b=v.cs?v.q:v.q.toLowerCase();return v.whole?a===b:a.includes(b)};
  for(const k in sh.cells){const[r,c]=k.split(',').map(Number),x=sh.cells[k];if(x.raw==null||x.raw==='')continue;const t=v.fx||!x.raw.startsWith('=')?x.raw:dispText(r,c);if(test(String(t)))hits.push([r,c])}
  hits.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(!hits.length){say('"'+v.q+'" 를 찾지 못했습니다.',true);return}
  if(replace&&v.mode==='all'){let n=0;for(const[r,c]of hits){const raw=rawOf(r,c),rx=new RegExp(v.q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),v.cs?'g':'gi');const nr=v.whole?v.rep:raw.replace(rx,()=>v.rep);if(nr!==raw){setCell(r,c,nr);n++}}commitHist();rr();say(n+'개 셀을 바꿨습니다.');return}
  lastFind.i=(lastFind.i+1)%hits.length;const[r,c]=hits[lastFind.i];setSel(r,c,false);say(hits.length+'개 중 '+(lastFind.i+1)+'번째: '+colName(c)+(r+1));
}
/* ================= 시트 ================= */
const tabs=el('div',{class:'gc-tabs',role:'tablist','aria-label':'시트'});
function renderTabs(){
  tabs.replaceChildren();
  eng.sheets.forEach((s,i)=>{const b=el('button',{type:'button',role:'tab',class:'gc-tab'+(i===si?' on':''),'aria-selected':String(i===si),style:meta[i].color?'border-bottom-color:'+meta[i].color:''},s.name);
    b.addEventListener('click',()=>switchSheet(i));b.addEventListener('dblclick',()=>renameSheet(i));tabs.append(b)});
  tabs.append(YC.btn('+ 시트',addSheet),YC.btn('이름 변경',()=>renameSheet(si)),YC.btn('복제',dupSheet),YC.btn('삭제',delSheet),YC.btn('탭 색',async()=>{const v=await ask('시트 탭 색',[{k:'c',label:'색',type:'color',value:meta[si].color||'#70f0bd'}]);if(v){meta[si].color=v.c;commitHist();renderTabs()}}));
}
function switchSheet(i){if(editing)endEdit(true);si=i;sel={r1:0,c1:0,r2:0,c2:0,ar:0,ac:0};cfCache.clear();ver++;layout();scroller.scrollTo(0,0);renderTabs();syncFx();rr();renderCharts();updatePivotBtn()}
function uniqueName(base){let n=base,k=2;while(eng.sheets.some(s=>s.name.toLowerCase()===n.toLowerCase()))n=base+' ('+k++ +')';return n}
function addSheet(){const n=eng.addSheet(uniqueName('Sheet'+(eng.sheets.length+1)));meta.push(newMeta());commitHist();switchSheet(n)}
async function renameSheet(i){const v=await ask('시트 이름 변경',[{k:'n',label:'새 이름',value:eng.sheets[i].name}]);if(!v)return;const n=v.n.trim().slice(0,31);if(!n||/[\[\]:*?\/\\]/.test(n)){say('시트 이름에 사용할 수 없는 문자가 있습니다.',true);return}
  if(eng.sheets.some((s,j)=>j!==i&&s.name.toLowerCase()===n.toLowerCase())){say('같은 이름의 시트가 이미 있습니다.',true);return}
  const old=eng.sheets[i].name;eng.sheets[i].name=n;
  // 다른 시트의 수식에서 이전 이름 참조를 새 이름으로 교체
  const re=new RegExp("(^|[^\\w.'])(?:'"+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"'|"+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+")!","g");
  const q=/[^\w.]/.test(n)?"'"+n.replace(/'/g,"''")+"'":n;
  eng.sheets.forEach(s=>{for(const k in s.cells){const x=s.cells[k];if(x.f&&x.raw.includes(old))x.raw=x.raw.replace(re,(m,p)=>p+q+'!')}});
  eng.resetCache();ver++;commitHist();renderTabs();rr();renderCharts()}
function dupSheet(){const src=S(),m=M(),n=eng.addSheet(uniqueName(src.name+' 사본')),ns=eng.sheets[n];for(const k in src.cells){const[r,c]=k.split(',').map(Number),x=src.cells[k];eng.setRaw(n,r,c,x.raw||'');const y=ns.cells[k];if(y&&x.s)y.s={...x.s}}ns.maxR=src.maxR;ns.maxC=src.maxC;const nm=YC.clone(m);nm.filter=null;meta.push(nm);commitHist();switchSheet(n)}
function delSheet(){if(eng.sheets.length<2){say('시트는 최소 한 개가 필요합니다.',true);return}if(!confirm('시트 "'+S().name+'" 를 삭제할까요? 이 시트를 참조하는 수식은 #REF! 가 됩니다.'))return;
  const name=S().name;eng.sheets.splice(si,1);meta.splice(si,1);eng.sheets.forEach(s=>{for(const k in s.cells){const x=s.cells[k];if(x.f&&x.raw.includes(name+'!')){x.raw=x.raw.replace(new RegExp("'?"+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"'?![$A-Za-z0-9:]+","g"),'#REF!')}}});
  eng.resetCache();si=Math.max(0,si-1);ver++;commitHist();switchSheet(si)}

/* ================= 이름 정의·메모·유효성·조건부 서식 ================= */
async function nameManager(){
  const body=el('div'),draw=()=>{body.replaceChildren(...Object.keys(eng.names).map(n=>el('div',{class:'ycp-item'},el('span',{class:'n'},eng.names[n].label+' → '+eng.names[n].ref),YC.btn('삭제',()=>{delete eng.names[n];eng.resetCache();ver++;draw();refreshNames();commitHist();rr()}))))};draw();
  const v=await ask('이름 정의',[{k:'n',label:'이름',value:'',hint:'영문·한글·숫자·밑줄, 셀 주소와 같으면 안 됩니다.'},{k:'ref',label:'참조 대상',value:(S().name.includes(' ')?"'"+S().name+"'":S().name)+'!'+rngStr(norm(sel)).replace(/([A-Z]+)(\d+)/g,'$$$1$$$2')}],'추가',body);
  if(!v||!v.n)return;if(!/^[A-Za-z_\u3131-\uD79D][\w.\u3131-\uD79D]*$/.test(v.n)||/^[A-Za-z]{1,3}\d+$/.test(v.n)){say('이름 형식이 올바르지 않습니다.',true);return}
  eng.names[v.n.toUpperCase()]={ref:v.ref,label:v.n};eng.resetCache();ver++;refreshNames();commitHist();rr();say('이름 "'+v.n+'" 를 정의했습니다.');
}
function refreshNames(){nameList.replaceChildren(...Object.values(eng.names).map(n=>el('option',{value:n.label})))}
async function noteEdit(){const k=sel.ar+','+sel.ac,v=await ask('셀 메모',[{k:'t',label:'메모',type:'textarea',value:M().notes[k]||'',hint:'비우면 메모를 삭제합니다.'}]);if(!v)return;if(v.t)M().notes[k]=v.t;else delete M().notes[k];commitHist();rr()}
async function dvDialog(){
  const v=await ask('데이터 유효성 검사',[{k:'type',label:'허용할 값',type:'select',opts:[['list','목록'],['int','정수'],['number','숫자'],['date','날짜'],['len','텍스트 길이'],['none','규칙 제거']],value:'list'},{k:'items',label:'목록(쉼표) 또는 범위',value:'예,아니오',hint:'예: 예,아니오  또는  A1:A5'},{k:'min',label:'최소값',value:''},{k:'max',label:'최대값',value:''}],'적용');
  if(!v)return;const g=norm(sel);M().dv=M().dv.filter(d=>d.range.r2<g.r1||d.range.r1>g.r2||d.range.c2<g.c1||d.range.c1>g.c2);
  if(v.type!=='none')M().dv.push({range:g,type:v.type,items:v.items,min:v.min===''?'':String(v.min),max:v.max===''?'':String(v.max)});commitHist();rr();say(v.type==='none'?'규칙을 제거했습니다.':'유효성 규칙을 적용했습니다 ('+rngStr(g)+').');
}
async function cfDialog(){
  const list=el('div'),draw=()=>{list.replaceChildren(...M().cf.map((r,i)=>el('div',{class:'ycp-item'},el('span',{class:'n'},rngStr(r.range)+' · '+({cell:'값 비교 '+r.op+' '+r.v1,text:'텍스트 "'+r.v1+'"',scale:'색조',bar:'데이터 막대',icon:'아이콘'})[r.type]),YC.btn('삭제',()=>{M().cf.splice(i,1);ver++;draw();commitHist();rr()}))))};draw();
  const v=await ask('조건부 서식',[{k:'type',label:'규칙 종류',type:'select',opts:[['cell','셀 값 비교'],['text','텍스트 포함'],['scale','색조(2색)'],['bar','데이터 막대'],['icon','아이콘(▼■▲)']],value:'cell'},{k:'op',label:'비교 연산',type:'select',opts:[['>','보다 큼'],['<','보다 작음'],['>=','이상'],['<=','이하'],['=','같음'],['<>','같지 않음'],['between','사이']],value:'>'},{k:'v1',label:'값 1 / 텍스트',value:'0'},{k:'v2',label:'값 2 (사이)',value:'10'},{k:'bg',label:'배경색 / 막대색',type:'color',value:'#f2c4c4'},{k:'col',label:'글자색',type:'color',value:'#7a1010'},{k:'lo',label:'색조 낮은 값',type:'color',value:'#4e79a7'},{k:'hi',label:'색조 높은 값',type:'color',value:'#e15759'}],'규칙 추가',list);
  if(!v)return;M().cf.push({id:YC.uid(),range:norm(sel),...v});ver++;commitHist();rr();say('조건부 서식 규칙을 추가했습니다 ('+rngStr(norm(sel))+').');
}
/* ================= 틀 고정 ================= */
function freeze(){const fz=M().freeze;if(fz.r||fz.c){M().freeze={r:0,c:0};say('틀 고정을 해제했습니다.')}else{M().freeze={r:sel.ar,c:sel.ac};say('선택한 셀 위쪽 '+sel.ar+'행, 왼쪽 '+sel.ac+'열을 고정했습니다.')}commitHist();rr()}

/* ================= 차트 ================= */
const chartBox=el('div',{class:'gc-charts','aria-label':'차트'});
const CT=[['col','세로 막대'],['bar','가로 막대'],['stack','누적 세로 막대'],['stackbar','누적 가로 막대'],['line','선'],['area','영역'],['stackarea','누적 영역'],['pie','원'],['donut','도넛'],['scatter','분산형'],['hist','히스토그램']];
function niceTicks(mn,mx,n=5){if(mn===mx){mx=mn+1}const span=mx-mn,step0=span/n,mag=Math.pow(10,Math.floor(Math.log10(step0))),f=step0/mag,step=(f<1.5?1:f<3?2:f<7?5:10)*mag,lo=Math.floor(mn/step)*step,hi=Math.ceil(mx/step)*step,t=[];for(let v=lo;v<=hi+step/2;v+=step)t.push(+v.toPrecision(12));return t}
const fmtN=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e4?(v/1e3).toFixed(0)+'K':String(+v.toFixed(2));
function chartData(ch){
  const g=ch.range,si0=ch.si??si,hasH=ch.header!==false;const rows=[];for(let r=g.r1;r<=Math.min(g.r2,eng.sheets[si0].maxR);r++){const row=[];for(let c=g.c1;c<=g.c2;c++)row.push(eng.get(si0,r,c));rows.push(row)}
  const head=hasH?rows.shift():null;const cats=rows.map(r=>G.toStr(r[0]));const nseries=(g.c2-g.c1);
  const series=[];for(let j=1;j<=nseries;j++)series.push({name:head?G.toStr(head[j]):'계열 '+j,vals:rows.map(r=>typeof r[j]==='number'?r[j]:(isNaN(+r[j])||r[j]===null||r[j]===''?0:+r[j]))});
  return{cats,series,rows,head};
}
function chartSvg(ch,W=480,H=300){
  const d=chartData(ch),{cats,series}=d;const pad={l:54,r:14,t:ch.title?34:14,b:ch.legend!==false&&series.length>1&&!/pie|donut/.test(ch.type)?54:36};
  const pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial,sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="#fff"/>`;
  if(ch.title)s+=`<text x="${W/2}" y="20" text-anchor="middle" font-size="14" font-weight="700" fill="#222">${YC.esc(ch.title)}</text>`;
  const col=i=>(ch.colors&&ch.colors[i])||PAL[i%PAL.length];
  if(!series.length||!cats.length){return s+`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#888">데이터가 없습니다</text></svg>`}
  if(ch.type==='pie'||ch.type==='donut'){
    const vals=series[0].vals.map(v=>Math.max(0,v)),tot=vals.reduce((a,b)=>a+b,0)||1,cx=W/2-60,cy=pad.t+ph/2,R=Math.min(pw*0.5,ph/2)-4;let a0=-Math.PI/2;
    vals.forEach((v,i)=>{const a1=a0+v/tot*Math.PI*2,large=a1-a0>Math.PI?1:0,x0=cx+R*Math.cos(a0),y0=cy+R*Math.sin(a0),x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1);
      s+=v/tot>0.9999?`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col(i)}"/>`:`<path d="M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} Z" fill="${col(i)}" stroke="#fff"/>`;a0=a1});
    if(ch.type==='donut')s+=`<circle cx="${cx}" cy="${cy}" r="${R*0.55}" fill="#fff"/>`;
    cats.forEach((c,i)=>{if(i<12)s+=`<rect x="${W-130}" y="${pad.t+i*16}" width="10" height="10" fill="${col(i)}"/><text x="${W-116}" y="${pad.t+9+i*16}" fill="#333">${YC.esc(c.slice(0,12))} ${(vals[i]/tot*100).toFixed(0)}%</text>`});return s+'</svg>'}
  if(ch.type==='scatter'){
    const pts=d.rows.map(r=>[+r[0],...r.slice(1).map(Number)]).filter(r=>!isNaN(r[0]));const xs=pts.map(p=>p[0]),ys=pts.flatMap(p=>p.slice(1).filter(v=>!isNaN(v)));
    if(!xs.length)return s+'</svg>';const xt=niceTicks(Math.min(...xs),Math.max(...xs)),yt=niceTicks(Math.min(0,...ys),Math.max(...ys));const X=v=>pad.l+(v-xt[0])/(xt[xt.length-1]-xt[0]||1)*pw,Y=v=>pad.t+ph-(v-yt[0])/(yt[yt.length-1]-yt[0]||1)*ph;
    for(const t of yt)s+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e4e4ea"/><text x="${pad.l-6}" y="${Y(t)+4}" text-anchor="end" fill="#555">${fmtN(t)}</text>`;
    for(const t of xt)s+=`<text x="${X(t)}" y="${H-pad.b+16}" text-anchor="middle" fill="#555">${fmtN(t)}</text>`;
    for(let j=1;j<=series.length;j++)for(const p of pts)if(!isNaN(p[j]))s+=`<circle cx="${X(p[0])}" cy="${Y(p[j])}" r="4" fill="${col(j-1)}" fill-opacity=".8"/>`;
    return s+legend(series,col,W,H,ch)+'</svg>'}
  if(ch.type==='hist'){
    const vals=series[0].vals.filter(v=>!isNaN(v)),nb=Math.max(2,Math.min(50,ch.bins||10)),mn=Math.min(...vals),mx=Math.max(...vals),bw=(mx-mn)/nb||1,cnt=Array(nb).fill(0);vals.forEach(v=>cnt[Math.min(nb-1,Math.floor((v-mn)/bw))]++);
    const yt=niceTicks(0,Math.max(...cnt)),Y=v=>pad.t+ph-v/(yt[yt.length-1]||1)*ph;for(const t of yt)s+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e4e4ea"/><text x="${pad.l-6}" y="${Y(t)+4}" text-anchor="end" fill="#555">${fmtN(t)}</text>`;
    cnt.forEach((n,i)=>{const x=pad.l+i*pw/nb;s+=`<rect x="${x+1}" y="${Y(n)}" width="${pw/nb-2}" height="${pad.t+ph-Y(n)}" fill="${col(0)}"/><text x="${x+pw/nb/2}" y="${H-pad.b+14}" text-anchor="middle" fill="#555" font-size="9">${fmtN(mn+i*bw)}</text>`});return s+'</svg>'}
  const horizontal=/bar$|^bar$/.test(ch.type)&&ch.type!=='stack',stacked=/^stack/.test(ch.type),isLine=ch.type==='line',isArea=/area/.test(ch.type);
  let hz=ch.type==='bar'||ch.type==='stackbar';
  const tot=cats.map((_,i)=>series.reduce((a,x)=>a+Math.max(0,x.vals[i]||0),0));
  let mn=Math.min(0,...series.flatMap(x=>x.vals)),mx=stacked||ch.type==='stackarea'?Math.max(...tot):Math.max(...series.flatMap(x=>x.vals));if(ch.type==='stackarea')mx=Math.max(...tot);
  const yt=niceTicks(mn,mx),lo=yt[0],hi=yt[yt.length-1],n=cats.length;
  if(hz){const V=v=>pad.l+(v-lo)/(hi-lo||1)*pw,rowH=ph/n;for(const t of yt)s+=`<line y1="${pad.t}" y2="${pad.t+ph}" x1="${V(t)}" x2="${V(t)}" stroke="#e4e4ea"/><text x="${V(t)}" y="${H-pad.b+14}" text-anchor="middle" fill="#555">${fmtN(t)}</text>`;
    cats.forEach((c,i)=>{const y=pad.t+i*rowH;s+=`<text x="${pad.l-6}" y="${y+rowH/2+4}" text-anchor="end" fill="#555">${YC.esc(c.slice(0,8))}</text>`;let acc=0;const bh=stacked?rowH*0.7:rowH*0.7/series.length;
      series.forEach((x,k)=>{const v=x.vals[i]||0;if(stacked){s+=`<rect x="${V(acc)}" y="${y+rowH*0.15}" width="${Math.max(0,V(acc+v)-V(acc))}" height="${bh}" fill="${col(k)}"/>`;acc+=v}else s+=`<rect x="${V(0)}" y="${y+rowH*0.15+k*bh}" width="${Math.max(0,V(v)-V(0))}" height="${bh-1}" fill="${col(k)}"/>`})})}
  else{const Y=v=>pad.t+ph-(v-lo)/(hi-lo||1)*ph,slot=pw/n;
    for(const t of yt)s+=`<line x1="${pad.l}" x2="${W-pad.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e4e4ea"/><text x="${pad.l-6}" y="${Y(t)+4}" text-anchor="end" fill="#555">${fmtN(t)}</text>`;
    cats.forEach((c,i)=>{if(n<=24||i%Math.ceil(n/24)===0)s+=`<text x="${pad.l+slot*(i+.5)}" y="${H-pad.b+14}" text-anchor="middle" fill="#555">${YC.esc(c.slice(0,8))}</text>`});
    if(isLine||isArea){const base=[];series.forEach((x,k)=>{const xs=i=>pad.l+slot*(i+.5);let pts=x.vals.map((v,i)=>{let top=v;if(ch.type==='stackarea'){top=series.slice(0,k+1).reduce((a,q)=>a+(q.vals[i]||0),0)}return[xs(i),Y(top),ch.type==='stackarea'?Y(series.slice(0,k).reduce((a,q)=>a+(q.vals[i]||0),0)):Y(0)]});
        if(isArea){s+=`<path d="M${pts.map(p=>p[0]+','+p[1]).join(' L')} L${pts[pts.length-1][0]},${pts[pts.length-1][2]} L${pts[0][0]},${pts[0][2]} Z" fill="${col(k)}" fill-opacity=".55" stroke="${col(k)}"/>`}
        else{s+=`<polyline fill="none" stroke="${col(k)}" stroke-width="2" points="${pts.map(p=>p[0]+','+p[1]).join(' ')}"/>`;pts.forEach(p=>s+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${col(k)}"/>`)}})}
    else{cats.forEach((c,i)=>{let acc=0;const bw=slot*0.7/(stacked?1:series.length);series.forEach((x,k)=>{const v=x.vals[i]||0;if(stacked){s+=`<rect x="${pad.l+slot*i+slot*0.15}" y="${Y(acc+v)}" width="${bw}" height="${Math.max(0,Y(acc)-Y(acc+v))}" fill="${col(k)}"/>`;acc+=v}else s+=`<rect x="${pad.l+slot*i+slot*0.15+k*bw}" y="${v>=0?Y(v):Y(0)}" width="${bw-1}" height="${Math.max(0,Math.abs(Y(v)-Y(0)))}" fill="${col(k)}"/>`})})}}
  s+=`<line x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${pad.t+ph}" stroke="#999"/>`;
  return s+legend(series,col,W,H,ch)+'</svg>';
}
function legend(series,col,W,H,ch){if(ch.legend===false||series.length<2)return '';let x=54,s='';series.forEach((q,i)=>{s+=`<rect x="${x}" y="${H-18}" width="10" height="10" fill="${col(i)}"/><text x="${x+14}" y="${H-9}" fill="#333">${YC.esc(q.name.slice(0,14))}</text>`;x+=26+Math.min(14,q.name.length)*7});return s}
function renderCharts(){
  chartBox.replaceChildren();
  M().charts.forEach((ch,i)=>{
    const card=el('div',{class:'gc-chart'}),holder=el('div');holder.innerHTML=chartSvg(ch);
    card.append(el('div',{class:'gc-ct'},YC.btn('편집',()=>editChart(i)),YC.btn('SVG 저장',()=>YC.download(new Blob([chartSvg(ch)],{type:'image/svg+xml'}),'chart-'+(i+1)+'.svg')),YC.btn('PNG 저장',()=>chartPng(ch,i)),YC.btn('삭제',()=>{M().charts.splice(i,1);commitHist();renderCharts()})),holder);chartBox.append(card)});
}
async function chartPng(ch,i){const svg=chartSvg(ch,960,600),im=await YC.loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)),c=document.createElement('canvas');c.width=960;c.height=600;c.getContext('2d').drawImage(im,0,0);YC.download(await YC.canvasBlob(c),'chart-'+(i+1)+'.png')}
async function editChart(i){
  const ex=i!==undefined?M().charts[i]:null,n=norm(sel);
  const v=await ask(ex?'차트 편집':'차트 만들기',[{k:'type',label:'차트 종류',type:'select',opts:CT,value:ex?ex.type:'col'},{k:'range',label:'데이터 범위',value:rngStr(ex?ex.range:(n.r1===n.r2&&n.c1===n.c2?usedRegion():n)),hint:'첫 열은 항목 이름(분산형은 X값), 첫 행은 계열 이름입니다.'},{k:'title',label:'제목',value:ex?ex.title:''},{k:'header',label:'첫 행이 계열 이름',type:'check',value:ex?ex.header!==false:true},{k:'legend',label:'범례 표시',type:'check',value:ex?ex.legend!==false:true},{k:'bins',label:'히스토그램 구간 수',type:'number',value:ex?ex.bins||10:10},{k:'c1',label:'색 1',type:'color',value:ex&&ex.colors?ex.colors[0]:PAL[0]},{k:'c2',label:'색 2',type:'color',value:ex&&ex.colors?ex.colors[1]:PAL[1]},{k:'c3',label:'색 3',type:'color',value:ex&&ex.colors?ex.colors[2]:PAL[2]}],ex?'적용':'만들기');
  if(!v)return;const m=/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/.exec(v.range.replace(/\$/g,''));if(!m||!m[3]){say('데이터 범위를 A1:D10 처럼 두 셀 이상으로 지정해 주세요.',true);return}
  const ch={id:ex?ex.id:YC.uid(),si,type:v.type,range:{r1:+m[2]-1,c1:colNum(m[1]),r2:+m[4]-1,c2:colNum(m[3])},title:v.title,header:v.header,legend:v.legend,bins:v.bins||10,colors:[v.c1,v.c2,v.c3,...PAL.slice(3)]};
  if(ex)M().charts[i]=ch;else M().charts.push(ch);commitHist();renderCharts();say('차트를 '+(ex?'수정':'만들')+'었습니다. 격자 아래에 표시됩니다.');
}
/* ================= 피벗 ================= */
let pivotBtn=null;
function updatePivotBtn(){if(pivotBtn)pivotBtn.hidden=!M().pivot}
async function pivotDialog(){
  const n=norm(sel),g=(n.r1===n.r2&&n.c1===n.c2)?usedRegion():n;const heads=[];for(let c=g.c1;c<=g.c2;c++)heads.push([String(c-g.c1),G.toStr(eng.get(si,g.r1,c))||colName(c)+'열']);
  if(g.r2-g.r1<1){say('피벗 테이블은 머리글 행과 데이터 행이 필요합니다.',true);return}
  const v=await ask('피벗 테이블',[{k:'src',label:'원본 범위(첫 행=머리글)',value:rngStr(g)},{k:'row',label:'행 필드',type:'select',opts:heads,value:'0'},{k:'col',label:'열 필드',type:'select',opts:[['','(없음)'],...heads],value:''},{k:'val',label:'값 필드',type:'select',opts:heads,value:String(Math.min(1,heads.length-1))},{k:'agg',label:'집계 방식',type:'select',opts:[['SUM','합계'],['COUNT','개수'],['AVERAGE','평균'],['MAX','최대'],['MIN','최소']],value:'SUM'},{k:'grp',label:'행 필드가 날짜일 때',type:'select',opts:[['','그대로'],['y','연도로 묶기'],['ym','연-월로 묶기']],value:''}],'만들기');
  if(!v)return;const def={sheet:S().name,range:g,row:+v.row,col:v.col===''?null:+v.col,val:+v.val,agg:v.agg,grp:v.grp};
  const ns=eng.addSheet(uniqueName('피벗 '+(eng.sheets.length)));meta.push(newMeta());meta[ns].pivot=def;si=ns;buildPivot(def,ns);sel={r1:0,c1:0,r2:0,c2:0,ar:0,ac:0};ver++;layout();commitHist();renderTabs();syncFx();rr();renderCharts();updatePivotBtn();say('새 시트에 피벗 테이블을 만들었습니다. 원본을 바꾼 뒤에는 "피벗 새로고침"을 누르세요.');
}
function buildPivot(def,target){
  const src=eng.sheetIdx(def.sheet),g=def.range,data=[];for(let r=g.r1+1;r<=g.r2;r++){const row=[];for(let c=g.c1;c<=g.c2;c++)row.push(eng.get(src,r,c));data.push(row)}
  const heads=[];for(let c=g.c1;c<=g.c2;c++)heads.push(G.toStr(eng.get(src,g.r1,c)));
  const key=(v,grp)=>{if(grp&&typeof v==='number'){const d=G.toDate(v);return grp==='y'?String(d.getUTCFullYear()):d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')}return G.toStr(v)};
  const rk=new Map(),ck=new Map(),cells=new Map();
  for(const row of data){const rv=key(row[def.row],def.grp),cv=def.col===null?'':key(row[def.col]);rk.set(rv,1);ck.set(cv,1);const kk=rv+'\u0001'+cv;let a=cells.get(kk);if(!a)cells.set(kk,a=[]);a.push(row[def.val])}
  const agg=a=>{const nums=a.filter(x=>typeof x==='number');switch(def.agg){case 'COUNT':return a.filter(x=>x!==null&&x!=='').length;case 'SUM':return nums.reduce((x,y)=>x+y,0);case 'AVERAGE':return nums.length?nums.reduce((x,y)=>x+y,0)/nums.length:0;case 'MAX':return nums.length?Math.max(...nums):0;case 'MIN':return nums.length?Math.min(...nums):0}};
  const rows=[...rk.keys()].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true})),cols=[...ck.keys()].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
  const sh=eng.sheets[target];sh.cells={};sh.maxR=0;sh.maxC=0;eng.resetCache();const put=(r,c,raw,s)=>{eng.setRaw(target,r,c,String(raw));const x=sh.cells[r+','+c];if(x&&s)x.s=s};
  const aggName={SUM:'합계',COUNT:'개수',AVERAGE:'평균',MAX:'최대',MIN:'최소'}[def.agg],hs={b:1,bg:'#2a4a3e',col:'#ffffff'};
  put(0,0,heads[def.row]+' \\ '+aggName+': '+heads[def.val],hs);
  const hc=def.col===null?[aggName]:cols;hc.forEach((c,j)=>put(0,1+j,c===''?'(빈 값)':c,hs));if(def.col!==null)put(0,1+hc.length,'총합계',hs);
  rows.forEach((rv,i)=>{put(i+1,0,rv===''?'(빈 값)':rv,{b:1});let tot=[];hc.forEach((cv,j)=>{const a=cells.get(rv+'\u0001'+(def.col===null?'':cv))||[];tot=tot.concat(a);if(a.length)put(i+1,1+j,+agg(a).toPrecision(12))});if(def.col!==null)put(i+1,1+hc.length,+agg(tot).toPrecision(12),{b:1})});
  const last=rows.length+1;put(last,0,'총합계',{b:1,bd:'t'});let all=[];hc.forEach((cv,j)=>{let a=[];for(const rv of rows)a=a.concat(cells.get(rv+'\u0001'+(def.col===null?'':cv))||[]);all=all.concat(a);put(last,1+j,+agg(a).toPrecision(12),{b:1,bd:'t'})});if(def.col!==null)put(last,1+hc.length,+agg(all).toPrecision(12),{b:1,bd:'t'});
  meta[target].colW[0]=200;
}
function refreshPivot(){const d=M().pivot;if(!d)return;buildPivot(d,si);ver++;layout();commitHist();rr();say('피벗 테이블을 새로고침했습니다.')}

/* ================= 파일 입출력 ================= */
async function importFile(){
  const fs=await YC.pick('.csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');const f=fs[0];if(!f)return;
  if(f.size>40*1024*1024){say('파일이 너무 큽니다(40MB 이하만 가져옵니다).',true);return}
  if(/\.xlsx$/i.test(f.name)){
    try{const wb=await IO.readXlsx(await f.arrayBuffer());loadXlsx(wb,f.name)}catch(e){say('.xlsx 를 읽지 못했습니다: '+e.message,true)}return}
  const v=await ask('CSV/TSV 가져오기',[{k:'enc',label:'인코딩',type:'select',opts:[['utf-8','UTF-8'],['euc-kr','EUC-KR (한글 윈도우)'],['utf-16le','UTF-16 LE']],value:'utf-8'},{k:'delim',label:'구분자',type:'select',opts:[['','자동 감지'],[',','쉼표'],['\t','탭'],[';','세미콜론']],value:''},{k:'into',label:'가져올 위치',type:'select',opts:[['new','새 시트'],['here','현재 시트의 선택 셀부터']],value:'new'}],'가져오기');
  if(!v)return;
  let text;try{text=new TextDecoder(v.enc).decode(await f.arrayBuffer())}catch(e){say('이 브라우저는 '+v.enc+' 인코딩을 지원하지 않습니다.',true);return}
  const{rows,delim}=IO.parseCSV(text,v.delim||undefined);
  if(rows.length>MAXR||rows.some(r=>r.length>MAXC)){say('행이나 열이 최대 크기('+MAXR+'×'+MAXC+')를 넘어 일부만 가져옵니다.',true)}
  let target=si,r0=0,c0=0;if(v.into==='new'){const n=eng.addSheet(uniqueName(f.name.replace(/\.[^.]+$/,'').slice(0,28)||'가져옴'));meta.push(newMeta());target=n;si=n}else{r0=norm(sel).r1;c0=norm(sel).c1}
  rows.slice(0,MAXR-r0).forEach((row,i)=>row.slice(0,MAXC-c0).forEach((val,j)=>{if(val!=='')eng.setRaw(target,r0+i,c0+j,val)}));
  ver++;layout();sel={r1:r0,c1:c0,r2:r0,c2:c0,ar:r0,ac:c0};commitHist();renderTabs();syncFx();rr();say(rows.length+'행을 가져왔습니다 (구분자: '+(delim==='\t'?'탭':delim)+', '+v.enc+').');
}
function loadXlsx(wb,name){
  const had=eng.sheets.some(s=>s.maxR>0);if(had&&!confirm('현재 통합 문서를 .xlsx 내용으로 바꿀까요? 되돌리려면 Ctrl+Z 를 누르세요.'))return;
  eng=new Engine();meta=[];eng.sheets=[];
  wb.sheets.forEach(s=>{const n=eng.addSheet(s.name),m=newMeta();meta.push(m);m.colW=s.colW;m.merges=s.merges;m.freeze=s.freeze;m.rowH=s.rowH;
    for(const c of s.cells){if(c.r>=MAXR||c.c>=MAXC)continue;
      let raw;if(c.f)raw='='+c.f;else if(c.v===null||c.v===undefined)raw='';else if(typeof c.v==='boolean')raw=c.v?'TRUE':'FALSE';else if(typeof c.v==='number')raw=String(c.v);else raw=c.t==='e'?String(c.v):(/^[=']/.test(c.v)||(!isNaN(+c.v)&&c.v.trim()!==''))?"'"+c.v:c.v;
      if(raw!==''||c.style)eng.setRaw(n,c.r,c.c,raw);const x=eng.sheets[n].cells[c.r+','+c.c];if(x&&c.style){x.s=c.style;if(c.style.fmt)x.fmtSet=true}}});
  for(const nm of wb.names)eng.names[nm.name.toUpperCase()]={ref:nm.ref.replace(/^'?[^!]*'?!/,m=>m),label:nm.name};
  si=0;sel={r1:0,c1:0,r2:0,c2:0,ar:0,ac:0};ver++;cfCache.clear();layout();commitHist();renderTabs();refreshNames();syncFx();rr();renderCharts();
  const w=wb.warn&&wb.warn.length?' 지원하지 않아 건너뛴 요소: '+[...new Set(wb.warn)].join(', ')+'.':'';say(name+' 를 가져왔습니다 ('+wb.sheets.length+'개 시트).'+w,!!w);
  if(w)info('가져오기 안내',el('p',{class:'ycp-note'},'다음 요소는 값 또는 서식만 가져오거나 건너뛰었습니다: '+[...new Set(wb.warn)].join(', ')+'. 공유 수식은 값으로 가져옵니다.'));
}
function toXlsxModel(){
  const sheets=eng.sheets.map((sh,i)=>{const m=meta[i],rows=new Map();
    for(const k in sh.cells){const[r,c]=k.split(',').map(Number),x=sh.cells[k];if((x.raw==null||x.raw==='')&&!x.s)continue;
      const v=eng.get(i,r,c);const o={c,style:x.s||(x.autoFmt?{fmt:x.autoFmt}:null)};
      if(x.autoFmt&&x.s&&!x.s.fmt)o.style={...x.s,fmt:x.autoFmt};
      const val=v&&v.__spark?'':v;
      if(x.f){o.f=x.raw.slice(1);if(isErr(val)){o.type='e';o.v=val.e}else if(typeof val==='number'){o.type='n';o.v=val}else if(typeof val==='boolean'){o.type='b';o.v=val}else{o.type='s';o.v=val===null?'':String(val)}}
      else if(x.raw===''||x.raw==null){o.type='x'}
      else if(typeof val==='number'){o.type='n';o.v=val}else if(typeof val==='boolean'){o.type='b';o.v=val}else{o.type='s';o.v=String(val===null?x.raw:val)}
      if(!rows.has(r))rows.set(r,[]);rows.get(r).push(o)}
    // 스필 결과 셀은 값으로 기록(수식은 원점 셀에만 있음)
    const list=[...rows.keys()].sort((a,b)=>a-b).map(r=>({r,cells:rows.get(r).sort((a,b)=>a.c-b.c),h:m.rowH[r]}));
    return{name:sh.name,rows:list,colW:m.colW,merges:m.merges,freeze:m.freeze}});
  const names=Object.values(eng.names).map(n=>({name:n.label,ref:n.ref}));
  return{sheets,names};
}
async function exportMenu(){
  const v=await ask('내보내기',[{k:'fmt',label:'형식',type:'select',opts:[['xlsx','.xlsx 통합 문서 (모든 시트)'],['csv','CSV (현재 시트)'],['tsv','TSV (현재 시트)']],value:'xlsx'},{k:'bom',label:'CSV 에 UTF-8 BOM 포함',type:'check',value:true,hint:'Excel 에서 한글이 깨지면 켜 두세요.'},{k:'delim',label:'CSV 구분자',type:'select',opts:[[',','쉼표'],[';','세미콜론']],value:','}],'내보내기');if(!v)return;exportAs(v);
}
function exportAs(v){
  const base='gridcraft';
  if(v.fmt==='xlsx'){YC.download(IO.writeXlsx(toXlsxModel()),base+'.xlsx');say('.xlsx 로 내보냈습니다. 차트·조건부 서식·유효성 검사는 .xlsx 에 포함되지 않습니다.');return}
  const sh=S(),rows=[];for(let r=0;r<sh.maxR;r++){const row=[];for(let c=0;c<sh.maxC;c++){row.push(dispText(r,c))}rows.push(row)}
  const d=v.fmt==='tsv'?'\t':v.delim,txt=(v.bom&&v.fmt==='csv'?'\uFEFF':'')+IO.toCSV(rows,d);YC.download(new Blob([txt],{type:'text/'+(v.fmt==='tsv'?'tab-separated-values':'csv')+';charset=utf-8'}),base+'.'+v.fmt);say('현재 시트('+sh.name+')를 '+v.fmt.toUpperCase()+' 로 내보냈습니다. 표시된 값(수식 결과) 기준입니다.');
}
YC.quickExport(()=>exportAs({fmt:'xlsx'}));

/* ================= 직렬화·기록 ================= */
function ser(){return{v:1,si,names:Object.values(eng.names).map(n=>({n:n.label,ref:n.ref})),sheets:eng.sheets.map((sh,i)=>{const cells={};for(const k in sh.cells){const x=sh.cells[k];if((x.raw==null||x.raw==='')&&!x.s)continue;const o={r:x.raw||''};if(x.s)o.s=x.s;if(x.autoFmt)o.a=x.autoFmt;cells[k]=o}return{name:sh.name,cells,m:meta[i]}})}}
function load(st){
  eng=new Engine();eng.sheets=[];meta=[];
  for(const s of st.sheets){const n=eng.addSheet(s.name);meta.push(Object.assign(newMeta(),YC.clone(s.m||{})));for(const k in s.cells){const[r,c]=k.split(',').map(Number),o=s.cells[k];eng.setRaw(n,r,c,o.r);const x=eng.sheets[n].cells[k]||(o.r===''?(eng.sheets[n].cells[k]={raw:'',v:null}):null);if(x){if(o.s)x.s=o.s;if(o.a)x.autoFmt=o.a}}}
  for(const n of st.names||[])eng.names[n.n.toUpperCase()]={ref:n.ref,label:n.n};
  si=cl(st.si||0,0,eng.sheets.length-1);ver++;cfCache.clear();layout();
  sel={r1:0,c1:0,r2:0,c2:0,ar:0,ac:0};renderTabs();refreshNames();syncFx();rr();renderCharts();updatePivotBtn();
}
const hist=YC.history(ser,s=>{const keep={...sel};load(s);sel=keep;rr()},50);
YC.bindHistoryKeys(hist,root);
function commitHist(){hist.commit();YC.dirty();renderCharts();updateStat()}
YC.adapter({export:ser,async import(st){load(st);hist.reset()}});

/* ================= 상태 표시줄 ================= */
const stat=el('div',{class:'gc-stat',role:'status'});
function updateStat(){
  const n=norm(sel);if(n.r1===n.r2&&n.c1===n.c2){stat.textContent=colName(sel.ac)+(sel.ar+1)+' · 시트 '+S().name+' · '+eng.sheets.length+'개 시트 · '+S().maxR.toLocaleString()+'행 사용';return}
  let cnt=0,sum=0,num=0,mn=Infinity,mx=-Infinity;const rl=Math.min(n.r2,Math.max(n.r1,S().maxR-1)),cl2=Math.min(n.c2,Math.max(n.c1,S().maxC-1));
  for(let r=n.r1;r<=rl;r++)for(let c=n.c1;c<=cl2;c++){const v=eng.get(si,r,c);if(v!==null&&v!=='')cnt++;if(typeof v==='number'){num++;sum+=v;if(v<mn)mn=v;if(v>mx)mx=v}}
  stat.textContent='범위 '+rngStr(n)+' · 개수 '+cnt+(num?' · 합계 '+G.numStr(+sum.toPrecision(12))+' · 평균 '+G.numStr(+(sum/num).toPrecision(10))+' · 최소 '+G.numStr(mn)+' · 최대 '+G.numStr(mx):'');
}

/* ================= 도구 막대 ================= */
const NF=[['General','일반'],['0','숫자(정수)'],['#,##0.00','숫자(천 단위)'],['₩#,##0','통화 ₩'],['$#,##0.00','통화 $'],['0%','백분율'],['0.00%','백분율(소수 2)'],['yyyy-mm-dd','날짜'],['yyyy년 m월 d일','날짜(긴 형식)'],['hh:mm:ss','시간'],['0.00E+00','과학'],['@','텍스트'],['custom','사용자 지정…']];
const nfSel=el('select',{'aria-label':'숫자 형식'},[el('option',{value:''},'숫자 형식'),...NF.map(([v,t])=>el('option',{value:v},t))]);nfSel.addEventListener('change',()=>{if(nfSel.value)applyFmt(nfSel.value);nfSel.value=''});
const colorIn=(label,fn,val)=>{const i=el('input',{type:'color',value:val,'aria-label':label,title:label});i.addEventListener('input',()=>fn(i.value));return i};
const bar1=el('div',{class:'gc-bar',role:'toolbar','aria-label':'서식'},
  YC.btn('굵게',()=>toggleStyle('b'),{title:'Ctrl+B'}),YC.btn('기울임',()=>toggleStyle('i'),{title:'Ctrl+I'}),
  el('label',{class:'ycp-sr'},'글자색'),colorIn('글자색',v=>patchStyle({col:v}),'#ffffff'),colorIn('배경색',v=>patchStyle({bg:v}),'#1d2a26'),
  YC.btn('왼쪽',()=>patchStyle({al:'l'})),YC.btn('가운데',()=>patchStyle({al:'c'})),YC.btn('오른쪽',()=>patchStyle({al:'r'})),YC.btn('줄 바꿈',()=>{const x=cellOf(sel.ar,sel.ac);patchStyle({wrap:!(x&&x.s&&x.s.wrap)})}),
  nfSel,YC.btn('소수 +',()=>decimals(1)),YC.btn('소수 −',()=>decimals(-1)),
  YC.btn('테두리: 전체',()=>borders('all')),YC.btn('바깥',()=>borders('outer')),YC.btn('아래',()=>borders('bottom')),YC.btn('없음',()=>borders('none')),
  YC.btn('병합',mergeSel),YC.btn('병합 해제',unmergeSel),YC.btn('서식 지우기',()=>{eachSel(x=>{delete x.s;delete x.autoFmt});ver++;commitHist();rr()}));
const bar2=el('div',{class:'gc-bar',role:'toolbar','aria-label':'데이터'},
  YC.btn('행 삽입',()=>insDel('r',1)),YC.btn('행 삭제',()=>insDel('r',-1)),YC.btn('열 삽입',()=>insDel('c',1)),YC.btn('열 삭제',()=>insDel('c',-1)),YC.btn('틀 고정',freeze),
  YC.btn('오름차순',()=>sortBy(sel.ac,true,true)),YC.btn('내림차순',()=>sortBy(sel.ac,false,true)),YC.btn('필터',toggleFilter),YC.btn('찾기/바꾸기',()=>openFind(true)),
  YC.btn('조건부 서식',cfDialog),YC.btn('유효성 검사',dvDialog),YC.btn('메모',noteEdit),YC.btn('이름 정의',nameManager),
  YC.btn('차트',()=>editChart()),YC.btn('피벗 테이블',pivotDialog),(pivotBtn=YC.btn('피벗 새로고침',refreshPivot)),
  YC.btn('실행 취소',()=>hist.undo()),YC.btn('다시 실행',()=>hist.redo()),
  YC.btn('가져오기',importFile,{primary:true}),YC.btn('내보내기',exportMenu,{primary:true}),
  YC.btn('도움말',()=>info('GridCraft 도움말',el('div',{class:'ycp-note',style:'line-height:1.9'},'방향키 이동 · 문자 입력으로 편집 · F2/더블클릭 편집 · Enter/Tab 확정 · Esc 취소 · Delete 지우기 · Ctrl+C/X/V 복사/잘라내기/붙여넣기 · Ctrl+D/R 아래/오른쪽 채우기 · Ctrl+B/I 굵게/기울임 · Ctrl+Z/Y 실행 취소/다시 실행 · Ctrl+방향키 데이터 끝으로 · Ctrl+F/H 찾기/바꾸기 · 수식 편집 중 F4 절대 참조 전환 · 선택 영역 모서리를 끌어 채우기. 함수는 '+G.functionCount()+'개를 지원합니다(SUM, VLOOKUP, XLOOKUP, SUMIFS, FILTER, SORT, UNIQUE, LET, LAMBDA, MAP, REDUCE, TEXT, DATE 등).'))));
pivotBtn.hidden=true;
const fxRow=el('div',{class:'gc-fx'},nameBox,nameList,el('span',{'aria-hidden':'true',style:'color:#70f0bd;font-style:italic'},'fx'),fxInput);
root.insertBefore(bar1,YC._status);root.insertBefore(bar2,YC._status);root.insertBefore(fxRow,YC._status);root.insertBefore(scroller,YC._status);root.insertBefore(live,YC._status);root.insertBefore(tabs,YC._status);root.insertBefore(stat,YC._status);root.insertBefore(chartBox,YC._status);
root.insertBefore(el('p',{class:'ycp-note'},'지원하지 않는 항목: 실시간 공동 편집, 매크로, 피벗 캐시 가져오기, 차트·조건부 서식의 .xlsx 내보내기. 수식은 직접 구현한 엔진으로 계산하므로 일부 함수의 세부 동작이 다른 프로그램과 다를 수 있습니다.'),YC._status);

/* ================= 시작 ================= */
const demo=[['항목','수량','단가','금액'],['사과',3,1200,'=B2*C2'],['배',2,2500,'=B3*C3'],['귤',10,400,'=B4*C4'],['합계','=SUM(B2:B4)','','=SUM(D2:D4)']];
demo.forEach((row,r)=>row.forEach((v,c)=>{if(v!=='')eng.setRaw(0,r,c,String(v))}));
for(let c=0;c<4;c++){const x=cellOf(0,c,true);x.s={b:1,bg:'#254337'}}
for(const r of[1,2,3,4])for(const c of[2,3]){const x=cellOf(r,c,true);x.s={...(x.s||{}),fmt:'#,##0'}}
for(let c=0;c<4;c++){const x=cellOf(4,c,true);x.s={...(x.s||{}),b:1}}
layout();renderTabs();syncFx();hist.commit();rr();
requestAnimationFrame(rr);
window.addEventListener('resize',YC.debounce(rr,120));
window.__gridcraft={get eng(){return eng},get meta(){return meta},get sel(){return sel},get si(){return si},hist,setSel,ser,load,dispText,startEdit,endEdit,shiftRefs,sortBy,toggleFilter,exportAs,toXlsxModel,loadXlsx,buildPivot,chartSvg,layout,hiddenRows,doFill,get clip(){return clip}};
})();
