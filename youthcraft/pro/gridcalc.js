/* GridCraft 계산 엔진 — 직접 만든 수식 파서·평가기(eval 사용 안 함), 의존성 기반 증분 재계산, 동적 배열 스필. */
(function(root){'use strict';
const MAXR=100000,MAXC=200;
const ERR=(e)=>({e});
const isErr=v=>v!==null&&typeof v==='object'&&'e' in v&&!Array.isArray(v);
const E={DIV0:ERR('#DIV/0!'),VALUE:ERR('#VALUE!'),REF:ERR('#REF!'),NAME:ERR('#NAME?'),NA:ERR('#N/A'),NUM:ERR('#NUM!'),CIRC:ERR('#CIRC!'),SPILL:ERR('#SPILL!'),NULL:ERR('#NULL!')};
/* ---------- 열 문자·참조 ---------- */
const colName=c=>{let s='';c++;while(c>0){const m=(c-1)%26;s=String.fromCharCode(65+m)+s;c=Math.floor((c-1)/26)}return s};
const colNum=s=>{let n=0;for(const ch of s.toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1};
const addr=(r,c)=>colName(c)+(r+1);
/* ---------- 토크나이저 ---------- */
const REFRE=/^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(])/;
const COLRE=/^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!)?(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\w(])/;
const ROWRE=/^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!)?(\$?)(\d+):(\$?)(\d+)(?![\w(])/;
function tokenize(s){
  const t=[];let i=0;
  while(i<s.length){
    const ch=s[i];
    if(/\s/.test(ch)){i++;continue}
    if(ch==='"'){let j=i+1,str='';while(j<s.length){if(s[j]==='"'){if(s[j+1]==='"'){str+='"';j+=2;continue}break}str+=s[j++]}t.push({t:'str',v:str,s:i,e:j+1});i=j+1;continue}
    const rest=s.slice(i);let m;
    if((m=/^\d+(\.\d*)?([eE][+-]?\d+)?|^\.\d+([eE][+-]?\d+)?/.exec(rest))){t.push({t:'num',v:parseFloat(m[0]),s:i,e:i+m[0].length});i+=m[0].length;continue}
    if((m=COLRE.exec(rest))){t.push({t:'colrange',sheet:m[1]?m[1].replace(/''/g,"'"):m[2],a:colNum(m[4]),b:colNum(m[6]),aa:!!m[3],ba:!!m[5],s:i,e:i+m[0].length});i+=m[0].length;continue}
    if((m=ROWRE.exec(rest))){t.push({t:'rowrange',sheet:m[1]?m[1].replace(/''/g,"'"):m[2],a:+m[4]-1,b:+m[6]-1,aa:!!m[3],ba:!!m[5],s:i,e:i+m[0].length});i+=m[0].length;continue}
    if((m=REFRE.exec(rest))){const c=colNum(m[4]);if(c<MAXC+50){t.push({t:'ref',sheet:m[1]?m[1].replace(/''/g,"'"):m[2],c,r:+m[6]-1,ca:!!m[3],ra:!!m[5],s:i,e:i+m[0].length});i+=m[0].length;continue}}
    if((m=/^[A-Za-z_À-￿][\w.À-￿]*/.exec(rest))){t.push({t:'id',v:m[0],s:i,e:i+m[0].length});i+=m[0].length;continue}
    if((m=/^(<>|<=|>=|[-+*/^&=<>%(),:;{}])/.exec(rest))){t.push({t:'op',v:m[0],s:i,e:i+m[0].length});i+=m[0].length;continue}
    if(ch==='#'){const mm=/^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!)/.exec(rest);if(mm){t.push({t:'err',v:'#'+mm[1],s:i,e:i+mm[0].length});i+=mm[0].length;continue}}
    throw new Error('수식에 해석할 수 없는 문자가 있습니다: '+ch);
  }
  return t;
}
/* ---------- 파서 ---------- */
function parse(src){
  const toks=tokenize(src);let p=0;
  const peek=()=>toks[p],next=()=>toks[p++];
  const isOp=(v)=>peek()&&peek().t==='op'&&peek().v===v;
  function cmp(){let l=cat();while(peek()&&peek().t==='op'&&['=','<>','<','>','<=','>='].includes(peek().v)){const op=next().v;l={k:'bin',op,l,r:cat()}}return l}
  function cat(){let l=add();while(isOp('&')){next();l={k:'bin',op:'&',l,r:add()}}return l}
  function add(){let l=mul();while(peek()&&peek().t==='op'&&(peek().v==='+'||peek().v==='-')){const op=next().v;l={k:'bin',op,l,r:mul()}}return l}
  function mul(){let l=pow();while(peek()&&peek().t==='op'&&(peek().v==='*'||peek().v==='/')){const op=next().v;l={k:'bin',op,l,r:pow()}}return l}
  function pow(){let l=unary();while(isOp('^')){next();l={k:'bin',op:'^',l,r:unary()}}return l}
  function unary(){if(peek()&&peek().t==='op'&&(peek().v==='-'||peek().v==='+')){const op=next().v;const e=unary();return op==='-'?{k:'neg',e}:e}return post()}
  function post(){let e=prim();while(isOp('%')){next();e={k:'pct',e}}return e}
  function prim(){
    const t=next();if(!t)throw new Error('수식이 끝나지 않았습니다.');
    if(t.t==='num')return{k:'num',v:t.v};if(t.t==='str')return{k:'str',v:t.v};if(t.t==='err')return{k:'err',v:t.v};
    if(t.t==='colrange')return{k:'range',sheet:t.sheet,r1:0,c1:t.a,r2:MAXR-1,c2:t.b,tok:t};
    if(t.t==='rowrange')return{k:'range',sheet:t.sheet,r1:t.a,c1:0,r2:t.b,c2:MAXC-1,tok:t};
    if(t.t==='ref'){const a={k:'ref',sheet:t.sheet,r:t.r,c:t.c};
      if(isOp(':')&&toks[p+1]&&toks[p+1].t==='ref'){next();const b=next();return{k:'range',sheet:t.sheet,r1:Math.min(a.r,b.r),c1:Math.min(a.c,b.c),r2:Math.max(a.r,b.r),c2:Math.max(a.c,b.c)}}return a}
    if(t.t==='id'){
      if(isOp('(')){next();const args=[];if(isOp(')')){next();return{k:'call',n:t.v.toUpperCase(),a:args}}
        for(;;){if(isOp(',')||isOp(')')){args.push({k:'empty'})}else args.push(cmp());if(isOp(',')){next();continue}if(isOp(')')){next();break}throw new Error('괄호나 쉼표가 필요합니다.')}
        return{k:'call',n:t.v.toUpperCase(),a:args}}
      const u=t.v.toUpperCase();if(u==='TRUE')return{k:'bool',v:true};if(u==='FALSE')return{k:'bool',v:false};return{k:'name',n:t.v}}
    if(t.t==='op'&&t.v==='('){const e=cmp();if(!isOp(')'))throw new Error('닫는 괄호가 없습니다.');next();return e}
    if(t.t==='op'&&t.v==='{'){const rows=[[]];for(;;){const e=cmp();rows[rows.length-1].push(e);if(isOp(',')){next();continue}if(isOp(';')){next();rows.push([]);continue}if(isOp('}')){next();break}throw new Error('배열 상수가 올바르지 않습니다.')}return{k:'arr',rows}}
    throw new Error('예상하지 못한 기호: '+(t.v||t.t));
  }
  const e=cmp();if(p<toks.length)throw new Error('수식 끝에 해석되지 않은 부분이 있습니다.');return e;
}
/* ---------- 값 변환 ---------- */
const isArr=Array.isArray;
const toNum=v=>{if(isErr(v))return v;if(v===null||v===undefined||v==='')return 0;if(typeof v==='number')return v;if(typeof v==='boolean')return v?1:0;
  if(typeof v==='string'){const s=v.trim().replace(/,/g,'');if(s!==''&&!isNaN(+s))return +s;const pc=/^(-?[\d.]+)%$/.exec(s);if(pc)return +pc[1]/100;return E.VALUE}return E.VALUE};
const toStr=v=>{if(isErr(v))return v;if(v===null||v===undefined)return '';if(typeof v==='boolean')return v?'TRUE':'FALSE';if(typeof v==='number')return numStr(v);return String(v)};
const numStr=n=>{if(!isFinite(n))return String(n);const s=String(+n.toPrecision(15));return s};
const toBool=v=>{if(isErr(v))return v;if(typeof v==='boolean')return v;if(typeof v==='number')return v!==0;if(typeof v==='string'){const u=v.toUpperCase();if(u==='TRUE')return true;if(u==='FALSE')return false;return E.VALUE}return false};
/* ---------- 날짜 ---------- */
const DAY=86400000,toDate=n=>new Date(Math.round((n-25569)*DAY)),fromDate=d=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds())/DAY+25569;
const mkDate=(y,m,d)=>Math.round((Date.UTC(y,m-1,d)-Date.UTC(1970,0,1))/DAY)+25569;
/* ---------- 숫자 서식 ---------- */
function formatValue(v,fmt){
  if(v===null||v===undefined)return '';if(isErr(v))return v.e;if(typeof v==='boolean')return v?'TRUE':'FALSE';
  if(typeof v==='string')return v;
  if(!fmt||fmt==='General'||fmt==='일반')return numStr(v);
  const f=fmt.split(';');let sect=f[0];if(v<0&&f.length>1){sect=f[1]}else if(v===0&&f.length>2)sect=f[2];
  const neg=v<0&&f.length<2;
  if(/[yhdsmYHDSM]/.test(sect.replace(/"[^"]*"|\\./g,''))&&!/^[#0,.?%\s$₩"원]+$/.test(sect)){
    const d=toDate(v),Y=d.getUTCFullYear(),M=d.getUTCMonth()+1,D=d.getUTCDate(),H=d.getUTCHours(),Mi=d.getUTCMinutes(),S=d.getUTCSeconds(),p2=n=>String(n).padStart(2,'0');
    const hasAmpm=/AM\/PM/i.test(sect);const wd=['일','월','화','수','목','금','토'][d.getUTCDay()],wde=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
    return sect.replace(/"([^"]*)"|\\(.)|yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|am\/pm/gi,(m,q,esc,off,str)=>{
      if(q!==undefined)return q;if(esc!==undefined)return esc;const l=m.toLowerCase();
      if(l==='yyyy')return String(Y);if(l==='yy')return p2(Y%100);if(l==='mmmm')return ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'][M-1];
      if(l==='mmm')return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][M-1];
      if(l==='mm'||l==='m'){const bef=str.slice(0,off).replace(/"[^"]*"/g,''),aft=str.slice(off+m.length).replace(/"[^"]*"/g,''),isMin=/h[^a-z]*$/i.test(bef)||/^[^a-z]*s/i.test(aft);const val=isMin?Mi:M;return l==='mm'?p2(val):String(val)}
      if(l==='dddd')return wd+'요일';if(l==='ddd')return wde;if(l==='dd')return p2(D);if(l==='d')return String(D);
      if(l==='hh')return p2(hasAmpm?((H+11)%12)+1:H);if(l==='h')return String(hasAmpm?((H+11)%12)+1:H);if(l==='ss')return p2(S);if(l==='s')return String(S);if(l==='am/pm')return H<12?'AM':'PM';return m});
  }
  let n=neg?-v:(v<0?-v:v);const sign=v<0&&f.length<2?'-':'';
  let secOrig=sect;const lit=[];sect=sect.replace(/"([^"]*)"|\\(.)/g,(m,q,e)=>{lit.push(q!==undefined?q:e);return '\u0001'+(lit.length-1)+'\u0002'});
  const m=/[#0?][#0?,]*(?:\.[#0?]*)?(?:[eE][+-]0+)?|\.[0#?]+/.exec(sect);
  const restore=s=>s.replace(/\u0001(\d+)\u0002/g,(x,i)=>lit[+i]).replace(/_./g,' ').replace(/\*./g,'');
  if(!m)return restore(sect);
  const pre=sect.slice(0,m.index),post=sect.slice(m.index+m[0].length);let pat=m[0];
  const pct=(pre+post).includes('%');if(pct)n*=100;
  let body;
  const sci=/[eE][+-]0+$/.exec(pat);
  if(sci){const mant=pat.slice(0,sci.index),dec=(mant.split('.')[1]||'').length,exp=Math.floor(Math.log10(n||1)),mm=(n/Math.pow(10,exp)).toFixed(dec);body=mm+'E'+(exp<0?'-':'+')+String(Math.abs(exp)).padStart(sci[0].length-2,'0')}
  else{const dec=(pat.split('.')[1]||'').length,comma=/,/.test(pat.split('.')[0]);let s=(Math.round((n+Number.EPSILON*n)*Math.pow(10,dec))/Math.pow(10,dec)).toFixed(dec);
    let[ip,fp]=s.split('.');const minInt=(pat.split('.')[0].match(/0/g)||[]).length;ip=ip.padStart(minInt,'0');if(minInt===0&&ip==='0'&&dec>0&&pat.startsWith('.'))ip='';
    if(comma)ip=ip.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    if(fp!==undefined){const minF=(pat.split('.')[1].match(/0/g)||[]).length;fp=fp.replace(/0+$/,'');fp=fp.padEnd(minF,'0')}
    body=ip+(fp?'.'+fp:'')}
  return sign+restore(pre)+body+restore(post);
}
/* ---------- 기준(criteria) 매칭 ---------- */
function matcher(crit){
  if(typeof crit==='number'||typeof crit==='boolean')return v=>v===crit||(typeof crit==='number'&&typeof v==='string'&&+v===crit&&v!=='');
  let s=toStr(crit),op='=';const m=/^(<>|<=|>=|=|<|>)/.exec(s);if(m){op=m[1];s=s.slice(op.length)}
  const num=s!==''&&!isNaN(+s)?+s:null;
  const wild=/[*?]/.test(s)?new RegExp('^'+s.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$','i'):null;
  return v=>{
    if(isErr(v))return false;
    if(op==='='||op==='<>'){let eq;if(num!==null&&typeof v==='number')eq=v===num;else if(s===''){eq=v===null||v===''}else if(wild)eq=typeof v==='string'&&wild.test(v);else eq=String(v===null?'':v).toLowerCase()===s.toLowerCase();return op==='='?eq:!eq}
    if(num!==null&&typeof v==='number'){return op==='<'?v<num:op==='>'?v>num:op==='<='?v<=num:v>=num}
    if(typeof v==='string'&&num===null){const a=v.toLowerCase(),b=s.toLowerCase();return op==='<'?a<b:op==='>'?a>b:op==='<='?a<=b:a>=b}return false};
}
/* ---------- 엔진 ---------- */
class Engine{
  constructor(){this.sheets=[];this.names={};this.cache=new Map();this.deps=new Map();this.rdeps=[];this.pre=new Map();this.spill=new Map();this.rects=new Map();this.computing=new Set();this.parsed=new Map();this.now=null;this.addSheet('Sheet1')}
  addSheet(name){const s={name,cells:{},maxR:0,maxC:0};this.sheets.push(s);return this.sheets.length-1}
  sheetIdx(n){if(n===undefined||n===null)return -1;const i=this.sheets.findIndex(s=>s.name.toLowerCase()===String(n).toLowerCase());return i}
  key(si,r,c){return si+'!'+r+','+c}
  cell(si,r,c){return this.sheets[si].cells[r+','+c]}
  /* 입력 파서 */
  static parseInput(str){
    if(str===null||str===undefined)return{v:null};str=String(str);if(str==='')return{v:null};
    if(str[0]==="'")return{v:str.slice(1),text:true};
    if(str[0]==='=')return{f:true};
    const t=str.trim();
    if(/^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?([eE][+-]?\d+)?$/.test(t))return{v:+t.replace(/,/g,'')};
    if(/^[-+]?\d*\.\d+([eE][+-]?\d+)?$/.test(t))return{v:+t};
    const pc=/^([-+]?\d+(\.\d+)?)%$/.exec(t);if(pc)return{v:+pc[1]/100,fmt:'0%'};
    if(/^TRUE$/i.test(t))return{v:true};if(/^FALSE$/i.test(t))return{v:false};
    const d=/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);if(d&&+d[2]>=1&&+d[2]<=12&&+d[3]>=1&&+d[3]<=31)return{v:mkDate(+d[1],+d[2],+d[3]),fmt:'yyyy-mm-dd'};
    const cur=/^[$₩]\s?([\d,]+(\.\d+)?)$/.exec(t);if(cur)return{v:+cur[1].replace(/,/g,''),fmt:t[0]==='$'?'$#,##0.00':'₩#,##0'};
    return{v:str};
  }
  setRaw(si,r,c,raw){
    const sh=this.sheets[si],k=r+','+c,key=this.key(si,r,c);
    this.clearPre(key);
    const old=sh.cells[k];const pi=Engine.parseInput(raw);
    if(raw===''||raw===null||raw===undefined){if(old){old.raw='';delete old.f;old.v=null;if(!old.s)delete sh.cells[k];else{}}}
    else{const cl=old||(sh.cells[k]={});cl.raw=String(raw);if(pi.f){cl.f=true;cl.v=undefined;this.parsed.delete(key)}else{delete cl.f;cl.v=pi.v;if(pi.fmt&&!cl.fmtSet)cl.autoFmt=pi.fmt}}
    if(r+1>sh.maxR)sh.maxR=r+1;if(c+1>sh.maxC)sh.maxC=c+1;
    this.invalidate(key,si,r,c);
    return pi;
  }
  clearPre(key){const p=this.pre.get(key);if(!p)return;for(const d of p.cells){const s=this.deps.get(d);if(s){s.delete(key);if(!s.size)this.deps.delete(d)}}if(p.ranges.length){this.rdeps=this.rdeps.filter(x=>x.dep!==key)}this.pre.delete(key)}
  invalidate(key0,si0,r0,c0){
    const stack=[[key0,si0,r0,c0]],seen=new Set();
    while(stack.length){const[key,si,r,c]=stack.pop();if(seen.has(key))continue;seen.add(key);this.cache.delete(key);
      const spo=this.spill.get(key);if(spo&&!seen.has(spo.origin)){const m0=/^(\d+)!(\d+),(\d+)$/.exec(spo.origin);stack.push([spo.origin,+m0[1],+m0[2],+m0[3]])}
      const ds=this.deps.get(key);if(ds)for(const d of ds){const m=/^(\d+)!(\d+),(\d+)$/.exec(d);stack.push([d,+m[1],+m[2],+m[3]])}
      for(const x of this.rdeps){if(x.si===si&&r>=x.r1&&r<=x.r2&&c>=x.c1&&c<=x.c2){const m=/^(\d+)!(\d+),(\d+)$/.exec(x.dep);stack.push([x.dep,+m[1],+m[2],+m[3]])}}
      const rc=this.rects.get(key);if(rc){for(let rr=rc.r1;rr<=rc.r2;rr++)for(let cc=rc.c1;cc<=rc.c2;cc++)if(rr!==rc.r1||cc!==rc.c1)stack.push([this.key(rc.si,rr,cc),rc.si,rr,cc])}}
  }
  /* 값 조회 */
  get(si,r,c,ctx){
    if(r<0||c<0||r>=MAXR||c>=MAXC)return E.REF;
    const key=this.key(si,r,c);
    if(ctx){ctx.cells.add(key)}
    if(this.cache.has(key))return this.cache.get(key);
    const sh=this.sheets[si];if(!sh)return E.REF;const cl=sh.cells[r+','+c];
    if(!cl||(cl.raw===''&&cl.v==null&&!cl.f)){const sp=this.spill.get(key);if(sp!==undefined){return sp.value}return null}
    if(!cl.f){const v=cl.v===undefined?null:cl.v;return v}
    if(this.computing.has(key))return E.CIRC;
    this.computing.add(key);let val;const cx={cells:new Set(),ranges:[],si,r,c,key};
    try{let ast=this.parsed.get(key);if(!ast||ast.raw!==cl.raw){ast={raw:cl.raw,tree:parse(cl.raw.slice(1))};this.parsed.set(key,ast)}
      val=this.ev(ast.tree,cx,{})}catch(e){val=e&&e.xl?e.xl:(e&&e.message&&/해석|괄호|수식|예상|배열|닫는/.test(e.message)?E.NAME:E.VALUE)}
    finally{this.computing.delete(key)}
    if(val&&val.__range)val=this.rangeToMatrix(val,cx);
    this.clearSpill(key);
    if(isArr(val)){const rows=val.length,cols=val[0]?val[0].length:0;let blocked=false;
      if(rows*cols>1){for(let i=0;i<rows&&!blocked;i++)for(let j=0;j<cols;j++){if(i===0&&j===0)continue;const rr=r+i,cc=c+j;if(rr>=MAXR||cc>=MAXC){blocked=true;break}const o=sh.cells[rr+','+cc];if(o&&(o.raw!==''||o.v!=null||o.f)){blocked=true;break}
        const ok=this.key(si,rr,cc),sp=this.spill.get(ok);if(sp&&sp.origin!==key){blocked=true;break}}}
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){if(i||j)cx.cells.add(this.key(si,r+i,c+j))}
      if(blocked)val=E.SPILL;
      else{const first=val[0]&&val[0][0];if(rows*cols>1){for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){if(i===0&&j===0)continue;const ok=this.key(si,r+i,c+j);this.spill.set(ok,{origin:key,value:val[i][j]===undefined?null:val[i][j]});this.cache.delete(ok)}
          this.rects.set(key,{si,r1:r,c1:c,r2:r+rows-1,c2:c+cols-1});if(r+rows>sh.maxR)sh.maxR=r+rows;if(c+cols>sh.maxC)sh.maxC=c+cols}
        val=first===undefined?null:first}}
    if(val&&val.__lambda)val=E.VALUE;
    this.cache.set(key,val);
    // 의존성 등록
    this.clearPre(key);const pre={cells:[...cx.cells].filter(k=>k!==key),ranges:cx.ranges};
    for(const d of pre.cells){let s=this.deps.get(d);if(!s)this.deps.set(d,s=new Set());s.add(key)}
    for(const rg of cx.ranges)this.rdeps.push({si:rg.si,r1:rg.r1,c1:rg.c1,r2:rg.r2,c2:rg.c2,dep:key});
    this.pre.set(key,pre);
    return val;
  }
  clearSpill(key){const rc=this.rects.get(key);if(!rc)return;for(let rr=rc.r1;rr<=rc.r2;rr++)for(let cc=rc.c1;cc<=rc.c2;cc++){if(rr===rc.r1&&cc===rc.c1)continue;const ok=this.key(rc.si,rr,cc);const sp=this.spill.get(ok);if(sp&&sp.origin===key){this.spill.delete(ok);this.cache.delete(ok);const d=this.deps.get(ok);if(d)for(const x of d){const m=/^(\d+)!(\d+),(\d+)$/.exec(x);this.invalidate(x,+m[1],+m[2],+m[3])}}}this.rects.delete(key)}
  rangeToMatrix(rg,ctx,limit=true){
    const sh=this.sheets[rg.si];let r2=rg.r2,c2=rg.c2;if(limit){r2=Math.min(r2,Math.max(rg.r1,sh.maxR-1));c2=Math.min(c2,Math.max(rg.c1,sh.maxC-1))}
    if(ctx)ctx.ranges.push({si:rg.si,r1:rg.r1,c1:rg.c1,r2:rg.r2,c2:rg.c2});
    const out=[];for(let r=rg.r1;r<=r2;r++){const row=[];for(let c=rg.c1;c<=c2;c++)row.push(this.get(rg.si,r,c,ctx));out.push(row)}return out;
  }
  /* 평가 */
  ev(n,cx,env){
    switch(n.k){
      case 'num':case 'str':case 'bool':return n.v;
      case 'err':return ERR(n.v);
      case 'empty':return null;
      case 'ref':{const si=n.sheet?this.sheetIdx(n.sheet):cx.si;if(si<0)return E.REF;return this.get(si,n.r,n.c,cx)}
      case 'range':{const si=n.sheet?this.sheetIdx(n.sheet):cx.si;if(si<0)return E.REF;return{__range:true,si,r1:n.r1,c1:n.c1,r2:n.r2,c2:n.c2}}
      case 'name':{if(env&&Object.prototype.hasOwnProperty.call(env,n.n.toUpperCase()))return env[n.n.toUpperCase()];const d=this.names[n.n.toUpperCase()];if(!d)return E.NAME;
        let ast=d.__ast;if(!ast)ast=d.__ast=parse(d.ref);return this.ev(ast,cx,{})}
      case 'neg':{const v=this.val1(this.ev(n.e,cx,env),cx);return this.map1(v,x=>{const a=toNum(x);return isErr(a)?a:-a})}
      case 'pct':{const v=this.val1(this.ev(n.e,cx,env),cx);return this.map1(v,x=>{const a=toNum(x);return isErr(a)?a:a/100})}
      case 'arr':return n.rows.map(r=>r.map(e=>this.ev(e,cx,env)));
      case 'bin':{const l=this.val1(this.ev(n.l,cx,env),cx),r=this.val1(this.ev(n.r,cx,env),cx);return this.map2(l,r,(a,b)=>this.binop(n.op,a,b))}
      case 'call':return this.call(n,cx,env);
    }
    throw new Error('알 수 없는 노드');
  }
  val1(v,cx){return v&&v.__range?this.rangeToMatrix(v,cx):v}
  map1(v,f){return isArr(v)?v.map(r=>r.map(f)):f(v)}
  map2(a,b,f){
    if(!isArr(a)&&!isArr(b))return f(a,b);
    const ra=isArr(a)?a.length:1,rb=isArr(b)?b.length:1,ca=isArr(a)?a[0].length:1,cb=isArr(b)?b[0].length:1,R=Math.max(ra,rb),C=Math.max(ca,cb),out=[];
    const at=(m,i,j)=>{if(!isArr(m))return m;const rr=m.length===1?0:i,cc=m[0].length===1?0:j;return m[rr]&&m[rr][cc]!==undefined?m[rr][cc]:E.NA};
    for(let i=0;i<R;i++){const row=[];for(let j=0;j<C;j++)row.push(f(at(a,i,j),at(b,i,j)));out.push(row)}return out;
  }
  binop(op,a,b){
    if(isErr(a))return a;if(isErr(b))return b;
    if(op==='&'){return toStr(a)+toStr(b)}
    if(['+','-','*','/','^'].includes(op)){const x=toNum(a),y=toNum(b);if(isErr(x))return x;if(isErr(y))return y;
      if(op==='+')return x+y;if(op==='-')return x-y;if(op==='*')return x*y;if(op==='/')return y===0?E.DIV0:x/y;const r=Math.pow(x,y);return isNaN(r)?E.NUM:r}
    // 비교
    const ord=v=>typeof v==='number'?1:typeof v==='string'?2:typeof v==='boolean'?3:0;
    let c;if(a===null)a=typeof b==='string'?'':typeof b==='boolean'?false:0;if(b===null)b=typeof a==='string'?'':typeof a==='boolean'?false:0;
    if(ord(a)!==ord(b))c=ord(a)-ord(b);else if(typeof a==='string')c=a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0;else c=a<b?-1:a>b?1:0;
    switch(op){case '=':return c===0;case '<>':return c!==0;case '<':return c<0;case '>':return c>0;case '<=':return c<=0;case '>=':return c>=0}
  }
  call(n,cx,env){
    const name=n.n,f=LAZY[name];
    if(f)return f.call(this,n.a,cx,env);
    const fn=FN[name];if(!fn){if(env&&env[name]&&env[name].__lambda)return this.applyLambda(env[name],n.a.map(a=>this.val1(this.ev(a,cx,env),cx)),cx);return E.NAME}
    const args=n.a.map(a=>this.ev(a,cx,env));
    try{return fn.call(this,args,cx)}catch(e){if(e&&e.xl)return e.xl;throw e}
  }
  applyLambda(l,args,cx){const env=Object.assign({},l.env);l.params.forEach((p,i)=>{env[p]=args[i]===undefined?null:args[i]});return this.val1(this.ev(l.body,cx,env),cx)}
  /* 도우미: 인수 → 평평한 값 목록, 행렬 */
  mat(v,cx){v=this.val1(v,cx);return isArr(v)?v:[[v]]}
  flat(v,cx){const m=this.mat(v,cx),o=[];for(const r of m)for(const x of r)o.push(x);return o}
  /* 행·열 삽입/삭제 */
  shiftSheet(si,axis,at,count){
    const sh=this.sheets[si],nc={};
    const f=(k)=>{const[r,c]=k.split(',').map(Number);let rr=r,cc=c;if(axis==='r'){if(count>0){if(r>=at)rr=r+count}else{if(r>=at&&r<at-count)return null;if(r>=at-count)rr=r+count}}else{if(count>0){if(c>=at)cc=c+count}else{if(c>=at&&c<at-count)return null;if(c>=at-count)cc=c+count}}return rr+','+cc};
    for(const k in sh.cells){const nk=f(k);if(nk)nc[nk]=sh.cells[k]}
    sh.cells=nc;sh.maxR=0;sh.maxC=0;for(const k in nc){const[r,c]=k.split(',').map(Number);if(r+1>sh.maxR)sh.maxR=r+1;if(c+1>sh.maxC)sh.maxC=c+1}
    for(let i=0;i<this.sheets.length;i++){const s=this.sheets[i];for(const k in s.cells){const cl=s.cells[k];if(cl.f){cl.raw=this.shiftFormula(cl.raw,i,si,axis,at,count)}}}
    for(const n in this.names){const d=this.names[n];d.ref=this.shiftFormula('='+d.ref,-1,si,axis,at,count).slice(1);delete d.__ast}
    this.resetCache();
  }
  resetCache(){this.cache.clear();this.deps.clear();this.rdeps=[];this.pre.clear();this.spill.clear();this.rects.clear();this.parsed.clear()}
  shiftFormula(raw,home,si,axis,at,count){
    let toks;try{toks=tokenize(raw.slice(1))}catch(_){return raw}
    let out='=',last=0;const src=raw.slice(1);
    const sh1=(v)=>{if(count>0)return v>=at?v+count:v;if(v>=at&&v<at-count)return -1;return v>=at-count?v+count:v};
    for(const t of toks){out+=src.slice(last,t.s);last=t.e;
      const target=t.sheet?this.sheetIdx(t.sheet):home;
      if((t.t==='ref'||t.t==='colrange'||t.t==='rowrange')&&target===si){
        const pre=t.sheet?(/[^\w.]/.test(t.sheet)?"'"+t.sheet.replace(/'/g,"''")+"'":t.sheet)+'!':'';
        if(t.t==='ref'){const v=axis==='r'?t.r:t.c,nv=sh1(v);if(nv<0){out+='#REF!';continue}const r=axis==='r'?nv:t.r,c=axis==='c'?nv:t.c;out+=pre+(t.ca?'$':'')+colName(c)+(t.ra?'$':'')+(r+1)}
        else if(t.t==='colrange'){if(axis==='c'){const a=sh1(t.a),b=sh1(t.b);if(a<0&&b<0){out+='#REF!';continue}out+=pre+(t.aa?'$':'')+colName(a<0?t.a:a)+':'+(t.ba?'$':'')+colName(b<0?t.b:b)}else out+=src.slice(t.s,t.e)}
        else{if(axis==='r'){const a=sh1(t.a),b=sh1(t.b);if(a<0&&b<0){out+='#REF!';continue}out+=pre+(t.aa?'$':'')+((a<0?t.a:a)+1)+':'+(t.ba?'$':'')+((b<0?t.b:b)+1)}else out+=src.slice(t.s,t.e)}
      }else if(t.t==='ref'||t.t==='colrange'||t.t==='rowrange')out+=src.slice(t.s,t.e);
      else out+=src.slice(t.s,t.e)}
    // 범위 A1:B2 에서 끝점 중 하나가 삭제되어 #REF! 가 섞이면 범위를 줄이는 대신 #REF! 로 둔다
    out+=src.slice(last);return out;
  }
}
/* ---------- 함수 ---------- */
const throwE=e=>{throw{xl:e}};
const nv=(v)=>{const n=toNum(v);if(isErr(n))throwE(n);return n};
const sv=(v)=>{const s=toStr(v);if(isErr(s))throwE(s);return s};
const firstErr=a=>{for(const x of a)if(isErr(x))return x;return null};
const FN={},LAZY={};
function numsOf(eng,args,cx,countBool=false){const o=[];for(const a of args){const direct=!(a&&a.__range)&&!isArr(a);const vals=eng.flat(a,cx);for(const v of vals){if(isErr(v))throwE(v);if(typeof v==='number')o.push(v);else if(direct&&typeof v==='boolean')o.push(v?1:0);else if(direct&&typeof v==='string'&&v.trim()!==''){const n=toNum(v);if(isErr(n))throwE(n);o.push(n)}}}return o}
const def=(names,fn)=>{for(const n of names.split(' '))FN[n]=fn};
/* 수학 */
def('SUM',function(a,cx){return numsOf(this,a,cx).reduce((x,y)=>x+y,0)});
def('AVERAGE',function(a,cx){const n=numsOf(this,a,cx);return n.length?n.reduce((x,y)=>x+y,0)/n.length:E.DIV0});
def('MIN',function(a,cx){const n=numsOf(this,a,cx);return n.length?Math.min(...n):0});
def('MAX',function(a,cx){const n=numsOf(this,a,cx);return n.length?Math.max(...n):0});
def('COUNT',function(a,cx){let c=0;for(const x of a)for(const v of this.flat(x,cx))if(typeof v==='number')c++;return c});
def('COUNTA',function(a,cx){let c=0;for(const x of a)for(const v of this.flat(x,cx))if(v!==null&&v!=='')c++;return c});
def('COUNTBLANK',function(a,cx){let c=0;for(const x of a){const m=this.mat(x,cx);const rg=x&&x.__range?x:null;const total=rg?(rg.r2-rg.r1+1)*(rg.c2-rg.c1+1):m.length*m[0].length;let nb=0;for(const r of m)for(const v of r)if(v!==null&&v!=='')nb++;c+=Math.min(total,(rg?Math.min(total,(rg.r2-rg.r1+1)*(rg.c2-rg.c1+1)):total))-nb}return c});
def('PRODUCT',function(a,cx){const n=numsOf(this,a,cx);return n.length?n.reduce((x,y)=>x*y,1):0});
def('SUMSQ',function(a,cx){return numsOf(this,a,cx).reduce((x,y)=>x+y*y,0)});
def('ABS',a=>Math.abs(nv(a[0])));def('SIGN',a=>Math.sign(nv(a[0])));def('SQRT',a=>{const x=nv(a[0]);return x<0?E.NUM:Math.sqrt(x)});
def('INT',a=>Math.floor(nv(a[0])));def('EXP',a=>Math.exp(nv(a[0])));
def('LN',a=>{const x=nv(a[0]);return x<=0?E.NUM:Math.log(x)});def('LOG10',a=>{const x=nv(a[0]);return x<=0?E.NUM:Math.log10(x)});
def('LOG',a=>{const x=nv(a[0]),b=a[1]===undefined?10:nv(a[1]);return x<=0||b<=0||b===1?E.NUM:Math.log(x)/Math.log(b)});
def('PI',()=>Math.PI);def('SIN',a=>Math.sin(nv(a[0])));def('COS',a=>Math.cos(nv(a[0])));def('TAN',a=>Math.tan(nv(a[0])));
def('ASIN',a=>{const x=nv(a[0]);return Math.abs(x)>1?E.NUM:Math.asin(x)});def('ACOS',a=>{const x=nv(a[0]);return Math.abs(x)>1?E.NUM:Math.acos(x)});def('ATAN',a=>Math.atan(nv(a[0])));def('ATAN2',a=>Math.atan2(nv(a[1]),nv(a[0])));
def('SINH',a=>Math.sinh(nv(a[0])));def('COSH',a=>Math.cosh(nv(a[0])));def('TANH',a=>Math.tanh(nv(a[0])));
def('DEGREES',a=>nv(a[0])*180/Math.PI);def('RADIANS',a=>nv(a[0])*Math.PI/180);
def('POWER',a=>{const r=Math.pow(nv(a[0]),nv(a[1]));return isNaN(r)?E.NUM:r});
def('MOD',a=>{const x=nv(a[0]),y=nv(a[1]);return y===0?E.DIV0:x-y*Math.floor(x/y)});
def('QUOTIENT',a=>{const y=nv(a[1]);return y===0?E.DIV0:Math.trunc(nv(a[0])/y)});
const rnd=(x,d,fn)=>{const m=Math.pow(10,d);return fn(x*m)/m};
def('ROUND',a=>{const d=a[1]===undefined?0:nv(a[1]),x=nv(a[0]);return rnd(x,d,v=>Math.sign(v)*Math.round(Math.abs(v)+1e-12))});
def('ROUNDUP',a=>{const d=a[1]===undefined?0:nv(a[1]);return rnd(nv(a[0]),d,v=>Math.sign(v)*Math.ceil(Math.abs(v)-1e-12))});
def('ROUNDDOWN',a=>{const d=a[1]===undefined?0:nv(a[1]);return rnd(nv(a[0]),d,v=>Math.trunc(v))});
def('TRUNC',a=>rnd(nv(a[0]),a[1]===undefined?0:nv(a[1]),v=>Math.trunc(v)));
def('CEILING',a=>{const s=a[1]===undefined?1:nv(a[1]);return s===0?0:Math.ceil(nv(a[0])/s)*s});
def('FLOOR',a=>{const s=a[1]===undefined?1:nv(a[1]);return s===0?0:Math.floor(nv(a[0])/s)*s});
def('MROUND',a=>{const s=nv(a[1]);return s===0?0:Math.round(nv(a[0])/s)*s});
def('EVEN',a=>{const x=nv(a[0]);return Math.sign(x)*2*Math.ceil(Math.abs(x)/2)});def('ODD',a=>{const x=nv(a[0]);const r=Math.sign(x)*(2*Math.ceil((Math.abs(x)-1)/2)+1);return x===0?1:r});
def('FACT',a=>{const n=Math.floor(nv(a[0]));if(n<0)return E.NUM;let r=1;for(let i=2;i<=n;i++)r*=i;return r});
const gcd=(x,y)=>y?gcd(y,x%y):x;
def('GCD',function(a,cx){return numsOf(this,a,cx).map(Math.abs).reduce(gcd,0)});def('LCM',function(a,cx){return numsOf(this,a,cx).map(Math.abs).reduce((x,y)=>x&&y?x/gcd(x,y)*y:0,1)});
def('COMBIN',a=>{const n=nv(a[0]),k=nv(a[1]);if(k>n||k<0)return E.NUM;let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return Math.round(r)});
def('RAND',()=>Math.random());def('RANDBETWEEN',a=>{const lo=Math.ceil(nv(a[0])),hi=Math.floor(nv(a[1]));return lo+Math.floor(Math.random()*(hi-lo+1))});
def('SUMPRODUCT',function(a,cx){const ms=a.map(x=>this.mat(x,cx));const R=ms[0].length,C=ms[0][0].length;let s=0;for(const m of ms)if(m.length!==R||m[0].length!==C)return E.VALUE;for(let i=0;i<R;i++)for(let j=0;j<C;j++){let p=1;for(const m of ms){const v=m[i][j];if(isErr(v))return v;p*=typeof v==='number'?v:typeof v==='boolean'?+v:0}s+=p}return s});
def('MEDIAN',function(a,cx){const n=numsOf(this,a,cx).sort((x,y)=>x-y);if(!n.length)return E.NUM;const m=n.length>>1;return n.length%2?n[m]:(n[m-1]+n[m])/2});
def('MODE',function(a,cx){const n=numsOf(this,a,cx),c=new Map();let best=null,bc=1;for(const x of n){const k=(c.get(x)||0)+1;c.set(x,k);if(k>bc){bc=k;best=x}}return best===null?E.NA:best});
const variance=(n,pop)=>{const m=n.reduce((x,y)=>x+y,0)/n.length;return n.reduce((x,y)=>x+(y-m)*(y-m),0)/(n.length-(pop?0:1))};
def('VAR VAR.S',function(a,cx){const n=numsOf(this,a,cx);return n.length<2?E.DIV0:variance(n,false)});def('VARP VAR.P',function(a,cx){const n=numsOf(this,a,cx);return n.length<1?E.DIV0:variance(n,true)});
def('STDEV STDEV.S',function(a,cx){const n=numsOf(this,a,cx);return n.length<2?E.DIV0:Math.sqrt(variance(n,false))});def('STDEVP STDEV.P',function(a,cx){const n=numsOf(this,a,cx);return n.length<1?E.DIV0:Math.sqrt(variance(n,true))});
def('LARGE',function(a,cx){const n=numsOf(this,[a[0]],cx).sort((x,y)=>y-x),k=nv(a[1]);return k<1||k>n.length?E.NUM:n[k-1]});def('SMALL',function(a,cx){const n=numsOf(this,[a[0]],cx).sort((x,y)=>x-y),k=nv(a[1]);return k<1||k>n.length?E.NUM:n[k-1]});
def('RANK RANK.EQ',function(a,cx){const x=nv(a[0]),n=numsOf(this,[a[1]],cx),asc=a[2]!==undefined&&nv(a[2])!==0;if(!n.includes(x))return E.NA;return 1+n.filter(v=>asc?v<x:v>x).length});
const pctile=(n,k)=>{n=n.slice().sort((x,y)=>x-y);if(!n.length||k<0||k>1)return E.NUM;const p=k*(n.length-1),lo=Math.floor(p),hi=Math.ceil(p);return n[lo]+(n[hi]-n[lo])*(p-lo)};
def('PERCENTILE PERCENTILE.INC',function(a,cx){return pctile(numsOf(this,[a[0]],cx),nv(a[1]))});def('QUARTILE QUARTILE.INC',function(a,cx){return pctile(numsOf(this,[a[0]],cx),nv(a[1])/4)});
def('GEOMEAN',function(a,cx){const n=numsOf(this,a,cx);return n.some(x=>x<=0)||!n.length?E.NUM:Math.exp(n.reduce((s,x)=>s+Math.log(x),0)/n.length)});
def('AVEDEV',function(a,cx){const n=numsOf(this,a,cx);if(!n.length)return E.NUM;const m=n.reduce((x,y)=>x+y,0)/n.length;return n.reduce((s,x)=>s+Math.abs(x-m),0)/n.length});
const pairs=(eng,a,cx)=>{const x=eng.flat(a[0],cx),y=eng.flat(a[1],cx),p=[];for(let i=0;i<Math.min(x.length,y.length);i++)if(typeof x[i]==='number'&&typeof y[i]==='number')p.push([x[i],y[i]]);return p};
const regr=p=>{const n=p.length,mx=p.reduce((s,q)=>s+q[0],0)/n,my=p.reduce((s,q)=>s+q[1],0)/n;let sxy=0,sxx=0,syy=0;for(const[q,r]of p){sxy+=(q-mx)*(r-my);sxx+=(q-mx)**2;syy+=(r-my)**2}return{n,mx,my,sxy,sxx,syy}};
def('CORREL',function(a,cx){const p=pairs(this,a,cx);if(p.length<2)return E.DIV0;const g=regr(p);return g.sxx&&g.syy?g.sxy/Math.sqrt(g.sxx*g.syy):E.DIV0});
def('SLOPE',function(a,cx){const p=pairs(this,[a[1],a[0]],cx);if(p.length<2)return E.DIV0;const g=regr(p);return g.sxx?g.sxy/g.sxx:E.DIV0});
def('INTERCEPT',function(a,cx){const p=pairs(this,[a[1],a[0]],cx);if(p.length<2)return E.DIV0;const g=regr(p);return g.sxx?g.my-g.sxy/g.sxx*g.mx:E.DIV0});
def('FORECAST FORECAST.LINEAR',function(a,cx){const x=nv(a[0]),p=pairs(this,[a[2],a[1]],cx);if(p.length<2)return E.DIV0;const g=regr(p);if(!g.sxx)return E.DIV0;const b=g.sxy/g.sxx;return g.my-b*g.mx+b*x});
/* 조건 집계 */
function condIdx(eng,pairsArgs,cx){const crit=[];for(let i=0;i<pairsArgs.length;i+=2){const m=eng.mat(pairsArgs[i],cx),f=matcher(eng.val1(pairsArgs[i+1],cx));crit.push({m,f})}
  const R=crit[0].m.length,C=crit[0].m[0].length,ok=[];for(const c of crit)if(c.m.length!==R||c.m[0].length!==C)throwE(E.VALUE);
  for(let i=0;i<R;i++)for(let j=0;j<C;j++)if(crit.every(c=>c.f(c.m[i][j])))ok.push([i,j]);return ok}
def('COUNTIF',function(a,cx){return condIdx(this,a,cx).length});def('COUNTIFS',function(a,cx){return condIdx(this,a,cx).length});
const sumIf=(eng,range,crit,cx)=>{const idx=condIdx(eng,crit,cx),m=eng.mat(range,cx),o=[];for(const[i,j]of idx){const v=m[i]&&m[i][j];if(typeof v==='number')o.push(v)}return o};
def('SUMIF',function(a,cx){return sumIf(this,a[2]===undefined?a[0]:a[2],[a[0],a[1]],cx).reduce((x,y)=>x+y,0)});
def('SUMIFS',function(a,cx){return sumIf(this,a[0],a.slice(1),cx).reduce((x,y)=>x+y,0)});
def('AVERAGEIF',function(a,cx){const n=sumIf(this,a[2]===undefined?a[0]:a[2],[a[0],a[1]],cx);return n.length?n.reduce((x,y)=>x+y,0)/n.length:E.DIV0});
def('AVERAGEIFS',function(a,cx){const n=sumIf(this,a[0],a.slice(1),cx);return n.length?n.reduce((x,y)=>x+y,0)/n.length:E.DIV0});
def('MAXIFS',function(a,cx){const n=sumIf(this,a[0],a.slice(1),cx);return n.length?Math.max(...n):0});def('MINIFS',function(a,cx){const n=sumIf(this,a[0],a.slice(1),cx);return n.length?Math.min(...n):0});
/* 텍스트 */
def('LEN',a=>sv(a[0]).length);def('UPPER',a=>sv(a[0]).toUpperCase());def('LOWER',a=>sv(a[0]).toLowerCase());
def('PROPER',a=>sv(a[0]).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu,(m,p,c)=>p+c.toUpperCase()));
def('TRIM',a=>sv(a[0]).trim().replace(/\s+/g,' '));def('CLEAN',a=>sv(a[0]).replace(/[\x00-\x1f]/g,''));
def('LEFT',a=>sv(a[0]).slice(0,a[1]===undefined?1:Math.max(0,nv(a[1]))));def('RIGHT',a=>{const s=sv(a[0]),n=a[1]===undefined?1:Math.max(0,nv(a[1]));return n?s.slice(-n):''});
def('MID',a=>{const s=sv(a[0]),st=nv(a[1]),n=nv(a[2]);return st<1||n<0?E.VALUE:s.substr(st-1,n)});
def('CONCAT',function(a,cx){return a.map(x=>this.flat(x,cx).map(sv).join('')).join('')});def('CONCATENATE',a=>a.map(sv).join(''));
def('TEXTJOIN',function(a,cx){const d=sv(a[0]),ig=toBool(a[1]);const o=[];for(const x of a.slice(2))for(const v of this.flat(x,cx)){const s=sv(v);if(!(ig===true&&s===''))o.push(s)}return o.join(d)});
def('SUBSTITUTE',a=>{const s=sv(a[0]),f=sv(a[1]),t=sv(a[2]);if(f==='')return s;if(a[3]===undefined)return s.split(f).join(t);let n=nv(a[3]),i=-1;while(n-->0){i=s.indexOf(f,i+1);if(i<0)return s}return s.slice(0,i)+t+s.slice(i+f.length)});
def('REPLACE',a=>{const s=sv(a[0]),st=nv(a[1])-1,n=nv(a[2]);return s.slice(0,st)+sv(a[3])+s.slice(st+n)});
def('FIND',a=>{const i=sv(a[1]).indexOf(sv(a[0]),a[2]===undefined?0:nv(a[2])-1);return i<0?E.VALUE:i+1});
def('SEARCH',a=>{const pat=sv(a[0]).replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.'),s=sv(a[1]).slice(a[2]===undefined?0:nv(a[2])-1),m=new RegExp(pat,'i').exec(s);return m?m.index+1+(a[2]===undefined?0:nv(a[2])-1):E.VALUE});
def('REPT',a=>{const n=nv(a[1]);return n<0?E.VALUE:sv(a[0]).repeat(n)});
def('EXACT',a=>sv(a[0])===sv(a[1]));def('CHAR',a=>String.fromCharCode(nv(a[0])));def('CODE',a=>sv(a[0]).charCodeAt(0));def('UNICHAR',a=>String.fromCodePoint(nv(a[0])));def('UNICODE',a=>sv(a[0]).codePointAt(0));
def('T',a=>typeof a[0]==='string'?a[0]:'');def('N',a=>typeof a[0]==='number'?a[0]:typeof a[0]==='boolean'?+a[0]:0);
def('VALUE',a=>{const n=toNum(a[0]);return n});def('NUMBERVALUE',a=>nv(sv(a[0]).replace(/\s/g,'')));
def('TEXT',a=>formatValue(typeof a[0]==='string'&&a[0]!==''&&!isNaN(+a[0])?+a[0]:a[0],sv(a[1])));
def('TEXTBEFORE',a=>{const s=sv(a[0]),d=sv(a[1]),i=s.indexOf(d);return i<0?E.NA:s.slice(0,i)});def('TEXTAFTER',a=>{const s=sv(a[0]),d=sv(a[1]),i=s.indexOf(d);return i<0?E.NA:s.slice(i+d.length)});
def('TEXTSPLIT',a=>[sv(a[0]).split(sv(a[1]))]);
def('FIXED',a=>formatValue(nv(a[0]),'#,##0'+(a[1]===undefined||nv(a[1])>0?'.'+'0'.repeat(a[1]===undefined?2:nv(a[1])):'')));
def('DOLLAR',a=>formatValue(nv(a[0]),'$#,##0.00'));
/* 논리·정보 */
def('AND',function(a,cx){let r=true;for(const x of a)for(const v of this.flat(x,cx)){if(isErr(v))return v;if(v===null||typeof v==='string')continue;if(!toBool(v))r=false}return r});
def('OR',function(a,cx){let r=false;for(const x of a)for(const v of this.flat(x,cx)){if(isErr(v))return v;if(v===null||typeof v==='string')continue;if(toBool(v))r=true}return r});
def('XOR',function(a,cx){let c=0;for(const x of a)for(const v of this.flat(x,cx)){if(toBool(v)===true)c++}return c%2===1});
def('NOT',a=>{const b=toBool(a[0]);return isErr(b)?b:!b});def('TRUE',()=>true);def('FALSE',()=>false);
def('ISNUMBER',a=>typeof a[0]==='number');def('ISTEXT',a=>typeof a[0]==='string');def('ISLOGICAL',a=>typeof a[0]==='boolean');def('ISBLANK',a=>a[0]===null);
def('ISERROR',a=>isErr(a[0]));def('ISERR',a=>isErr(a[0])&&a[0].e!=='#N/A');def('ISNA',a=>isErr(a[0])&&a[0].e==='#N/A');
def('ISEVEN',a=>Math.floor(nv(a[0]))%2===0);def('ISODD',a=>Math.abs(Math.floor(nv(a[0])))%2===1);
def('NA',()=>E.NA);
/* 날짜 */
def('TODAY',function(){const n=new Date();return mkDate(n.getFullYear(),n.getMonth()+1,n.getDate())});
def('NOW',function(){const n=new Date();return mkDate(n.getFullYear(),n.getMonth()+1,n.getDate())+(n.getHours()*3600+n.getMinutes()*60+n.getSeconds())/86400});
def('DATE',a=>mkDate(nv(a[0]),nv(a[1]),nv(a[2])));def('TIME',a=>(nv(a[0])*3600+nv(a[1])*60+nv(a[2]))/86400);
def('YEAR',a=>toDate(nv(a[0])).getUTCFullYear());def('MONTH',a=>toDate(nv(a[0])).getUTCMonth()+1);def('DAY',a=>toDate(nv(a[0])).getUTCDate());
def('HOUR',a=>Math.floor((nv(a[0])%1)*24+1e-9));def('MINUTE',a=>Math.floor(((nv(a[0])%1)*1440+1e-6)%60));def('SECOND',a=>Math.round(((nv(a[0])%1)*86400)%60));
def('WEEKDAY',a=>{const d=toDate(nv(a[0])).getUTCDay(),t=a[1]===undefined?1:nv(a[1]);return t===2?(d+6)%7+1:t===3?(d+6)%7:d+1});
def('DAYS',a=>Math.floor(nv(a[0]))-Math.floor(nv(a[1])));
def('DATEVALUE',a=>{const p=Engine.parseInput(sv(a[0]));return typeof p.v==='number'?p.v:E.VALUE});
def('EDATE',a=>{const d=toDate(nv(a[0])),m=nv(a[1]);return mkDate(d.getUTCFullYear(),d.getUTCMonth()+1+m,Math.min(d.getUTCDate(),new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+m+1,0)).getUTCDate()))});
def('EOMONTH',a=>{const d=toDate(nv(a[0])),m=nv(a[1]);return mkDate(d.getUTCFullYear(),d.getUTCMonth()+1+m+1,0)});
def('DATEDIF',a=>{const s=toDate(nv(a[0])),e=toDate(nv(a[1])),u=sv(a[2]).toUpperCase();if(e<s)return E.NUM;let y=e.getUTCFullYear()-s.getUTCFullYear(),m=e.getUTCMonth()-s.getUTCMonth(),d=e.getUTCDate()-s.getUTCDate();if(d<0){m--;d+=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),0)).getUTCDate()}if(m<0){y--;m+=12}
  return u==='Y'?y:u==='M'?y*12+m:u==='D'?Math.floor((e-s)/DAY):u==='YM'?m:u==='MD'?d:E.NUM});
def('WEEKNUM',a=>{const d=toDate(nv(a[0])),j=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.floor(((d-j)/DAY+j.getUTCDay())/7)+1});
def('NETWORKDAYS',a=>{let s=Math.floor(nv(a[0])),e=Math.floor(nv(a[1])),c=0;const sg=s<=e?1:-1;for(let d=s;sg>0?d<=e:d>=e;d+=sg){const w=toDate(d).getUTCDay();if(w!==0&&w!==6)c++}return c*sg});
/* 조회 */
def('ROW',function(a,cx){if(a[0]&&a[0].__range)return a[0].r1+1;return cx.r+1});def('COLUMN',function(a,cx){if(a[0]&&a[0].__range)return a[0].c1+1;return cx.c+1});
def('ROWS',function(a,cx){return this.mat(a[0],cx).length});def('COLUMNS',function(a,cx){return this.mat(a[0],cx)[0].length});
def('ADDRESS',a=>(a[3]===undefined||toBool(a[3])!==false?'':'')+(nv(a[2]||1)===1||nv(a[2]||1)===2?'$':'')+colName(nv(a[1])-1)+(nv(a[2]||1)===1||nv(a[2]||1)===3?'$':'')+nv(a[0]));
def('CHOOSE',a=>{const i=nv(a[0]);return i<1||i>=a.length?E.VALUE:a[i]});
def('VLOOKUP',function(a,cx){const v=a[0],m=this.mat(a[1],cx),ci=nv(a[2]),approx=a[3]===undefined?true:toBool(a[3])!==false;if(ci<1||ci>m[0].length)return E.REF;
  if(!approx){for(const r of m)if(this.binop('=',r[0],v)===true&&r[0]!==null||(typeof v==='string'&&typeof r[0]==='string'&&matcher(v)(r[0])&&/[*?]/.test(v)))return r[ci-1];return E.NA}
  let best=null;for(const r of m){const c=this.binop('<=',r[0],v);if(c===true&&r[0]!==null)best=r;else if(c===false)break}return best?best[ci-1]:E.NA});
def('HLOOKUP',function(a,cx){const v=a[0],m=this.mat(a[1],cx),ri=nv(a[2]),approx=a[3]===undefined?true:toBool(a[3])!==false;if(ri<1||ri>m.length)return E.REF;
  if(!approx){for(let j=0;j<m[0].length;j++)if(this.binop('=',m[0][j],v)===true&&m[0][j]!==null)return m[ri-1][j];return E.NA}
  let best=-1;for(let j=0;j<m[0].length;j++){if(this.binop('<=',m[0][j],v)===true&&m[0][j]!==null)best=j;else break}return best<0?E.NA:m[ri-1][best]});
const findPos=(eng,v,arr,mode,search)=>{ // mode: 0 exact, -1 exact or next smaller, 1 exact or next larger, 2 wildcard
  const n=arr.length,idxs=search===-1?[...arr.keys()].reverse():[...arr.keys()];
  const eq=(x)=>mode===2?matcher(v)(x):(x!==null&&eng.binop('=',x,v)===true);
  for(const i of idxs)if(eq(arr[i]))return i;
  if(mode===-1||mode===1){let best=-1;for(let i=0;i<n;i++){const x=arr[i];if(x===null||typeof x!==typeof v)continue;if(mode===-1&&x<v&&(best<0||x>arr[best]))best=i;if(mode===1&&x>v&&(best<0||x<arr[best]))best=i}return best}return -1};
def('XLOOKUP',function(a,cx){const v=a[0],la=this.flat(a[1],cx),ra=this.mat(a[2],cx),mm=a[4]===undefined||a[4]===null?0:nv(a[4]),sm=a[5]===undefined?1:nv(a[5]);
  const i=findPos(this,v,la,mm,sm);if(i<0)return a[3]!==undefined&&a[3]!==null?a[3]:E.NA;const vert=this.mat(a[1],cx).length>1||this.mat(a[1],cx)[0].length===1;
  return vert?(ra[0].length===1?ra[i][0]:[ra[i]]):(ra.length===1?ra[0][i]:ra.map(r=>[r[i]]))});
def('MATCH',function(a,cx){const t=a[2]===undefined?1:nv(a[2]),arr=this.flat(a[1],cx);let i;if(t===0)i=findPos(this,a[0],arr,/[*?]/.test(String(a[0]))&&typeof a[0]==='string'?2:0,1);else if(t===1){i=-1;for(let k=0;k<arr.length;k++){if(arr[k]!==null&&this.binop('<=',arr[k],a[0])===true)i=k;else if(arr[k]!==null)break}}else{i=-1;for(let k=0;k<arr.length;k++){if(arr[k]!==null&&this.binop('>=',arr[k],a[0])===true)i=k;else break}}return i<0?E.NA:i+1});
def('XMATCH',function(a,cx){const arr=this.flat(a[1],cx),i=findPos(this,a[0],arr,a[2]===undefined?0:nv(a[2]),a[3]===undefined?1:nv(a[3]));return i<0?E.NA:i+1});
def('INDEX',function(a,cx){const m=this.mat(a[0],cx);let r=a[1]===undefined?0:nv(a[1]),c=a[2]===undefined?0:nv(a[2]);if(m.length===1&&a[2]===undefined&&r>0){c=r;r=1}
  if(r>m.length||c>m[0].length||r<0||c<0)return E.REF;if(r===0&&c===0)return m;if(r===0)return m.map(x=>[x[c-1]]);if(c===0)return[m[r-1]];return m[r-1][c-1]});
def('LOOKUP',function(a,cx){const arr=this.flat(a[1],cx),res=a[2]!==undefined?this.flat(a[2],cx):arr;let best=-1;for(let k=0;k<arr.length;k++){if(arr[k]!==null&&this.binop('<=',arr[k],a[0])===true)best=k;else if(arr[k]!==null)break}return best<0?E.NA:res[best]});
def('TRANSPOSE',function(a,cx){const m=this.mat(a[0],cx);return m[0].map((_,j)=>m.map(r=>r[j]))});
def('SEQUENCE',a=>{const R=nv(a[0]),C=a[1]===undefined?1:nv(a[1]),s=a[2]===undefined?1:nv(a[2]),st=a[3]===undefined?1:nv(a[3]);if(R<1||C<1||R*C>1e6)return E.VALUE;const o=[];let k=s;for(let i=0;i<R;i++){const r=[];for(let j=0;j<C;j++){r.push(k);k+=st}o.push(r)}return o});
def('RANDARRAY',a=>{const R=a[0]===undefined?1:nv(a[0]),C=a[1]===undefined?1:nv(a[1]);return Array.from({length:R},()=>Array.from({length:C},()=>Math.random()))});
def('FILTER',function(a,cx){const m=this.mat(a[0],cx),inc=this.mat(a[1],cx);const byRow=inc[0].length===1||inc.length===m.length&&inc[0].length===1;let out;
  if(inc.length===m.length&&inc[0].length===1){out=m.filter((r,i)=>{const v=inc[i][0];return v===true||(typeof v==='number'&&v!==0)})}
  else if(inc.length===1&&inc[0].length===m[0].length){const keep=inc[0].map(v=>v===true||(typeof v==='number'&&v!==0));out=m.map(r=>r.filter((_,j)=>keep[j]))}else return E.VALUE;
  if(!out.length||!out[0].length)return a[2]!==undefined?a[2]:E.CALC||ERR('#CALC!');return out});
const cmpv=(x,y)=>{const o=v=>typeof v==='number'?0:typeof v==='string'?1:typeof v==='boolean'?2:3;if(o(x)!==o(y))return o(x)-o(y);if(typeof x==='string')return x.toLowerCase()<y.toLowerCase()?-1:x.toLowerCase()>y.toLowerCase()?1:0;return x<y?-1:x>y?1:0};
def('SORT',function(a,cx){const m=this.mat(a[0],cx).map(r=>r.slice()),col=a[1]===undefined?1:nv(a[1]),ord=a[2]===undefined?1:nv(a[2]);if(col<1||col>m[0].length)return E.VALUE;return m.sort((p,q)=>ord*cmpv(p[col-1],q[col-1]))});
def('SORTBY',function(a,cx){const m=this.mat(a[0],cx),k=this.flat(a[1],cx),ord=a[2]===undefined?1:nv(a[2]);if(k.length!==m.length)return E.VALUE;return m.map((r,i)=>[r,k[i]]).sort((p,q)=>ord*cmpv(p[1],q[1])).map(x=>x[0])});
def('UNIQUE',function(a,cx){const m=this.mat(a[0],cx),seen=new Set(),out=[];for(const r of m){const k=JSON.stringify(r.map(v=>typeof v==='string'?v.toLowerCase():v));if(!seen.has(k)){seen.add(k);out.push(r)}}return out});
def('TAKE',function(a,cx){const m=this.mat(a[0],cx),r=nv(a[1]),c=a[2]===undefined?m[0].length:nv(a[2]);const rr=r>=0?m.slice(0,r):m.slice(r);return rr.map(x=>c>=0?x.slice(0,c):x.slice(c))});
def('DROP',function(a,cx){const m=this.mat(a[0],cx),r=nv(a[1]),c=a[2]===undefined?0:nv(a[2]);const rr=r>=0?m.slice(r):m.slice(0,r);return rr.map(x=>c>=0?x.slice(c):x.slice(0,c))});
def('HSTACK',function(a,cx){const ms=a.map(x=>this.mat(x,cx)),R=Math.max(...ms.map(m=>m.length));return Array.from({length:R},(_,i)=>ms.flatMap(m=>m[i]||Array(m[0].length).fill(E.NA)))});
def('VSTACK',function(a,cx){return a.flatMap(x=>this.mat(x,cx))});
def('TOCOL',function(a,cx){return this.flat(a[0],cx).map(v=>[v])});def('TOROW',function(a,cx){return[this.flat(a[0],cx)]});
def('SPARKLINE',function(a,cx){const vals=this.flat(a[0],cx).filter(v=>typeof v==='number');return{__spark:true,vals,kind:a[1]===undefined?'line':sv(a[1])}});
/* 지연 평가 함수 */
LAZY.IF=function(a,cx,env){const c=this.val1(this.ev(a[0],cx,env),cx);const t=isArr(c)?null:toBool(c);if(isArr(c)){return c.map(r=>r.map(x=>toBool(x)===true?this.val1(this.ev(a[1],cx,env),cx):a[2]?this.val1(this.ev(a[2],cx,env),cx):false))}if(isErr(t))return t;if(t)return a[1]?this.ev(a[1],cx,env):true;return a[2]?this.ev(a[2],cx,env):false};
LAZY.IFS=function(a,cx,env){for(let i=0;i+1<a.length;i+=2){const c=toBool(this.val1(this.ev(a[i],cx,env),cx));if(isErr(c))return c;if(c)return this.ev(a[i+1],cx,env)}return E.NA};
LAZY.IFERROR=function(a,cx,env){const v=this.ev(a[0],cx,env);const x=this.val1(v,cx);if(isErr(x))return this.ev(a[1],cx,env);return x};
LAZY.IFNA=function(a,cx,env){const x=this.val1(this.ev(a[0],cx,env),cx);if(isErr(x)&&x.e==='#N/A')return this.ev(a[1],cx,env);return x};
LAZY.SWITCH=function(a,cx,env){const v=this.val1(this.ev(a[0],cx,env),cx);let i=1;for(;i+1<a.length;i+=2){if(this.binop('=',v,this.val1(this.ev(a[i],cx,env),cx))===true)return this.ev(a[i+1],cx,env)}return i<a.length?this.ev(a[i],cx,env):E.NA};
LAZY.LET=function(a,cx,env){const e=Object.assign({},env);for(let i=0;i+1<a.length;i+=2){if(a[i].k!=='name')return E.VALUE;e[a[i].n.toUpperCase()]=this.val1(this.ev(a[i+1],cx,e),cx)}return this.ev(a[a.length-1],cx,e)};
LAZY.LAMBDA=function(a,cx,env){const params=a.slice(0,-1).map(x=>x.n.toUpperCase());return{__lambda:true,params,body:a[a.length-1],env}};
const lam=(eng,x,cx,env)=>{const l=eng.ev(x,cx,env);if(!l||!l.__lambda)throwE(E.VALUE);return l};
LAZY.MAP=function(a,cx,env){const arrs=a.slice(0,-1).map(x=>this.mat(this.ev(x,cx,env),cx)),l=lam(this,a[a.length-1],cx,env);return arrs[0].map((r,i)=>r.map((_,j)=>this.applyLambda(l,arrs.map(m=>m[i][j]),cx)))};
LAZY.REDUCE=function(a,cx,env){const init=this.val1(this.ev(a[0],cx,env),cx),m=this.mat(this.ev(a[1],cx,env),cx),l=lam(this,a[2],cx,env);let acc=init;for(const r of m)for(const v of r)acc=this.applyLambda(l,[acc,v],cx);return acc};
LAZY.SCAN=function(a,cx,env){const init=this.val1(this.ev(a[0],cx,env),cx),m=this.mat(this.ev(a[1],cx,env),cx),l=lam(this,a[2],cx,env);let acc=init;return m.map(r=>r.map(v=>acc=this.applyLambda(l,[acc,v],cx)))};
LAZY.BYROW=function(a,cx,env){const m=this.mat(this.ev(a[0],cx,env),cx),l=lam(this,a[1],cx,env);return m.map(r=>[this.applyLambda(l,[[r]],cx)])};
LAZY.BYCOL=function(a,cx,env){const m=this.mat(this.ev(a[0],cx,env),cx),l=lam(this,a[1],cx,env);return[m[0].map((_,j)=>this.applyLambda(l,[m.map(r=>[r[j]])],cx))]};
LAZY.MAKEARRAY=function(a,cx,env){const R=nv(this.val1(this.ev(a[0],cx,env),cx)),C=nv(this.val1(this.ev(a[1],cx,env),cx)),l=lam(this,a[2],cx,env);return Array.from({length:R},(_,i)=>Array.from({length:C},(_,j)=>this.applyLambda(l,[i+1,j+1],cx)))};
LAZY.OFFSET=function(a,cx,env){const base=this.ev(a[0],cx,env);if(!base||!base.__range)return E.REF;const dr=nv(this.val1(this.ev(a[1],cx,env),cx)),dc=nv(this.val1(this.ev(a[2],cx,env),cx)),h=a[3]?nv(this.val1(this.ev(a[3],cx,env),cx)):base.r2-base.r1+1,w=a[4]?nv(this.val1(this.ev(a[4],cx,env),cx)):base.c2-base.c1+1;
  const r1=base.r1+dr,c1=base.c1+dc;if(r1<0||c1<0)return E.REF;return{__range:true,si:base.si,r1,c1,r2:r1+h-1,c2:c1+w-1}};
LAZY.INDIRECT=function(a,cx,env){const s=sv(this.val1(this.ev(a[0],cx,env),cx));try{const t=parse(s);return this.ev(t,cx,{})}catch(_){return E.REF}};
const api={Engine,parse,tokenize,formatValue,matcher,colName,colNum,addr,isErr,E,MAXR,MAXC,toNum,toStr,mkDate,toDate,FN,LAZY,numStr};
api.functionCount=()=>new Set([...Object.keys(FN),...Object.keys(LAZY)]).size;
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.YCGridCalc=api;
})(typeof window!=='undefined'?window:globalThis);
