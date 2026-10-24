const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin || "https://youthdeveloping.github.io",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=utf-8", ...headers}});
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function ensure(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_data (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  const row = await db.prepare("SELECT id FROM admin_data WHERE id=1").first();
  if (!row) {
    const payload = {games:[],events:[],pages:[]};
    await db.prepare("INSERT INTO admin_data(id,payload,updated_at) VALUES(1,?,?)").bind(JSON.stringify(payload),new Date().toISOString()).run();
  }
}
export default {
 async fetch(request, env) {
  const origin=request.headers.get("Origin")||"";
  const allowed=origin==="https://youthdeveloping.github.io"||origin==="http://localhost:8788";
  const headers=cors(allowed?origin:"https://youthdeveloping.github.io");
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(!allowed) return json({error:"Origin not allowed"},403,headers);
  const url=new URL(request.url);
  if(url.pathname==="/api/health") return json({ok:true,service:"nolguro-admin-api"},200,headers);
  if(url.pathname==="/api/login"&&request.method==="POST"){
    let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400,headers)}
    if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET) return json({error:"관리자 비밀 설정이 완료되지 않았습니다. Cloudflare에서 ADMIN_PASSWORD와 SESSION_SECRET을 설정해 주세요."},503,headers);
    if(body.password!==env.ADMIN_PASSWORD) return json({error:"비밀번호가 올바르지 않습니다."},401,headers);
    const exp=String(Date.now()+8*60*60*1000), token=exp+"."+await sign(exp,env.SESSION_SECRET);
    return json({ok:true},200,{...headers,"Set-Cookie":"nolguro_admin="+token+"; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=28800"});
  }
  if(url.pathname==="/api/logout") return json({ok:true},200,{...headers,"Set-Cookie":"nolguro_admin=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"});
  const cookie=request.headers.get("Cookie")||"";
  const token=(cookie.match(/(?:^|;\s*)nolguro_admin=([^;]+)/)||[])[1]||"";
  const parts=token.split(".");
  let authed=false;
  if(parts.length===2&&Number(parts[0])>Date.now()&&env.SESSION_SECRET){authed=(await sign(parts[0],env.SESSION_SECRET))===parts[1]}
  if(!authed)return json({error:"관리자 로그인이 필요합니다."},401,headers);
  if(!env.DB)return json({error:"D1 binding missing"},500,headers);
  try{
    await ensure(env.DB);
    if(url.pathname==="/api/data"&&request.method==="GET"){
      const row=await env.DB.prepare("SELECT payload,updated_at FROM admin_data WHERE id=1").first();
      return json({data:JSON.parse(row.payload),updatedAt:row.updated_at},200,headers);
    }
    if(url.pathname==="/api/data"&&request.method==="PUT"){
      let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400,headers)}
      if(!body||!Array.isArray(body.games)||!Array.isArray(body.events)||!Array.isArray(body.pages))return json({error:"Required lists missing"},400,headers);
      if(body.games.length>1000||body.events.length>500||body.pages.length>1000)return json({error:"Too many records"},413,headers);
      const stamp=new Date().toISOString();
      await env.DB.prepare("UPDATE admin_data SET payload=?,updated_at=? WHERE id=1").bind(JSON.stringify({games:body.games,events:body.events,pages:body.pages}),stamp).run();
      return json({ok:true,updatedAt:stamp},200,headers);
    }
    return json({error:"Not found"},404,headers);
  }catch(e){return json({error:"Server error"},500,headers)}
 }
};