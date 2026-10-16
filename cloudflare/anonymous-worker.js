export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  const cors = { "Access-Control-Allow-Origin": "https://youthdeveloping.github.io", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Content-Type": "application/json; charset=utf-8" };
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
  if(request.method==="OPTIONS") return new Response(null,{headers:cors});
  if(url.pathname!=="/api/anonymous" && !url.pathname.startsWith("/api/anonymous/")) return json({error:"Not found"},404);
  if(!env.DB) return json({error:"Database binding DB is not configured"},503);
  const admin = request.headers.get("Authorization")==="Bearer "+env.ADMIN_TOKEN && !!env.ADMIN_TOKEN;
  try {
   if(request.method==="GET" && url.pathname==="/api/anonymous"){
    const rows=await env.DB.prepare("SELECT id, body, created_at FROM messages WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 100").all();
    return json({messages:rows.results||[]});
   }
   if(request.method==="POST" && url.pathname==="/api/anonymous"){
    const data=await request.json(); const body=String(data.body||"").trim();
    if(body.length<1||body.length>500) return json({error:"메시지는 1~500자로 작성해 주세요."},400);
    const result=await env.DB.prepare("INSERT INTO messages (body) VALUES (?)").bind(body).run();
    return json({ok:true,id:result.meta.last_row_id},201);
   }
   const report=url.pathname.match(/^\/api\/anonymous\/(\d+)\/report$/);
   if(request.method==="POST"&&report){
    const data=await request.json(); const reason=String(data.reason||"부적절한 메시지").trim().slice(0,300);
    const exists=await env.DB.prepare("SELECT id FROM messages WHERE id=? AND deleted_at IS NULL").bind(report[1]).first();
    if(!exists) return json({error:"메시지를 찾을 수 없습니다."},404);
    await env.DB.prepare("INSERT INTO reports (message_id,reason) VALUES (?,?)").bind(report[1],reason||"부적절한 메시지").run();
    return json({ok:true},201);
   }
   if(url.pathname==="/api/anonymous/admin/reports"&&request.method==="GET"){
    if(!admin)return json({error:"관리자 인증이 필요합니다."},401);
    const rows=await env.DB.prepare("SELECT r.id,r.message_id,r.reason,r.created_at,m.body FROM reports r LEFT JOIN messages m ON m.id=r.message_id WHERE r.status='open' ORDER BY r.id DESC LIMIT 200").all();
    return json({reports:rows.results||[]});
   }
   const del=url.pathname.match(/^\/api\/anonymous\/admin\/messages\/(\d+)$/);
   if(request.method==="DELETE"&&del){
    if(!admin)return json({error:"관리자 인증이 필요합니다."},401);
    await env.DB.prepare("UPDATE messages SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND deleted_at IS NULL").bind(del[1]).run();
    await env.DB.prepare("UPDATE reports SET status='resolved' WHERE message_id=?").bind(del[1]).run();
    return json({ok:true});
   }
   return json({error:"Not found"},404);
  } catch(e){ return json({error:"서버 오류가 발생했습니다."},500); }
 }
};