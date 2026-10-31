/* WordCraft Pro — 문서 작업실. 브라우저 안에서만 처리하며 AI 기능은 없습니다. */
(()=>{'use strict';
if(!window.YC)return;
const {el}=YC,say=YC.say;
const root=YC.workspace({title:'WordCraft',intro:'제목·목록·표·이미지·링크가 있는 문서를 쓰고 DOCX, HTML, Markdown, TXT로 저장합니다.',subtitle:'모든 편집과 파일 변환은 이 브라우저 안에서 이뤄집니다.'}).root;

/* ---------- 정화 ---------- */
const TAGS=new Set('p div span br h1 h2 h3 h4 h5 h6 b strong i em u s strike del sub sup ul ol li blockquote pre code a img table thead tbody tr td th hr'.split(' '));
const STY=['color','background-color','font-size','font-family','text-align','font-weight','font-style','text-decoration'];
function clean(node){
  for(const ch of [...node.childNodes]){
    if(ch.nodeType===3)continue;
    if(ch.nodeType!==1){ch.remove();continue}
    const t=ch.tagName.toLowerCase();
    if(!TAGS.has(t)){if(/^(script|style|iframe|object|embed|link|meta|svg|form|input|button|textarea|select|noscript)$/.test(t)){ch.remove();continue}clean(ch);ch.replaceWith(...ch.childNodes);continue}
    const keep={};
    if(t==='a'){const h=ch.getAttribute('href')||'';if(/^(https?:|mailto:|#)/i.test(h))keep.href=h}
    if(t==='img'){const s=ch.getAttribute('src')||'';if(/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)){keep.src=s;keep.alt=ch.getAttribute('alt')||''}else{ch.remove();continue}}
    if(t==='td'||t==='th'){for(const k of['colspan','rowspan']){const v=+ch.getAttribute(k);if(v>1&&v<50)keep[k]=v}}
    const st=[];for(const p of STY){const v=ch.style&&ch.style.getPropertyValue(p);if(v&&!/url\(|expression|javascript/i.test(v))st.push(p+':'+v)}
    for(const a of [...ch.attributes])ch.removeAttribute(a.name);
    for(const k in keep)ch.setAttribute(k,keep[k]);
    if(st.length)ch.setAttribute('style',st.join(';'));
    if(t==='a'){ch.setAttribute('rel','noopener noreferrer');ch.setAttribute('target','_blank')}
    clean(ch);
  }
}
const sanitize=html=>{const d=new DOMParser().parseFromString('<body>'+html+'</body>','text/html');clean(d.body);return d.body.innerHTML};

/* ---------- 에디터 ---------- */
const ed=el('div',{class:'wc-page',contenteditable:'true',role:'textbox','aria-multiline':'true','aria-label':'문서 본문',spellcheck:'true'});
ed.innerHTML='<h1>제목을 입력하세요</h1><p>여기에 내용을 쓰세요. 위 도구 막대로 제목·목록·표·이미지를 넣을 수 있습니다.</p>';
const css=el('style',null,`
.wc-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.wc-bar select{height:30px}
.wc-wrap{display:grid;grid-template-columns:200px minmax(0,1fr);gap:12px;margin-top:8px}
@media(max-width:820px){.wc-wrap{grid-template-columns:1fr}}
.wc-out{background:#14141a;border:1px solid #36363f;border-radius:8px;padding:8px;font-size:12px;max-height:70vh;overflow:auto}
.wc-out a{display:block;color:#aaaab4;padding:3px 4px;cursor:pointer;text-decoration:none;border-radius:4px}
.wc-out a:hover,.wc-out a:focus{background:#25252d;color:#fff}
.wc-scroll{background:#2a2a32;border-radius:8px;padding:14px;max-height:70vh;overflow:auto}
.wc-page{background:#fff;color:#1a1a1a;max-width:794px;min-height:900px;margin:0 auto;padding:56px 64px;font:16px/1.7 'Noto Sans KR',system-ui,sans-serif;outline:none;box-shadow:0 2px 12px #0008}
.wc-page h1{font-size:2em;margin:.6em 0 .3em}.wc-page h2{font-size:1.5em;margin:.6em 0 .3em}.wc-page h3{font-size:1.2em}
.wc-page table{border-collapse:collapse;width:100%;margin:8px 0}.wc-page td,.wc-page th{border:1px solid #999;padding:4px 8px;min-width:40px}
.wc-page img{max-width:100%}.wc-page blockquote{border-left:4px solid #bbb;margin:8px 0;padding:2px 14px;color:#555}
.wc-page pre{background:#f1f1f4;padding:8px;border-radius:4px;overflow:auto}.wc-page hr{border:0;border-top:1px solid #aaa}
.wc-page .wc-pb{border-top:2px dashed #aaa;margin:20px 0;page-break-after:always}
.wc-page mark.wc-hit{background:#ffe066}
.wc-stat{font-size:12px;color:#aaaab4;margin-top:6px}
@media print{body *{visibility:hidden}.wc-page,.wc-page *{visibility:visible}.wc-page{position:absolute;left:0;top:0;box-shadow:none;max-width:none;padding:0}}
`);document.head.append(css);

const cmd=(c,v)=>{ed.focus();document.execCommand(c,false,v);changed()};
const sel=(label,opts,fn)=>{const s=el('select',{'aria-label':label},el('option',{value:''},label),opts.map(([v,t])=>el('option',{value:v},t)));s.addEventListener('change',()=>{if(s.value)fn(s.value);s.value=''});return s};
const colorIn=(label,fn,v)=>{const i=el('input',{type:'color',value:v,'aria-label':label,title:label});i.addEventListener('input',()=>fn(i.value));return i};
const savedRange=()=>{const s=getSelection();return s.rangeCount?s.getRangeAt(0).cloneRange():null};
let lastRange=null;document.addEventListener('selectionchange',()=>{const s=getSelection();if(s.rangeCount&&ed.contains(s.anchorNode))lastRange=s.getRangeAt(0).cloneRange()});
const restore=()=>{ed.focus();if(lastRange){const s=getSelection();s.removeAllRanges();s.addRange(lastRange)}};
const FONTS=[['Noto Sans KR','고딕'],['Noto Serif KR','명조'],['Georgia','Georgia'],['Arial','Arial'],['monospace','고정폭']];
function insertHTML(h){restore();document.execCommand('insertHTML',false,sanitize(h));changed()}
function curCell(){const s=getSelection();let n=s.anchorNode;while(n&&n!==ed){if(n.nodeType===1&&/^T[DH]$/.test(n.tagName))return n;n=n.parentNode}return null}
function tableOp(op){
  restore();const td=curCell();if(!td){say('표 안의 칸을 먼저 선택해 주세요.',true);return}
  const tr=td.parentElement,tb=tr.closest('table'),ci=[...tr.children].indexOf(td);
  if(op==='rowAfter'||op==='rowBefore'){const n=tr.cloneNode(true);n.querySelectorAll('td,th').forEach(c=>c.innerHTML='<br>');tr[op==='rowAfter'?'after':'before'](n)}
  else if(op==='colAfter'||op==='colBefore'){tb.querySelectorAll('tr').forEach(r=>{const c=r.children[ci];if(!c)return;const n=c.cloneNode(false);n.innerHTML='<br>';c[op==='colAfter'?'after':'before'](n)})}
  else if(op==='delRow'){if(tb.rows.length<2)tb.remove();else tr.remove()}
  else if(op==='delCol'){if(tr.children.length<2)tb.remove();else tb.querySelectorAll('tr').forEach(r=>r.children[ci]&&r.children[ci].remove())}
  else if(op==='delTable')tb.remove();
  changed();
}
async function pickFile(accept){const f=await YC.pick(accept);return f&&f[0]}
async function addImage(){
  const f=await pickFile('image/png,image/jpeg,image/gif,image/webp');if(!f)return;
  if(f.size>3*1024*1024){say('이미지가 3MB를 넘습니다. 줄여서 다시 넣어 주세요.',true);return}
  const url=await YC.readDataURL(f);insertHTML('<img src="'+url+'" alt="'+YC.esc(f.name)+'">');say('이미지를 넣었습니다. 문서에 포함되어 저장됩니다.');
}
function addLink(){
  const u=prompt('링크 주소 (https://… 또는 mailto:…)','https://');if(!u)return;if(!/^(https?:|mailto:)/i.test(u)){say('http, https, mailto 주소만 넣을 수 있습니다.',true);return}
  restore();document.execCommand('createLink',false,u);ed.querySelectorAll('a').forEach(a=>{a.rel='noopener noreferrer';a.target='_blank'});changed();
}
function addTable(){
  const r=+prompt('행 수',3),c=+prompt('열 수',3);if(!(r>0&&r<=50&&c>0&&c<=20)){say('행은 50, 열은 20 이하의 숫자로 입력해 주세요.',true);return}
  insertHTML('<table><tbody>'+('<tr>'+'<td><br></td>'.repeat(c)+'</tr>').repeat(r)+'</tbody></table><p><br></p>');
}
function makeToc(){
  const hs=[...ed.querySelectorAll('h1,h2,h3')];if(!hs.length){say('제목(H1~H3)이 없어 목차를 만들 수 없습니다.',true);return}
  ed.querySelectorAll('.wc-toc').forEach(x=>x.remove());
  const t=el('div',{class:'wc-toc',contenteditable:'false'},el('h2',null,'목차'),el('ul',null,hs.map(h=>el('li',{style:'margin-left:'+(+h.tagName[1]-1)*18+'px;list-style:none'},h.textContent))));
  ed.prepend(t);changed();say('맨 위에 목차를 만들었습니다. 제목을 바꾼 뒤에는 다시 눌러 갱신하세요.');
}
let hits=[],hi=-1;
function clearMarks(){ed.querySelectorAll('mark.wc-hit').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));ed.normalize()}
function find(q,cs){
  clearMarks();hits=[];hi=-1;if(!q)return 0;const w=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),cs?'g':'gi');
  for(const n of nodes){if(n.parentElement.closest('.wc-toc'))continue;const t=n.nodeValue;let m,last=0;const frag=document.createDocumentFragment();let any=false;re.lastIndex=0;
    while((m=re.exec(t))){any=true;frag.append(t.slice(last,m.index));const k=el('mark',{class:'wc-hit'},m[0]);frag.append(k);hits.push(k);last=m.index+m[0].length;if(m[0]==='')re.lastIndex++}
    if(any){frag.append(t.slice(last));n.replaceWith(frag)}}
  return hits.length;
}
function findNext(){if(!hits.length)return;hi=(hi+1)%hits.length;hits.forEach(h=>h.style.outline='');hits[hi].style.outline='2px solid #e15759';hits[hi].scrollIntoView({block:'center'})}
function replaceAll(q,r,cs){const n=find(q,cs);hits.forEach(h=>h.replaceWith(document.createTextNode(r)));hits=[];ed.normalize();changed();return n}

/* ---------- 입출력 ---------- */
const htmlOf=()=>{const c=ed.cloneNode(true);c.querySelectorAll('mark.wc-hit').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));c.querySelectorAll('.wc-pb').forEach(p=>p.setAttribute('style','page-break-after:always'));return c.innerHTML};
const title=()=>(ed.querySelector('h1')||{}).textContent||'문서';
function toText(){const c=ed.cloneNode(true);c.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));c.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre').forEach(b=>b.append('\n'));c.querySelectorAll('td,th').forEach(b=>b.append('\t'));return c.textContent.replace(/\n{3,}/g,'\n\n').trim()+'\n'}
function toMd(){
  const inl=n=>{if(n.nodeType===3)return n.nodeValue.replace(/\s+/g,' ');if(n.nodeType!==1)return '';const t=n.tagName.toLowerCase(),k=[...n.childNodes].map(inl).join('');
    if(t==='b'||t==='strong')return k.trim()?'**'+k.trim()+'**':k;if(t==='i'||t==='em')return k.trim()?'*'+k.trim()+'*':k;if(t==='s'||t==='del'||t==='strike')return '~~'+k+'~~';if(t==='code')return '`'+k+'`';
    if(t==='a')return '['+k+']('+n.getAttribute('href')+')';if(t==='img')return '![]('+(n.getAttribute('src').startsWith('data:')?'embedded-image':n.getAttribute('src'))+')';if(t==='br')return '  \n';return k};
  const blk=(n,ind='')=>{if(n.nodeType===3)return n.nodeValue.trim()?n.nodeValue.trim()+'\n\n':'';if(n.nodeType!==1)return '';const t=n.tagName.toLowerCase();
    if(/^h[1-6]$/.test(t))return '#'.repeat(+t[1])+' '+inl(n).trim()+'\n\n';
    if(t==='ul'||t==='ol'){let i=0;return [...n.children].map(li=>{i++;const sub=[...li.children].filter(x=>/^[uo]l$/i.test(x.tagName)).map(x=>blk(x,ind+'  ')).join('');const own=[...li.childNodes].filter(x=>!(x.nodeType===1&&/^[uo]l$/i.test(x.tagName))).map(inl).join('').trim();return ind+(t==='ul'?'- ':i+'. ')+own+'\n'+sub}).join('')+(ind?'':'\n')}
    if(t==='blockquote')return inl(n).trim().split('\n').map(l=>'> '+l).join('\n')+'\n\n';
    if(t==='pre')return '```\n'+n.textContent+'\n```\n\n';if(t==='hr')return '---\n\n';
    if(t==='table'){const rows=[...n.rows].map(r=>[...r.cells].map(c=>inl(c).trim().replace(/\|/g,'\\|')));if(!rows.length)return '';const w=Math.max(...rows.map(r=>r.length));const f=r=>'| '+Array.from({length:w},(_,i)=>r[i]||'').join(' | ')+' |';return [f(rows[0]),'|'+' --- |'.repeat(w),...rows.slice(1).map(f)].join('\n')+'\n\n'}
    if(n.classList.contains('wc-pb'))return '\n';
    if(t==='p'||t==='div'){if([...n.children].some(c=>/^(h[1-6]|ul|ol|table|blockquote|pre|p|div)$/i.test(c.tagName)))return [...n.childNodes].map(c=>blk(c)).join('');return inl(n).trim()?inl(n).trim()+'\n\n':''}
    return inl(n)+'\n\n'};
  return [...ed.childNodes].map(n=>blk(n)).join('').replace(/\n{3,}/g,'\n\n').trim()+'\n';
}
function mdToHtml(md){
  const esc=YC.esc,inline=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\*([^*]+)\*/g,'<i>$1</i>').replace(/~~([^~]+)~~/g,'<s>$1</s>').replace(/\[([^\]]+)\]\((https?:[^)\s]+|mailto:[^)\s]+)\)/g,'<a href="$2">$1</a>');
  const lines=md.replace(/\r/g,'').split('\n');let out='',i=0;
  while(i<lines.length){const l=lines[i];let m;
    if((m=/^(#{1,6})\s+(.*)$/.exec(l))){out+=`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;i++}
    else if(/^```/.test(l)){let b=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))b.push(lines[i++]);i++;out+='<pre>'+esc(b.join('\n'))+'</pre>'}
    else if(/^\s*[-*]\s+/.test(l)){out+='<ul>';while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i]))out+='<li>'+inline(lines[i++].replace(/^\s*[-*]\s+/,''))+'</li>';out+='</ul>'}
    else if(/^\s*\d+\.\s+/.test(l)){out+='<ol>';while(i<lines.length&&/^\s*\d+\.\s+/.test(lines[i]))out+='<li>'+inline(lines[i++].replace(/^\s*\d+\.\s+/,''))+'</li>';out+='</ol>'}
    else if(/^>\s?/.test(l)){let b=[];while(i<lines.length&&/^>\s?/.test(lines[i]))b.push(lines[i++].replace(/^>\s?/,''));out+='<blockquote>'+inline(b.join(' '))+'</blockquote>'}
    else if(/^---+$/.test(l)){out+='<hr>';i++}
    else if(/^\|.*\|$/.test(l)&&/^\|[\s:|-]+\|$/.test(lines[i+1]||'')){const rows=[l];i+=2;while(i<lines.length&&/^\|.*\|$/.test(lines[i]))rows.push(lines[i++]);out+='<table><tbody>'+rows.map((r,k)=>'<tr>'+r.slice(1,-1).split('|').map(c=>`<${k?'td':'th'}>${inline(c.trim())}</${k?'td':'th'}>`).join('')+'</tr>').join('')+'</tbody></table>'}
    else if(!l.trim())i++;else{let b=[];while(i<lines.length&&lines[i].trim()&&!/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s|>|---)/.test(lines[i]))b.push(lines[i++]);out+='<p>'+inline(b.join(' '))+'</p>'}}
  return out;
}
/* DOCX */
const x=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
function runs(n,f={}){
  if(n.nodeType===3){const t=n.nodeValue.replace(/\s+/g,' ');if(!t)return '';return '<w:r><w:rPr>'+(f.b?'<w:b/>':'')+(f.i?'<w:i/>':'')+(f.u?'<w:u w:val="single"/>':'')+(f.s?'<w:strike/>':'')+(f.col?'<w:color w:val="'+f.col+'"/>':'')+(f.mono?'<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>':'')+'</w:rPr><w:t xml:space="preserve">'+x(t)+'</w:t></w:r>'}
  if(n.nodeType!==1)return '';const t=n.tagName.toLowerCase(),g={...f};
  if(t==='b'||t==='strong')g.b=1;if(t==='i'||t==='em')g.i=1;if(t==='u')g.u=1;if(t==='s'||t==='del'||t==='strike')g.s=1;if(t==='code')g.mono=1;
  const c=n.style&&n.style.color;if(c){const m=/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c);if(m)g.col=[m[1],m[2],m[3]].map(v=>(+v).toString(16).padStart(2,'0')).join('');else if(/^#[0-9a-f]{6}$/i.test(c))g.col=c.slice(1)}
  if(n.style&&/bold|[6-9]00/.test(n.style.fontWeight))g.b=1;if(n.style&&n.style.fontStyle==='italic')g.i=1;if(/underline/.test(n.style&&n.style.textDecoration))g.u=1;
  if(t==='br')return '<w:r><w:br/></w:r>';if(t==='img')return '<w:r><w:t>[이미지]</w:t></w:r>';
  return [...n.childNodes].map(k=>runs(k,g)).join('');
}
function para(n,style,extra=''){const al=n.style&&n.style.textAlign;const jc={center:'center',right:'right',justify:'both'}[al];return '<w:p><w:pPr>'+(style?'<w:pStyle w:val="'+style+'"/>':'')+extra+(jc?'<w:jc w:val="'+jc+'"/>':'')+'</w:pPr>'+runs(n)+'</w:p>'}
function docxBody(){
  let out='';
  const blk=(n,depth=0)=>{if(n.nodeType===3){return n.nodeValue.trim()?'<w:p><w:r><w:t xml:space="preserve">'+x(n.nodeValue.trim())+'</w:t></w:r></w:p>':''}if(n.nodeType!==1)return '';const t=n.tagName.toLowerCase();
    if(/^h[1-6]$/.test(t))return para(n,'Heading'+Math.min(3,+t[1]));
    if(t==='ul'||t==='ol'){let i=0,s='';for(const li of n.children){i++;const sub=[...li.children].filter(c=>/^[uo]l$/i.test(c.tagName));const own=document.createElement('div');[...li.childNodes].forEach(c=>{if(!(c.nodeType===1&&/^[uo]l$/i.test(c.tagName)))own.append(c.cloneNode(true))});
      const mark=t==='ul'?'• ':i+'. ';s+='<w:p><w:pPr><w:ind w:left="'+(360+depth*360)+'" w:hanging="260"/></w:pPr><w:r><w:t xml:space="preserve">'+x(mark)+'</w:t></w:r>'+runs(own)+'</w:p>'+sub.map(u=>blk(u,depth+1)).join('')}return s}
    if(t==='table'){const rows=[...n.rows];if(!rows.length)return '';return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(b=>'<w:'+b+' w:val="single" w:sz="4" w:color="999999"/>').join('')+'</w:tblBorders></w:tblPr>'+rows.map(r=>'<w:tr>'+[...r.cells].map(c=>'<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>'+(c.colSpan>1?'<w:gridSpan w:val="'+c.colSpan+'"/>':'')+'</w:tcPr>'+(para(c)||'<w:p/>')+'</w:tc>').join('')+'</w:tr>').join('')+'</w:tbl><w:p/>'}
    if(t==='hr')return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
    if(n.classList&&n.classList.contains('wc-pb'))return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    if(t==='blockquote')return para(n,null,'<w:ind w:left="480"/>');if(t==='pre')return para(n,null);
    if((t==='div'||t==='p')&&[...n.children].some(c=>/^(h[1-6]|ul|ol|table|blockquote|pre|p|div)$/i.test(c.tagName)))return [...n.childNodes].map(c=>blk(c)).join('');
    return para(n)};
  const c=ed.cloneNode(true);c.querySelectorAll('mark.wc-hit').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));
  for(const n of c.childNodes)out+=blk(n);return out||'<w:p/>';
}
function buildDocx(){
  const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${docxBody()}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const hs=(id,sz)=>`<w:style w:type="paragraph" w:styleId="Heading${id}"><w:name w:val="heading ${id}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${id-1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${hs(1,40)}${hs(2,32)}${hs(3,26)}</w:styles>`;
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const drels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const z=YC.zip([{name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:doc},{name:'word/styles.xml',data:styles},{name:'word/_rels/document.xml.rels',data:drels}]);
  return new Blob([z],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function exportAs(fmt){
  const base=(title().trim().replace(/[\\/:*?"<>|]+/g,'').slice(0,40)||'document');
  if(fmt==='docx'){YC.download(buildDocx(),base+'.docx');say('.docx 로 저장했습니다. 이미지는 "[이미지]" 표시로 대체되고 글자 크기·글꼴 변경은 반영되지 않습니다.');return}
  if(fmt==='html'){const h='<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+x(title())+'</title><style>body{max-width:794px;margin:40px auto;padding:0 24px;font:16px/1.7 system-ui,sans-serif}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}img{max-width:100%}</style></head><body>'+htmlOf()+'</body></html>';YC.download(new Blob([h],{type:'text/html;charset=utf-8'}),base+'.html')}
  else if(fmt==='md')YC.download(new Blob([toMd()],{type:'text/markdown;charset=utf-8'}),base+'.md');
  else YC.download(new Blob([toText()],{type:'text/plain;charset=utf-8'}),base+'.txt');
  say('.'+fmt+' 로 저장했습니다.');
}
YC.quickExport(()=>exportAs('docx'));
async function importFile(){
  const f=await pickFile('.html,.htm,.md,.markdown,.txt,text/plain,text/html');if(!f)return;
  if(f.size>5*1024*1024){say('5MB 이하 파일만 가져옵니다.',true);return}
  const t=await YC.readText(f);
  if(/\.html?$/i.test(f.name))ed.innerHTML=sanitize(t.replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi,''));
  else if(/\.(md|markdown)$/i.test(f.name))ed.innerHTML=sanitize(mdToHtml(t));
  else ed.innerHTML=t.replace(/\r/g,'').split(/\n{2,}/).map(p=>'<p>'+YC.esc(p).replace(/\n/g,'<br>')+'</p>').join('');
  changed(true);say(f.name+' 를 가져왔습니다. .docx 가져오기는 지원하지 않습니다.');
}

/* ---------- 상태·저장 ---------- */
const stat=el('div',{class:'wc-stat',role:'status'}),out=el('nav',{class:'wc-out','aria-label':'문서 개요'});
function refresh(){
  const t=ed.innerText||'',words=(t.trim().match(/\S+/g)||[]).length,ch=t.replace(/\s/g,'').length;
  stat.textContent='단어 '+words.toLocaleString()+' · 글자(공백 제외) '+ch.toLocaleString()+' · 예상 쪽수 '+Math.max(1,Math.ceil(ed.scrollHeight/1050));
  out.replaceChildren(el('b',{style:'display:block;margin-bottom:6px'},'개요'),...[...ed.querySelectorAll('h1,h2,h3')].map((h,i)=>{const a=el('a',{tabindex:0,style:'padding-left:'+(+h.tagName[1]-1)*10+'px'},h.textContent||'(빈 제목)');a.addEventListener('click',()=>h.scrollIntoView({block:'start',behavior:'smooth'}));a.addEventListener('keydown',e=>{if(e.key==='Enter')a.click()});return a}));
}
const rf=YC.debounce(refresh,250);
function changed(){rf();YC.dirty()}
ed.addEventListener('input',changed);
ed.addEventListener('paste',e=>{
  const cd=e.clipboardData;if(!cd)return;const h=cd.getData('text/html');
  if(h){e.preventDefault();document.execCommand('insertHTML',false,sanitize(h.replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi,'')));changed()}
});
ed.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length)e.preventDefault()});
ed.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();findBox.querySelector('input').focus()}});
YC.adapter({export:()=>({html:htmlOf()}),async import(s){ed.innerHTML=sanitize(s.html||'');changed(true)}});

/* ---------- 도구 막대 ---------- */
const B=(l,f,t)=>YC.btn(l,f,{title:t});
const bar1=el('div',{class:'wc-bar',role:'toolbar','aria-label':'글자 서식'},
  B('굵게',()=>cmd('bold'),'Ctrl+B'),B('기울임',()=>cmd('italic'),'Ctrl+I'),B('밑줄',()=>cmd('underline'),'Ctrl+U'),B('취소선',()=>cmd('strikeThrough')),B('위첨자',()=>cmd('superscript')),B('아래첨자',()=>cmd('subscript')),
  sel('문단 형식',[['p','본문'],['h1','제목 1'],['h2','제목 2'],['h3','제목 3'],['blockquote','인용'],['pre','코드 블록']],v=>cmd('formatBlock',v)),
  sel('글꼴',FONTS,v=>cmd('fontName',v)),
  sel('글자 크기',[['1','아주 작게'],['2','작게'],['3','보통'],['5','크게'],['6','더 크게'],['7','가장 크게']],v=>cmd('fontSize',v)),
  colorIn('글자색',v=>cmd('foreColor',v),'#cc0000'),colorIn('형광펜',v=>cmd('hiliteColor',v),'#ffe066'),
  B('왼쪽',()=>cmd('justifyLeft')),B('가운데',()=>cmd('justifyCenter')),B('오른쪽',()=>cmd('justifyRight')),B('양쪽',()=>cmd('justifyFull')),
  B('글머리표',()=>cmd('insertUnorderedList')),B('번호',()=>cmd('insertOrderedList')),B('내어쓰기',()=>cmd('outdent')),B('들여쓰기',()=>cmd('indent')),B('서식 지우기',()=>cmd('removeFormat')));
const bar2=el('div',{class:'wc-bar',role:'toolbar','aria-label':'삽입과 파일'},
  B('표',addTable),sel('표 편집',[['rowBefore','위에 행 추가'],['rowAfter','아래에 행 추가'],['colBefore','왼쪽에 열 추가'],['colAfter','오른쪽에 열 추가'],['delRow','행 삭제'],['delCol','열 삭제'],['delTable','표 삭제']],tableOp),
  B('이미지',addImage),B('링크',addLink),B('가로선',()=>insertHTML('<hr><p><br></p>')),B('쪽 나누기',()=>insertHTML('<div class="wc-pb" contenteditable="false"></div><p><br></p>')),B('목차',makeToc),
  B('실행 취소',()=>cmd('undo'),'Ctrl+Z'),B('다시 실행',()=>cmd('redo'),'Ctrl+Y'),
  YC.btn('가져오기',importFile,{primary:true}),
  sel('내보내기',[['docx','.docx'],['html','.html'],['md','Markdown'],['txt','텍스트']],exportAs),B('인쇄 / PDF',()=>{window.print()},'인쇄 창에서 PDF로 저장을 고르세요'));
const fi=el('input',{type:'text','aria-label':'찾을 내용',placeholder:'찾기'}),ri=el('input',{type:'text','aria-label':'바꿀 내용',placeholder:'바꾸기'}),cs=el('input',{type:'checkbox','aria-label':'대소문자 구분'});
const findBox=el('div',{class:'wc-bar',role:'search'},fi,ri,el('label',null,cs,' 대소문자'),
  YC.btn('찾기',()=>{const n=find(fi.value,cs.checked);say(n?n+'개 찾음':'찾지 못했습니다.',!n);findNext()}),YC.btn('다음',findNext),
  YC.btn('모두 바꾸기',()=>{const n=replaceAll(fi.value,ri.value,cs.checked);say(n+'개를 바꿨습니다.',!n)}),YC.btn('강조 지우기',clearMarks));
fi.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!hits.length)find(fi.value,cs.checked);findNext()}});
const wrap=el('div',{class:'wc-wrap'},out,el('div',{class:'wc-scroll'},ed));
const st=YC._status;
for(const n of[bar1,bar2,findBox,wrap,stat])root.insertBefore(n,st);
root.insertBefore(el('p',{class:'ycp-note'},'지원하지 않는 항목: .docx 가져오기, 변경 추적, 각주, 머리글·바닥글, 실시간 공동 편집. .docx 내보내기에는 이미지와 글꼴 크기가 담기지 않습니다. PDF는 브라우저 인쇄 창에서 저장합니다.'),st);
refresh();
window.__wordcraft={ed,sanitize,toMd,toText,mdToHtml,buildDocx,find,replaceAll,htmlOf,tableOp,makeToc};
})();
