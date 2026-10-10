document.addEventListener("DOMContentLoaded",()=>{const b=document.querySelector(".menu-toggle"),n=document.querySelector(".nav");if(!n)return;
if(b){b.setAttribute("aria-controls",n.id||"site-nav");if(!n.id)n.id="site-nav";b.addEventListener("click",()=>{const o=n.classList.toggle("open");b.setAttribute("aria-expanded",String(o));});}
const links=[
["이용안내","/nolguro/usage/index.html"],["문화예술","/nolguro/business/arts.html"],["성장지원","/nolguro/business/support.html"],["293르네상스","/nolguro/business/renaissance.html"],["이용약관","/nolguro/terms.html"],["개인정보처리방침","/nolguro/privacy.html"],["사이트 검색","/nolguro/search.html"]
];
for(const [label,href] of links){if(!n.querySelector('a[href="'+href+'"]')){const a=document.createElement("a");a.href=href;a.textContent=label;n.appendChild(a);}}
const current=location.pathname;for(const a of n.querySelectorAll("a")){if(a.getAttribute("href")===current||((current.endsWith("/")&&a.getAttribute("href")===current+"index.html"))){a.setAttribute("aria-current","page");}}
});