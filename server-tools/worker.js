const PAGES_ORIGIN = "https://youthdeveloping.github.io";
const cors = {"Access-Control-Allow-Origin":PAGES_ORIGIN,"Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Vary":"Origin"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors}});
const makeKey=()=>{const a="abcdefghjkmnpqrstuvwxyz23456789";const b=new Uint8Array(8);crypto.getRandomValues(b);return Array.from(b,x=>a[x%a.length]).join("");};
const validUrl=v=>{try{const u=new URL(v);return (u.protocol==="http:"||u.protocol==="https:")&&u.hostname.includes(".");}catch{return false;}};
const getRecord=async(env,key)=>{const data=await env.URL_SHORTER_KV.get("link:"+key);if(data){try{return {record:JSON.parse(data),storageKey:"link:"+key};}catch{}}const legacy=await env.URL_SHORTER_KV.get(key);if(!legacy)return null;try{const p=JSON.parse(legacy);if(p&&p.url)return {record:p,storageKey:key};}catch{}return {record:{url:legacy,createdAt:null,clicks:0,legacy:true},storageKey:key};};
const b64url=s=>btoa(s).split("+").join("-").split("/").join("_").replace(/=+$/,"");const tokenSig=async(v,k)=>{const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(k),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(v));return b64url(String.fromCharCode(...new Uint8Array(sig)));};const makeAdminToken=async(k)=>{const p=b64url(JSON.stringify({exp:Date.now()+28800000}));const v="v1."+p;return v+"."+await tokenSig(v,k);};const isAdmin=async(r,e)=>{const raw=(r.headers.get("Authorization")||"");const t=raw.startsWith("Bearer ")?raw.slice(7).trim().split("."):[];if(!e.URL_SHORT_KEY||t.length!==3||t[0]!=="v1")return false;const sig=await tokenSig(t[0]+"."+t[1],e.URL_SHORT_KEY);if(sig!==t[2])return false;try{const payload=atob(t[1].replace(/-/g,"+").replace(/_/g,"/"));return JSON.parse(payload).exp>Date.now();}catch{return false;}};
export default {async fetch(request,env){const url=new URL(request.url);const path=url.pathname.split("/").filter(Boolean);if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
if(path[0]==="api"&&path[1]==="shorten"&&request.method==="POST"){try{const body=await request.json();const longUrl=String(body.longUrl||"").trim();const alias=String(body.alias||"").trim().toLowerCase();if(!validUrl(longUrl))return json({error:"올바른 http:// 또는 https:// 주소를 입력해 주세요."},400);if(alias&&!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(alias))return json({error:"사용자 지정 코드는 영문 소문자·숫자·밑줄·하이픈으로 3~32자여야 합니다."},400);let key=alias;if(key){if(await env.URL_SHORTER_KV.get("link:"+key)||await env.URL_SHORTER_KV.get(key))return json({error:"이미 사용 중인 코드입니다. 다른 코드를 입력해 주세요."},409);}else{for(let i=0;i<6;i++){const c=makeKey();if(!(await env.URL_SHORTER_KV.get("link:"+c))&&!(await env.URL_SHORTER_KV.get(c))){key=c;break;}}if(!key)return json({error:"코드 생성에 실패했습니다. 다시 시도해 주세요."},503);}await env.URL_SHORTER_KV.put("link:"+key,JSON.stringify({url:longUrl,createdAt:new Date().toISOString(),clicks:0,alias:Boolean(alias)}));return json({shortKey:key,shortUrl:PAGES_ORIGIN+"/s/"+encodeURIComponent(key),destination:longUrl});}catch{return json({error:"요청을 처리하지 못했습니다. 주소를 확인하고 다시 시도해 주세요."},400);}}
if(path[0]==="api"&&path[1]==="resolve"&&path.length===3&&request.method==="GET"){const key=decodeURIComponent(path[2]);const found=await getRecord(env,key);if(!found||!validUrl(found.record.url))return json({error:"링크를 찾을 수 없습니다."},404);if(!found.record.legacy){const next={...found.record,clicks:Number(found.record.clicks||0)+1,lastClickedAt:new Date().toISOString()};await env.URL_SHORTER_KV.put(found.storageKey,JSON.stringify(next));}return json({url:found.record.url});}

if(path[0]==="api"&&path[1]==="tools"){
 if(!(await isAdmin(request,env)))return json({error:"서버 인증이 필요합니다."},401);
 const app=path[2]||"";
 const allowedTools=new Set(["chat","ledger","suggestions","notices","status","stats"]);
 if(!allowedTools.has(app))return json({error:"지원하지 않는 도구입니다."},404);
 const key="tool:"+app;
 const load=async()=>{const raw=await env.URL_SHORTER_KV.get(key);if(raw){try{return JSON.parse(raw)}catch{}}return app==="status"?{state:"정상",message:"모든 기능이 정상 작동 중입니다.",updatedAt:new Date().toISOString()}:[]};
 const save=async value=>{await env.URL_SHORTER_KV.put(key,JSON.stringify(value));};
 if(app==="stats"&&request.method==="GET"){const out={};for(const n of ["chat","ledger","suggestions","notices"]){const raw=await env.URL_SHORTER_KV.get("tool:"+n);try{const v=JSON.parse(raw||"[]");out[n]=Array.isArray(v)?v.length:0}catch{out[n]=0}}return json({stats:out,storage:"Cloudflare KV",generatedAt:new Date().toISOString()});}
 if(request.method==="GET")return json({data:await load()});
 if(app==="status"&&request.method==="PUT"){try{const b=await request.json();const state=String(b.state||"");const message=String(b.message||"").trim();if(!["정상","점검 중","장애"].includes(state)||!message||message.length>1000)return json({error:"상태 또는 설명이 올바르지 않습니다."},400);const v={state,message,updatedAt:new Date().toISOString()};await save(v);return json({ok:true,data:v})}catch{return json({error:"요청 형식이 올바르지 않습니다."},400)}}
 if(app==="status")return json({error:"상태 변경은 PUT을 사용하세요."},405);
 const items=await load();if(!Array.isArray(items))return json({error:"저장 데이터 형식 오류"},500);
 if(request.method==="POST"){try{const b=await request.json();let item={id:crypto.randomUUID(),createdAt:new Date().toISOString()};
 if(app==="chat"){item.name=String(b.name||"").trim().slice(0,30);item.message=String(b.message||"").trim().slice(0,500);if(!item.name||!item.message)return json({error:"닉네임과 메시지를 입력해 주세요."},400);}
 if(app==="ledger"){item.type=b.type==="out"?"out":"in";item.amount=Number(b.amount);item.memo=String(b.memo||"").trim().slice(0,100);if(!Number.isSafeInteger(item.amount)||item.amount<1||item.amount>100000000||!item.memo)return json({error:"금액 또는 내용을 확인해 주세요."},400);}
 if(app==="suggestions"){item.title=String(b.title||"").trim().slice(0,100);item.body=String(b.body||"").trim().slice(0,3000);item.state="접수";if(!item.title||!item.body)return json({error:"제목과 내용을 입력해 주세요."},400);}
 if(app==="notices"){item.title=String(b.title||"").trim().slice(0,120);item.body=String(b.body||"").trim().slice(0,5000);if(!item.title||!item.body)return json({error:"제목과 내용을 입력해 주세요."},400);}
 items.push(item);const cap=app==="chat"?500:2000;if(items.length>cap)items.splice(0,items.length-cap);await save(items);return json({ok:true,item},201)}catch{return json({error:"요청 본문을 읽을 수 없습니다."},400)}}
 const id=path[3]||"";
 if(request.method==="PUT"){const index=items.findIndex(x=>x.id===id);if(index<0)return json({error:"항목을 찾을 수 없습니다."},404);try{const b=await request.json();if(app==="suggestions"){const state=String(b.state||"");if(!["접수","검토 중","완료"].includes(state))return json({error:"상태 값이 올바르지 않습니다."},400);items[index].state=state}else if(app==="notices"){const title=String(b.title||"").trim().slice(0,120),body=String(b.body||"").trim().slice(0,5000);if(!title||!body)return json({error:"제목과 내용을 입력해 주세요."},400);items[index].title=title;items[index].body=body;items[index].updatedAt=new Date().toISOString()}else return json({error:"이 항목은 수정할 수 없습니다."},405);await save(items);return json({ok:true,item:items[index]})}catch{return json({error:"요청 본문을 읽을 수 없습니다."},400)}}
 if(request.method==="DELETE"){if(!id)return json({error:"항목 ID가 필요합니다."},400);const next=items.filter(x=>x.id!==id);if(next.length===items.length)return json({error:"항목을 찾을 수 없습니다."},404);await save(next);return json({ok:true,id})}
 return json({error:"지원하지 않는 HTTP 메서드입니다."},405);
}

if(path[0]==="api"&&path[1]==="admin"&&path[2]==="login"&&request.method==="POST"){try{const body=await request.json();if(!env.ADMIN_SECRET||String(body.password||"")!==env.ADMIN_SECRET)return json({error:"비밀번호가 올바르지 않습니다."},401);if(!env.URL_SHORT_KEY)return json({error:"URL_SHORT_KEY 설정이 없습니다."},500);return json({token:await makeAdminToken(env.URL_SHORT_KEY),expiresIn:28800});}catch{return json({error:"로그인 요청 오류"},400);}}if(path[0]==="api"&&path[1]==="admin"){if(!(await isAdmin(request,env)))return json({error:"관리자 인증이 필요합니다."},401);
if(path[2]==="github"&&(request.method==="GET"||request.method==="PUT")){
 try{
  if(!env.GIT_TOKEN)return json({error:"Worker의 GIT_TOKEN 환경변수가 설정되지 않았습니다."},500);
  const allowed=new Set(["data/apps.json","data/socials.json"]);
  const qpath=request.method==="GET"?url.searchParams.get("path"):null;
  const body=request.method==="PUT"?await request.json():null;
  const filePath=String(qpath||(body&&body.path)||"");
  const branch=String((request.method==="GET"?url.searchParams.get("branch"):body&&body.branch)||"main");
  const repo=String((body&&body.repo)||"youthdeveloping/youthdeveloping.github.io");
  if(repo!=="youthdeveloping/youthdeveloping.github.io"||!allowed.has(filePath)||branch!=="main")return json({error:"허용되지 않은 저장소·파일·브랜치입니다."},400);
  const api="https://api.github.com/repos/"+repo+"/contents/"+filePath.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(branch);
  const ghHeaders={Authorization:"Bearer "+env.GIT_TOKEN,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"YouthDeveloper-Admin"};
  if(request.method==="GET"){
   const gr=await fetch(api,{headers:ghHeaders});
   if(!gr.ok)return json({error:"GitHub 파일 조회에 실패했습니다.",status:gr.status},gr.status===404?404:502);
   const file=await gr.json();
   const bin=atob(String(file.content||"").replace(/\s/g,""));
   const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
   return json({content:new TextDecoder().decode(bytes),sha:file.sha,path:filePath,branch});
  }
  if(typeof body.content!=="string"||body.content.length>500000)return json({error:"파일 내용이 없거나 너무 큽니다."},400);
  let sha;
  const current=await fetch(api,{headers:ghHeaders});
  if(current.ok)sha=(await current.json()).sha;
  else if(current.status!==404)return json({error:"GitHub 기존 파일 확인에 실패했습니다.",status:current.status},502);
  const bytes=new TextEncoder().encode(body.content);let binary="";
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  const payload={message:String(body.message||"Update "+filePath+" via admin").slice(0,120),content:btoa(binary),branch};
  if(sha)payload.sha=sha;
  const wr=await fetch(api,{method:"PUT",headers:{...ghHeaders,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const result=await wr.json().catch(()=>({}));
  if(!wr.ok)return json({error:"GitHub 저장에 실패했습니다.",status:wr.status,detail:result.message||""},wr.status===409||wr.status===422?409:502);
  return json({ok:true,path:filePath,commit:result.commit&&result.commit.sha||null});
 }catch(e){return json({error:"GitHub 연결 처리 중 오류가 발생했습니다."},500);}
}
if(path.length===3&&path[2]==="links"&&request.method==="GET"){const listing=await env.URL_SHORTER_KV.list({prefix:"link:",limit:1000});const links=[];for(const item of listing.keys){const key=item.name.slice(5);const data=await env.URL_SHORTER_KV.get(item.name);if(!data)continue;try{const r=JSON.parse(data);links.push({key,url:r.url,createdAt:r.createdAt||null,clicks:Number(r.clicks||0),alias:Boolean(r.alias),shortUrl:PAGES_ORIGIN+"/s/"+encodeURIComponent(key)});}catch{}}links.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return json({links,truncated:listing.list_complete===false});}if(path.length===4&&path[2]==="links"&&request.method==="DELETE"){const key=decodeURIComponent(path[3]||"");if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(key))return json({error:"잘못된 코드입니다."},400);await env.URL_SHORTER_KV.delete("link:"+key);await env.URL_SHORTER_KV.delete(key);return json({ok:true,key});}return json({error:"지원하지 않는 관리자 요청입니다."},404);}
if(request.method==="GET"&&path.length===1&&path[0]!=="api"){const key=decodeURIComponent(path[0]);const found=await getRecord(env,key);if(!found||!validUrl(found.record.url))return new Response("존재하지 않거나 만료된 단축 링크입니다.",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8"}});if(!found.record.legacy)await env.URL_SHORTER_KV.put(found.storageKey,JSON.stringify({...found.record,clicks:Number(found.record.clicks||0)+1,lastClickedAt:new Date().toISOString()}));return Response.redirect(found.record.url,302);}return new Response("Not Found",{status:404,headers:cors});}};