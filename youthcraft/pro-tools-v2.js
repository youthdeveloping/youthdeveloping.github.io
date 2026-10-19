/* YouthCraft expansion pack v2 — additional practical editing controls */
(()=>{'use strict';
const title=(document.title.split(' — ')[0]||'').trim(),$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const host=$('#yc-specific');if(!host)return;
const msg=$('#yc-message');const note=t=>{if(msg)msg.textContent=t};
const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.addEventListener('click',fn);host.append(b);return b};
const input=(label,type='text',value='')=>{const l=document.createElement('label');l.className='field';l.textContent=label;const i=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;i.value=value;l.append(i);host.append(l);return i};
const download=(name,data,type='text/plain;charset=utf-8')=>{const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
if(title==='GridCraft'){
 const table=$('table', $('#stage')||document);if(table){
 const rows=()=>$$('tr',table),cells=tr=>[...tr.children],val=td=>td.querySelector('input')?.value??td.textContent;
 button('행 추가',()=>{const tr=document.createElement('tr');for(let i=0;i<(rows()[0]?.children.length||5);i++){const td=document.createElement('td'),inp=document.createElement('input');inp.setAttribute('aria-label','새 행 셀 '+(i+1));td.append(inp);tr.append(td)}table.append(tr);note('행을 추가했습니다.')});
 button('선택 행 삭제',()=>{const r=rows();if(r.length<=1){note('최소 한 행은 남겨야 합니다.');return}const last=r[r.length-1];last.remove();note('마지막 행을 삭제했습니다.')});
 const sortCol=input('정렬할 열 번호','number','1');sortCol.min=1;
 button('선택 열 오름차순 정렬',()=>{const r=rows();if(r.length<2)return;const idx=Math.max(0,(+sortCol.value||1)-1),head=r[0],data=r.slice(1).sort((a,b)=>val(cells(a)[idx]).localeCompare(val(cells(b)[idx]),undefined,{numeric:true,sensitivity:'base'}));[head,...data].forEach(tr=>table.append(tr));note('첫 행을 제목으로 보고 나머지 행을 정렬했습니다.')});
 const query=input('행 필터 (포함할 글자)','text','');
 button('필터 적용',()=>{const r=rows();r.slice(1).forEach(tr=>tr.hidden=!!query.value&&!cells(tr).some(td=>val(td).toLowerCase().includes(query.value.toLowerCase())));note(query.value?'필터를 적용했습니다.':'필터를 해제했습니다.')});
 button('필터 초기화',()=>{rows().forEach(tr=>tr.hidden=false);query.value='';note('모든 행을 표시합니다.')});
 }
}
if(title==='DeckCraft'){
 const titleInput=$('#title'),bodyInput=$('#body'),bgInput=$('#bg');const read=()=>({title:titleInput?.value||'슬라이드',body:bodyInput?.value||'',bg:bgInput?.value||'#20243a'});
 const write=s=>{if(titleInput)titleInput.value=s.title;if(bodyInput)bodyInput.value=s.body;if(bgInput)bgInput.value=s.bg;[titleInput,bodyInput,bgInput].forEach(x=>x?.dispatchEvent(new Event('input',{bubbles:true})))};
 let slides=[read()],idx=0;const status=document.createElement('p');status.className='hint';host.append(status);
 const refresh=()=>status.textContent='슬라이드 '+(idx+1)+' / '+slides.length;
 button('슬라이드 복제',()=>{slides[idx]=read();slides.splice(idx+1,0,{...slides[idx]});idx++;write(slides[idx]);refresh()});
 button('슬라이드 위로 이동',()=>{if(idx===0)return;slides[idx]=read();[slides[idx-1],slides[idx]]=[slides[idx],slides[idx-1]];idx--;write(slides[idx]);refresh()});
 button('슬라이드 아래로 이동',()=>{if(idx>=slides.length-1)return;slides[idx]=read();[slides[idx+1],slides[idx]]=[slides[idx],slides[idx+1]];idx++;write(slides[idx]);refresh()});
 button('슬라이드 쇼 미리보기',()=>{slides[idx]=read();const w=window.open('','_blank');if(!w){note('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.');return}w.document.write('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>발표 미리보기</title><style>body{margin:0;background:#111;color:#fff;font:24px Arial}.slide{height:100vh;box-sizing:border-box;padding:8vw;display:none;page-break-after:always}.slide.active{display:block}button{position:fixed;bottom:20px;padding:12px}</style>'+slides.map((s,i)=>'<section class="slide '+(i===0?'active':'')+'" style="background:'+String(s.bg).replace(/[^#a-zA-Z0-9(),.% -]/g,'')+'"><h1>'+s.title.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</h1><p>'+s.body.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/\n/g,'<br>')+'</p></section>').join('')+'<button id="prev">← 이전</button><button id="next" style="right:20px">다음 →</button><script>let i=0,s=[...document.querySelectorAll(".slide")];function go(n){s[i].classList.remove("active");i=(n+s.length)%s.length;s[i].classList.add("active")}document.querySelector("#prev").onclick=()=>go(i-1);document.querySelector("#next").onclick=()=>go(i+1);document.onkeydown=e=>{if(e.key==="ArrowRight"||e.key===" ")go(i+1);if(e.key==="ArrowLeft")go(i-1)};<\/script>');w.document.close()});
 refresh();
}
if(title==='PhotoCraft'){
 const canvas=$('canvas', $('#stage')||document);if(canvas){
 const rotation=input('회전 각도 (도)','number','90');
 button('좌우 반전',()=>{const c=$('canvas', $('#stage')||document);if(!c)return;const tmp=document.createElement('canvas');tmp.width=c.width;tmp.height=c.height;tmp.getContext('2d').translate(c.width,0);tmp.getContext('2d').scale(-1,1);tmp.getContext('2d').drawImage(c,0,0);c.getContext('2d').clearRect(0,0,c.width,c.height);c.getContext('2d').drawImage(tmp,0,0);note('좌우 반전을 적용했습니다.')});
 button('상하 반전',()=>{const c=$('canvas', $('#stage')||document);if(!c)return;const tmp=document.createElement('canvas');tmp.width=c.width;tmp.height=c.height;const x=tmp.getContext('2d');x.translate(0,c.height);x.scale(1,-1);x.drawImage(c,0,0);c.getContext('2d').clearRect(0,0,c.width,c.height);c.getContext('2d').drawImage(tmp,0,0);note('상하 반전을 적용했습니다.')});
 button('회전 적용',()=>{const c=$('canvas', $('#stage')||document);if(!c)return;const a=(+rotation.value||0)*Math.PI/180,w=c.width,h=c.height,nw=Math.max(1,Math.ceil(Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a)))),nh=Math.max(1,Math.ceil(Math.abs(h*Math.cos(a))+Math.abs(w*Math.sin(a)))),tmp=document.createElement('canvas');tmp.width=nw;tmp.height=nh;const x=tmp.getContext('2d');x.translate(nw/2,nh/2);x.rotate(a);x.drawImage(c,-w/2,-h/2);c.width=nw;c.height=nh;c.getContext('2d').drawImage(tmp,0,0);note('회전을 적용했습니다.')});
 const crop=input('자르기 비율: 너비','number','800');const cropH=input('자르기 비율: 높이','number','600');
 button('중앙 자르기',()=>{const c=$('canvas', $('#stage')||document);if(!c)return;const w=Math.max(1,Math.min(c.width,+crop.value||c.width)),h=Math.max(1,Math.min(c.height,+cropH.value||c.height)),x=Math.floor((c.width-w)/2),y=Math.floor((c.height-h)/2),tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;tmp.getContext('2d').drawImage(c,x,y,w,h,0,0,w,h);c.width=w;c.height=h;c.getContext('2d').drawImage(tmp,0,0);note('중앙 기준으로 캔버스를 잘랐습니다.')});
 }
}
if(title==='LightCraft'){
 const c=$('canvas',$('#stage')||document);if(c){const old=document.createElement('canvas');old.width=c.width;old.height=c.height;old.getContext('2d').drawImage(c,0,0);button('보정 초기화',()=>{const cv=$('canvas',$('#stage')||document);cv.style.filter='';['brightness','contrast','saturation'].forEach(id=>{const i=$('#'+id);if(i)i.value=100});note('미리보기 필터를 초기화했습니다. 원본 픽셀은 보존되어 있어야 합니다.')});}
}
if(title==='EffectCraft'){
 const fps=input('재생 속도 (FPS)','number','8');fps.min=1;fps.max=30;const count=input('프레임 수','number','8');count.min=2;count.max=60;
 button('프레임 미리보기 재생',()=>{const canvas=$('canvas',$('#stage')||document);if(!canvas){note('미리보기 캔버스가 없습니다.');return}const ctx=canvas.getContext('2d'),total=Math.max(2,Math.min(60,+count.value||8)),rate=Math.max(1,Math.min(30,+fps.value||8));let frame=0;const paint=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#22263b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#70f0bd';ctx.beginPath();ctx.arc(100+(frame/(total-1))*Math.max(0,canvas.width-200),canvas.height/2,Math.min(60,canvas.height/8),0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText('프레임 '+(frame+1)+'/'+total,20,30);frame=(frame+1)%total;if(frame!==0)window.setTimeout(paint,1000/rate);else note('프레임 미리보기가 한 바퀴 재생되었습니다. GIF/영상 파일은 생성하지 않았습니다.')};paint()});
}
if(title==='SoundCraft'||title==='FilmCraft'){
 const media=$('video, audio',$('#stage')||document);if(media){const info=document.createElement('p');info.className='hint';info.textContent='파일의 브라우저 재생을 사용합니다. 인코딩·클립 렌더링 기능은 별도 구현이 필요합니다.';host.append(info);button('재생 위치 5초 뒤로',()=>media.currentTime=Math.max(0,media.currentTime-5));button('재생 위치 5초 앞으로',()=>{if(Number.isFinite(media.duration))media.currentTime=Math.min(media.duration,media.currentTime+5)});button('구간 반복 켜기/끄기',()=>{media.loop=!media.loop;note('구간 반복 '+(media.loop?'켜짐':'꺼짐'))})}
}
})();