/* - by ChatGPT Ai */
const API = "https://quizcraft-realtime.youthdeveloper-github.workers.dev";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
/* - by ChatGPT Ai: persistent QuizCraft appearance themes */
const themeSelect=$("#site-theme");
function applySiteTheme(theme){const allowed=["midnight","aurora","paper"];const value=allowed.includes(theme)?theme:"midnight";document.body.dataset.theme=value;if(themeSelect)themeSelect.value=value;try{localStorage.setItem("quizcraft.theme",value)}catch{}}
applySiteTheme(localStorage.getItem("quizcraft.theme")||"midnight");
if(themeSelect)themeSelect.addEventListener("change",()=>applySiteTheme(themeSelect.value));
let quiz = JSON.parse(localStorage.getItem("quizcraft.quiz")||"null") || {title:"",timeLimit:20,questions:[{q:"",a:["","","",""],correct:0,aMedia:[]}]};
let socket=null, role=null, roomCode="", hostToken="", myName="", answered=false, currentQuestion=null;
function playTone(freq=660,duration=.12){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.value=freq;g.gain.setValueAtTime(.07,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);o.onended=()=>c.close()}catch{}}
function updateTimer(remaining,total){const n=$("#timer-number"),f=$("#timer-fill");if(n)n.textContent=remaining+"초";if(f){f.style.width=Math.max(0,Math.min(100,remaining/Math.max(1,total)*100))+"%";f.classList.toggle("urgent",remaining<=5)}}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function tab(name){$$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));$$(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+name));$("#workspace").scrollIntoView({behavior:"smooth",block:"center"})}
$("#go-host").onclick=()=>selectMode("host");$("#go-join").onclick=()=>selectMode("player");$$(".tab").forEach(x=>x.onclick=()=>tab(x.dataset.tab));
function mediaInput(label,kind,index,value,type){return '<div class="media-upload"><strong>'+label+'</strong><input type="file" class="media-file" data-kind="'+kind+'" data-index="'+index+'" accept="'+type+'"><small class="media-status">'+(value?'첨부됨':'파일 선택')+'</small><div class="media-preview"></div><button type="button" class="media-clear" '+(value?'':'disabled')+'>첨부 제거</button></div>'}
function updateMediaPreview(input,value){const box=input.parentElement.querySelector(".media-preview"),clear=input.parentElement.querySelector(".media-clear");box.innerHTML=value?(input.dataset.kind.endsWith("image")?mediaMarkup(value,"image","media-thumb"):mediaMarkup(value,"audio","media-audio-preview")):"";if(clear)clear.disabled=!value}function bindMediaInputs(root){root.querySelectorAll(".media-file").forEach(input=>{input.onchange=()=>{const file=input.files?.[0];if(!file)return;if(file.size>220*1024){input.value="";toast("파일 하나는 220KB 이하로 선택해 줘.");return}const kind=input.dataset.kind;if(kind.endsWith("image")&&!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)){input.value="";return toast("PNG, JPG, WEBP, GIF 이미지 파일을 선택해 줘.")}if(kind.endsWith("audio")&&!["audio/mpeg","audio/mp3","audio/ogg","audio/wav","audio/webm","audio/mp4"].includes(file.type)){input.value="";return toast("MP3, OGG, WAV, WEBM, M4A 오디오 파일을 선택해 줘.")}const reader=new FileReader();reader.onload=()=>{input.dataset.media=String(reader.result);input.parentElement.querySelector(".media-status").textContent="✓ "+file.name;updateMediaPreview(input,input.dataset.media)};reader.onerror=()=>toast("파일을 읽지 못했어.");reader.readAsDataURL(file)};input.parentElement.querySelector(".media-clear").onclick=()=>{input.value="";delete input.dataset.media;input.parentElement.querySelector(".media-status").textContent="파일 선택";updateMediaPreview(input,"")}})}
function renderEditor(){ $("#quiz-title").value=quiz.title;$("#quiz-time-limit").value=String(quiz.timeLimit||20);$("#question-editor").innerHTML="";quiz.questions.forEach((q,i)=>{q.aMedia=q.aMedia||[];const el=document.createElement("div");el.className="editor-question";el.innerHTML='<div class="editor-question-head"><span>QUESTION '+(i+1)+'</span><button class="btn tiny ghost remove">삭제</button></div><input class="qtext" maxlength="180" placeholder="질문 내용"><div class="question-media-edit">'+mediaInput("문제 이미지","q-image",i,q.image,"image/*")+mediaInput("문제 사운드","q-audio",i,q.audio,"audio/*")+'</div><div class="options-edit">'+q.a.map((_,j)=>'<div class="option-edit-wrap"><input class="opt" maxlength="70" placeholder="보기 '+(j+1)+'">'+mediaInput("보기 이미지","a-image",j,q.aMedia[j]?.image,"image/*")+mediaInput("보기 사운드","a-audio",j,q.aMedia[j]?.audio,"audio/*")+'</div>').join("")+'</div><label class="field-label">정답 보기</label><select class="correct" style="width:100%;padding:10px;background:#101027;color:white;border:1px solid #ffffff22;border-radius:8px">'+q.a.map((_,j)=>'<option value="'+j+'">보기 '+(j+1)+'</option>').join("")+'</select>';el.querySelector(".qtext").value=q.q;q.a.forEach((v,j)=>el.querySelectorAll(".opt")[j].value=v);el.querySelector(".correct").value=q.correct;el.querySelectorAll(".media-file").forEach(input=>{const kind=input.dataset.kind,index=Number(input.dataset.index),value=kind==="q-image"?q.image:kind==="q-audio"?q.audio:kind==="a-image"?q.aMedia[index]?.image:q.aMedia[index]?.audio;if(value){input.dataset.media=value;input.parentElement.querySelector(".media-status").textContent="✓ 기존 파일 첨부됨"}updateMediaPreview(input,value)});bindMediaInputs(el);el.querySelector(".remove").onclick=()=>{if(quiz.questions.length<=1)return toast("문제는 최소 1개 필요해!");quiz.questions.splice(i,1);renderEditor()};$("#question-editor").append(el)})}
function readEditor(){const cards=$$(".editor-question");const questions=cards.map((el,qi)=>{const files=[...el.querySelectorAll(".media-file")],get=(kind,index=0)=>files.find(x=>x.dataset.kind===kind&&Number(x.dataset.index)===index)?.dataset.media||"";return {q:el.querySelector(".qtext").value.trim(),a:[...el.querySelectorAll(".opt")].map(x=>x.value.trim()),correct:Number(el.querySelector(".correct").value),image:get("q-image",qi),audio:get("q-audio",qi),aMedia:[0,1,2,3].map(i=>({image:get("a-image",i),audio:get("a-audio",i)}))}});if(!$("#quiz-title").value.trim()||questions.some(q=>!q.q||q.a.some(a=>!a)||new Set(q.a).size!==4))throw Error("제목, 문제, 서로 다른 보기 4개를 모두 입력해 줘.");const bytes=questions.reduce((n,q)=>n+[q.image,q.audio,...q.aMedia.flatMap(x=>[x.image,x.audio])].reduce((a,v)=>a+(v?Math.ceil(v.length*.75):0),0),0);if(bytes>850*1024)throw Error("첨부한 이미지와 사운드 전체 용량은 850KB 이하로 맞춰 줘.");return {title:$("#quiz-title").value.trim(),timeLimit:Number($("#quiz-time-limit").value)||20,questions}}
$("#add-question").onclick=()=>{if($(".editor-question").length>=30)return toast("한 퀴즈는 최대 30문제야.");if($(".editor-question").length)quiz=readEditor();quiz.questions.push({q:"",a:["","","",""],correct:0,aMedia:[]});renderEditor()};
function getLibrary(){try{return JSON.parse(localStorage.getItem("quizcraft.library")||"[]")}catch{return []}}
function renderLibrary(){const items=getLibrary(),list=$("#library-list");$("#library-count").textContent=items.length+"개";if(!items.length){list.innerHTML='<p class="library-empty">아직 저장한 퀴즈가 없어.</p>';return}list.innerHTML=items.map(x=>'<article class="library-item" data-id="'+escapeHtml(x.id)+'"><div class="library-item-info"><strong>'+escapeHtml(x.title)+'</strong><small>'+x.questions.length+'문제 · '+new Date(x.updatedAt||Date.now()).toLocaleDateString("ko-KR")+'</small></div><div class="library-item-actions"><button class="btn tiny ghost load-library">열기</button><button class="btn tiny ghost export-library">ZIP</button><button class="btn tiny ghost share-library">공유</button><button class="btn tiny ghost delete-library">삭제</button></div></article>').join("");list.querySelectorAll(".library-item").forEach(card=>{const item=items.find(x=>x.id===card.dataset.id);card.querySelector(".load-library").onclick=()=>{quiz={title:item.title,timeLimit:item.timeLimit||20,questions:item.questions};renderEditor();toast("퀴즈를 불러왔어!")};card.querySelector(".export-library").onclick=()=>exportQuizZip(item);card.querySelector(".share-library").onclick=()=>shareQuiz(item);card.querySelector(".delete-library").onclick=()=>{localStorage.setItem("quizcraft.library",JSON.stringify(getLibrary().filter(x=>x.id!==item.id)));renderLibrary();toast("보관함에서 삭제했어.")}})}
function saveToLibrary(item){const items=getLibrary(),id=item.id||("q"+Date.now().toString(36)+Math.random().toString(36).slice(2,6));const saved={...item,id,updatedAt:new Date().toISOString()};const i=items.findIndex(x=>x.id===id);if(i>=0)items[i]=saved;else items.unshift(saved);localStorage.setItem("quizcraft.library",JSON.stringify(items));renderLibrary()}

/* - by ChatGPT Ai: portable QuizCraft ZIP backup with embedded media assets */
function cloneQuizData(value){return JSON.parse(JSON.stringify(value))}
async function exportQuizZip(source){
 try{
  if(!window.JSZip)throw Error("ZIP 모듈을 불러오지 못했어. 인터넷 연결을 확인해 줘.");
  const sourceQuiz=source||readEditor(),copy=cloneQuizData(sourceQuiz),zip=new JSZip(),assets={};
  function externalize(value,path){
   if(typeof value==="string"&&value.startsWith("data:")){
    const match=value.match(/^data:([^;,]+)?;base64,([\s\S]+)$/);
    if(!match)throw Error("첨부 파일 형식을 읽을 수 없어.");
    const assetPath="media/"+path.replace(/[^a-zA-Z0-9._/-]/g,"_")+".bin";
    zip.file(assetPath,match[2],{base64:true});assets[assetPath]={mime:match[1]||"application/octet-stream"};
    return "__QC_ASSET__:"+assetPath;
   }
   if(Array.isArray(value))return value.map((v,i)=>externalize(v,path+"-"+i));
   if(value&&typeof value==="object"){for(const key of Object.keys(value))value[key]=externalize(value[key],path+"-"+key);return value}
   return value;
  }
  externalize(copy,"quiz");
  zip.file("quizcraft.json",JSON.stringify({format:"QuizCraft",version:1,exportedAt:new Date().toISOString(),assets,quiz:copy},null,2));
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
  const url=URL.createObjectURL(blob),a=document.createElement("a"),base=(sourceQuiz.title||"quizcraft").replace(/[\\/:*?"<>|]/g,"-").trim().slice(0,60)||"quizcraft";
  a.href=url;a.download=base+".quizcraft.zip";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast("문제·정답·사진·음악을 ZIP 파일로 저장했어! 📦");
 }catch(e){toast(e.message||"ZIP 저장에 실패했어.")}
}
function validateImportedQuiz(q){
 if(!q||typeof q.title!=="string"||!Array.isArray(q.questions)||q.questions.length<1||q.questions.length>30)throw Error("퀴즈 파일 형식이 올바르지 않아.");
 for(const item of q.questions){if(!item||typeof item.q!=="string"||!Array.isArray(item.a)||item.a.length!==4||!Number.isInteger(item.correct)||item.correct<0||item.correct>3||item.a.some(x=>typeof x!=="string"))throw Error("문제 또는 보기 데이터가 올바르지 않아.");}
 return q;
}
async function importQuizZip(file){
 try{
  if(!window.JSZip)throw Error("ZIP 모듈을 불러오지 못했어. 인터넷 연결을 확인해 줘.");
  if(!file)return;if(file.size>15*1024*1024)throw Error("ZIP 파일은 15MB 이하만 불러올 수 있어.");
  const zip=await JSZip.loadAsync(file,{checkCRC32:true}),entry=zip.file("quizcraft.json");
  if(!entry)throw Error("QuizCraft에서 내보낸 ZIP 파일이 아니야.");
  const backup=JSON.parse(await entry.async("string"));
  if(backup.format!=="QuizCraft"||backup.version!==1||!backup.assets||typeof backup.assets!=="object")throw Error("지원하지 않는 퀴즈 백업 형식이야.");
  let expanded=0;
  async function restore(value){
   if(typeof value==="string"&&value.startsWith("__QC_ASSET__:")){
    const path=value.slice("__QC_ASSET__:".length),meta=backup.assets[path],asset=zip.file(path);
    if(!meta||!asset)throw Error("ZIP 안에서 첨부 파일을 찾을 수 없어: "+path);
    const base64=await asset.async("base64");expanded+=Math.ceil(base64.length*.75);
    if(expanded>12*1024*1024)throw Error("압축 해제된 첨부 파일이 너무 커.");
    return "data:"+(meta.mime||"application/octet-stream")+";base64,"+base64;
   }
   if(Array.isArray(value))return Promise.all(value.map(restore));
   if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value))out[key]=await restore(value[key]);return out}
   return value;
  }
  const imported=validateImportedQuiz(await restore(backup.quiz));
  imported.timeLimit=Number(imported.timeLimit)||20;quiz=imported;
  localStorage.setItem("quizcraft.quiz",JSON.stringify(quiz));saveToLibrary(quiz);renderEditor();
  $("#share-result").classList.add("hidden");tab("editor");
  toast("퀴즈와 사진·음악까지 모두 불러왔어! 🎉");
 }catch(e){toast(e.message||"ZIP 파일을 불러오지 못했어.")}
}
$("#export-zip").onclick=()=>{try{exportQuizZip(readEditor())}catch(e){toast(e.message)}};
$("#import-zip-trigger").onclick=()=>$("#import-zip-file").click();
$("#import-zip-file").onchange=e=>{const file=e.target.files?.[0];if(file)importQuizZip(file);e.target.value=""};

async function shareQuiz(item){try{const r=await fetch(API+"/api/library",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quiz:item})});const d=await r.json();if(!r.ok)throw Error(d.error||"공유 코드 생성 실패");$("#share-code").textContent=d.code;$("#share-result").classList.remove("hidden");toast("공유 코드가 만들어졌어!")}catch(e){toast(e.message.includes("Failed to fetch")?"공유 서버에 연결할 수 없어.":e.message)}}

/* - by ChatGPT Ai: interactive quiz preview */
let previewState=null;
function closeQuizPreview(){const modal=$("#quiz-preview-modal");if(modal)modal.remove();previewState=null}
function drawQuizPreview(){
 const modal=$("#quiz-preview-modal");if(!modal||!previewState)return;
 const q=previewState.quiz.questions[previewState.index],i=previewState.index;
 const options=q.a.map((answer,j)=>{const media=q.aMedia?.[j]||{};return '<button class="preview-option" data-choice="'+j+'">'+mediaMarkup(media.image,"image","preview-option-image")+'<span>'+escapeHtml(answer)+'</span>'+mediaMarkup(media.audio,"audio","preview-option-audio")+'</button>'}).join("");
 modal.querySelector(".preview-body").innerHTML='<div class="preview-progress"><span>QUESTION '+(i+1)+' / '+previewState.quiz.questions.length+'</span><span>'+Math.round((i+1)/previewState.quiz.questions.length*100)+'%</span></div><div class="preview-progress-track"><i style="width:'+((i+1)/previewState.quiz.questions.length*100)+'%"></i></div><h2>'+escapeHtml(q.q)+'</h2>'+mediaMarkup(q.image,"image","preview-question-image")+mediaMarkup(q.audio,"audio","preview-question-audio")+'<div class="preview-options">'+options+'</div><p class="preview-feedback" aria-live="polite">보기를 선택해서 정답 표시를 확인해 봐.</p><div class="preview-nav"><button class="btn ghost" data-prev '+(i===0?'disabled':'')+'>← 이전</button><button class="btn primary" data-next>'+(i===previewState.quiz.questions.length-1?'미리보기 종료':'다음 문제 →')+'</button></div>';
 modal.querySelectorAll(".preview-option").forEach(button=>button.onclick=()=>{if(previewState.answered)return;previewState.answered=true;const selected=Number(button.dataset.choice);modal.querySelectorAll(".preview-option").forEach((b,j)=>{b.disabled=true;if(j===q.correct)b.classList.add("is-correct");if(j===selected&&j!==q.correct)b.classList.add("is-wrong")});modal.querySelector(".preview-feedback").textContent=selected===q.correct?"정답이야! 🎉":"아쉬워! 정답은 "+q.a[q.correct]+" 이야.";});
 modal.querySelector("[data-prev]").onclick=()=>{if(i>0){previewState.index--;previewState.answered=false;drawQuizPreview()}};
 modal.querySelector("[data-next]").onclick=()=>{if(i===previewState.quiz.questions.length-1){closeQuizPreview();return}previewState.index++;previewState.answered=false;drawQuizPreview()};
}
$("#preview-quiz").onclick=()=>{try{const draft=readEditor();const modal=document.createElement("div");modal.id="quiz-preview-modal";modal.className="quiz-preview-overlay";modal.innerHTML='<section class="quiz-preview-dialog" role="dialog" aria-modal="true" aria-label="퀴즈 미리보기"><header><div><span class="eyebrow">QUIZ PREVIEW</span><h3>'+escapeHtml(draft.title)+'</h3></div><button class="preview-close" aria-label="닫기">✕</button></header><div class="preview-body"></div></section>';document.body.append(modal);previewState={quiz:draft,index:0,answered:false};modal.querySelector(".preview-close").onclick=closeQuizPreview;modal.onclick=e=>{if(e.target===modal)closeQuizPreview()};drawQuizPreview()}catch(e){toast(e.message)}};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#quiz-preview-modal"))closeQuizPreview()});

$("#save-quiz").onclick=()=>{try{quiz=readEditor();localStorage.setItem("quizcraft.quiz",JSON.stringify(quiz));saveToLibrary(quiz);$("#host-selected-quiz").querySelector("strong").textContent=quiz.title;$("#host-selected-quiz").querySelector("span").textContent=quiz.questions.length+" Q";toast("내 퀴즈 보관함에 저장했어!")}catch(e){toast(e.message)}};
$("#share-quiz").onclick=()=>{try{quiz=readEditor();shareQuiz(quiz)}catch(e){toast(e.message)}};
$("#copy-share-code").onclick=()=>{const code=$("#share-code").textContent;navigator.clipboard?.writeText(code).then(()=>toast("공유 코드를 복사했어!")).catch(()=>toast("공유 코드: "+code))};
$("#import-quiz").onclick=async()=>{const code=$("#import-code").value.trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code))return toast("8자리 공유 코드를 입력해 줘.");try{const r=await fetch(API+"/api/library/"+code),d=await r.json();if(!r.ok)throw Error(d.error||"퀴즈를 찾을 수 없어.");quiz=d.quiz;localStorage.setItem("quizcraft.quiz",JSON.stringify(quiz));saveToLibrary(quiz);renderEditor();toast("공유 퀴즈를 가져왔어!")}catch(e){toast(e.message.includes("Failed to fetch")?"서버에 연결할 수 없어.":e.message)}};
$("#import-code").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));
renderLibrary();
renderEditor();
async function createRoom(){try{if(!authToken){pendingMode="host";return openAuth("login");}quiz=readEditor();localStorage.setItem("quizcraft.quiz",JSON.stringify(quiz));myName=$("#host-name").value.trim()||currentUser?.nickname||"진행자";const r=await fetch(API+"/api/rooms",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},body:JSON.stringify({hostName:myName,quiz})});const d=await r.json();if(!r.ok)throw Error(d.error||"방 생성 실패");roomCode=d.code;hostToken=d.hostToken;role="host";$("#host-pin").textContent=roomCode;$("#host-room").classList.remove("hidden");$("#host-players").textContent="참가자를 기다리는 중...";connect();toast("게임방이 만들어졌어!")}catch(e){toast(e.message.includes("Failed to fetch")?"실시간 서버에 연결할 수 없어. 서버 설정을 확인해 줘.":e.message)}}
$("#create-room").onclick=createRoom;
function connect(){if(socket)socket.close();const url=API.replace(/^http/,"ws")+"/api/rooms/"+roomCode+"?role="+role+"&name="+encodeURIComponent(myName)+(role==="host"?"&token="+encodeURIComponent(hostToken):"");socket=new WebSocket(url);socket.onopen=()=>{$("#game-status").textContent="● 서버 연결됨"};socket.onmessage=e=>{const m=JSON.parse(e.data);handleMessage(m)};socket.onclose=()=>{$("#game-status").textContent="연결 종료"};socket.onerror=()=>toast("서버 연결 오류")}
function send(type,data={}){if(!socket||socket.readyState!==1)return toast("서버 연결을 기다려 줘.");socket.send(JSON.stringify({type,...data}))}
function handleMessage(m){
 if(m.type==="lobby"){
  if(role==="host"){$("#host-player-count").textContent=m.players.length+"명 참가 중";$("#host-players").textContent=m.players.length?m.players.map(p=>"👤 "+p.name).join("  ·  "):"아직 참가자가 없어. 친구들을 초대해 봐!";$("#start-game").disabled=m.players.length===0;$("#start-game").textContent=m.players.length?"게임 시작하기 ("+m.players.length+"명)":"참가자 기다리는 중..."}
  else renderLobby(m);
 }
 if(m.type==="roster"&&role==="host")renderHostRoster(m.players||[]);
 if(m.type==="activity"&&role==="host")addHostActivity(m.event);
 if(m.type==="started"||m.type==="question")renderQuestion(m);
 if(m.type==="answered"){
  if(role==="player"){$$(".answer").forEach(b=>b.disabled=true);$("#answer-feedback").textContent="답변 제출 완료! 결과를 기다려 봐."}
  if(role==="host"){if(m.players)renderAnswerProgress(m.players);else{const status=$("#answer-progress");if(status)status.textContent="답변 완료 "+m.count+" / "+m.total+"명"}}
 }
 if(m.type==="timer")updateTimer(m.remaining,m.total);
 if(m.type==="reveal")renderReveal(m);
 if(m.type==="leaderboard")renderLeaderboard(m);
 if(m.type==="ended")renderFinal(m);
 if(m.type==="kicked"){if(socket)socket.close();$("#game-content").innerHTML='<div class="result-state"><h2>게임에서 나왔어</h2><p>진행자가 참가를 종료했어.</p></div>';toast(m.message||"진행자가 게임에서 내보냈어.");}
 if(m.type==="error")toast(m.message);
}
function showGame(){ $("#workspace").classList.add("hidden");$(".hero").classList.add("hidden");$(".features").classList.add("hidden");$("#game-screen").classList.remove("hidden");$("#game-screen").scrollIntoView({behavior:"smooth"})}
function renderLobby(m){showGame();$("#game-role").textContent="PLAYER LOBBY";$("#game-content").innerHTML='<div class="result-state"><div class="eyebrow">YOU ARE IN!</div><h2>참가 완료 🎉</h2><p style="color:var(--muted)">진행자가 게임을 시작할 때까지 기다려 줘.</p><h2>'+escapeHtml(myName)+'</h2><p style="color:var(--muted)">참가자 '+m.players.length+'명</p></div>'}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function mediaMarkup(src,kind,cls="question-media"){if(!src)return "";return kind==="image"?'<img class="'+cls+'" src="'+escapeHtml(src)+'" alt="첨부 이미지">':'<audio class="'+cls+'" controls preload="none" src="'+escapeHtml(src)+'"></audio>'}
function renderAnswerProgress(players=[]){
 const total=players.length,done=players.filter(p=>p.answered).length,percent=total?Math.round(done/total*100):0;
 const status=$("#answer-progress"),pct=$("#answer-progress-percent"),fill=$("#answer-progress-fill"),list=$("#answer-progress-list");
 if(status)status.textContent="답변 완료 "+done+" / "+total+"명";
 if(pct)pct.textContent=percent+"%";
 if(fill)fill.style.width=percent+"%";
 if(list)list.innerHTML=players.length?players.map(p=>'<div class="answer-progress-player"><span>'+escapeHtml(p.name)+'</span><strong class="'+(p.answered?"is-submitted":"is-waiting")+'">'+(p.answered?"✓ 제출 완료":"대기 중")+'</strong></div>').join(""):'<p class="answer-progress-empty">아직 참가자가 없어.</p>';
}
/* - by ChatGPT Ai: host participant roster, profile details and invitation links */
let hostPlayersCache=[];
function renderHostRoster(players=[]){
 hostPlayersCache=players;
 const list=$("#host-roster-list"),count=$("#host-roster-count");
 if(count)count.textContent=players.length+"명";
 if(list)list.innerHTML=players.length?players.map(p=>'<article class="host-player-card"><button class="host-player-profile" data-player-details="'+escapeHtml(p.id)+'"><span class="host-player-avatar">👤</span><span class="host-player-meta"><strong>'+escapeHtml(p.name)+'</strong><small>'+p.score+'점 · '+p.correctCount+'정답 '+p.wrongCount+'오답</small></span><span class="host-player-state '+(p.answered?'done':'waiting')+'">'+(p.answered?'제출':'대기')+'</span></button><button class="host-kick" data-player-kick="'+escapeHtml(p.id)+'" title="참가자 내보내기" aria-label="'+escapeHtml(p.name)+' 내보내기">내보내기</button></article>').join(""):'<p class="host-roster-empty">아직 참가자가 없어. PIN이나 초대 링크를 공유해 봐!</p>';
}
function showPlayerDetails(id){
 const p=hostPlayersCache.find(x=>x.id===id),panel=$("#host-player-details");if(!p||!panel)return;
 const history=p.history||[];
 panel.innerHTML='<div class="host-detail-head"><div><span class="eyebrow">PLAYER PROFILE</span><h3>'+escapeHtml(p.name)+'</h3></div><button class="btn tiny ghost" id="close-player-details">닫기</button></div><div class="host-detail-stats"><div><strong>'+p.score+'</strong><small>점수</small></div><div><strong>'+p.correctCount+'</strong><small>정답</small></div><div><strong>'+p.wrongCount+'</strong><small>오답</small></div></div><p class="host-detail-meta">입장 '+new Date(p.joinedAt).toLocaleTimeString("ko-KR")+' · '+(p.answered?'현재 문제 제출 완료':'현재 문제 대기 중')+'</p><h4>문제별 응답 기록</h4>'+(history.length?'<div class="host-history-list">'+history.slice().reverse().map(h=>'<article><strong>Q'+h.question+'. '+escapeHtml(h.questionText)+'</strong><p>선택: '+escapeHtml(h.selectedText)+' · 정답: '+escapeHtml(h.correctText)+'</p><small class="'+(h.correct?'is-submitted':'is-waiting')+'">'+(h.correct?'정답':'오답')+' · '+h.elapsedSeconds+'초 · +'+h.scoreEarned+'점</small></article>').join("")+'</div>':'<p class="host-roster-empty">아직 제출한 답변이 없어.</p>');
 $("#close-player-details").onclick=()=>{panel.innerHTML="";panel.classList.add("hidden")};panel.classList.remove("hidden");
}
function addHostActivity(event){
 const list=$("#host-activity-list");if(!list||!event)return;
 const labels={joined:"입장했어",left:"나갔어",kicked:"내보냈어",answered:event.correct?"정답을 제출했어":"답변을 제출했어"};
 const item=document.createElement("div");item.className="host-activity-item";
 const detail=event.action==="answered"?" · Q"+event.question:"";
 item.textContent=(event.name||"참가자")+" "+(labels[event.action]||"활동했어")+detail+" · "+new Date(event.at||Date.now()).toLocaleTimeString("ko-KR");
 list.prepend(item);while(list.children.length>30)list.lastElementChild.remove();
}
function setupHostRoster(){
 const list=$("#host-roster-list");if(list)list.onclick=e=>{
  const detail=e.target.closest("[data-player-details]"),kick=e.target.closest("[data-player-kick]");
  if(detail){showPlayerDetails(detail.dataset.playerDetails);return}
  if(kick){const p=hostPlayersCache.find(x=>x.id===kick.dataset.playerKick);if(p&&confirm(p.name+" 참가자를 퀴즈에서 내보낼까?"))send("kick",{playerId:p.id})}
 };
 const add=$("#host-add-player"),invite=$("#host-invite-panel");
 if(add&&invite)add.onclick=()=>{invite.classList.toggle("hidden");if(!invite.classList.contains("hidden")){$("#host-invite-pin").textContent=roomCode;const link=location.origin+"/quizcraft/student.html?pin="+encodeURIComponent(roomCode);$("#host-invite-url").value=link}};
 const copy=$("#host-copy-invite");if(copy)copy.onclick=()=>{const link=$("#host-invite-url").value;navigator.clipboard?.writeText(link).then(()=>toast("초대 링크를 복사했어!")).catch(()=>toast("PIN: "+roomCode))};
}
function renderQuestion(m){showGame();currentQuestion=m;answered=false;const q=m.question,questionMedia=mediaMarkup(q.image,"image")+mediaMarkup(q.audio,"audio");const options=q.a.map((a,i)=>{const media=q.aMedia?.[i]||{};const image=mediaMarkup(media.image,"image","option-media-image"),audio=mediaMarkup(media.audio,"audio","option-media-audio");return role==="host"?'<div class="answer answer-host">'+image+'<span>'+escapeHtml(a)+'</span>'+audio+'</div>':'<div class="answer-wrap"><button class="answer" data-i="'+i+'">'+image+'<span>'+escapeHtml(a)+'</span></button>'+audio+'</div>'}).join("");$("#game-role").textContent=role==="host"?"HOST CONTROL":"LIVE QUESTION";$("#game-content").innerHTML='<div class="timer-box"><div class="timer-meta"><span>남은 시간</span><strong id="timer-number">'+(m.timeLimit||20)+'초</strong></div><div class="timer-track"><i id="timer-fill" style="width:100%"></i></div></div><div class="game-question"><div class="counter">QUESTION '+(m.index+1)+' / '+m.total+'</div><h2>'+escapeHtml(q.q)+'</h2>'+questionMedia+(role==="host"?'<div class="answer-progress-panel"><div class="answer-progress-head"><p id="answer-progress">답변 현황을 불러오는 중...</p><strong id="answer-progress-percent">0%</strong></div><div class="answer-progress-track"><i id="answer-progress-fill" style="width:0%"></i></div><div id="answer-progress-list" class="answer-progress-list"></div></div>':'<div class="answer-grid">'+options+'</div><p id="answer-feedback" style="color:var(--muted);font-size:12px"></p>')+(role==="host"?'<div class="answer-grid host-answer-grid">'+options+'</div>':'')+'</div>'+(role==="host"?'<div class="host-controls"><button class="btn primary full" id="reveal-answer">정답 공개</button></div>':"");if(role==="host"){renderAnswerProgress(m.players||[]);setupHostRoster();}updateTimer(m.timeLimit||20,m.timeLimit||20);if(role==="player")$$(".answer").forEach(b=>b.onclick=()=>{if(answered)return;answered=true;b.classList.add("selected");send("answer",{answer:Number(b.dataset.i)});});if(role==="host")$("#reveal-answer").onclick=()=>send("reveal")}
function renderReveal(m){playTone(660,.12);const mine=m.leaderboard.find(p=>p.name===myName);if(role==="player"&&mine)playTone(mine.lastCorrect?880:220,.18);const q=currentQuestion?.question,counts=m.answerCounts||[0,0,0,0],max=Math.max(1,...counts);const distribution=q?q.a.map((a,i)=>'<div class="distribution-row '+(i===m.correctIndex?'is-correct':'')+'"><div class="distribution-label"><span>'+(i===m.correctIndex?'✓ ':'')+escapeHtml(a)+'</span><strong>'+counts[i]+'명</strong></div><div class="distribution-track"><i style="width:'+(counts[i]/max*100)+'%"></i></div></div>').join(""):"";$("#game-content").innerHTML='<div class="result-state"><div class="eyebrow">ANSWER REVEALED</div><h2>정답은 '+escapeHtml(m.answerText)+' 🎯</h2><p style="color:var(--muted)">선택지별 응답 결과</p></div><div class="distribution">'+distribution+'</div>'+(role==="host"?'<button class="btn primary full" id="show-leaderboard">순위표 보기 →</button>':'<p style="text-align:center;color:var(--muted);font-size:12px">진행자가 순위표를 보여줄 때까지 기다려 줘.</p>');if(role==="host")$("#show-leaderboard").onclick=()=>send("leaderboard")}
function renderLeaderboard(m){const rows=m.leaderboard||[];$("#game-role").textContent="TOP PLAYERS";$("#game-content").innerHTML='<div class="result-state"><div class="eyebrow">LEADERBOARD</div><h2>🏆 현재 순위 TOP 5</h2><p style="color:var(--muted)">다음 문제를 향해 달려가 보자!</p></div><div class="leaderboard">'+rows.map(p=>'<div class="leader-row"><strong>'+(p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':p.rank+'.')+' '+escapeHtml(p.name)+'</strong><span>'+p.score+'점</span></div>').join("")+'</div>'+(role==="host"?'<button class="btn primary full" id="next-question">'+(m.last?"최종 시상대 보기 🎉":"다음 문제 →")+'</button>':'<p style="text-align:center;color:var(--muted);font-size:12px">진행자가 다음 단계를 시작할 때까지 기다려 줘.</p>');if(role==="host")$("#next-question").onclick=()=>send("next")}
function renderFinal(m){launchConfetti();playTone(880,.18);setTimeout(()=>playTone(1100,.22),180);const rawRows=m.leaderboard||[];const rows=rawRows.map((p,i)=>({...p,rank:1+rawRows.slice(0,i).filter(x=>x.score>p.score).map(x=>x.score).filter((score,j,arr)=>arr.indexOf(score)===j).length}));const winners=rows.filter(p=>p.rank===1);const winnerLabel=winners.length===1?escapeHtml(winners[0].name)+" 우승!":winners.map(p=>escapeHtml(p.name)).join(" · ")+" 공동 우승!";const stats=m.stats||[];const totalAnswers=stats.reduce((n,s)=>n+(s.answered||0),0),correctAnswers=stats.reduce((n,s)=>n+(s.correct||0),0),accuracy=totalAnswers?Math.round(correctAnswers/totalAnswers*100):0;const statHtml=role==="host"?'<section class="host-statistics"><div class="stats-title"><div><span class="eyebrow">HOST ANALYTICS</span><h3>📊 게임 통계</h3></div><span class="stats-tag">이번 게임</span></div><div class="stats-summary"><div><strong>'+rows.length+'</strong><small>참가자</small></div><div><strong>'+stats.length+'</strong><small>문제 수</small></div><div><strong>'+accuracy+'%</strong><small>전체 정답률</small></div></div><div class="question-stats">'+stats.map((s,i)=>{const max=Math.max(1,...(s.answerCounts||[]));return '<article class="question-stat"><div class="question-stat-head"><strong>Q'+(i+1)+'. '+escapeHtml(s.question)+'</strong><span>'+s.correct+'/'+s.total+'명 정답</span></div><div class="stat-meter">'+(s.answerCounts||[0,0,0,0]).map((n,j)=>'<i title="보기 '+(j+1)+': '+n+'명" style="height:'+Math.max(4,n/max*100)+'%"></i>').join("")+'</div><div class="stat-foot"><span>응답 '+s.answered+'명 · 미응답 '+Math.max(0,s.total-s.answered)+'명</span><span>평균 '+(s.averageSeconds||0)+'초</span></div></article>'}).join("")+'</div><button class="btn ghost full" id="download-stats">통계 CSV 다운로드</button></section>':'';$("#game-content").innerHTML='<div class="result-state winner-card"><div class="eyebrow">QUIZ COMPLETE</div><div class="winner-cup">🏆</div><h2>'+(winnerLabel||"퀴즈 완료!")+'</h2><p style="color:var(--muted)">모두 수고했어!</p></div><div class="leaderboard">'+rows.map((p,i)=>'<div class="leader-row rank-row rank-'+p.rank+'"><strong>'+(p.rank===1?"🥇":p.rank===2?"🥈":p.rank===3?"🥉":p.rank+".")+' '+escapeHtml(p.name)+'</strong><span>'+p.score+'점</span></div>').join("")+'</div>'+statHtml+'<div style="text-align:center"><button class="btn ghost" onclick="location.reload()">처음으로</button></div>';if(role==="host"&&$("#download-stats"))$("#download-stats").onclick=()=>{const lines=[["문제","정답률","응답자","미응답","평균 응답 시간","보기1","보기2","보기3","보기4"],...stats.map((s,i)=>["Q"+(i+1)+" "+s.question,(s.total?Math.round(s.correct/s.total*100):0)+"%",s.answered,Math.max(0,s.total-s.answered),(s.averageSeconds||0)+"초",...(s.answerCounts||[0,0,0,0])])];const csv="\\uFEFF"+lines.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\\r\\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="quizcraft-statistics.csv";a.click();URL.revokeObjectURL(url)}}

$("#start-game").onclick=()=>send("start");$("#close-room").onclick=()=>{if(socket)socket.close();$("#host-room").classList.add("hidden");role=null;toast("방 연결을 종료했어.")};
const invitedPin=new URLSearchParams(location.search).get("pin");if(invitedPin&&/^\d{6}$/.test(invitedPin))$("#join-pin").value=invitedPin;
$("#join-room").onclick=()=>{roomCode=$("#join-pin").value.replace(/\D/g,"");myName=$("#player-name").value.trim()||"";if(roomCode.length!==6)return toast("6자리 PIN을 입력해 줘.");if(myName.length<2)return toast("닉네임을 2글자 이상 입력해 줘.");role="player";connect();showGame();$("#game-content").innerHTML='<div class="result-state"><h2>입장하는 중...</h2></div>'};
$("#leave-game").onclick=()=>{if(socket)socket.close();location.reload()};

/* - by ChatGPT Ai: QuizCraft account lifecycle and role-first navigation */
const AUTH_KEY="quizcraft.auth.token";
let authToken=localStorage.getItem(AUTH_KEY)||"",currentUser=null,authMode="login",soloState=null;
function openAuth(mode="login"){authMode=mode;if(mode==="register"&&$("#auth-provider").value==="youthdeveloper")$("#auth-provider").value="quizcraft";$("#auth-overlay").classList.remove("hidden");$("#auth-form-wrap").classList.remove("hidden");$("#account-profile").classList.add("hidden");$("#auth-eyebrow").textContent="QUIZCRAFT ACCOUNT";$("#auth-description").textContent="YouthDeveloper 계정 또는 QuizCraft 전용 계정으로 시작해.";$("#auth-title").textContent=mode==="register"?"회원가입":"로그인";$("#auth-submit").textContent=mode==="register"?"계정 만들기":"로그인";$("#auth-role-wrap").classList.toggle("hidden",mode!=="register");$("#auth-error").textContent="";$("#auth-password").value="";}
function openAccountProfile(){if(!currentUser)return openAuth("login");$("#auth-overlay").classList.remove("hidden");$("#auth-eyebrow").textContent="ACCOUNT SETTINGS";$("#auth-description").textContent="계정 역할과 이용 권한을 관리해.";$("#auth-title").textContent="계정 설정";$("#auth-form-wrap").classList.add("hidden");$("#account-profile").classList.remove("hidden");$("#auth-role-wrap").classList.add("hidden");renderAccountProfile();}
function closeAuth(){const overlay=$("#auth-overlay");if(overlay)overlay.classList.add("hidden")}
function setAccount(user){currentUser=user;$("#account-open").textContent=user?user.nickname+" · 계정":"로그인 / 회원가입";if($("#account-open-inline"))$("#account-open-inline").textContent=user?user.nickname+" · 계정":"로그인";if(user&&$("#host-name"))$("#host-name").value=user.nickname}
async function qcRequest(path,method="GET",body){const r=await fetch(API+path,{method,headers:{...(authToken?{Authorization:"Bearer "+authToken}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"요청에 실패했어.");return d}
async function refreshAccount(){if(!authToken){setAccount(null);return}try{const d=await qcRequest("/api/auth/me");setAccount(d.user)}catch{authToken="";localStorage.removeItem(AUTH_KEY);setAccount(null)}}
async function submitAuth(){
 const provider=$("#auth-provider").value,nickname=$("#auth-nickname").value.trim(),password=$("#auth-password").value;
 $("#auth-error").textContent="";
 try{
  let d;
  if(provider==="youthdeveloper"){
   const r=await fetch("https://web.youthdeveloper-github.workers.dev/api/chat/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nickname,password})}),yd=await r.json().catch(()=>({}));
   if(!r.ok||!yd.token)throw Error(yd.error||"YouthDeveloper 계정 로그인이 실패했어.");
   d=await qcRequest("/api/auth/youthdeveloper","POST",{token:yd.token});
  }else d=await qcRequest("/api/auth/"+authMode,"POST",{nickname,password,role:$("#auth-role").value});
  authToken=d.token||authToken;if(authToken)localStorage.setItem(AUTH_KEY,authToken);setAccount(d.user);closeAuth();toast("로그인했어! 환영해 🎉");
  if(pendingMode)selectMode(pendingMode);pendingMode=null;
 }catch(e){$("#auth-error").textContent=e.message}
}
let pendingMode=null;
async function selectMode(mode){
 if(mode==="host"&&!authToken){pendingMode=mode;openAuth("login");return}
 if(mode==="host")await refreshAccount();
 if(mode==="host"&&!currentUser?.canHost){toast("현재 참가자 계정이야. 계정 설정에서 진행자 권한으로 바꿔 줘.");openAccountProfile();return}
 $("#workspace").classList.remove("hidden");$("#selected-role-label").textContent=mode==="host"?"🎤 진행자 모드":"🎮 참가자 모드";
 $("#editor-tab").classList.toggle("hidden",mode!=="host");$("#host-tab").classList.toggle("hidden",mode!=="host");$("[data-role-tab=player]").forEach(x=>x.classList.toggle("hidden",mode!=="player"));tab(mode==="host"?"host":"join");
 if(mode==="host"){renderEditor();renderLibrary();const saved=getLibrary();if(saved.length){const item=saved[0];quiz={title:item.title,timeLimit:item.timeLimit||20,questions:item.questions};$("#host-selected-quiz").querySelector("strong").textContent=item.title;$("#host-selected-quiz").querySelector("span").textContent=item.questions.length+" Q"}}
 if(mode==="player")loadPublicQuizzes();
}
function renderAccountProfile(){if(!currentUser)return;$("#auth-eyebrow").textContent="ACCOUNT SETTINGS";$("#auth-description").textContent="계정 역할과 이용 권한을 관리해.";$("#auth-title").textContent="계정 설정";$("#account-summary").textContent=currentUser.nickname+" · "+(currentUser.provider==="youthdeveloper"?"YouthDeveloper 계정":"QuizCraft 전용 계정");$("#profile-role").value=currentUser.canHost?"host":"player";$("#profile-save").textContent="변경사항 저장";}
$("#account-open").onclick=async()=>{if(!authToken){openAuth("login");return}await refreshAccount();if(currentUser)openAccountProfile();else openAuth("login")};
$("#account-open-inline").onclick=()=>$("#account-open").click();
$("#auth-close").type="button";$("#auth-close").onclick=e=>{e.preventDefault();e.stopPropagation();closeAuth()};$("#auth-overlay").onclick=e=>{if(e.target===$("#auth-overlay"))closeAuth()};
$("#auth-switch").onclick=()=>openAuth(authMode==="login"?"register":"login");
$("#auth-submit").onclick=submitAuth;
$("#auth-provider").onchange=()=>{const yd=$("#auth-provider").value==="youthdeveloper";if(yd&&authMode==="register"){authMode="login";$("#auth-title").textContent="로그인";$("#auth-submit").textContent="로그인";}$("#auth-role-wrap").classList.toggle("hidden",yd||authMode!=="register")};
$("#profile-save").type="button";$("#profile-save").onclick=async e=>{e.preventDefault();e.stopPropagation();const button=$("#profile-save");button.disabled=true;try{const d=await qcRequest("/api/auth/profile","POST",{role:$("#profile-role").value});setAccount(d.user);toast("계정 설정을 저장했어!");closeAuth()}catch(e){toast(e.message)}finally{button.disabled=false}};
$("#auth-logout").type="button";$("#auth-logout").onclick=async e=>{e.preventDefault();e.stopPropagation();if(!confirm("로그아웃할까?"))return;try{await qcRequest("/api/auth/logout","POST",{})}catch{}authToken="";currentUser=null;localStorage.removeItem(AUTH_KEY);setAccount(null);closeAuth();toast("로그아웃했어.")};
$("#back-to-roles").onclick=()=>{$("#workspace").classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"})};
$("#refresh-public-quizzes").onclick=loadPublicQuizzes;
async function loadPublicQuizzes(){
 const list=$("#public-quiz-list");if(!list)return;list.innerHTML='<p class="library-empty">공개 퀴즈를 불러오는 중...</p>';
 try{const d=await qcRequest("/api/quizzes");const items=d.quizzes||[];if(!items.length){list.innerHTML='<p class="library-empty">아직 공개된 퀴즈가 없어. 진행자가 첫 퀴즈를 공개해 봐!</p>';return}
 list.innerHTML=items.map(x=>'<article class="public-quiz-card"><div><strong>'+escapeHtml(x.title)+'</strong><small>'+x.questionCount+'문제 · '+x.timeLimit+'초 · '+escapeHtml(x.authorName)+' 출제</small></div><button class="btn primary tiny" data-public-play="'+x.id+'">이 퀴즈 플레이</button></article>').join("");
 list.querySelectorAll("[data-public-play]").forEach(b=>b.onclick=async()=>{try{const item=await qcRequest("/api/quizzes/"+b.dataset.publicPlay);startSoloQuiz(item.quiz,item.meta)}catch(e){toast(e.message)}});
 }catch(e){list.innerHTML='<p class="library-empty">'+escapeHtml(e.message)+'</p>'}
}
async function publishCurrentQuiz(){
 try{if(!authToken)return openAuth("host");const draft=readEditor();const visibility=$("#quiz-visibility")?.value||"public";if(visibility!=="public")return toast("참가자에게 공개하려면 공개 설정을 선택해 줘.");const d=await qcRequest("/api/quizzes","POST",{quiz:draft,visibility});quiz=draft;saveToLibrary(quiz);toast("퀴즈를 공개 목록에 올렸어! 🌐");$("#share-code").textContent=d.quiz.id;$("#share-result").classList.remove("hidden");loadPublicQuizzes()}
 catch(e){toast(e.message)}
}
$("#publish-quiz").onclick=publishCurrentQuiz;$("#new-quiz").onclick=()=>{quiz={title:"",timeLimit:20,questions:[{q:"",a:["","","",""],correct:0,aMedia:[]}]};renderEditor();toast("새 퀴즈를 만들 준비가 됐어!")};
function startSoloQuiz(data,meta){
 if(!data?.questions?.length)return toast("퀴즈에 문제가 없어.");
 soloState={quiz:data,index:0,score:0,answered:false,meta};
 $("#game-screen").classList.remove("hidden");$("#workspace").classList.add("hidden");$("#game-role").textContent="PUBLIC QUIZ";$("#host-roster").classList.add("hidden");drawSoloQuiz();$("#game-screen").scrollIntoView({behavior:"smooth"});
}
function drawSoloQuiz(){
 const st=soloState;if(!st)return;const q=st.quiz.questions[st.index];
 $("#game-content").innerHTML='<div class="question-card"><div class="eyebrow">PUBLIC QUIZ · '+(st.index+1)+' / '+st.quiz.questions.length+'</div><h2>'+escapeHtml(q.q)+'</h2>'+mediaMarkup(q.image,"image","question-image")+mediaMarkup(q.audio,"audio","question-audio")+'<div class="answer-grid">'+q.a.map((x,i)=>'<button class="answer" data-solo-answer="'+i+'">'+String.fromCharCode(65+i)+'. '+escapeHtml(x)+'</button>').join("")+'</div><p id="answer-feedback" class="answer-feedback">정답을 선택해 봐!</p><button class="btn primary full hidden" id="solo-next">'+(st.index===st.quiz.questions.length-1?"결과 보기":"다음 문제 →")+'</button></div>';
 $("#game-status").textContent=(st.meta?.authorName||"공개 퀴즈")+" 출제";
 $("#game-content").querySelectorAll("[data-solo-answer]").forEach(b=>b.onclick=()=>{if(st.answered)return;st.answered=true;const choice=Number(b.dataset.soloAnswer),correct=choice===q.correct;if(correct)st.score+=100;$("#game-content").querySelectorAll(".answer").forEach((x,i)=>{x.disabled=true;if(i===q.correct)x.classList.add("is-correct");if(i===choice&&!correct)x.classList.add("is-wrong")});$("#answer-feedback").textContent=correct?"정답이야! +100점 🎉":"아쉬워! 정답은 "+q.a[q.correct]+" 이야.";$("#solo-next").classList.remove("hidden")});
 $("#solo-next").onclick=()=>{if(st.index===st.quiz.questions.length-1){$("#game-content").innerHTML='<div class="result-state"><div class="winner-cup">🏆</div><h2>퀴즈 완료!</h2><p>최종 점수 '+st.score+'점 / '+st.quiz.questions.length*100+'점</p><button class="btn primary full" id="solo-home">공개 퀴즈 더 보기</button></div>';$("#solo-home").onclick=()=>{soloState=null;$("#game-screen").classList.add("hidden");$("#host-roster").classList.remove("hidden");selectMode("player")};return}st.index++;st.answered=false;drawSoloQuiz()};
}
/* - by ChatGPT Ai: removed obsolete selector that stopped startup */
setupHostRoster();
refreshAccount();try{if(quiz?.title==="기본 상식 퀴즈"&&quiz.questions?.length===5){quiz={title:"",timeLimit:20,questions:[{q:"",a:["","","",""],correct:0,aMedia:[]}]};localStorage.removeItem("quizcraft.quiz")}const oldLibrary=getLibrary().filter(x=>!(x.title==="기본 상식 퀴즈"&&x.questions?.length===5));if(oldLibrary.length!==getLibrary().length)localStorage.setItem("quizcraft.library",JSON.stringify(oldLibrary));}catch{}renderEditor();renderLibrary();const requestedMode=new URLSearchParams(location.search).get("mode");if(requestedMode==="host"||requestedMode==="player")selectMode(requestedMode);
