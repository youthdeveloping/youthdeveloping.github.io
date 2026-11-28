/* - by ChatGPT Ai */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||min));
const validMedia=(v,kind)=>{if(v==null||v==="")return true;if(typeof v!=="string"||v.length>300000)return false;const re=kind==="image"?/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/:/^data:audio\/(mpeg|mp3|ogg|wav|webm|mp4);base64,[A-Za-z0-9+/=]+$/;return re.test(v)};
const validQuestionMedia=q=>validMedia(q.image,"image")&&validMedia(q.audio,"audio")&&(!q.aMedia||Array.isArray(q.aMedia)&&q.aMedia.length===4&&q.aMedia.every(m=>m&&validMedia(m.image,"image")&&validMedia(m.audio,"audio")));
// - by ChatGPT Ai: persistent accounts and public quiz catalog
async function resolveUser(env,token){
 if(!token)return null;
 const stub=env.ROOMS.get(env.ROOMS.idFromName("auth:users"));
 const r=await stub.fetch("https://auth.internal/auth/resolve",{headers:{Authorization:"Bearer "+token}});
 if(!r.ok)return null;return r.json();
}
const validQuiz=(quiz)=>!!quiz&&Array.isArray(quiz.questions)&&quiz.questions.length>=1&&quiz.questions.length<=30&&quiz.questions.every(q=>typeof q.q==="string"&&q.q.trim()&&q.q.length<=180&&Array.isArray(q.a)&&q.a.length===4&&q.a.every(a=>typeof a==="string"&&a.trim()&&a.length<=70)&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<=3&&validQuestionMedia(q));


export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  if(url.pathname==="/api/health")return json({ok:true,service:"QuizCraft Realtime",time:new Date().toISOString()});
  if(url.pathname.startsWith("/api/auth/")){
   const stub=env.ROOMS.get(env.ROOMS.idFromName("auth:users"));
   return stub.fetch(new Request("https://auth.internal"+url.pathname.replace("/api","") ,request));
  }
  if(url.pathname==="/api/quizzes"&&request.method==="GET"){
   const stub=env.ROOMS.get(env.ROOMS.idFromName("public:catalog"));return stub.fetch("https://catalog.internal/catalog/list");
  }
  if(url.pathname==="/api/quizzes"&&request.method==="POST"){
   const auth=await resolveUser(env,request.headers.get("Authorization")?.replace(/^Bearer\s+/i,""));if(!auth?.user)return json({error:"퀴즈를 공개하려면 로그인해야 해."},401);
   if(!auth.user.canHost)return json({error:"진행자 권한이 필요해."},403);
   let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
   const quiz=body.quiz;if(!validQuiz(quiz))return json({error:"퀴즈 형식이 올바르지 않아."},400);
   if(JSON.stringify(quiz).length>1250000)return json({error:"첨부 파일 용량이 너무 커."},413);
   const id=crypto.randomUUID().replace(/-/g,"").slice(0,16),title=String(quiz.title||"QuizCraft 퀴즈").slice(0,80),createdAt=Date.now();
   const item={id,title,questionCount:quiz.questions.length,timeLimit:clamp(quiz.timeLimit,5,120),authorId:auth.user.id,authorName:auth.user.nickname,createdAt,visibility:body.visibility==="private"?"private":"public"};
   const quizStub=env.ROOMS.get(env.ROOMS.idFromName("publicquiz:"+id));
   await quizStub.fetch("https://quiz.internal/quiz/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quiz:{...quiz,title,timeLimit:item.timeLimit},meta:item})});
   const catalog=env.ROOMS.get(env.ROOMS.idFromName("public:catalog"));
   const saved=await catalog.fetch("https://catalog.internal/catalog/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});
   if(!saved.ok)return json({error:"공개 퀴즈 저장에 실패했어."},500);return json({quiz:item});
  }
  const publicQuiz=url.pathname.match(/^\/api\/quizzes\/([a-f0-9]{16})$/);
  if(publicQuiz&&request.method==="GET"){
   const catalog=env.ROOMS.get(env.ROOMS.idFromName("public:catalog"));
   const metaRes=await catalog.fetch("https://catalog.internal/catalog/get?id="+publicQuiz[1]);if(!metaRes.ok)return json({error:"퀴즈를 찾을 수 없어."},404);
   const meta=await metaRes.json();if(meta.visibility!=="public")return json({error:"비공개 퀴즈야."},403);
   const qstub=env.ROOMS.get(env.ROOMS.idFromName("publicquiz:"+publicQuiz[1]));return qstub.fetch("https://quiz.internal/quiz/load");
  }

  if(url.pathname==="/api/rooms"&&request.method==="POST"){
   let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
   const quiz=body.quiz;
   if(!quiz||!Array.isArray(quiz.questions)||quiz.questions.length<1||quiz.questions.length>30)return json({error:"퀴즈는 1~30문제가 필요해."},400);
   for(const q of quiz.questions){
    if(typeof q.q!=="string"||!q.q.trim()||q.q.length>180||!Array.isArray(q.a)||q.a.length!==4||q.a.some(a=>typeof a!=="string"||!a.trim()||a.length>70)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3||!validQuestionMedia(q))return json({error:"문제 형식 또는 첨부 미디어가 올바르지 않아."},400);
   }
   if(JSON.stringify(quiz).length>1250000)return json({error:"퀴즈와 첨부 파일 전체 용량은 850KB 이하로 맞춰 줘."},413);
   quiz.title=String(quiz.title||"QuizCraft 퀴즈").slice(0,80);
   quiz.timeLimit=clamp(quiz.timeLimit,5,120);
   const code=String(Math.floor(100000+Math.random()*900000));
   const hostToken=crypto.randomUUID()+crypto.randomUUID();
   const roomId=env.ROOMS.idFromName(code),stub=env.ROOMS.get(roomId);
   const r=await stub.fetch("https://room.internal/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,hostToken,quiz,hostName:String(body.hostName||auth.user.nickname||"진행자").slice(0,18)})});
   if(!r.ok)return json({error:"방을 만들지 못했어."},500);
   return json({code,hostToken});
  }
  if(url.pathname==="/api/library"&&request.method==="POST"){
   let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
   const quiz=body.quiz,invalid=!quiz||!Array.isArray(quiz.questions)||quiz.questions.length<1||quiz.questions.length>30||quiz.questions.some(q=>typeof q.q!=="string"||!q.q.trim()||q.q.length>180||!Array.isArray(q.a)||q.a.length!==4||q.a.some(a=>typeof a!=="string"||!a.trim()||a.length>70)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3||!validQuestionMedia(q));
   if(invalid)return json({error:"퀴즈 형식이 올바르지 않아."},400);
   if(JSON.stringify(quiz).length>1250000)return json({error:"퀴즈와 첨부 파일 전체 용량은 850KB 이하로 맞춰 줘."},413);quiz.title=String(quiz.title||"QuizCraft 퀴즈").slice(0,80);quiz.timeLimit=clamp(quiz.timeLimit,5,120);
   const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let code="";for(let i=0;i<8;i++)code+=alphabet[crypto.getRandomValues(new Uint8Array(1))[0]%alphabet.length];
   const stub=env.ROOMS.get(env.ROOMS.idFromName("library:"+code));
   const saved=await stub.fetch("https://library.internal/library/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quiz,createdAt:Date.now()})});
   if(!saved.ok)return json({error:"퀴즈 공유 저장에 실패했어."},500);return json({code});
  }
  const libraryMatch=url.pathname.match(/^\/api\/library\/([A-Z0-9]{8})$/);
  if(libraryMatch&&request.method==="GET"){const stub=env.ROOMS.get(env.ROOMS.idFromName("library:"+libraryMatch[1]));return stub.fetch("https://library.internal/library/load")}
  const match=url.pathname.match(/^\/api\/rooms\/(\d{6})$/);
  if(match){const roomId=env.ROOMS.idFromName(match[1]);return env.ROOMS.get(roomId).fetch(request)}
  return json({error:"Not found"},404);
 }
};

export class QuizRoom {
 constructor(state){this.state=state;this.sessions=new Map();this.data=null}

 async authFetch(request,url){
  let users=await this.state.storage.get("users")||{},sessions=await this.state.storage.get("sessions")||{};
  const body=async()=>{try{return await request.json()}catch{return {}}};
  const issue=(user)=>{const token=crypto.randomUUID()+crypto.randomUUID();sessions[token]={id:user.id,expires:Date.now()+30*86400000};return {token,user};};
  if(url.pathname==="/auth/register"&&request.method==="POST"){
   const b=await body(),nickname=String(b.nickname||"").trim(),password=String(b.password||""),role=b.role==="host"?"host":"player",key=nickname.toLowerCase();
   if(nickname.length<2||nickname.length>20||!/^[가-힣a-zA-Z0-9_ -]+$/.test(nickname)||password.length<8||password.length>128)return json({error:"닉네임 2~20자, 비밀번호 8~128자로 입력해 줘."},400);
   if(users[key])return json({error:"이미 사용 중인 닉네임이야."},409);
   const salt=crypto.getRandomValues(new Uint8Array(16)),material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},material,256);
   const user={id:"qc:"+key,nickname,provider:"quizcraft",role,canHost:role==="host",createdAt:Date.now(),passwordSalt:Array.from(salt),passwordHash:Array.from(new Uint8Array(bits))};users[key]=user;
   const result=issue({id:user.id,nickname,provider:user.provider,role,canHost:user.canHost});await this.state.storage.put("users",users);await this.state.storage.put("sessions",sessions);return json(result);
  }
  if(url.pathname==="/auth/login"&&request.method==="POST"){
   const b=await body(),key=String(b.nickname||"").trim().toLowerCase(),password=String(b.password||""),u=users[key];if(!u||u.provider!=="quizcraft")return json({error:"계정 또는 비밀번호를 확인해 줘."},401);
   const salt=new Uint8Array(u.passwordSalt),material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]),bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},material,256));
   if(bits.some((v,i)=>v!==u.passwordHash[i]))return json({error:"계정 또는 비밀번호를 확인해 줘."},401);
   const result=issue({id:u.id,nickname:u.nickname,provider:u.provider,role:u.role,canHost:u.canHost});await this.state.storage.put("sessions",sessions);return json(result);
  }
  if(url.pathname==="/auth/youthdeveloper"&&request.method==="POST"){
   const b=await body(),external=String(b.token||"");if(!external)return json({error:"YouthDeveloper 계정 토큰이 없어."},400);
   let verified;try{const r=await fetch("https://web.youthdeveloper-github.workers.dev/api/chat/me",{headers:{Authorization:"Bearer "+external}});verified=await r.json();if(!r.ok||!verified.user?.nickname)throw Error("invalid")}catch{return json({error:"YouthDeveloper 계정을 확인하지 못했어."},401)}
   const nickname=verified.user.nickname,key="yd:"+nickname.toLowerCase();let u=users[key];if(!u){u={id:key,nickname,provider:"youthdeveloper",role:"host",canHost:true,createdAt:Date.now()};users[key]=u}
   const result=issue({id:u.id,nickname:u.nickname,provider:u.provider,role:u.role,canHost:u.canHost});await this.state.storage.put("users",users);await this.state.storage.put("sessions",sessions);return json(result);
  }
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,""),session=sessions[token],user=session&&session.expires>Date.now()?Object.values(users).find(u=>u.id===session.id):null;
  if(url.pathname==="/auth/resolve"&&request.method==="GET")return user?json({user:{id:user.id,nickname:user.nickname,provider:user.provider,role:user.role,canHost:user.canHost}}):json({error:"Unauthorized"},401);
  if(url.pathname==="/auth/me"&&request.method==="GET")return user?json({user:{id:user.id,nickname:user.nickname,provider:user.provider,role:user.role,canHost:user.canHost}}):json({error:"로그인이 필요해."},401);
  if(url.pathname==="/auth/profile"&&request.method==="POST"){
   if(!user)return json({error:"로그인이 필요해."},401);const b=await body(),role=b.role==="host"?"host":"player";user.role=role;user.canHost=role==="host"||user.provider==="youthdeveloper";await this.state.storage.put("users",users);return json({user:{id:user.id,nickname:user.nickname,provider:user.provider,role:user.role,canHost:user.canHost}});
  }
  if(url.pathname==="/auth/logout"&&request.method==="POST"){delete sessions[token];await this.state.storage.put("sessions",sessions);return json({ok:true})}
  return json({error:"Not found"},404);
 }
 async catalogFetch(request,url){
  let items=await this.state.storage.get("publicQuizzes")||[];
  if(url.pathname==="/catalog/list")return json({quizzes:items.filter(x=>x.visibility==="public").sort((a,b)=>b.createdAt-a.createdAt)});
  if(url.pathname==="/catalog/add"&&request.method==="POST"){const item=await request.json();items=[item,...items.filter(x=>x.id!==item.id)].slice(0,1000);await this.state.storage.put("publicQuizzes",items);return json({ok:true})}
  if(url.pathname==="/catalog/get"){const item=items.find(x=>x.id===url.searchParams.get("id"));return item?json(item):json({error:"Not found"},404)}
  return json({error:"Not found"},404);
 }
 async publicQuizFetch(request,url){
  if(url.pathname==="/quiz/save"&&request.method==="POST"){const data=await request.json();await this.state.storage.put("publicQuiz",data);return json({ok:true})}
  if(url.pathname==="/quiz/load"&&request.method==="GET"){const data=await this.state.storage.get("publicQuiz");return data?json(data):json({error:"Not found"},404)}
  return json({error:"Not found"},404);
 }
\n async room(){return this.data||await this.state.storage.get("room")}
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==="/library/save"&&request.method==="POST"){let data;try{data=await request.json()}catch{return new Response("Invalid JSON",{status:400})}await this.state.storage.put("sharedQuiz",data);return new Response("ok")}
  if(url.pathname==="/library/load"&&request.method==="GET"){const data=await this.state.storage.get("sharedQuiz");if(!data)return new Response(JSON.stringify({error:"공유 코드를 찾을 수 없어."}),{status:404,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});return new Response(JSON.stringify({quiz:data.quiz}),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}
  if(url.pathname==="/create"&&request.method==="POST"){
   const d=await request.json();await this.state.storage.put("room",d);this.data=d;return new Response("ok");
  }
  const room=await this.room();if(!room)return new Response(JSON.stringify({error:"존재하지 않는 방이야."}),{status:404});
  if(request.headers.get("Upgrade")!=="websocket")return new Response("WebSocket required",{status:426});
  const role=url.searchParams.get("role"),name=(url.searchParams.get("name")||"참가자").slice(0,18),token=url.searchParams.get("token");
  if(role==="host"&&token!==room.hostToken)return new Response("Unauthorized",{status:401});
  if(role!=="host"&&role!=="player")return new Response("Invalid role",{status:400});
  if(role==="player"&&!room.started&&this.sessions.size>=100)return new Response("Room full",{status:409});
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();
  const pid=crypto.randomUUID();this.sessions.set(pid,{ws:server,role,name,score:0,answered:false,lastCorrect:false,joinedAt:Date.now(),correctCount:0,wrongCount:0,history:[]});
  server.serializeAttachment({pid,role,name});
  server.addEventListener("message",e=>this.onMessage(pid,e.data));
  server.addEventListener("close",()=>{const gone=this.sessions.get(pid);this.sessions.delete(pid);this.broadcast({type:"lobby",players:this.players()});this.sendHost({type:"roster",players:this.hostPlayers()});if(gone?.role==="player")this.sendHost({type:"activity",event:{name:gone.name,action:"left",at:Date.now()}})});
  server.addEventListener("error",()=>this.sessions.delete(pid));
  server.send(JSON.stringify({type:"lobby",players:this.players()}));
  this.broadcast({type:"lobby",players:this.players()});
  this.sendHost({type:"roster",players:this.hostPlayers()});
  if(role==="player")this.sendHost({type:"activity",event:{name,action:"joined",at:Date.now()}});
  if(role==="player"&&room.started&&!room.revealed){
   server.send(JSON.stringify({type:"question",index:room.index,total:room.quiz.questions.length,question:room.quiz.questions[room.index],timeLimit:room.quiz.timeLimit||20,players:this.players(),midJoin:true}));
   const remaining=Math.max(0,Math.ceil((room.deadline-Date.now())/1000));
   server.send(JSON.stringify({type:"timer",remaining,total:room.quiz.timeLimit||20}));
  }else if(role==="player"&&room.started&&room.revealed){const q=room.quiz.questions[room.index],stat=room.stats?.[room.index]||{};server.send(JSON.stringify({type:"question",index:room.index,total:room.quiz.questions.length,question:q,timeLimit:room.quiz.timeLimit||20,players:this.players(),midJoin:true}));server.send(JSON.stringify({type:"reveal",answerText:q.a[q.correct],correctIndex:q.correct,answerCounts:stat.answerCounts||[0,0,0,0],leaderboard:this.leaderboard(),last:room.index===room.quiz.questions.length-1,midJoin:true}));}
  return new Response(null,{status:101,webSocket:client});
 }
 players(){return [...this.sessions.values()].filter(p=>p.role==="player").map(p=>({name:p.name,score:p.score,answered:p.answered}))}
 hostPlayers(){return [...this.sessions.entries()].filter(([,p])=>p.role==="player").map(([id,p])=>({id,name:p.name,score:p.score,answered:p.answered,lastCorrect:p.lastCorrect,correctCount:p.correctCount,wrongCount:p.wrongCount,joinedAt:p.joinedAt,lastAnsweredAt:p.lastAnsweredAt||null,history:p.history||[]}))}
 sendHost(m){const s=JSON.stringify(m);for(const p of this.sessions.values())if(p.role==="host")try{p.ws.send(s)}catch{}}
 broadcast(m){const s=JSON.stringify(m);for(const p of this.sessions.values())try{p.ws.send(s)}catch{}}
 host(pid){return this.sessions.get(pid)?.role==="host"}
 leaderboard(){return [...this.sessions.values()].filter(p=>p.role==="player").sort((a,b)=>b.score-a.score).map(p=>({name:p.name,score:p.score,lastCorrect:p.lastCorrect}))}
 async reveal(room,automatic=false){
  if(!room.started||room.revealed)return;
  room.revealed=true;
  const q=room.quiz.questions[room.index],stat=room.stats?.[room.index]||{question:q.q,correct:0,answered:0,total:this.players().length,answerCounts:[0,0,0,0],responseTimes:[]};
  stat.total=this.players().length;stat.averageSeconds=stat.responseTimes.length?Math.round(stat.responseTimes.reduce((a,b)=>a+b,0)/stat.responseTimes.length/100)/10:0;
  room.stats=room.stats||[];room.stats[room.index]=stat;
  await this.state.storage.put("room",room);await this.state.storage.deleteAlarm();
  this.broadcast({type:"reveal",answerText:q.a[q.correct],correctIndex:q.correct,answerCounts:stat.answerCounts||[0,0,0,0],leaderboard:this.leaderboard(),last:room.index===room.quiz.questions.length-1,automatic});
 }
 async alarm(){
  const room=await this.room();if(!room||!room.started||room.revealed)return;
  const remaining=Math.max(0,Math.ceil((room.deadline-Date.now())/1000));
  if(remaining<=0){await this.reveal(room,true);return}
  this.broadcast({type:"timer",remaining,total:room.quiz.timeLimit||20});
  await this.state.storage.setAlarm(Date.now()+1000);
 }
 async onMessage(pid,raw){
  const sender=this.sessions.get(pid);if(!sender)return;
  let m;try{m=JSON.parse(raw)}catch{return}
  const room=await this.room();if(!room)return;
  if(sender.role==="player"&&m.type==="answer"){
   if(!room.started||room.revealed||sender.answered||!Number.isInteger(m.answer)||m.answer<0||m.answer>3)return;
   sender.answered=true;sender.lastCorrect=m.answer===room.quiz.questions[room.index].correct;if(sender.lastCorrect)sender.correctCount++;else sender.wrongCount++;
   room.stats=room.stats||[];const qstat=room.stats[room.index]||(room.stats[room.index]={question:room.quiz.questions[room.index].q,correct:0,answered:0,total:this.players().length,answerCounts:[0,0,0,0],responseTimes:[]});
   qstat.answered++;qstat.answerCounts[m.answer]++;if(sender.lastCorrect)qstat.correct++;qstat.responseTimes.push(Date.now()-room.questionStartedAt);
   const elapsed=Date.now()-room.questionStartedAt;
   sender.score+=sender.lastCorrect?Math.max(100,Math.round(1000-900*Math.min(1,elapsed/(room.quiz.timeLimit*1000)))):0;
   sender.answeredAt=Date.now();sender.lastAnsweredAt=sender.answeredAt;sender.history.push({question:room.index+1,questionText:room.quiz.questions[room.index].q,selectedIndex:m.answer,selectedText:room.quiz.questions[room.index].a[m.answer],correctIndex:room.quiz.questions[room.index].correct,correctText:room.quiz.questions[room.index].a[room.quiz.questions[room.index].correct],correct:sender.lastCorrect,elapsedSeconds:Math.round(elapsed/100)/10,scoreEarned:sender.lastCorrect?Math.max(100,Math.round(1000-900*Math.min(1,elapsed/(room.quiz.timeLimit*1000)))):0});
   const answered=[...this.sessions.values()].filter(p=>p.role==="player"&&p.answered).length;
   const total=this.players().length;
   this.broadcast({type:"answered",count:answered,total,players:this.players()});this.sendHost({type:"roster",players:this.hostPlayers()});this.sendHost({type:"activity",event:{name:sender.name,action:"answered",correct:sender.lastCorrect,question:room.index+1,at:Date.now()}});
   if(total>0&&answered>=total)await this.reveal(room,false);
   return;
  }
  if(!this.host(pid))return;
  if(m.type==="start"){
   if(room.started)return;
   room.started=true;room.index=0;room.revealed=false;room.stats=[];room.questionStartedAt=Date.now();
   room.deadline=Date.now()+(room.quiz.timeLimit||20)*1000;
   for(const p of this.sessions.values()){p.answered=false;p.lastCorrect=false}
   await this.state.storage.put("room",room);await this.state.storage.setAlarm(Date.now()+1000);
   this.broadcast({type:"started",index:0,total:room.quiz.questions.length,question:room.quiz.questions[0],timeLimit:room.quiz.timeLimit||20,players:this.players()});
  }
  if(m.type==="kick"&&typeof m.playerId==="string"){const target=this.sessions.get(m.playerId);if(target?.role==="player"){try{target.ws.send(JSON.stringify({type:"kicked",message:"진행자가 게임에서 내보냈어."}));target.ws.close(4001,"Removed by host")}catch{}this.sessions.delete(m.playerId);this.broadcast({type:"lobby",players:this.players()});this.sendHost({type:"roster",players:this.hostPlayers()});this.sendHost({type:"activity",event:{name:target.name,action:"kicked",at:Date.now()}})}return;}
  if(m.type==="reveal")await this.reveal(room,false);
  if(m.type==="leaderboard"&&room.revealed){const sorted=this.leaderboard();const scores=[...new Set(sorted.map(p=>p.score))];const ranked=sorted.map(p=>({...p,rank:scores.indexOf(p.score)+1}));this.broadcast({type:"leaderboard",leaderboard:ranked.filter(p=>p.rank<=5),last:room.index===room.quiz.questions.length-1});}
  if(m.type==="next"){
   if(!room.revealed)return;
   if(room.index+1>=room.quiz.questions.length){
    room.started=false;await this.state.storage.put("room",room);await this.state.storage.deleteAlarm();
    this.broadcast({type:"ended",leaderboard:this.leaderboard(),stats:room.stats||[]});return;
   }
   room.index++;room.revealed=false;room.questionStartedAt=Date.now();
   room.deadline=Date.now()+(room.quiz.timeLimit||20)*1000;
   for(const p of this.sessions.values()){p.answered=false;p.lastCorrect=false}
   await this.state.storage.put("room",room);await this.state.storage.setAlarm(Date.now()+1000);
   this.broadcast({type:"question",index:room.index,total:room.quiz.questions.length,question:room.quiz.questions[room.index],timeLimit:room.quiz.timeLimit||20,players:this.players()});
  }
 }
}