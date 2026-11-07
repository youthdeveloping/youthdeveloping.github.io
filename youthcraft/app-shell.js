(()=>{'use strict';
if(window.__YC_APP_SHELL_V2__)return;window.__YC_APP_SHELL_V2__=true;
const ydDeviceScript=document.createElement('script');ydDeviceScript.src='/device-layout.js';ydDeviceScript.defer=true;document.head.append(ydDeviceScript);

const app=(document.title.split('—')[0]||'').trim();if(app==='FilmCraft'||app==='PhotoCraft')return;
const css=document.createElement('style');css.id='yc-app-shell-v2-style';css.textContent=`
*{box-sizing:border-box}
html,body{width:100%;height:100%;min-height:0;margin:0!important;overflow:hidden!important}
body{display:flex!important;flex-direction:column!important}
body>header{flex:0 0 54px!important;height:54px!important;min-height:54px!important}
#yc-workspace-tools{flex:0 0 40px!important;min-height:40px!important;padding:5px 12px!important;overflow-x:auto!important;flex-wrap:nowrap!important}
#yc-tool-nav{flex:0 0 38px!important;min-height:38px!important;padding:4px 10px!important;overflow-x:auto!important;overflow-y:hidden!important;flex-wrap:nowrap!important}
#yc-tool-nav a{white-space:nowrap!important}
#yc-quick-actions{flex:0 0 38px!important;min-height:38px!important;padding:4px 10px!important;flex-wrap:nowrap!important;overflow-x:auto!important}
#yc-quick-actions span{display:none!important}
#yc-pro-menu,#yc-pro-context,.yc-pro-status{display:none!important}\nmain{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;width:100%!important;max-width:none!important;margin:0!important;padding:8px!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
main>.crumb,main>h1,main>.intro,main>.foot,main>.bottom-note{display:none!important}
main>.layout{display:grid!important;grid-template-columns:minmax(230px,290px) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important;gap:10px!important;flex:1 1 auto!important;min-height:0!important;height:100%!important;margin:0!important;overflow:hidden!important}
main>.layout>.panel{min-width:0!important;min-height:0!important;height:100%!important;overflow:auto!important;padding:10px!important}
main>.layout>.panel:nth-child(2){display:flex!important;flex-direction:column!important;overflow:hidden!important}
main .stage{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow:auto!important}
main .stage canvas{max-width:100%!important;height:auto!important}
main>.ycp,#ycp-root{flex:1 1 auto!important;min-height:0!important;max-height:100%!important;margin:0!important;padding:10px!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
#ycp-root>.ycp-title,#ycp-root>.ycp-sub{flex:none!important}
#ycp-root>.ycp-grid{display:grid!important;grid-template-columns:minmax(250px,310px) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important;gap:10px!important;flex:1 1 auto!important;min-height:0!important;height:100%!important;overflow:hidden!important}
#ycp-root .ycp-side,#ycp-root .ycp-main{min-width:0!important;min-height:0!important;overflow:auto!important}
#ycp-root .ycp-stage,#ycp-root .gc-scroll{height:100%!important;max-height:none!important;min-height:0!important;overflow:auto!important}
#ycp-root .ycp-status{flex:none!important}
body>.layout{flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow:hidden!important}
body>.layout>.left,body>.layout>.right,body>.layout>aside{min-height:0!important;overflow:auto!important}
body>.layout>.center,body>.layout>.workspace{min-width:0!important;min-height:0!important;overflow:hidden!important}
body>.layout .stage{min-height:0!important;height:100%!important;overflow:auto!important}
#yc-advanced-v3,#yc-suite-v4{display:none!important}
#yc-app-extra-drawer{display:none;position:fixed;z-index:9999;inset:0;background:#0009;align-items:stretch;justify-content:flex-end}
#yc-app-extra-drawer.open{display:flex}
#yc-app-extra-drawer .yc-drawer{width:min(620px,92vw);height:100%;overflow:auto;background:#191b22;border-left:1px solid #454958;padding:14px;box-shadow:-20px 0 60px #0008}
#yc-app-extra-drawer .yc-drawer-head{display:flex;justify-content:space-between;align-items:center;position:sticky;top:-14px;background:#191b22;padding:8px 0;z-index:2}
#yc-app-extra-drawer #yc-advanced-v3,#yc-app-extra-drawer #yc-suite-v4{display:block!important;position:static!important;width:auto!important;max-height:none!important;overflow:visible!important;margin:10px 0!important}
@media(max-width:760px){
 body>header{flex-basis:48px!important;height:48px!important;min-height:48px!important}
 #yc-workspace-tools{flex-basis:36px!important;min-height:36px!important}
 #yc-tool-nav{flex-basis:36px!important;min-height:36px!important}
 #yc-quick-actions{flex-basis:36px!important;min-height:36px!important}
 main>.layout{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important}
 main>.layout>.panel:first-child{display:none!important}
 #ycp-root>.ycp-grid{grid-template-columns:minmax(0,1fr)!important}
 #ycp-root .ycp-side{max-height:34vh}
 body>.layout{display:flex!important;flex-direction:column!important}
 body>.layout>.left,body>.layout>aside.left{display:none!important}
 body>.layout>.center,body>.layout>.workspace{flex:1;min-height:0}
}
`;document.head.append(css);
const quick=document.getElementById('yc-quick-actions');
if(quick&&!document.getElementById('yc-extra-toggle')){const b=document.createElement('button');b.id='yc-extra-toggle';b.type='button';b.textContent='추가 기능';quick.append(b);b.onclick=()=>openDrawer()}
const drawer=document.createElement('div');drawer.id='yc-app-extra-drawer';drawer.innerHTML='<div class="yc-drawer"><div class="yc-drawer-head"><strong>추가 기능 패널</strong><button type="button" id="yc-extra-close">닫기 ✕</button></div><div id="yc-extra-content"></div></div>';document.body.append(drawer);
const content=drawer.querySelector('#yc-extra-content');
['yc-advanced-v3','yc-suite-v4'].forEach(id=>{const node=document.getElementById(id);if(node)content.append(node)});
function openDrawer(){drawer.classList.add('open')}
drawer.querySelector('#yc-extra-close').onclick=()=>drawer.classList.remove('open');
drawer.addEventListener('click',e=>{if(e.target===drawer)drawer.classList.remove('open')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')drawer.classList.remove('open')});
})();