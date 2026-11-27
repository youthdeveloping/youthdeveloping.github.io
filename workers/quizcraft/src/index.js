/* - by ChatGPT Ai */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||min));

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  if(url.pathname==="/api/health")return json({ok:true,service:"QuizCraft Realtime",time:new Date().toISOString()});
  if(url.pathname==="/api/rooms"&&request.method==="POST"){
   let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
   const quiz=body.quiz;
   if(!quiz||!Array.isArray(quiz.questions)||quiz.questions.length<1||quiz.questions.length>30)return json({error:"퀴즈는 1~30문제가 필요해."},400);
   for(const q of quiz.questions){
    if(typeof q.q!=="string"||!q.q.trim()||q.q.length>180||!Array.isArray(q.a)||q.a.length!==4||q.a.some(a=>typeof a!=="string"||!a.trim()||a.length>70)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3)return json({error:"문제 형식이 올바르지 않아."},400);
   }
   quiz.title=String(quiz.title||"QuizCraft 퀴즈").slice(0,80);
   quiz.timeLimit=clamp(quiz.timeLimit,5,120);
   const code=String(Math.floor(100000+Math.random()*900000));
   const hostToken=crypto.randomUUID()+crypto.randomUUID();
   const roomId=env.ROOMS.idFromName(code),stub=env.ROOMS.get(roomId);
   const r=await stub.fetch("https://room.internal/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,hostToken,quiz,hostName:String(body.hostName||"진행자").slice(0,18)})});
   if(!r.ok)return json({error:"방을 만들지 못했어."},500);
   return json({code,hostToken});
  }
  if(url.pathname==="/api/library"&&request.method==="POST"){
   let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
   const quiz=body.quiz,invalid=!quiz||!Array.isArray(quiz.questions)||quiz.questions.length<1||quiz.questions.length>30||quiz.questions.some(q=>typeof q.q!=="string"||!q.q.trim()||q.q.length>180||!Array.isArray(q.a)||q.a.length!==4||q.a.some(a=>typeof a!=="string"||!a.trim()||a.length>70)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3);
   if(invalid)return json({error:"퀴즈 형식이 올바르지 않아."},400);
   quiz.title=String(quiz.title||"QuizCraft 퀴즈").slice(0,80);quiz.timeLimit=clamp(quiz.timeLimit,5,120);
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
 async room(){return this.data||await this.state.storage.get("room")}
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
  const pid=crypto.randomUUID();this.sessions.set(pid,{ws:server,role,name,score:0,answered:false,lastCorrect:false});
  server.serializeAttachment({pid,role,name});
  server.addEventListener("message",e=>this.onMessage(pid,e.data));
  server.addEventListener("close",()=>{this.sessions.delete(pid);this.broadcast({type:"lobby",players:this.players()})});
  server.addEventListener("error",()=>this.sessions.delete(pid));
  server.send(JSON.stringify({type:"lobby",players:this.players()}));
  this.broadcast({type:"lobby",players:this.players()});
  if(room.started&&!room.revealed){
   const remaining=Math.max(0,Math.ceil((room.deadline-Date.now())/1000));
   server.send(JSON.stringify({type:"timer",remaining,total:room.quiz.timeLimit||20}));
  }
  return new Response(null,{status:101,webSocket:client});
 }
 players(){return [...this.sessions.values()].filter(p=>p.role==="player").map(p=>({name:p.name,score:p.score,answered:p.answered}))}
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
  this.broadcast({type:"reveal",answerText:q.a[q.correct],leaderboard:this.leaderboard(),last:room.index===room.quiz.questions.length-1,automatic});
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
   sender.answered=true;sender.lastCorrect=m.answer===room.quiz.questions[room.index].correct;
   room.stats=room.stats||[];const qstat=room.stats[room.index]||(room.stats[room.index]={question:room.quiz.questions[room.index].q,correct:0,answered:0,total:this.players().length,answerCounts:[0,0,0,0],responseTimes:[]});
   qstat.answered++;qstat.answerCounts[m.answer]++;if(sender.lastCorrect)qstat.correct++;qstat.responseTimes.push(Date.now()-room.questionStartedAt);
   const elapsed=Date.now()-room.questionStartedAt;
   sender.score+=sender.lastCorrect?Math.max(100,Math.round(1000-900*Math.min(1,elapsed/(room.quiz.timeLimit*1000)))):0;
   sender.answeredAt=Date.now();
   const answered=[...this.sessions.values()].filter(p=>p.role==="player"&&p.answered).length;
   const total=this.players().length;
   this.broadcast({type:"answered",count:answered,total});
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
   this.broadcast({type:"started",index:0,total:room.quiz.questions.length,question:{q:room.quiz.questions[0].q,a:room.quiz.questions[0].a},timeLimit:room.quiz.timeLimit||20});
  }
  if(m.type==="reveal")await this.reveal(room,false);
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
   this.broadcast({type:"question",index:room.index,total:room.quiz.questions.length,question:{q:room.quiz.questions[room.index].q,a:room.quiz.questions[room.index].a},timeLimit:room.quiz.timeLimit||20});
  }
 }
}