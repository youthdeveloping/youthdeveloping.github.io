/* - by ChatGPT Ai */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  if(url.pathname==="/api/health")return json({ok:true,service:"QuizCraft Realtime",time:new Date().toISOString()});
  if(url.pathname==="/api/rooms"&&request.method==="POST"){
   let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
   if(!body.quiz||!Array.isArray(body.quiz.questions)||body.quiz.questions.length<1||body.quiz.questions.length>30)return json({error:"퀴즈는 1~30문제가 필요해."},400);
   for(const q of body.quiz.questions){if(!q.q||!Array.isArray(q.a)||q.a.length!==4||!Number.isInteger(q.correct)||q.correct<0||q.correct>3)return json({error:"문제 형식이 올바르지 않아."},400)}
   const code=String(Math.floor(100000+Math.random()*900000));
   const hostToken=crypto.randomUUID()+crypto.randomUUID();
   const id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id);
   const r=await stub.fetch("https://room.internal/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,hostToken,quiz,hostName:String(body.hostName||"진행자").slice(0,18)})});
   if(!r.ok)return json({error:"방을 만들지 못했어."},500);
   return json({code,hostToken});
  }
  const match=url.pathname.match(/^\/api\/rooms\/(\d{6})$/);
  if(match){const id=env.ROOMS.idFromName(match[1]);return env.ROOMS.get(id).fetch(request)}
  return json({error:"Not found"},404);
 }
};
export class QuizRoom {
 constructor(state){this.state=state;this.sessions=new Map();this.data=null}
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==="/create"&&request.method==="POST"){const d=await request.json();await this.state.storage.put("room",d);this.data=d;return new Response("ok")}
  const room=this.data||await this.state.storage.get("room");if(!room)return new Response(JSON.stringify({error:"존재하지 않는 방이야."}),{status:404});
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
  return new Response(null,{status:101,webSocket:client});
 }
 players(){return [...this.sessions.values()].filter(p=>p.role==="player").map(p=>({name:p.name,score:p.score}))}
 broadcast(m){const s=JSON.stringify(m);for(const p of this.sessions.values())try{p.ws.send(s)}catch{}}
 host(pid){return this.sessions.get(pid)?.role==="host"}
 async onMessage(pid,raw){
  const sender=this.sessions.get(pid);if(!sender)return;let m;try{m=JSON.parse(raw)}catch{return}
  const room=this.data||await this.state.storage.get("room");if(!room)return;
  if(sender.role==="player"&&m.type==="answer"){
   if(!room.started||room.revealed||sender.answered||!Number.isInteger(m.answer))return;
   sender.answered=true;sender.lastCorrect=m.answer===room.quiz.questions[room.index].correct;
   sender.score+=sender.lastCorrect?Math.max(500,1000-Math.min(500,Date.now()-room.questionStartedAt)/2):0;
   sender.answeredAt=Date.now();this.broadcast({type:"answered",count:[...this.sessions.values()].filter(p=>p.role==="player"&&p.answered).length,total:this.players().length});return;
  }
  if(!this.host(pid))return;
  if(m.type==="start"){room.started=true;room.index=0;room.revealed=false;room.questionStartedAt=Date.now();await this.state.storage.put("room",room);this.broadcast({type:"started",index:0,total:room.quiz.questions.length,question:{q:room.quiz.questions[0].q,a:room.quiz.questions[0].a}})}
  if(m.type==="reveal"){if(!room.started||room.revealed)return;room.revealed=true;await this.state.storage.put("room",room);const q=room.quiz.questions[room.index];const leaderboard=this.leaderboard();this.broadcast({type:"reveal",answerText:q.a[q.correct],leaderboard,last:room.index===room.quiz.questions.length-1})}
  if(m.type==="next"){if(!room.revealed)return;if(room.index+1>=room.quiz.questions.length){room.started=false;this.broadcast({type:"ended",leaderboard:this.leaderboard()});return}room.index++;room.revealed=false;room.questionStartedAt=Date.now();for(const p of this.sessions.values()){p.answered=false;p.lastCorrect=false}await this.state.storage.put("room",room);this.broadcast({type:"question",index:room.index,total:room.quiz.questions.length,question:{q:room.quiz.questions[room.index].q,a:room.quiz.questions[room.index].a}})}
 }
 leaderboard(){return [...this.sessions.values()].filter(p=>p.role==="player").sort((a,b)=>b.score-a.score).map(p=>({name:p.name,score:p.score,lastCorrect:p.lastCorrect}))}
}
