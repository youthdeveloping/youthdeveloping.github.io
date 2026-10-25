/* YouthCraft Pro core — shared helpers for the Pro workspaces.
   Browser-only. No network access, no AI features. */
(()=>{'use strict';
if(window.YC)return;
const YC=window.YC={};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
YC.$=$;YC.$$=$$;
YC.toolName=(document.title.split(' — ')[0]||'').trim();

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`
.ycp{margin-top:18px;background:var(--panel,#1a1a20);border:1px solid var(--line,#36363f);border-radius:12px;padding:14px;color:var(--text,#f6f6f8)}
.ycp *{box-sizing:border-box}
.ycp h2.ycp-title{margin:0 0 4px;font-size:13px;letter-spacing:.12em;color:#70f0bd}
.ycp .ycp-sub{margin:0 0 12px;font-size:12px;color:var(--muted,#aaaab4);line-height:1.7}
.ycp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.ycp-row>label{font-size:12px;color:var(--muted,#aaaab4);display:flex;align-items:center;gap:6px}
.ycp button{font:inherit;font-size:12px;border:1px solid #454550;border-radius:7px;background:#25252d;color:#f6f6f8;padding:7px 10px;cursor:pointer}
.ycp button:hover:not(:disabled){border-color:#70f0bd;color:#70f0bd}
.ycp button:disabled{opacity:.45;cursor:not-allowed}
.ycp button.on{background:#70f0bd;color:#101014;border-color:#70f0bd}
.ycp button.primary{background:#70f0bd;color:#101014;border-color:#70f0bd;font-weight:700}
.ycp button.primary:hover:not(:disabled){color:#101014;filter:brightness(1.08)}
.ycp input,.ycp select,.ycp textarea{font:inherit;font-size:12px;background:#101014;color:#f6f6f8;border:1px solid #36363f;border-radius:6px;padding:6px 8px;width:auto;min-width:0}
.ycp input[type=range]{padding:0;width:150px;accent-color:#70f0bd}
.ycp input[type=color]{padding:0;width:34px;height:28px;border-radius:6px}
.ycp input[type=checkbox]{width:auto;accent-color:#70f0bd}
.ycp textarea{width:100%}
.ycp :focus-visible{outline:2px solid #70f0bd;outline-offset:2px}
.ycp-grid{display:grid;gap:14px;grid-template-columns:minmax(210px,260px) minmax(0,1fr)}
.ycp-grid.rev{grid-template-columns:minmax(0,1fr) minmax(210px,260px)}
@media(max-width:820px){.ycp-grid,.ycp-grid.rev{grid-template-columns:1fr}}
.ycp-side{display:flex;flex-direction:column;gap:12px;min-width:0}
.ycp-main{min-width:0}
.ycp-group{border:1px solid #2c2c35;border-radius:9px;padding:10px;background:#16161b}
.ycp-group>h3{margin:0 0 6px;font-size:11px;letter-spacing:.1em;color:#a8a8b2;font-weight:700}
.ycp-field{display:grid;grid-template-columns:86px minmax(0,1fr) 40px;gap:6px;align-items:center;margin:5px 0;font-size:12px;color:var(--muted,#aaaab4)}
.ycp-field input[type=range]{width:100%}
.ycp-field.two{grid-template-columns:86px minmax(0,1fr)}
.ycp-field output{font-size:11px;text-align:right;color:#f6f6f8}
.ycp-status{min-height:20px;font-size:12px;color:#70f0bd;margin-top:8px}
.ycp-status.err{color:#ff8795}
.ycp-stage{background:#25252b;border-radius:8px;overflow:auto;position:relative}
.ycp-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
.ycp-note{font-size:11px;color:#8d8d99;line-height:1.7;margin:6px 0 0}
.ycp-list{display:flex;flex-direction:column;gap:3px;max-height:230px;overflow:auto}
.ycp-item{display:flex;align-items:center;gap:6px;padding:5px 7px;border:1px solid #2c2c35;border-radius:6px;font-size:12px;background:#1b1b21;cursor:pointer}
.ycp-item.sel{border-color:#70f0bd;background:#1d2a26}
.ycp-item span.n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ycp-item button{padding:2px 6px;font-size:11px}
.ycp-table{border-collapse:collapse;font-size:12px}
.ycp-table td,.ycp-table th{border:1px solid #3a3a45;padding:4px 8px}
.ycp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ycp-badge{font-size:10px;letter-spacing:.08em;border:1px solid #70f0bd;color:#70f0bd;border-radius:999px;padding:1px 7px;margin-left:6px}
`;
document.head.append(css);

/* ---------- DOM helper ---------- */
YC.el=(tag,props,...kids)=>{
  const e=document.createElement(tag);
  if(props)for(const[k,v]of Object.entries(props)){
    if(v==null||v===false)continue;
    if(k==='class')e.className=v;
    else if(k==='style'&&typeof v==='object')Object.assign(e.style,v);
    else if(k==='style')e.style.cssText=v;
    else if(k==='text')e.textContent=v;
    else if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.slice(2),v);
    else if(k in e&&k!=='list'&&k!=='type'&&k!=='min'&&k!=='max'&&k!=='step')e[k]=v;
    else e.setAttribute(k,v===true?'':v);
  }
  for(const k of kids.flat())if(k!=null&&k!==false)e.append(k.nodeType?k:document.createTextNode(String(k)));
  return e;
};
const el=YC.el;

/* ---------- workspace mounting ---------- */
/* Creates the Pro workspace below the header, hides the old basic workspace and the
   generic expansion panel so that no dead buttons remain. Returns {root,status}. */
YC.workspace=(opts={})=>{
  const main=$('main');if(!main)return null;
  const old=$('.layout');if(old&&opts.replaceBasic!==false){old.hidden=true;old.style.display='none'}
  $$('.yc-pro-panel').forEach(p=>p.remove());
  const root=el('section',{class:'ycp',id:'ycp-root','aria-label':(opts.title||YC.toolName)+' Pro 작업실'});
  const head=el('h2',{class:'ycp-title'},(opts.title||YC.toolName).toUpperCase()+' PRO',el('span',{class:'ycp-badge'},'BROWSER'));
  const sub=el('p',{class:'ycp-sub'},opts.subtitle||'모든 작업은 이 브라우저 안에서 처리되며 서버로 전송되지 않습니다.');
  const status=el('div',{class:'ycp-status',role:'status','aria-live':'polite'});
  root.append(head,sub);
  (old||main.lastElementChild).insertAdjacentElement(old?'beforebegin':'afterend',root);
  root.append(status);
  YC._status=status;YC.root=root;
  const intro=$('.intro');if(intro&&opts.intro)intro.textContent=opts.intro;
  return {root,status};
};
YC.say=(msg,err)=>{const s=YC._status;if(!s)return;s.textContent=msg;s.classList.toggle('err',!!err);clearTimeout(YC._st);YC._st=setTimeout(()=>{if(s.textContent===msg)s.textContent=''},6000)};

/* ---------- UI builders ---------- */
YC.btn=(label,fn,o={})=>{const b=el('button',{type:'button',class:o.primary?'primary':'',title:o.title||''},label);if(fn)b.addEventListener('click',fn);return b};
YC.row=(...kids)=>el('div',{class:'ycp-row'},...kids);
YC.group=(title,...kids)=>el('div',{class:'ycp-group'},title?el('h3',null,title):null,...kids);
YC.range=(label,o,onInput)=>{
  const out=el('output',null,String(o.value??0)+(o.unit||''));
  const inp=el('input',{type:'range',min:o.min??0,max:o.max??100,step:o.step??1,value:o.value??0,'aria-label':label});
  inp.addEventListener('input',()=>{out.textContent=inp.value+(o.unit||'');onInput&&onInput(+inp.value,inp)});
  inp.addEventListener('dblclick',()=>{inp.value=o.reset??o.value??0;inp.dispatchEvent(new Event('input'))});
  const wrap=el('label',{class:'ycp-field'},el('span',null,label),inp,out);
  wrap.input=inp;wrap.out=out;wrap.set=v=>{inp.value=v;out.textContent=inp.value+(o.unit||'')};
  return wrap;
};
YC.num=(label,o,onChange)=>{
  const inp=el('input',{type:'number',min:o.min,max:o.max,step:o.step??1,value:o.value??0,'aria-label':label});
  inp.addEventListener('change',()=>onChange&&onChange(+inp.value,inp));
  const wrap=el('label',{class:'ycp-field two'},el('span',null,label),inp);wrap.input=inp;return wrap;
};
YC.text=(label,o,onChange)=>{
  const inp=el(o.multiline?'textarea':'input',{type:o.multiline?undefined:'text',value:o.value??'',rows:o.rows||3,placeholder:o.placeholder||'','aria-label':label});
  inp.addEventListener('input',()=>onChange&&onChange(inp.value,inp));
  const wrap=el('label',{class:'ycp-field two'},el('span',null,label),inp);wrap.input=inp;return wrap;
};
YC.select=(label,opts,value,onChange)=>{
  const sel=el('select',{'aria-label':label},opts.map(o=>{const[v,t]=Array.isArray(o)?o:[o,o];return el('option',{value:v,selected:String(v)===String(value)},t)}));
  sel.addEventListener('change',()=>onChange&&onChange(sel.value,sel));
  const wrap=el('label',{class:'ycp-field two'},el('span',null,label),sel);wrap.input=sel;return wrap;
};
YC.color=(label,value,onChange)=>{
  const inp=el('input',{type:'color',value:value||'#70f0bd','aria-label':label});
  inp.addEventListener('input',()=>onChange&&onChange(inp.value,inp));
  const wrap=el('label',{class:'ycp-field two'},el('span',null,label),inp);wrap.input=inp;return wrap;
};
YC.check=(label,value,onChange)=>{
  const inp=el('input',{type:'checkbox',checked:!!value});
  inp.addEventListener('change',()=>onChange&&onChange(inp.checked,inp));
  const wrap=el('label',{class:'ycp-field two'},el('span',null,label),inp);wrap.input=inp;return wrap;
};
YC.tabs=(items,onPick,start=0)=>{
  const box=el('div',{class:'ycp-tabs',role:'tablist'});
  const bs=items.map(([id,label],i)=>{const b=el('button',{type:'button',role:'tab','aria-selected':String(i===start),class:i===start?'on':''},label);b.addEventListener('click',()=>pick(id));box.append(b);return[id,b]});
  function pick(id){bs.forEach(([k,b])=>{b.classList.toggle('on',k===id);b.setAttribute('aria-selected',String(k===id))});onPick(id)}
  box.pick=pick;return box;
};

/* ---------- files ---------- */
YC.download=(blob,name)=>{const u=URL.createObjectURL(blob),a=el('a',{href:u,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)};
YC.pick=(accept,multiple=false)=>new Promise(res=>{
  const i=el('input',{type:'file',accept:accept||'',multiple,hidden:true});
  i.addEventListener('change',()=>{res([...i.files]);i.remove()});
  i.addEventListener('cancel',()=>{res([]);i.remove()});
  document.body.append(i);i.click();
});
YC.readText=f=>f.text();
YC.readDataURL=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(f)});
YC.readBuffer=f=>f.arrayBuffer();
YC.loadImage=src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(new Error('이미지를 열 수 없습니다.'));im.src=src});
YC.canvasBlob=(c,type='image/png',q)=>new Promise(res=>c.toBlob(res,type,q));
YC.fmtBytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
YC.esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
YC.uid=()=>Math.random().toString(36).slice(2,9);
YC.clone=v=>JSON.parse(JSON.stringify(v));
YC.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- project adapter + autosave bridge ---------- */
/* studio.js calls window.youthCraftProjectAdapter.export()/import() for .ycproject save/open and
   autosave. A hidden control lets Pro workspaces request an autosave after a change. */
const dirtyInput=el('input',{type:'hidden',id:'yc-pro-dirty',value:'0'});
document.body.append(dirtyInput);
let dt;YC.dirty=()=>{clearTimeout(dt);dt=setTimeout(()=>{dirtyInput.value=String(Date.now());dirtyInput.dispatchEvent(new Event('input',{bubbles:true}))},200)};
YC.quickExport=fn=>{window.youthCraftQuickExport=fn};
YC.adapter=a=>{window.youthCraftProjectAdapter={export:()=>({tool:YC.toolName,pro:true,state:a.export()}),import:async d=>{if(!d||d.tool!==YC.toolName||!d.pro)throw new Error('다른 도구의 프로젝트입니다.');await a.import(d.state)}}};

/* ---------- undo / redo ---------- */
YC.history=(getState,setState,limit=60)=>{
  let stack=[],idx=-1,lock=false;
  const h={
    commit(){if(lock)return;const s=JSON.stringify(getState());if(idx>=0&&stack[idx]===s)return;stack=stack.slice(0,idx+1);stack.push(s);if(stack.length>limit)stack.shift();idx=stack.length-1;h.onchange&&h.onchange()},
    undo(){if(idx<=0)return false;lock=true;try{setState(JSON.parse(stack[--idx]))}finally{lock=false}h.onchange&&h.onchange();return true},
    redo(){if(idx>=stack.length-1)return false;lock=true;try{setState(JSON.parse(stack[++idx]))}finally{lock=false}h.onchange&&h.onchange();return true},
    reset(){stack=[];idx=-1;h.commit()},
    get canUndo(){return idx>0},get canRedo(){return idx<stack.length-1}
  };
  return h;
};
/* Ctrl/Cmd+Z, Ctrl/Cmd+Y (or Shift+Z) while focus is not in a text field. */
YC.bindHistoryKeys=(h,scope)=>{
  document.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey))return;
    const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t&&t.isContentEditable)return;
    if(scope&&!scope.contains(document.activeElement)&&document.activeElement!==document.body)return;
    const k=e.key.toLowerCase();
    if(k==='z'&&!e.shiftKey){e.preventDefault();h.undo()}
    else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();h.redo()}
  });
};

/* ---------- ZIP (store only) + CRC32 ---------- */
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
YC.crc32=u8=>{let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=crcT[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
YC.zip=files=>{ /* files: [{name:string, data:Uint8Array|string}] → Blob */
  const enc=new TextEncoder(),parts=[],cent=[];let off=0;
  const d=new Date(),dosT=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dosD=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(const f of files){
    const nm=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=YC.crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,dosT,true);lh.setUint16(12,dosD,true);lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
    parts.push(lh.buffer,nm,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,dosT,true);ch.setUint16(14,dosD,true);ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cent.push(ch.buffer,nm);
    off+=30+nm.length+data.length;
  }
  let cs=0;for(const c of cent)cs+=c.byteLength||c.length;
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
  return new Blob([...parts,...cent,end.buffer],{type:'application/zip'});
};

/* ---------- SVG sanitizer ---------- */
YC.sanitizeSvg=text=>{
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');
  if(doc.querySelector('parsererror'))throw new Error('SVG 파일을 해석할 수 없습니다.');
  const root=doc.documentElement;if(root.localName!=='svg')throw new Error('SVG 문서가 아닙니다.');
  const bad=new Set(['script','foreignobject','iframe','object','embed','audio','video','animate','set','animatemotion','animatetransform','style']);
  (function walk(n){
    for(const c of [...n.children]){
      if(bad.has(c.localName.toLowerCase())){c.remove();continue}
      for(const a of [...c.attributes]){
        const nm=a.name.toLowerCase(),v=a.value.trim().toLowerCase();
        if(nm.startsWith('on'))c.removeAttribute(a.name);
        else if((nm==='href'||nm==='xlink:href')&&!v.startsWith('#')&&!v.startsWith('data:image/'))c.removeAttribute(a.name);
        else if(/url\(\s*['"]?\s*(https?:|javascript:|\/\/)/.test(v))c.removeAttribute(a.name);
      }
      walk(c);
    }
  })(root);
  for(const a of [...root.attributes]){if(a.name.toLowerCase().startsWith('on'))root.removeAttribute(a.name)}
  return new XMLSerializer().serializeToString(root);
};

/* ---------- misc ---------- */
YC.rgb=hex=>{const h=hex.replace('#','');const n=parseInt(h.length===3?h.replace(/./g,'$&$&'):h,16);return[(n>>16)&255,(n>>8)&255,n&255]};
YC.hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(YC.clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
YC.debounce=(fn,ms=120)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
YC.raf=fn=>{let p=false;return(...a)=>{if(p)return;p=true;requestAnimationFrame(()=>{p=false;fn(...a)})}};
YC.loadScript=src=>new Promise((ok,no)=>{if(document.querySelector('script[data-ycsrc="'+src+'"]'))return ok();const s=el('script',{src,async:true});s.dataset.ycsrc=src;s.onload=ok;s.onerror=()=>no(new Error('스크립트를 불러오지 못했습니다: '+src));document.head.append(s)});
})();
