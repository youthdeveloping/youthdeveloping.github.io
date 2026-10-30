/* GridCraft 파일 입출력 — CSV/TSV, .xlsx(OOXML) 읽기·쓰기. 외부 라이브러리 없이 ZIP 을 직접 다룹니다. */
(function(root){'use strict';
const G=root.YCGridCalc||(typeof require!=='undefined'?require('./gridcalc.js'):null);
const {colName,colNum,formatValue,isErr}=G;
/* ---------- CSV ---------- */
function parseCSV(text,delim){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  if(!delim){const first=text.split(/\r?\n/,5).join('\n');const cnt=d=>(first.match(new RegExp(d==='\t'?'\t':'\\'+d,'g'))||[]).length;delim=['\t',';',','].sort((a,b)=>cnt(b)-cnt(a))[0];if(!cnt(delim))delim=','}
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"'&&cur==='')q=true;
    else if(ch===delim){row.push(cur);cur=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur=''}
    else cur+=ch}
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return{rows,delim};
}
function toCSV(rows,delim=','){const esc=s=>{s=String(s);return s.includes(delim)||/["\n\r]/.test(s)||/^\s|\s$/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};return rows.map(r=>r.map(esc).join(delim)).join('\r\n')}
/* ---------- ZIP 쓰기(store) ---------- */
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u8=>{let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=crcT[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function zip(files){
  const enc=new TextEncoder(),parts=[],cent=[];let off=0;const d=new Date(),dosT=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dosD=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const u16=n=>[n&255,(n>>8)&255],u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255];
  for(const f of files){const nm=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
    const lh=new Uint8Array([0x50,0x4b,3,4,20,0,0,8,0,0,...u16(dosT),...u16(dosD),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),0,0]);
    parts.push(lh,nm,data);
    cent.push(new Uint8Array([0x50,0x4b,1,2,20,0,20,0,0,8,0,0,...u16(dosT),...u16(dosD),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(off)]),nm);
    off+=lh.length+nm.length+data.length}
  const cs=cent.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cs),...u32(off),0,0]);
  return new Blob([...parts,...cent,end],{type:'application/zip'});
}
/* ---------- ZIP 읽기 ---------- */
async function inflateRaw(u8){const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}
async function unzip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf);let e=u8.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('ZIP 형식이 아닙니다.');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out={},dec=new TextDecoder();
  for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true),name=dec.decode(u8.subarray(p+46,p+46+nl));
    p+=46+nl+xl+cl;if(name.endsWith('/'))continue;
    const lnl=dv.getUint16(lo+26,true),lxl=dv.getUint16(lo+28,true),ds=lo+30+lnl+lxl,raw=u8.subarray(ds,ds+csz);
    out[name]=method===0?raw:method===8?await inflateRaw(raw):null}
  return out;
}
/* ---------- XLSX 쓰기 ---------- */
const xe=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
function writeXlsx(model){
  // model: {sheets:[{name,rows:[{r,cells:[{c,type,v,f,style}]}],colW,rowH,merges,freeze}], styles:[{b,i,col,bg,al,wrap,fmt,bd}]}
  const styles=model.styles,fonts=['<font><sz val="11"/><name val="Malgun Gothic"/></font>'],fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'],borders=['<border><left/><right/><top/><bottom/><diagonal/></border>'],numFmts=[],xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const idx=(arr,x)=>{let i=arr.indexOf(x);if(i<0){arr.push(x);i=arr.length-1}return i};
  const builtin={'General':0,'0':1,'0.00':2,'#,##0':3,'#,##0.00':4,'0%':9,'0.00%':10,'0.00E+00':11,'yyyy-mm-dd':14};
  const rgb=h=>'FF'+h.replace('#','').toUpperCase();
  const xfOf=st=>{if(!st)return 0;const key=JSON.stringify(st);if(xfOf.m[key]!==undefined)return xfOf.m[key];
    const font='<font>'+(st.b?'<b/>':'')+(st.i?'<i/>':'')+'<sz val="11"/>'+(st.col?'<color rgb="'+rgb(st.col)+'"/>':'')+'<name val="Malgun Gothic"/></font>';
    const fid=idx(fonts,font),fill=st.bg?'<fill><patternFill patternType="solid"><fgColor rgb="'+rgb(st.bg)+'"/><bgColor indexed="64"/></patternFill></fill>':null,flid=fill?idx(fills,fill):0;
    const bd=st.bd||'',side=(k,n)=>bd.includes(k)?'<'+n+' style="thin"><color auto="1"/></'+n+'>':'<'+n+'/>';
    const bid=bd?idx(borders,'<border>'+side('l','left')+side('r','right')+side('t','top')+side('b','bottom')+'<diagonal/></border>'):0;
    let nf=0;if(st.fmt&&st.fmt!=='General'){if(builtin[st.fmt]!==undefined)nf=builtin[st.fmt];else{nf=164+idx(numFmts,st.fmt)}}
    const al=(st.al||st.wrap)?'<alignment'+(st.al?' horizontal="'+({l:'left',c:'center',r:'right'}[st.al]||'general')+'"':'')+(st.wrap?' wrapText="1"':'')+' vertical="center"/>':'';
    xfs.push('<xf numFmtId="'+nf+'" fontId="'+fid+'" fillId="'+flid+'" borderId="'+bid+'" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"'+(al?' applyAlignment="1">'+al+'</xf>':'/>'));
    return xfOf.m[key]=xfs.length-1};xfOf.m={};
  const files=[],sheetXml=[];
  model.sheets.forEach((sh,si)=>{
    let x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if(sh.freeze&&(sh.freeze.r||sh.freeze.c)){const f=sh.freeze;x+='<sheetViews><sheetView workbookViewId="0"'+(si===0?' tabSelected="1"':'')+'><pane'+(f.c?' xSplit="'+f.c+'"':'')+(f.r?' ySplit="'+f.r+'"':'')+' topLeftCell="'+colName(f.c)+(f.r+1)+'" activePane="'+(f.r&&f.c?'bottomRight':f.r?'bottomLeft':'topRight')+'" state="frozen"/></sheetView></sheetViews>'}
    else x+='<sheetViews><sheetView workbookViewId="0"'+(si===0?' tabSelected="1"':'')+'/></sheetViews>';
    x+='<sheetFormatPr defaultRowHeight="15"/>';
    const cw=Object.keys(sh.colW||{});if(cw.length)x+='<cols>'+cw.sort((a,b)=>a-b).map(k=>'<col min="'+(+k+1)+'" max="'+(+k+1)+'" width="'+Math.max(1,(sh.colW[k]/7)).toFixed(2)+'" customWidth="1"/>').join('')+'</cols>';
    x+='<sheetData>';
    for(const row of sh.rows){x+='<row r="'+(row.r+1)+'"'+(row.h!==undefined?(row.h===0?' hidden="1"':' ht="'+(row.h*0.75).toFixed(1)+'" customHeight="1"'):'')+'>';
      for(const c of row.cells){const ref=colName(c.c)+(row.r+1),s=xfOf(c.style),sa=s?' s="'+s+'"':'';
        if(c.f!==undefined){const fx='<f>'+xe(c.f)+'</f>';
          if(c.type==='n')x+='<c r="'+ref+'"'+sa+'>'+fx+'<v>'+c.v+'</v></c>';else if(c.type==='b')x+='<c r="'+ref+'"'+sa+' t="b">'+fx+'<v>'+(c.v?1:0)+'</v></c>';else if(c.type==='e')x+='<c r="'+ref+'"'+sa+' t="e">'+fx+'<v>'+xe(c.v)+'</v></c>';else x+='<c r="'+ref+'"'+sa+' t="str">'+fx+'<v>'+xe(c.v)+'</v></c>'}
        else if(c.type==='n')x+='<c r="'+ref+'"'+sa+'><v>'+c.v+'</v></c>';else if(c.type==='b')x+='<c r="'+ref+'"'+sa+' t="b"><v>'+(c.v?1:0)+'</v></c>';
        else if(c.type==='e')x+='<c r="'+ref+'"'+sa+' t="e"><v>'+xe(c.v)+'</v></c>';else if(c.type==='s')x+='<c r="'+ref+'"'+sa+' t="inlineStr"><is><t xml:space="preserve">'+xe(c.v)+'</t></is></c>';else x+='<c r="'+ref+'"'+sa+'/>'}
      x+='</row>'}
    x+='</sheetData>';
    if(sh.merges&&sh.merges.length)x+='<mergeCells count="'+sh.merges.length+'">'+sh.merges.map(m=>'<mergeCell ref="'+colName(m.c1)+(m.r1+1)+':'+colName(m.c2)+(m.r2+1)+'"/>').join('')+'</mergeCells>';
    x+='</worksheet>';sheetXml.push(x)});
  const styleXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+(numFmts.length?'<numFmts count="'+numFmts.length+'">'+numFmts.map((f,i)=>'<numFmt numFmtId="'+(164+i)+'" formatCode="'+xe(f)+'"/>').join('')+'</numFmts>':'')+
    '<fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  files.push({name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+model.sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'});
  files.push({name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
  files.push({name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+model.sheets.map((s,i)=>'<sheet name="'+xe(s.name.slice(0,31))+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets>'+
    (model.names&&model.names.length?'<definedNames>'+model.names.map(n=>'<definedName name="'+xe(n.name)+'">'+xe(n.ref)+'</definedName>').join('')+'</definedNames>':'')+'</workbook>'});
  files.push({name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+model.sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(model.sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'});
  files.push({name:'xl/styles.xml',data:styleXml});
  sheetXml.forEach((x,i)=>files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:x}));
  return zip(files);
}
/* ---------- XLSX 읽기 ---------- */
const BUILTIN_FMT={1:'0',2:'0.00',3:'#,##0',4:'#,##0.00',9:'0%',10:'0.00%',11:'0.00E+00',14:'yyyy-mm-dd',15:'d-mmm-yy',16:'d-mmm',17:'mmm-yy',18:'h:mm AM/PM',19:'h:mm:ss AM/PM',20:'h:mm',21:'h:mm:ss',22:'yyyy-mm-dd hh:mm',37:'#,##0;(#,##0)',38:'#,##0;(#,##0)',39:'#,##0.00;(#,##0.00)',40:'#,##0.00;(#,##0.00)',45:'mm:ss',46:'[h]:mm:ss',47:'mm:ss.0',48:'##0.0E+0'};
async function readXlsx(buf){
  const files=await unzip(buf),dec=new TextDecoder(),P=new DOMParser();
  const xml=n=>{if(!files[n])return null;return P.parseFromString(dec.decode(files[n]),'application/xml')};
  const warn=[];
  if(!files['xl/workbook.xml'])throw new Error('.xlsx 파일이 아닙니다.');
  for(const k of Object.keys(files)){if(/pivotCache|pivotTables\//.test(k)&&!warn.includes('피벗 테이블(값만 가져옴)'))warn.push('피벗 테이블(값만 가져옴)');if(/externalLinks\//.test(k)&&!warn.includes('외부 통합 문서 링크'))warn.push('외부 통합 문서 링크');if(/charts\//.test(k)&&!warn.includes('차트'))warn.push('차트');if(/drawings\//.test(k)&&!warn.includes('도형·그림'))warn.push('도형·그림');if(/vbaProject/.test(k)&&!warn.includes('매크로'))warn.push('매크로')}
  const ss=[];const sdoc=xml('xl/sharedStrings.xml');if(sdoc)for(const si of sdoc.getElementsByTagName('si')){let t='';for(const x of si.getElementsByTagName('t'))if(x.parentNode.nodeName!=='rPh')t+=x.textContent;ss.push(t)}
  const fmtCodes={},xfFmt=[],xfStyle=[];const st=xml('xl/styles.xml');
  const fonts=[],fills=[],bords=[];
  if(st){for(const nf of st.getElementsByTagName('numFmt'))fmtCodes[nf.getAttribute('numFmtId')]=nf.getAttribute('formatCode');
    const lst=(tag)=>{const e=st.getElementsByTagName(tag)[0];return e?[...e.children]:[]};
    for(const f of lst('fonts'))fonts.push({b:!!f.getElementsByTagName('b')[0],i:!!f.getElementsByTagName('i')[0],col:(f.getElementsByTagName('color')[0]||{getAttribute:()=>null}).getAttribute('rgb')});
    for(const f of lst('fills')){const fg=f.getElementsByTagName('fgColor')[0];fills.push(fg&&f.getElementsByTagName('patternFill')[0]&&f.getElementsByTagName('patternFill')[0].getAttribute('patternType')==='solid'?fg.getAttribute('rgb'):null)}
    for(const b of lst('borders')){let s='';for(const[k,n]of[['l','left'],['r','right'],['t','top'],['b','bottom']]){const e=b.getElementsByTagName(n)[0];if(e&&e.getAttribute('style'))s+=k}bords.push(s)}
    const xfs=st.getElementsByTagName('cellXfs')[0];if(xfs)for(const xf of xfs.children){const id=xf.getAttribute('numFmtId'),code=fmtCodes[id]||BUILTIN_FMT[id]||null;xfFmt.push(code);
      const fo=fonts[+xf.getAttribute('fontId')]||{},fl=fills[+xf.getAttribute('fillId')],bd=bords[+xf.getAttribute('borderId')],al=xf.getElementsByTagName('alignment')[0];
      const s={};if(fo.b)s.b=1;if(fo.i)s.i=1;if(fo.col&&fo.col!=='FF000000')s.col='#'+fo.col.slice(-6);if(fl&&fl!=='FFFFFFFF')s.bg='#'+fl.slice(-6);if(bd)s.bd=bd;if(code&&code!=='General')s.fmt=code;
      if(al){const h=al.getAttribute('horizontal');if(h==='left')s.al='l';else if(h==='center')s.al='c';else if(h==='right')s.al='r';if(al.getAttribute('wrapText')==='1')s.wrap=1}
      xfStyle.push(Object.keys(s).length?s:null)}}
  const wb=xml('xl/workbook.xml'),rels=xml('xl/_rels/workbook.xml.rels'),relMap={};if(rels)for(const r of rels.getElementsByTagName('Relationship'))relMap[r.getAttribute('Id')]=r.getAttribute('Target');
  const sheets=[];
  for(const s of wb.getElementsByTagName('sheet')){
    const rid=s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');let tgt=relMap[rid]||'';tgt=tgt.replace(/^\//,'');const path=tgt.startsWith('xl/')?tgt:'xl/'+tgt;
    const d=xml(path);if(!d){warn.push('시트 '+s.getAttribute('name')+' 읽기 실패');continue}
    const out={name:s.getAttribute('name'),cells:[],colW:{},merges:[],freeze:{r:0,c:0},rowH:{}};
    for(const c of d.getElementsByTagName('col')){const w=parseFloat(c.getAttribute('width')),mn=+c.getAttribute('min'),mx=Math.min(+c.getAttribute('max'),mn+50);if(w&&c.getAttribute('customWidth')==='1')for(let k=mn;k<=mx;k++)out.colW[k-1]=Math.round(w*7)}
    const pane=d.getElementsByTagName('pane')[0];if(pane&&pane.getAttribute('state')==='frozen'){out.freeze={c:+(pane.getAttribute('xSplit')||0),r:+(pane.getAttribute('ySplit')||0)}}
    for(const mc of d.getElementsByTagName('mergeCell')){const m=/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(mc.getAttribute('ref'));if(m)out.merges.push({c1:colNum(m[1]),r1:+m[2]-1,c2:colNum(m[3]),r2:+m[4]-1})}
    for(const row of d.getElementsByTagName('row')){if(row.getAttribute('hidden')==='1')out.rowH[+row.getAttribute('r')-1]=0;
      for(const c of row.getElementsByTagName('c')){const m=/^([A-Z]+)(\d+)$/.exec(c.getAttribute('r'));if(!m)continue;const t=c.getAttribute('t'),si=+(c.getAttribute('s')||0);
        const fe=c.getElementsByTagName('f')[0],ve=c.getElementsByTagName('v')[0];let v=null;
        if(t==='s'&&ve)v=ss[+ve.textContent];else if(t==='inlineStr')v=[...c.getElementsByTagName('t')].map(x=>x.textContent).join('');else if(t==='b'&&ve)v=ve.textContent==='1';else if(t==='e'&&ve)v=ve.textContent;else if(t==='str'&&ve)v=ve.textContent;else if(ve&&ve.textContent!=='')v=+ve.textContent;
        out.cells.push({r:+m[2]-1,c:colNum(m[1]),v,f:fe&&fe.textContent?fe.textContent:null,fe:fe?fe.getAttribute('t'):null,t,style:xfStyle[si]||null})}}
    sheets.push(out)}
  const names=[];for(const n of wb.getElementsByTagName('definedName')){if(!/^_xlnm/.test(n.getAttribute('name')))names.push({name:n.getAttribute('name'),ref:n.textContent})}
  return{sheets,names,warn};
}
const api={parseCSV,toCSV,zip,unzip,writeXlsx,readXlsx,crc32};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.YCGridIO=api;
})(typeof window!=='undefined'?window:globalThis);
