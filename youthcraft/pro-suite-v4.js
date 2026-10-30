(()=>{'use strict';if(window.__YC_SUITE_V4__)return;window.__YC_SUITE_V4__=true;
const title=(document.title.split('—')[0]||'').trim(),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],stage=$('#stage')||$('.stage'),tools=$('#yc-advanced-v3 #yc3-tools');
if(!stage)return;
const panel=document.createElement('section');panel.id='yc-suite-v4';panel.style.cssText='margin:14px;padding:14px;background:#20232b;border:1px solid #444958;border-radius:10px;color:#eee;font:13px/1.5 system-ui';
panel.innerHTML='<h2 style="margin:0 0 8px;font-size:16px">전문 편집 기능 확장</h2><div id="yc-v4-toolbar" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"></div><div id="yc-v4-work"></div><p id="yc-v4-status" style="font-size:11px;color:#8eddb9;margin:8px 0 0">준비됨</p>';
const base=$('#yc-advanced-v3')||stage.parentElement; if(base)base.insertAdjacentElement('afterend',panel);
const bar=$('#yc-v4-toolbar'),work=$('#yc-v4-work'),status=$('#yc-v4-status');
const say=s=>status.textContent=s;
function btn(t,fn){const b=document.createElement('button');b.type='button';b.textContent=t;b.style.cssText='padding:7px 10px;background:#343944;color:#fff;border:1px solid #555e70;border-radius:5px;cursor:pointer';b.onclick=fn;bar.append(b);return b}
function field(label,type='text',value=''){const l=document.createElement('label');l.style.cssText='display:inline-grid;gap:4px;margin:5px 8px 5px 0;color:#b9c0ce;font-size:11px';l.textContent=label;const i=document.createElement('input');i.type=type;i.value=value;i.style.cssText='max-width:170px;padding:6px;background:#171a21;color:#fff;border:1px solid #50596b;border-radius:4px';l.append(i);work.append(l);return i}
function card(t,desc){const d=document.createElement('div');d.style.cssText='padding:10px;margin:8px 0;background:#191c23;border:1px solid #394151;border-radius:7px';const h=document.createElement('b');h.textContent=t;d.append(h);if(desc){const p=document.createElement('p');p.textContent=desc;p.style.cssText='margin:4px 0;color:#aeb7c7;font-size:11px';d.append(p)}work.append(d);return d}
function download(name,data,mime){const u=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
if(title==='WordCraft'){
 const c=card('문서 편집 도구','문단 서식, 목록, 표, 검색 및 파일 내보내기를 지원합니다.');
 let ed=$('[contenteditable=true]',stage)||$('.output[contenteditable=true]',stage);
 if(!ed){const ta=$('textarea',stage);ed=document.createElement('article');ed.contentEditable='true';ed.spellcheck=true;ed.style.cssText='min-height:420px;padding:28px;background:#fff;color:#222;border-radius:5px;outline:none;white-space:pre-wrap';ed.innerHTML=ta?ta.value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>'):'문서를 입력하세요.';if(ta)ta.hidden=true;stage.append(ed)}
 ed.style.cssText+=';min-height:420px;padding:28px;background:#fff;color:#222;border-radius:5px;outline:none;white-space:pre-wrap;line-height:1.7';
 const fmt=(cmd,val)=>{ed.focus();document.execCommand(cmd,false,val);say('서식을 적용했습니다.')};
 const tools=[['굵게',()=>fmt('bold')],['기울임',()=>fmt('italic')],['밑줄',()=>fmt('underline')],['제목 1',()=>fmt('formatBlock','h1')],['제목 2',()=>fmt('formatBlock','h2')],['본문',()=>fmt('formatBlock','p')],['글머리표',()=>fmt('insertUnorderedList')],['번호 목록',()=>fmt('insertOrderedList')],['왼쪽',()=>fmt('justifyLeft')],['가운데',()=>fmt('justifyCenter')],['오른쪽',()=>fmt('justifyRight')],['실행 취소',()=>fmt('undo')],['다시 실행',()=>fmt('redo')]];
 tools.forEach(([t,f])=>{const b=document.createElement('button');b.textContent=t;b.onclick=f;b.style.cssText='margin:3px;padding:6px 8px;background:#343944;color:#fff;border:1px solid #555e70;border-radius:4px';c.append(b)});
 const color=field('글자 색','color','#222222'),size=field('글자 크기(px)','number','16');btn('색상 적용',()=>fmt('foreColor',color.value));btn('크기 적용',()=>{ed.focus();document.execCommand('fontSize',false,'7');$$('font[size="7"]',ed).forEach(x=>{x.removeAttribute('size');x.style.fontSize=Math.max(8,Math.min(96,+size.value||16))+'px'})});
 btn('표 삽입',()=>{ed.focus();const rows=Math.max(1,Math.min(20,+prompt('행 수','3')||3)),cols=Math.max(1,Math.min(12,+prompt('열 수','3')||3));let h='<table style="border-collapse:collapse;width:100%" border="1">';for(let r=0;r<rows;r++){h+='<tr>';for(let k=0;k<cols;k++)h+='<td style="padding:8px">&nbsp;</td>';h+='</tr>'}h+='</table><p><br></p>';document.execCommand('insertHTML',false,h)});
 const find=field('찾을 문구','text',''),replace=field('바꿀 문구','text','');btn('찾기',()=>{const text=ed.innerText||'';const at=text.toLocaleLowerCase().indexOf(find.value.toLocaleLowerCase());if(at<0||!find.value)return say('문구를 찾지 못했습니다.');const walker=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let n,offset=at;while(n=walker.nextNode()){if(offset<=n.textContent.length){const range=document.createRange();range.setStart(n,offset);range.setEnd(n,Math.min(n.textContent.length,offset+find.value.length));const sel=getSelection();sel.removeAllRanges();sel.addRange(range);say('문구를 찾았습니다.');return}offset-=n.textContent.length} });
 btn('모두 바꾸기',()=>{if(!find.value)return;const walker=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let n,count=0;while(n=walker.nextNode()){const before=n.textContent,after=before.split(find.value).join(replace.value);if(before!==after){count+=(before.length-after.length+replace.value.length)/(find.value.length+replace.value.length)||1;n.textContent=after}}say('바꾸기 작업을 완료했습니다.');});
 btn('단어 수',()=>{const t=ed.innerText.trim();say('글자 '+t.length+'자 · 단어 '+(t?t.split(/\s+/).length:0)+'개 · 문단 '+(t?t.split(/\n+/).filter(Boolean).length:0)+'개')});
 btn('HTML 저장',()=>download('wordcraft.html','<!doctype html><meta charset="utf-8"><article>'+ed.innerHTML+'</article>','text/html;charset=utf-8'));
 btn('텍스트 저장',()=>download('wordcraft.txt',ed.innerText,'text/plain;charset=utf-8'));btn('인쇄 / PDF',()=>{const w=window.open('','_blank');if(!w)return say('팝업을 허용해 주세요.');w.document.write('<meta charset="utf-8"><style>body{font:16px/1.7 serif;max-width:800px;margin:40px auto}table{border-collapse:collapse}td{border:1px solid #aaa;padding:8px}</style>'+ed.innerHTML);w.document.close();w.print()});
}
if(title==='FilmCraft'||title==='SoundCraft'||title==='EffectCraft'){
 const c=card('클립 구간 편집','미디어 파일의 재생 구간을 지정하고 구간 미리보기를 할 수 있습니다. 원본 파일 자체를 재인코딩하지는 않습니다.');
 const f=field('시작 시간(초)','number','0'),e=field('끝 시간(초)','number','0');f.min=e.min=0;f.step=e.step='.01';
 const media=$$('video,audio',stage);const m=media[0];
 if(m){m.addEventListener('loadedmetadata',()=>{e.value=m.duration.toFixed(2);say('미디어 길이 '+m.duration.toFixed(2)+'초')});btn('현재 위치를 시작점으로',()=>f.value=m.currentTime.toFixed(2));btn('현재 위치를 끝점으로',()=>e.value=m.currentTime.toFixed(2));btn('구간 재생',()=>{const a=Math.max(0,+f.value||0),z=Math.min(m.duration,+e.value||m.duration);if(z<=a)return say('끝 시간은 시작 시간보다 커야 합니다.');m.currentTime=a;m.play();const stop=()=>{if(m.currentTime>=z){m.pause();m.removeEventListener('timeupdate',stop)}};m.addEventListener('timeupdate',stop);say(a.toFixed(2)+'초부터 '+z.toFixed(2)+'초까지 재생합니다.')});btn('구간 정보 저장',()=>download(title.toLowerCase()+'-clip.json',JSON.stringify({file:m.currentSrc,start:Number(f.value),end:Number(e.value),duration:m.duration},null,2),'application/json'))}
 else say('먼저 도구의 파일 추가 기능으로 미디어를 불러오세요.');
}
if(title==='DeckCraft'){
 const c=card('슬라이드 편집 보조','현재 페이지의 슬라이드 요소를 탐색하고 순서를 바꾸거나 복제·삭제할 수 있습니다.');
 const findSlides=()=>$$('.slide,[data-slide],.deck-slide',stage);
 const list=document.createElement('div');list.style.cssText='display:grid;gap:6px;margin-top:8px';c.append(list);
 function refresh(){list.replaceChildren();const slides=findSlides();slides.forEach((s,i)=>{const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;align-items:center;padding:6px;background:#252a34;border-radius:5px';const label=document.createElement('span');label.textContent=(i+1)+'. '+(s.querySelector('h1,h2,h3')?.textContent||s.textContent.trim().slice(0,35)||'슬라이드');label.style.flex='1';row.append(label);[['↑',-1],['↓',1],['복제',0],['삭제',2]].forEach(([t,n])=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{if(n===-1&&s.previousElementSibling)stage.insertBefore(s,s.previousElementSibling);else if(n===1&&s.nextElementSibling)stage.insertBefore(s.nextElementSibling,s);else if(n===0)s.after(s.cloneNode(true));else if(n===2){if(findSlides().length<=1)return say('마지막 슬라이드는 삭제할 수 없습니다.');s.remove()}refresh();say('슬라이드 구성을 변경했습니다.')};row.append(b)});list.append(row)})}
 btn('슬라이드 목록 새로고침',refresh);refresh();
}
if(title==='PdfCraft'){
 const c=card('PDF 페이지 작업','PDF 원본을 브라우저 미리보기로 확인하고 인쇄 대화상자를 이용해 PDF로 저장할 수 있습니다. 브라우저 내 병합·페이지 재배열은 PDF 전용 라이브러리가 연결되어야 합니다.');
 const f=field('PDF 파일','file');f.accept='application/pdf';const out=document.createElement('div');c.append(out);f.onchange=()=>{out.replaceChildren();const file=f.files?.[0];if(!file)return;if(file.size>80*1024*1024)return say('80MB 이하 파일을 선택해 주세요.');const url=URL.createObjectURL(file),frame=document.createElement('iframe');frame.src=url;frame.title='PDF 문서 미리보기';frame.style.cssText='width:100%;height:520px;background:white;border:0';out.append(frame);const p=document.createElement('p');p.textContent=file.name+' · '+(file.size/1048576).toFixed(2)+' MB';out.append(p);say('PDF를 불러왔습니다.')};
}
if(title==='GridCraft'){
 const c=card('GridCraft Pro 기능 안내','GridCraft에는 별도 수식 엔진, 다중 시트, 셀 서식, 정렬·필터, 차트, 데이터 유효성 검사 및 CSV 입출력 모듈이 연결되어 있습니다.');
 const info=document.createElement('p');info.textContent='수식 입력은 =SUM(A1:A10), =AVERAGE(B1:B10), IF, COUNTIF 등의 지원 함수와 셀 참조를 사용할 수 있습니다.';info.style.color='#c2c9d5';c.append(info);
}
})();