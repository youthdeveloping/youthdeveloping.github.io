/* YouthDeveloper shared account client. Uses the same identity as the chat service. */
(()=>{'use strict';
const API='https://web.youthdeveloper-github.workers.dev/api/chat',KEY='yd_chat_token';
const account={
 getToken(){try{return localStorage.getItem(KEY)||''}catch{return ''}},
 setToken(token){try{localStorage.setItem(KEY,String(token||''))}catch{}},
 logout(){try{localStorage.removeItem(KEY)}catch{};window.dispatchEvent(new CustomEvent('yd-account-change',{detail:null}))},
 async request(path,options={}){const token=this.getToken();const response=await fetch(API+path,{...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'계정 요청에 실패했습니다.');return data},
 async me(){if(!this.getToken())return null;try{const data=await this.request('/me');window.dispatchEvent(new CustomEvent('yd-account-change',{detail:data.user}));return data.user}catch{return null}},
 async login(nickname,password){const data=await this.request('/login',{method:'POST',body:JSON.stringify({nickname,password})});this.setToken(data.token);window.dispatchEvent(new CustomEvent('yd-account-change',{detail:data.user}));return data.user},
 async register(nickname,password){const data=await this.request('/register',{method:'POST',body:JSON.stringify({nickname,password})});this.setToken(data.token);window.dispatchEvent(new CustomEvent('yd-account-change',{detail:data.user}));return data.user}
};
window.YDAccount=account;
})();
