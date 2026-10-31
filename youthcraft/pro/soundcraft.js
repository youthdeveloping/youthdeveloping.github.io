/* SoundCraft Pro — 오디오 편집 작업실. 브라우저 안에서만 처리하며 AI 기능은 없습니다. */
(()=>{'use strict';
if(!window.YC)return;
const {el}=YC,say=YC.say,AC=window.AudioContext||window.webkitAudioContext,OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
const root=YC.workspace({title:'SoundCraft',intro:'소리를 불러와 자르고 이어 붙이고 효과를 넣은 뒤 WAV로 저장합니다.',subtitle:'모든 소리 처리는 이 브라우저 안에서 이뤄집니다. 소리 파일은 서버로 전송되지 않습니다.'}).root;
if(!AC){root.append(el('p',{class:'ycp-note'},'이 브라우저는 Web Audio를 지원하지 않아 SoundCraft Pro를 사용할 수 없습니다.'));return}
const MAXSEC=1800;
let ctx=null,data=null,rate=44100,sel=null,cursor=0,zoom={start:0,len:0},clipboard=null,markers=[],src=null,playStart=0,playFrom=0,playing=false,loop=false,anim=0,rec=null,name='audio';
const getCtx=()=>ctx||(ctx=new AC());
const ch=()=>data?data.length:0,len=()=>data?data[0].length:0;
const css=el('style',null,`
.sc-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.sc-wave{display:block;width:100%;height:220px;background:#0e0e12;border:1px solid #36363f;border-radius:8px;touch-action:none;cursor:crosshair}
.sc-spec{display:block;width:100%;height:90px;background:#0e0e12;border:1px solid #36363f;border-radius:8px;margin-top:6px}
.sc-info{font-size:12px;color:#aaaab4;margin:6px 0}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:8px}
`);document.head.append(css);
const cv=el('canvas',{class:'sc-wave',tabindex:0,role:'img','aria-label':'파형. 끌어서 구간을 선택하고 스페이스로 재생합니다.'}),spec=el('canvas',{class:'sc-spec','aria-label':'재생 중 주파수 분석'});
const info=el('div',{class:'sc-info',role:'status'});
/* ---------- 상태 ---------- */
const snap=()=>data?{d:data.map(c=>new Float32Array(c)),rate,markers:[...markers]}:null;
const stack=[];let idx=-1;
function commit(){const s=snap();stack.length=idx+1;stack.push(s);if(stack.length>12)stack.shift();idx=stack.length-1;YC.dirty()}
function restore(s){stop();if(!s){data=null}else{data=s.d.map(c=>new Float32Array(c));rate=s.rate;markers=[...s.markers]}sel=null;cursor=0;fitAll();draw();upd()}
const undo=()=>{if(idx>0){idx--;restore(stack[idx])}},redo=()=>{if(idx<stack.length-1){idx++;restore(stack[idx])}};
const fmt=t=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(2).padStart(5,'0')};
function upd(){
  if(!data){info.textContent='소리가 없습니다. "불러오기"를 누르거나 녹음하세요.';return}
  const s=sel?`선택 ${fmt(sel[0]/rate)} – ${fmt(sel[1]/rate)} (${((sel[1]-sel[0])/rate).toFixed(2)}초)`:'선택 없음';
  info.textContent=`${name} · ${ch()}채널 · ${rate}Hz · 길이 ${fmt(len()/rate)} · 커서 ${fmt(cursor/rate)} · ${s} · 최대 음량 ${peakDb().toFixed(1)} dBFS`;
}
function peakDb(){let p=0;for(const c of data)for(let i=0;i<c.length;i++){const a=Math.abs(c[i]);if(a>p)p=a}return p>0?20*Math.log10(p):-Infinity}
/* ---------- 파형 그리기 ---------- */
function fitAll(){zoom={start:0,len:Math.max(1,len())}}
function resize(){const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=Math.max(300,r.width*d);cv.height=r.height*d;spec.width=cv.width;spec.height=spec.getBoundingClientRect().height*d}
const x2s=x=>Math.round(zoom.start+x/cv.width*zoom.len),s2x=s=>(s-zoom.start)/zoom.len*cv.width;
function draw(){
  const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.fillStyle='#0e0e12';g.fillRect(0,0,W,H);
  if(!data){g.fillStyle='#777';g.font=`${14*(devicePixelRatio||1)}px sans-serif`;g.fillText('소리를 불러오세요',20,40);return}
  const n=ch(),lh=H/n;
  if(sel){g.fillStyle='rgba(112,240,189,.18)';g.fillRect(s2x(sel[0]),0,s2x(sel[1])-s2x(sel[0]),H)}
  for(let c=0;c<n;c++){const mid=lh*c+lh/2,a=data[c];g.strokeStyle='#2a2a33';g.beginPath();g.moveTo(0,mid);g.lineTo(W,mid);g.stroke();g.strokeStyle='#70f0bd';g.beginPath();
    const spp=zoom.len/W;
    for(let x=0;x<W;x++){const s0=Math.floor(zoom.start+x*spp),s1=Math.min(a.length,Math.max(s0+1,Math.floor(zoom.start+(x+1)*spp)));if(s0>=a.length)break;let mn=1,mx=-1;const step=Math.max(1,Math.floor((s1-s0)/64));for(let i=s0;i<s1;i+=step){const v=a[i];if(v<mn)mn=v;if(v>mx)mx=v}
      g.moveTo(x+.5,mid-mx*lh/2*.95);g.lineTo(x+.5,mid-mn*lh/2*.95)}g.stroke()}
  g.strokeStyle='#ffd166';markers.forEach(m=>{const x=s2x(m.at);if(x>=0&&x<=W){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();g.fillStyle='#ffd166';g.font=`${11*(devicePixelRatio||1)}px sans-serif`;g.fillText(m.label,x+3,12*(devicePixelRatio||1))}});
  g.strokeStyle='#fff';const cx=s2x(playing?curPos():cursor);g.beginPath();g.moveTo(cx,0);g.lineTo(cx,H);g.stroke();
}
const curPos=()=>Math.min(len(),Math.round(playFrom+(getCtx().currentTime-playStart)*rate*rateMul));
let rateMul=1;
/* ---------- 선택·확대 ---------- */
let dragSel=null;
cv.addEventListener('pointerdown',e=>{if(!data)return;cv.setPointerCapture(e.pointerId);const r=cv.getBoundingClientRect(),s=cl(x2s((e.clientX-r.left)/r.width*cv.width));dragSel={a:s,moved:false};cv.focus()});
cv.addEventListener('pointermove',e=>{if(!dragSel)return;const r=cv.getBoundingClientRect(),s=cl(x2s((e.clientX-r.left)/r.width*cv.width));if(Math.abs(s-dragSel.a)>zoom.len/cv.width*2)dragSel.moved=true;if(dragSel.moved){sel=[Math.min(dragSel.a,s),Math.max(dragSel.a,s)];draw();upd()}});
cv.addEventListener('pointerup',()=>{if(!dragSel)return;if(!dragSel.moved){sel=null;cursor=dragSel.a;if(playing){play(cursor)}}dragSel=null;draw();upd()});
cv.addEventListener('wheel',e=>{if(!data)return;e.preventDefault();const r=cv.getBoundingClientRect(),f=(e.clientX-r.left)/r.width,a=zoom.start+zoom.len*f,nl=Math.max(200,Math.min(len(),zoom.len*(e.deltaY>0?1.25:0.8)));zoom.len=nl;zoom.start=Math.max(0,Math.min(len()-nl,a-nl*f));draw()},{passive:false});
const cl=s=>Math.max(0,Math.min(len(),s));
cv.addEventListener('keydown',e=>{
  if(e.key===' '){e.preventDefault();playing?stop():play()}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();cut(true)}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();cursor=cl(cursor+(e.key==='ArrowLeft'?-1:1)*Math.round(rate*(e.shiftKey?1:0.1)));draw();upd()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();if(data){sel=[0,len()];draw();upd()}}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();copy()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='x'){e.preventDefault();cut(false)}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();paste()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
});
/* ---------- 재생 ---------- */
function toBuffer(d,sr){const b=getCtx().createBuffer(d.length,d[0].length,sr);d.forEach((c,i)=>b.copyToChannel(c,i));return b}
function play(from){
  if(!data)return;stop(true);const c=getCtx();if(c.state==='suspended')c.resume();
  const a=sel?sel[0]:(from!==undefined?from:cursor),b=sel?sel[1]:len();
  const slice=data.map(x=>x.subarray(a,b)),buf=toBuffer(slice.map(x=>new Float32Array(x)),rate);
  src=c.createBufferSource();src.buffer=buf;src.playbackRate.value=rateMul;src.loop=loop&&!!sel;
  const an=c.createAnalyser();an.fftSize=1024;src.connect(an);an.connect(c.destination);src._an=an;
  playFrom=a;playStart=c.currentTime;playing=true;src.onended=()=>{if(src&&src.buffer===buf){playing=false;cursor=sel?sel[1]:len();cancelAnimationFrame(anim);draw();upd()}};src.start();
  const bins=new Uint8Array(an.frequencyBinCount),loopf=()=>{if(!playing)return;an.getByteFrequencyData(bins);drawSpec(bins);draw();anim=requestAnimationFrame(loopf)};loopf();
}
function stop(silent){if(src){try{src.onended=null;src.stop()}catch(_){}src=null}if(playing&&!silent){cursor=curPos()}playing=false;cancelAnimationFrame(anim);if(!silent){draw();upd()}}
function drawSpec(bins){const g=spec.getContext('2d'),W=spec.width,H=spec.height;g.fillStyle='#0e0e12';g.fillRect(0,0,W,H);const n=Math.min(bins.length,256),bw=W/n;g.fillStyle='#70f0bd';for(let i=0;i<n;i++){const h=bins[i]/255*H;g.fillRect(i*bw,H-h,Math.max(1,bw-1),h)}}
/* ---------- 편집 ---------- */
const range=()=>sel&&sel[1]-sel[0]>0?sel:[0,len()];
function need(){if(!data){say('먼저 소리를 불러오거나 녹음해 주세요.',true);return false}return true}
function splice(a,b,ins){data=data.map((c,i)=>{const x=ins?ins[Math.min(i,ins.length-1)]:new Float32Array(0),o=new Float32Array(c.length-(b-a)+x.length);o.set(c.subarray(0,a));o.set(x,a);o.set(c.subarray(b),a+x.length);return o});markers=markers.filter(m=>m.at<a||m.at>=b).map(m=>m.at>=b?{...m,at:m.at-(b-a)+(ins?ins[0].length:0)}:m)}
function copy(){if(!need())return;if(!sel){say('복사할 구간을 먼저 선택해 주세요.',true);return}clipboard={d:data.map(c=>new Float32Array(c.subarray(sel[0],sel[1]))),rate};say('복사했습니다 ('+((sel[1]-sel[0])/rate).toFixed(2)+'초).')}
function cut(del){if(!need())return;if(!sel){say('자를 구간을 먼저 선택해 주세요.',true);return}if(!del)clipboard={d:data.map(c=>new Float32Array(c.subarray(sel[0],sel[1]))),rate};const[a,b]=sel;splice(a,b,null);cursor=a;sel=null;fitAll();commit();draw();upd();say(del?'선택 구간을 삭제했습니다.':'잘라냈습니다.')}
function paste(){if(!clipboard){say('붙여넣을 내용이 없습니다. 먼저 복사하거나 잘라내 주세요.',true);return}
  if(!data){data=clipboard.d.map(c=>new Float32Array(c));rate=clipboard.rate;cursor=0;fitAll();commit();draw();upd();return}
  let ins=clipboard.d;if(clipboard.rate!==rate)ins=ins.map(c=>resample(c,clipboard.rate,rate));
  while(ins.length<ch())ins=[...ins,ins[ins.length-1]];ins=ins.slice(0,ch());const at=sel?sel[0]:cursor;splice(sel?sel[0]:at,sel?sel[1]:at,ins);cursor=at+ins[0].length;sel=null;fitAll();commit();draw();upd();say('붙여넣었습니다.')}
function trimTo(){if(!need())return;if(!sel){say('남길 구간을 선택해 주세요.',true);return}data=data.map(c=>c.slice(sel[0],sel[1]));markers=markers.filter(m=>m.at>=sel[0]&&m.at<sel[1]).map(m=>({...m,at:m.at-sel[0]}));sel=null;cursor=0;fitAll();commit();draw();upd();say('선택한 구간만 남겼습니다.')}
function mapRange(fn,msg){if(!need())return;const[a,b]=range();for(let c=0;c<ch();c++)fn(data[c].subarray(a,b),c,b-a);commit();draw();upd();say(msg)}
const gainDb=db=>mapRange(x=>{const g=Math.pow(10,db/20);for(let i=0;i<x.length;i++)x[i]*=g},'음량을 '+db+' dB 조절했습니다.');
function normalize(db=-1){if(!need())return;const[a,b]=range();let p=0;for(const c of data)for(let i=a;i<b;i++){const v=Math.abs(c[i]);if(v>p)p=v}if(p===0){say('무음이라 정규화할 수 없습니다.',true);return}const g=Math.pow(10,db/20)/p;mapRange(x=>{for(let i=0;i<x.length;i++)x[i]*=g},'최대 음량을 '+db+' dBFS로 맞췄습니다.')}
const fade=(inn)=>mapRange(x=>{const n=x.length;for(let i=0;i<n;i++)x[i]*=inn?i/n:1-i/n},inn?'페이드 인을 적용했습니다.':'페이드 아웃을 적용했습니다.');
const reverse=()=>mapRange(x=>x.reverse(),'뒤집었습니다.');
const invert=()=>mapRange(x=>{for(let i=0;i<x.length;i++)x[i]=-x[i]},'위상을 반전했습니다.');
const silence=()=>mapRange(x=>x.fill(0),'선택 구간을 무음으로 만들었습니다.');
function removeDC(){mapRange(x=>{let m=0;for(let i=0;i<x.length;i++)m+=x[i];m/=x.length||1;for(let i=0;i<x.length;i++)x[i]-=m},'직류 성분을 제거했습니다.')}
function insertSilence(){if(!need())return;const s=+prompt('넣을 무음 길이(초)',1);if(!(s>0&&s<=60)){say('0보다 크고 60 이하인 초를 입력해 주세요.',true);return}const at=sel?sel[0]:cursor,z=data.map(()=>new Float32Array(Math.round(s*rate)));splice(at,at,z);fitAll();commit();draw();upd();say(s+'초 무음을 넣었습니다.')}
function trimSilence(){
  if(!need())return;const th=Math.pow(10,-50/20);let a=0,b=len();const loud=i=>data.some(c=>Math.abs(c[i])>th);while(a<b&&!loud(a))a++;while(b>a&&!loud(b-1))b--;
  if(b<=a){say('모두 무음입니다.',true);return}if(a===0&&b===len()){say('앞뒤에 제거할 무음이 없습니다(기준 −50 dB).');return}
  data=data.map(c=>c.slice(a,b));markers=[];sel=null;cursor=0;fitAll();commit();draw();upd();say('앞뒤 무음을 제거했습니다 ('+(a/rate).toFixed(2)+'초 앞부분).');
}
function resample(x,from,to){if(from===to)return x;const n=Math.round(x.length*to/from),o=new Float32Array(n),r=from/to;for(let i=0;i<n;i++){const p=i*r,j=Math.floor(p),f=p-j;o[i]=x[j]*(1-f)+(x[Math.min(x.length-1,j+1)]||0)*f}return o}
function toMono(){if(!need())return;if(ch()<2){say('이미 모노입니다.');return}const m=new Float32Array(len());for(const c of data)for(let i=0;i<m.length;i++)m[i]+=c[i]/ch();data=[m];commit();draw();upd();say('모노로 합쳤습니다.')}
function changeRate(){if(!need())return;const r=+prompt('새 샘플레이트(Hz): 8000 – 96000',rate);if(!(r>=8000&&r<=96000)){say('8000~96000 사이로 입력해 주세요.',true);return}data=data.map(c=>resample(c,rate,Math.round(r)));markers=markers.map(m=>({...m,at:Math.round(m.at*r/rate)}));rate=Math.round(r);sel=null;cursor=0;fitAll();commit();draw();upd();say('샘플레이트를 '+rate+'Hz로 바꿨습니다.')}
function speed(){if(!need())return;const f=+prompt('배속 (0.25 – 4). 속도와 음높이가 함께 변합니다',1.25);if(!(f>=0.25&&f<=4)){say('0.25~4 사이로 입력해 주세요.',true);return}data=data.map(c=>resample(c,rate*f,rate));fitAll();sel=null;cursor=0;commit();draw();upd();say('배속 '+f+'로 바꿨습니다.')}
function addMarker(){if(!need())return;const at=sel?sel[0]:cursor;markers.push({at,label:'M'+(markers.length+1)});commit();draw();say('마커를 추가했습니다.')}
/* 오프라인 효과 */
async function offline(build,label,tail=0){
  if(!need())return;if(!OAC){say('이 브라우저는 오프라인 오디오 처리를 지원하지 않습니다.',true);return}
  const[a,b]=range(),n=b-a,total=n+Math.round(tail*rate),o=new OAC(ch(),total,rate),buf=toBuffer(data.map(c=>new Float32Array(c.subarray(a,b))),rate),s=o.createBufferSource();s.buffer=buf;
  const out=build(o,s);out.connect(o.destination);s.start();const r=await o.startRendering();
  const res=[];for(let c=0;c<ch();c++)res.push(r.getChannelData(c).slice());splice(a,b,res);
  if(sel)sel=[a,a+res[0].length];commit();fitAll();draw();upd();say(label+'를 적용했습니다.');
}
const filt=(type,f,q=0.707,g=0)=>(o,s)=>{const b=o.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;b.gain.value=g;s.connect(b);return b};
function eq(){
  const b=+bassI.value,m=+midI.value,t=+trebI.value;
  offline((o,s)=>{const l=o.createBiquadFilter();l.type='lowshelf';l.frequency.value=200;l.gain.value=b;const p=o.createBiquadFilter();p.type='peaking';p.frequency.value=1000;p.Q.value=0.8;p.gain.value=m;const h=o.createBiquadFilter();h.type='highshelf';h.frequency.value=4000;h.gain.value=t;s.connect(l);l.connect(p);p.connect(h);return h},'이퀄라이저 (저음 '+b+' · 중음 '+m+' · 고음 '+t+' dB)');
}
function compressor(){offline((o,s)=>{const c=o.createDynamicsCompressor();c.threshold.value=-24;c.ratio.value=4;c.attack.value=0.01;c.release.value=0.25;c.knee.value=12;s.connect(c);const g=o.createGain();g.gain.value=1.5;c.connect(g);return g},'컴프레서')}
function echo(){const d=+prompt('에코 간격(초)',0.3),fb=+prompt('반복 세기 (0~0.9)',0.4);if(!(d>0&&d<=2&&fb>=0&&fb<=0.9)){say('간격은 2초 이하, 반복 세기는 0~0.9로 입력해 주세요.',true);return}
  offline((o,s)=>{const dl=o.createDelay(2);dl.delayTime.value=d;const f=o.createGain();f.gain.value=fb;const mix=o.createGain();s.connect(mix);s.connect(dl);dl.connect(f);f.connect(dl);dl.connect(mix);return mix},'에코',Math.min(6,d*8))}
function reverb(){
  offline((o,s)=>{const len2=Math.round(o.sampleRate*1.8),ir=o.createBuffer(2,len2,o.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len2;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len2,3)}
    const conv=o.createConvolver();conv.buffer=ir;const wet=o.createGain();wet.gain.value=0.35;const mix=o.createGain();s.connect(mix);s.connect(conv);conv.connect(wet);wet.connect(mix);return mix},'리버브',1.8)}
const lowpass=()=>offline(filt('lowpass',+prompt('고음 차단 주파수(Hz)',4000)||4000),'저역 통과 필터');
const highpass=()=>offline(filt('highpass',+prompt('저음 차단 주파수(Hz)',120)||120),'고역 통과 필터');
/* 소음 억제: 기준 문턱 아래 구간을 줄이는 게이트(알고리즘 방식) */
function gate(){
  if(!need())return;const th=+prompt('게이트 기준(dBFS, −80 ~ −10)',-45);if(!(th>=-80&&th<=-10)){say('−80 ~ −10 사이로 입력해 주세요.',true);return}
  const t=Math.pow(10,th/20),win=Math.round(rate*0.02);mapRange(x=>{let env=0;const a=1/(rate*0.005),r=1/(rate*0.08);for(let i=0;i<x.length;i++){const v=Math.abs(x[i]);env+=(v>env?a:r)*(v-env);x[i]*=env>t?1:Math.max(0,env/t)}},'노이즈 게이트(기준 '+th+' dB)를 적용했습니다.')
}
/* ---------- 입출력 ---------- */
async function loadFile(){
  const f=(await YC.pick('audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac,.webm'))[0];if(!f)return;
  if(f.size>200*1024*1024){say('파일이 너무 큽니다(200MB 이하).',true);return}
  try{const buf=await getCtx().decodeAudioData(await f.arrayBuffer());
    if(buf.duration>MAXSEC){say('30분을 넘는 소리는 불러오지 않습니다.',true);return}
    const nd=[];for(let c=0;c<Math.min(2,buf.numberOfChannels);c++)nd.push(buf.getChannelData(c).slice());
    if(data&&!confirm('현재 소리를 바꿀까요? 되돌리려면 실행 취소를 누르세요.'))return;
    data=nd;rate=buf.sampleRate;name=f.name.replace(/\.[^.]+$/,'');markers=[];sel=null;cursor=0;fitAll();commit();draw();upd();say(f.name+' 를 불러왔습니다'+(buf.numberOfChannels>2?' (앞 2채널만 사용)':'')+'.')}
  catch(e){say('이 브라우저가 해독하지 못하는 형식입니다. WAV 또는 브라우저가 지원하는 형식으로 바꿔 주세요.',true)}
}
function encodeWav(d,sr,bits=16){
  const n=d[0].length,c=d.length,bps=bits/8,ba=c*bps,buf=new ArrayBuffer(44+n*ba),v=new DataView(buf),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+n*ba,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,bits===32?3:1,true);v.setUint16(22,c,true);v.setUint32(24,sr,true);v.setUint32(28,sr*ba,true);v.setUint16(32,ba,true);v.setUint16(34,bits,true);w(36,'data');v.setUint32(40,n*ba,true);
  let o=44;for(let i=0;i<n;i++)for(let k=0;k<c;k++){const s=Math.max(-1,Math.min(1,d[k][i]));if(bits===16){v.setInt16(o,s<0?s*32768:s*32767,true)}else if(bits===24){const q=Math.round(s<0?s*8388608:s*8388607);v.setUint8(o,q&255);v.setUint8(o+1,(q>>8)&255);v.setUint8(o+2,(q>>16)&255)}else v.setFloat32(o,s,true);o+=bps}
  return new Blob([buf],{type:'audio/wav'});
}
function exportWav(bits){if(!need())return;const[a,b]=sel?sel:[0,len()],blob=encodeWav(data.map(c=>c.subarray(a,b)),rate,bits||+bitSel.value);YC.download(blob,name+(sel?'-선택':'')+'.wav');say('WAV('+(bits||bitSel.value)+'비트)로 저장했습니다 ('+YC.fmtBytes(blob.size)+'). MP3와 OGG 인코딩은 지원하지 않습니다.')}
YC.quickExport(()=>exportWav(16));
async function record(){
  if(rec){rec.stop();return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){say('이 브라우저는 마이크 녹음을 지원하지 않습니다.',true);return}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false}})}catch(e){say('마이크 사용이 허용되지 않았습니다.',true);return}
  const c=getCtx(),srcN=c.createMediaStreamSource(stream),proc=c.createScriptProcessor(4096,1,1),chunks=[];proc.onaudioprocess=e=>{chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))};srcN.connect(proc);proc.connect(c.destination);
  recBtn.textContent='녹음 중지';say('녹음 중입니다…');
  rec={stop(){proc.disconnect();srcN.disconnect();stream.getTracks().forEach(t=>t.stop());const n=chunks.reduce((a,x)=>a+x.length,0),m=new Float32Array(n);let o=0;for(const x of chunks){m.set(x,o);o+=x.length}
    rec=null;recBtn.textContent='녹음';if(!n)return;if(!data){data=[m];rate=c.sampleRate;name='녹음'}else{const ins=[resample(m,c.sampleRate,rate)];while(ins.length<ch())ins.push(ins[0]);splice(cursor,cursor,ins)}fitAll();commit();draw();upd();say('녹음을 추가했습니다.')}};
}
YC.adapter({
  export(){if(!data)return{empty:true};const bytes=data.reduce((a,c)=>a+c.length*2,0);
    if(bytes>40*1024*1024){return{tooBig:true,name,rate,markers,note:'소리가 커서 프로젝트에 담지 않았습니다. 원본 파일을 따로 보관하세요.'}}
    const enc=c=>{const i=new Int16Array(c.length);for(let k=0;k<c.length;k++){const s=Math.max(-1,Math.min(1,c[k]));i[k]=s<0?s*32768:s*32767}let bin='';const u=new Uint8Array(i.buffer);for(let k=0;k<u.length;k+=32768)bin+=String.fromCharCode.apply(null,u.subarray(k,k+32768));return btoa(bin)};
    return{name,rate,markers,pcm:data.map(enc)}},
  async import(s){if(!s||s.empty){restore(null);return}if(s.tooBig){say(s.note,true);return}
    data=s.pcm.map(b=>{const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const i16=new Int16Array(u.buffer),f=new Float32Array(i16.length);for(let k=0;k<f.length;k++)f[k]=i16[k]/32768;return f});rate=s.rate;name=s.name;markers=s.markers||[];sel=null;cursor=0;fitAll();stack.length=0;idx=-1;commit();draw();upd()}
});
/* ---------- 도구 막대 ---------- */
const B=(l,f,t)=>YC.btn(l,f,{title:t||''}),mkSl=(l,mn,mx,v)=>{const i=el('input',{type:'range',min:mn,max:mx,value:v,step:1,'aria-label':l});const o=el('output',null,v+' dB');i.addEventListener('input',()=>o.textContent=i.value+' dB');return {i,w:el('label',{class:'ycp-field'},el('span',null,l),i,o)}};
const bass=mkSl('저음',-12,12,0),mid=mkSl('중음',-12,12,0),treb=mkSl('고음',-12,12,0);const bassI=bass.i,midI=mid.i,trebI=treb.i;
const bitSel=el('select',{'aria-label':'WAV 비트 깊이'},[['16','16비트'],['24','24비트'],['32','32비트 실수']].map(([v,t])=>el('option',{value:v},t)));
const recBtn=B('녹음',record);
const speedSel=el('select',{'aria-label':'재생 속도'},[['0.5','0.5배'],['0.75','0.75배'],['1','1배'],['1.5','1.5배'],['2','2배']].map(([v,t])=>el('option',{value:v,selected:v==='1'},t)));speedSel.addEventListener('change',()=>{rateMul=+speedSel.value;if(playing)play(curPos())});
const loopCb=el('input',{type:'checkbox','aria-label':'선택 구간 반복'});loopCb.addEventListener('change',()=>{loop=loopCb.checked;if(playing)play()});
const row1=el('div',{class:'sc-bar',role:'toolbar','aria-label':'재생과 편집'},YC.btn('불러오기',loadFile,{primary:true}),recBtn,YC.btn('재생',()=>play(),{primary:true}),B('정지',()=>stop()),speedSel,el('label',null,loopCb,' 반복'),
  B('복사',copy),B('잘라내기',()=>cut(false)),B('붙여넣기',paste),B('삭제',()=>cut(true)),B('선택만 남기기',trimTo),B('전체 선택',()=>{if(data){sel=[0,len()];draw();upd()}}),B('확대 맞춤',()=>{fitAll();draw()}),B('선택 확대',()=>{if(sel){zoom={start:sel[0],len:Math.max(200,sel[1]-sel[0])};draw()}}),
  B('마커',addMarker),B('무음 넣기',insertSilence),B('실행 취소',undo),B('다시 실행',redo));
const row2=el('div',{class:'sc-bar',role:'toolbar','aria-label':'효과'},
  B('음량 +3 dB',()=>gainDb(3)),B('음량 −3 dB',()=>gainDb(-3)),B('정규화 −1 dB',()=>normalize(-1)),B('페이드 인',()=>fade(true)),B('페이드 아웃',()=>fade(false)),B('뒤집기',reverse),B('위상 반전',invert),B('구간 무음',silence),B('직류 제거',removeDC),B('앞뒤 무음 제거',trimSilence),
  B('노이즈 게이트',gate),B('컴프레서',compressor),B('에코',echo),B('리버브',reverb),B('저역 통과',lowpass),B('고역 통과',highpass),B('모노로',toMono),B('샘플레이트',changeRate),B('배속',speed));
const eqBox=el('div',{class:'sc-grid'},bass.w,mid.w,treb.w,el('div',null,YC.btn('이퀄라이저 적용',eq)));
const row3=el('div',{class:'sc-bar'},el('label',null,'내보내기 ',bitSel),YC.btn('WAV로 저장',()=>exportWav(),{primary:true}));
const st=YC._status;for(const n of[row1,row2,cv,spec,info,el('b',null,'이퀄라이저'),eqBox,row3])root.insertBefore(n,st);
root.insertBefore(el('p',{class:'ycp-note'},'사용법: 파형을 끌어 구간을 선택하고, 스페이스로 재생·정지, Delete로 삭제, Ctrl+C/X/V로 복사·잘라내기·붙여넣기, 마우스 휠로 확대합니다. 효과는 선택한 구간(없으면 전체)에 적용됩니다. 최대 30분, 최대 2채널. 저장은 WAV만 지원하며 MP3·OGG 인코딩과 다중 트랙은 없습니다.'),st);
addEventListener('resize',YC.debounce(()=>{resize();draw()},120));
resize();draw();upd();stack.push(null);idx=0;
window.__soundcraft={get data(){return data},get rate(){return rate},get sel(){return sel},set sel(v){sel=v},get markers(){return markers},setData(d,r){data=d;rate=r;fitAll();commit();draw();upd()},cut,copy,paste,trimTo,gainDb,normalize,fade,reverse,undo,redo,encodeWav,exportWav,eq,compressor,reverb,echo,toMono,trimSilence,peakDb,speed,eqSet(b,m,t){bassI.value=b;midI.value=m;trebI.value=t}};
})();
