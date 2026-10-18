/* YouthCraft Studio helpers: local autosave, portable project snapshots, keyboard help */
(()=>{'use strict';
const KEY='youthcraft.autosave.'+location.pathname;
const style=document.createElement('style');style.textContent=`
#yc-workspace-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 14px;background:#17171c;border-bottom:1px solid #36363f;position:sticky;top:0;z-index:50}
#yc-workspace-tools .yc-label{font-size:10px;letter-spacing:.12em;color:#a8a8b2;margin-right:auto}
#yc-workspace-tools button{font:inherit;font-size:11px;border:1px solid #454550;border-radius:7px;background:#25252d;color:#f6f6f8;padding:7px 10px;cursor:pointer}
#yc-workspace-tools button:hover{border-color:#70f0bd;color:#70f0bd}
#yc-workspace-tools .yc-status{font-size:10px;color:#70f0bd;min-width:78px}
#yc-modal{position:fixed;inset:0;background:#000a;z-index:1000;display:none;place-items:center;padding:18px}
#yc-modal>div{background:#1a1a20;border:1px solid #454550;border-radius:12px;padding:20px;max-width:440px;width:100%;color:#f6f6f8}
#yc-modal h2{font-size:18px;margin:0 0 10px}#yc-modal p{font-size:12px;color:#b8b8c1;line-height:1.7}
#yc-modal button{margin-top:10px;padding:8px 12px;background:#70f0bd;color:#111;border:0;border-radius:7px;cursor:pointer}
`;document.head.append(style);
const bar=document.createElement('div');bar.id='yc-workspace-tools';bar.innerHTML='<span class="yc-label">YOUTHCRAFT WORKSPACE</span><span class="yc-status" id="yc-status">자동 저장 준비</span><button id="yc-save">프로젝트 저장</button><button id="yc-load">프로젝트 열기</button><button id="yc-help">단축키 / 도움말</button><input id="yc-file" type="file" accept=".ycproject,.json,application/json" hidden>';
const header=document.querySelector('header');if(header)header.insertAdjacentElement('afterend',bar);else document.body.prepend(bar);
const status=t=>{const e=document.getElementById('yc-status');if(e)e.textContent=t};
const controls=()=>Array.from(document.querySelectorAll('input,textarea,select')).filter(e=>e.id&&e.type!=='file'&&!e.closest('#yc-workspace-tools'));
const snapshot=()=>({format:'YouthCraftProject',version:1,tool:document.title,path:location.pathname,savedAt:new Date().toISOString(),fields:controls().map(e=>({id:e.id,type:e.type,value:e.type==='checkbox'?e.checked:e.value})),canvas:(()=>{const c=document.querySelector('canvas');try{return c&&c.width&&c.height?{width:c.width,height:c.height,data:c.toDataURL('image/png')}:null}catch(_){return null}})()});
let timer;function autosave(){clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(snapshot()));status('자동 저장됨')}catch(_){status('자동 저장 제한됨')}},450)}
controls().forEach(e=>{e.addEventListener('input',autosave);e.addEventListener('change',autosave)});
try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);(data.fields||[]).forEach(f=>{const e=document.getElementById(f.id);if(e&&e.type!=='file'){if(e.type==='checkbox')e.checked=!!f.value;else e.value=f.value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}});status('이전 작업 복원됨')}}catch(_){}
function download(){const data=snapshot();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='youthcraft-project.ycproject';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);status('프로젝트 파일 저장됨')}
document.getElementById('yc-save').onclick=download;
document.getElementById('yc-load').onclick=()=>document.getElementById('yc-file').click();
document.getElementById('yc-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.format!=='YouthCraftProject'||!Array.isArray(data.fields))throw Error('형식이 다릅니다');data.fields.forEach(f=>{const el=document.getElementById(f.id);if(el&&el.type!=='file'){if(el.type==='checkbox')el.checked=!!f.value;else el.value=f.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}});if(data.canvas&&data.canvas.data){const target=document.querySelector('canvas');if(target){const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);const stage=document.querySelector('.stage');if(stage){stage.replaceChildren(c);status('미리보기 복원됨 · 편집 가능한 요소는 원본 앱 상태에 따라 다를 수 있습니다')}else status('프로젝트 입력값 복원됨')};im.src=data.canvas.data}}localStorage.setItem(KEY,JSON.stringify(data));status('프로젝트를 불러왔습니다')}catch(err){alert('프로젝트 파일을 열지 못했습니다. YouthCraft에서 저장한 .ycproject 파일인지 확인해 주세요.')}e.target.value=''};
const modal=document.createElement('div');modal.id='yc-modal';modal.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="yc-help-title"><h2 id="yc-help-title">작업을 더 편하게</h2><p><b>Ctrl / ⌘ + S</b> 프로젝트 파일 저장<br><b>Ctrl / ⌘ + Shift + S</b>도구에서 지원하는 경우 별도 내보내기<br><b>자동 저장</b> 같은 브라우저에서 다시 열면 입력값을 복원합니다.<br><br>프로젝트 파일은 작업 입력값과 가능한 경우 캔버스 미리보기를 담습니다. 원본 이미지·영상·오디오 파일 자체를 포함하지 않을 수 있으므로 원본도 따로 보관해 주세요.</p><button id="yc-close">확인</button></div>';document.body.append(modal);document.getElementById('yc-help').onclick=()=>modal.style.display='grid';document.getElementById('yc-close').onclick=()=>modal.style.display='none';modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none'});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();download()}if(e.key==='Escape')modal.style.display='none'});
})();