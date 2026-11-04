(()=>{'use strict';
if(window.__YC_PHOTOSHOP_APP__)return;window.__YC_PHOTOSHOP_APP__=true;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const layout=$('.layout'),stage=$('.stage'),left=$('aside.left'),right=$('aside.right'),workspace=$('.workspace');if(!layout||!stage||!workspace)return;
const css=document.createElement('style');css.id='yc-photoshop-app-css';css.textContent=`
:root{--ps-bg:#1e1e1e;--ps-panel:#252526;--ps-panel2:#2d2d30;--ps-border:#3b3b3b;--ps-text:#ddd;--ps-muted:#aaa;--ps-blue:#1683d8}
*{box-sizing:border-box}
html,body{width:100%;height:100%;min-height:0;margin:0!important;overflow:hidden!important;background:var(--ps-bg)!important;color:var(--ps-text)!important;font:12px/1.4 Arial,system-ui,sans-serif!important}
body{display:flex!important;flex-direction:column!important}
body>header{height:42px!important;min-height:42px!important;flex:0 0 42px!important;padding:0 12px!important;background:#202020!important;border-bottom:1px solid #111!important}
.brand{font-size:13px!important;gap:8px!important}.brand .logo{width:25px!important;height:25px!important;border-radius:4px!important;background:#1683d8!important;color:white!important}
.head-actions button{padding:6px 10px!important;border-radius:4px!important}
#yc-ps-menubar{height:29px;min-height:29px;flex:0 0 29px;display:flex;align-items:center;gap:1px;padding:0 8px;background:#282828;border-bottom:1px solid #111;overflow-x:auto}
#yc-ps-menubar button{border:0!important;background:transparent!important;border-radius:3px!important;padding:5px 10px!important;white-space:nowrap;color:#ddd!important;font-size:11px!important}
#yc-ps-menubar button:hover{background:#414141!important}
#yc-ps-context{height:36px;min-height:36px;flex:0 0 36px;display:flex;align-items:center;gap:7px;padding:4px 10px;background:#303030;border-bottom:1px solid #111;overflow-x:auto}
#yc-ps-context label{display:flex;align-items:center;gap:4px;color:#bbb;white-space:nowrap}
#yc-ps-context input{width:65px!important;padding:4px!important}
#yc-ps-context button{padding:5px 8px!important;white-space:nowrap}
.layout{flex:1 1 auto!important;min-height:0!important;height:auto!important;display:grid!important;grid-template-columns:54px minmax(0,1fr) 260px!important;overflow:hidden!important}
aside{min-width:0!important;min-height:0!important;height:100%!important;overflow:auto!important;padding:9px!important;background:#252526!important}
aside.left{border-right:1px solid #111!important}
aside.right{border-left:1px solid #111!important}
.group{margin-bottom:13px!important}.group-title{font-size:10px!important;color:#aaa!important;letter-spacing:.04em!important;margin:0 0 8px!important}
.tools{display:grid!important;grid-template-columns:1fr!important;gap:4px!important}
.tool{min-height:42px!important;padding:4px!important;align-items:center!important;justify-content:center!important;gap:1px!important;border-radius:4px!important;font-size:10px!important}
.tool span{font-size:17px!important}
button{border-radius:4px!important;background:#383838!important;border:1px solid #505050!important;color:#e8e8e8!important;padding:6px 9px!important;font-size:11px!important}
button:hover{background:#484848!important;border-color:#777!important}
.primary{background:#126fc0!important;border-color:#1683d8!important;color:white!important}
.field{margin:9px 0!important;gap:5px!important}.field label{font-size:10px!important;color:#bbb!important}
input[type=text],input[type=number],select{background:#1d1d1d!important;border:1px solid #555!important;border-radius:3px!important;padding:6px!important;color:#eee!important}
input[type=range]{accent-color:#1683d8!important}
.workspace{min-width:0!important;min-height:0!important;height:100%!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:#1e1e1e!important}
.workspace-top{height:32px!important;min-height:32px!important;flex:0 0 32px!important;padding:3px 8px!important;background:#292929!important;border-bottom:1px solid #111!important}
.edit-toolbar{height:37px!important;min-height:37px!important;flex:0 0 37px!important;overflow-x:auto!important;overflow-y:hidden!important;display:flex!important;align-items:center!important;gap:8px!important;padding:3px 8px!important;background:#303030!important;border-bottom:1px solid #111!important}
.toolbar-group{display:flex!important;align-items:center!important;gap:4px!important;white-space:nowrap!important}
.toolbar-label{font-size:10px!important;color:#aaa!important}
.toolbar-group label{font-size:10px!important;color:#bbb!important;display:flex!important;align-items:center!important;gap:3px!important}
.toolbar-group input{width:55px!important;padding:4px!important}
.stage{flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:24px!important;background-color:#383838!important;background-image:linear-gradient(45deg,#414141 25%,transparent 25%),linear-gradient(-45deg,#414141 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#414141 75%),linear-gradient(-45deg,transparent 75%,#414141 75%)!important;background-size:20px 20px!important;background-position:0 0,0 10px,10px -10px,-10px 0!important}
.canvas-wrap{flex:none!important;max-width:none!important;box-shadow:0 5px 24px #000a,0 0 0 1px #111!important;transform-origin:center center}
#canvas{display:block!important;max-width:none!important;height:auto!important}
.bottom-note{height:22px!important;min-height:22px!important;flex:0 0 22px!important;padding:3px 8px!important;background:#252526!important;border-top:1px solid #111!important;font-size:10px!important;color:#aaa!important}
.layer{border-radius:3px!important;background:#303030!important;padding:6px!important}.layer.selected{background:#164b75!important;border-color:#1683d8!important}
#yc-ps-panel-tabs{display:flex;gap:2px;margin:-2px -2px 10px;position:sticky;top:-9px;background:#252526;padding:2px 0;z-index:3}
#yc-ps-panel-tabs button{flex:1;padding:6px 3px!important;font-size:10px!important}
#yc-ps-panel-tabs button.active{background:#444!important;border-bottom:2px solid #1683d8!important}
.yc-ps-panel-hidden{display:none!important}
#yc-ps-status{height:23px;min-height:23px;flex:0 0 23px;display:flex;align-items:center;justify-content:space-between;padding:2px 9px;background:#252526;border-top:1px solid #111;color:#aaa;font-size:10px}
.yc-ps-pop{position:fixed;z-index:10000;top:74px;left:8px;min-width:190px;padding:6px;background:#2b2b2b;border:1px solid #555;box-shadow:0 8px 25px #0009}
.yc-ps-pop button{display:block;width:100%;text-align:left;border:0;background:transparent}
@media(max-width:850px){.layout{grid-template-columns:48px minmax(0,1fr) 205px!important}aside{padding:6px!important}.stage{padding:10px!important}}
@media(max-width:620px){.layout{grid-template-columns:42px minmax(0,1fr)!important}.layout>aside.right{display:none!important}.edit-toolbar{height:34px!important;min-height:34px!important;flex-basis:34px!important}}
`;document.head.append(css);
const header=$('body>header');const menu=document.createElement('nav');menu.id='yc-ps-menubar';menu.innerHTML='<button data-menu="file">파일</button><button data-menu="edit">편집</button><button data-menu="image">이미지</button><button data-menu="layer">레이어</button><button data-menu="select">선택</button><button data-menu="filter">필터</button><button data-menu="view">보기</button><button data-menu="window">창</button><button data-menu="help">도움말</button>';header.after(menu);
const context=document.createElement('div');context.id='yc-ps-context';context.innerHTML='<strong style="color:#ddd;white-space:nowrap">PhotoCraft</strong><span style="color:#777">|</span><label>도구 옵션</label><button id="yc-ps-fit">화면 맞춤</button><button id="yc-ps-actual">100%</button><label>확대 <input id="yc-ps-zoom" type="range" min="10" max="200" value="100"></label><span id="yc-ps-zoomval" style="min-width:36px">100%</span>';menu.after(context);
const status=document.createElement('div');status.id='yc-ps-status';status.innerHTML='<span id="yc-ps-dim">문서 없음</span><span>PhotoCraft · YouthDeveloper</span>';layout.after(status);
function fit(){const c=$('#canvas'),w=$('.canvas-wrap');if(!c||!w||w.classList.contains('hidden'))return;const area=stage.getBoundingClientRect(),scale=Math.min((area.width-48)/c.width,(area.height-48)/c.height,1);w.style.transform='scale('+Math.max(.05,scale)+')';$('#yc-ps-zoom').value=Math.round(scale*100);$('#yc-ps-zoomval').textContent=Math.round(scale*100)+'%';$('#yc-ps-dim').textContent=c.width+' × '+c.height+' px'}
function zoom(v){const w=$('.canvas-wrap');if(!w||w.classList.contains('hidden'))return;w.style.transform='scale('+v/100+')';$('#yc-ps-zoomval').textContent=v+'%';$('#yc-ps-zoom').value=v}
$('#yc-ps-fit').onclick=fit;$('#yc-ps-actual').onclick=()=>zoom(100);$('#yc-ps-zoom').oninput=e=>zoom(+e.target.value);
const ro=new ResizeObserver(()=>fit());ro.observe(stage);
const tabs=document.createElement('div');tabs.id='yc-ps-panel-tabs';tabs.innerHTML='<button data-tab="props" class="active">속성</button><button data-tab="layers">레이어</button><button data-tab="image">보정</button>';right.prepend(tabs);
const groups=$$('.group',right);groups.forEach((g,i)=>g.dataset.psPanel=i===0?'props':'layers');
function showTab(t){groups.forEach(g=>g.classList.toggle('yc-ps-panel-hidden',(t==='props'&&g.dataset.psPanel!=='props')||(t==='layers'&&g.dataset.psPanel!=='layers')||(t==='image'&&g.dataset.psPanel!=='props')));tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));if(t==='image'){const imageGroup=$$('.group',left).find(g=>g.textContent.includes('IMAGE'));if(imageGroup){imageGroup.style.display='block';imageGroup.scrollIntoView({block:'nearest'})}}}
tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
function action(which){const click=id=>$('#'+id)?.click();if(which==='open')click('openBtn');if(which==='save')click('saveBtn');if(which==='new')click('newBtn');if(which==='undo')click('undoBtn');if(which==='redo')click('redoBtn');if(which==='delete')click('deleteBtn');if(which==='fit')fit();if(which==='100')zoom(100);if(which==='flipH')click('flipH');if(which==='flipV')click('flipV');if(which==='rotateL')click('rotateLeft');if(which==='rotateR')click('rotateRight');if(which==='crop')click('applyCrop');if(which==='props')showTab('props');if(which==='layers')showTab('layers');if(which==='image')showTab('image');}
const menus={
 file:[['새 문서','new'],['열기…','open'],['PNG로 내보내기','save']],
 edit:[['실행 취소','undo'],['다시 실행','redo'],['삭제','delete']],
 image:[['왼쪽으로 90° 회전','rotateL'],['오른쪽으로 90° 회전','rotateR'],['좌우 반전','flipH'],['상하 반전','flipV'],['자르기 적용','crop']],
 layer:[['레이어 패널','layers'],['속성 패널','props']],
 select:[['선택 도구',()=>document.querySelector('[data-tool=select]')?.click()],['텍스트 도구',()=>document.querySelector('[data-tool=text]')?.click()]],
 filter:[['보정 패널 열기','image'],['보정 초기화',()=>$('#resetFilters')?.click()]],
 view:[['화면 맞춤','fit'],['100% 보기','100']],
 window:[['속성','props'],['레이어','layers'],['보정','image']],
 help:[['PhotoCraft 도움말',()=>alert('왼쪽 도구 모음에서 객체를 추가하고, 오른쪽 패널에서 속성과 레이어를 편집하세요. 상단 메뉴에서 파일·이미지·보기 명령을 사용할 수 있습니다.')]]
};
let pop=null;function closePop(){pop?.remove();pop=null}
menu.querySelectorAll('button').forEach(b=>b.onclick=()=>{closePop();const list=menus[b.dataset.menu];pop=document.createElement('div');pop.className='yc-ps-pop';list.forEach(([label,act])=>{const x=document.createElement('button');x.textContent=label;x.onclick=()=>{closePop();typeof act==='function'?act():action(act)};pop.append(x)});b.after(pop)});
document.addEventListener('click',e=>{if(pop&&!pop.contains(e.target)&&!menu.contains(e.target))closePop()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePop();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();action('open')}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();action('save')}});
const open=$('#openBtn');open?.addEventListener('click',()=>setTimeout(fit,250));$('#newBtn')?.addEventListener('click',()=>setTimeout(fit,250));$('#saveBtn')?.addEventListener('click',()=>{});
const originalRender=window.youthCraftProjectAdapter; // adapter remains owned by the editor
const resizeInputs=$$('#resizeW,#resizeH,#cropW,#cropH');resizeInputs.forEach(i=>i.addEventListener('change',()=>{}));
const rightGroup=$$('.group',right);if(rightGroup[1]){const layerTools=rightGroup[1];const head=layerTools.querySelector('h2');if(head)head.textContent='LAYERS / 레이어'}
const leftGroups=$$('.group',left);if(leftGroups[1])leftGroups[1].querySelector('.group-title').textContent='TYPE & SHAPES';
if(leftGroups[2])leftGroups[2].querySelector('.group-title').textContent='IMAGE ADJUSTMENTS';

// Extra editing features live in a dockable-style drawer, not below the canvas.
const extDrawer=document.createElement('div');extDrawer.id='yc-ps-extra-drawer';extDrawer.style.cssText='display:none;position:fixed;z-index:11000;inset:0;background:#0009;justify-content:flex-end';
extDrawer.innerHTML='<section style="width:min(650px,94vw);height:100%;overflow:auto;background:#252526;border-left:1px solid #555;padding:14px;box-shadow:-15px 0 40px #0009"><div style="display:flex;justify-content:space-between;align-items:center;position:sticky;top:-14px;background:#252526;padding:8px 0;z-index:3"><b>고급 편집 패널</b><button id="yc-ps-extra-close">닫기 ✕</button></div><div id="yc-ps-extra-content"></div></section>';
document.body.append(extDrawer);
const extContent=extDrawer.querySelector('#yc-ps-extra-content');
['yc-advanced-v3','yc-suite-v4'].forEach(id=>{const node=document.getElementById(id);if(node)extContent.append(node)});
function openExtras(){extDrawer.style.display='flex'}function closeExtras(){extDrawer.style.display='none'}
extDrawer.querySelector('#yc-ps-extra-close').onclick=closeExtras;extDrawer.addEventListener('click',e=>{if(e.target===extDrawer)closeExtras()});
const extraBtn=document.createElement('button');extraBtn.textContent='고급 기능 패널';extraBtn.onclick=openExtras;context.append(extraBtn);
const extraMenu=menus.window;extraMenu.push(['고급 기능 패널',openExtras]);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExtras()});
setTimeout(fit,120);window.addEventListener('load',fit);
})();