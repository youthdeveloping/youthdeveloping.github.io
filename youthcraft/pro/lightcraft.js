/* LightCraft Pro — 비파괴 사진 현상·라이브러리 작업실. 브라우저 안에서만 처리하며 AI 기능은 없습니다. */
(()=>{'use strict';
if(!window.YC)return;
const {el}=YC;
const MAXSRC=8000, PREV=1400;

/* ============ 기본값·프리셋 ============ */
const BANDS=['빨강','주황','노랑','초록','하늘','파랑','보라','자홍'], BHUE=[0,30,60,120,180,240,275,320];
const z8=()=>[0,0,0,0,0,0,0,0];
const DEF=()=>({exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,temp:0,tint:0,vibrance:0,saturation:0,
  clarity:0,texture:0,dehaze:0,sharpen:0,vignette:0,grain:0,bw:0,
  curves:{rgb:[[0,0],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]},
  mixer:{h:z8(),s:z8(),l:z8()},bwmix:z8(),
  grade:{sh:{h:0,s:0,l:0},mid:{h:0,s:0,l:0},hi:{h:0,s:0,l:0}}});
const GEO=()=>({angle:0,rot:0,flip:false,crop:{x:0,y:0,w:1,h:1}});
const merge=(a,b)=>{for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],b[k]);else a[k]=YC.clone(b[k])}return a};
const PRESETS=[
 ['선명한 풍경',{contrast:20,vibrance:35,saturation:8,clarity:20,dehaze:10}],
 ['부드러운 인물',{contrast:-10,highlights:-15,shadows:15,vibrance:10,temp:8,clarity:-15}],
 ['따뜻한 오후',{temp:30,tint:5,contrast:8,highlights:-15,vibrance:15}],
 ['차가운 새벽',{temp:-30,tint:-5,contrast:6,shadows:10,vibrance:8}],
 ['흑백 기본',{bw:1,contrast:15}],
 ['흑백 고대비',{bw:1,contrast:45,blacks:-20,whites:20,clarity:15}],
 ['빈티지 필름',{contrast:-12,blacks:35,saturation:-20,grain:30,temp:12,vignette:-25}],
 ['페이드',{blacks:50,contrast:-25,saturation:-15}],
 ['시네마틱 청록·주황',{contrast:15,saturation:-5,grade:{sh:{h:200,s:35,l:-5},hi:{h:35,s:30,l:0}}}],
 ['로모',{contrast:30,saturation:20,vignette:-45,temp:6}],
 ['드라마틱',{contrast:35,clarity:35,highlights:-30,shadows:20,vibrance:10,vignette:-20}],
 ['밝고 환하게',{exposure:0.5,shadows:30,whites:15,contrast:-8}],
 ['어둡고 무겁게',{exposure:-0.5,contrast:22,blacks:-20,saturation:-8}],
 ['음식 사진',{temp:10,vibrance:30,contrast:12,clarity:10,saturation:6}],
 ['피부 톤 정리',{vibrance:8,contrast:-6,mixer:{s:[0,-12,0,0,0,0,0,0],l:[0,12,0,0,0,0,0,0]}}],
 ['하늘 강조',{contrast:10,mixer:{s:[0,0,0,0,20,35,0,0],l:[0,0,0,0,-10,-20,0,0]}}],
 ['초록 숲',{vibrance:15,mixer:{h:[0,0,-8,-6,0,0,0,0],s:[0,0,10,25,0,0,0,0]},clarity:10}],
 ['세피아 모노톤',{bw:1,contrast:10,grade:{mid:{h:35,s:35,l:0},hi:{h:45,s:15,l:0}}}]
];

/* ============ 수학 도구 ============ */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
let _h=0,_s=0,_l=0,_r=0,_g=0,_b=0;
function rgb2hsl(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);_l=(mx+mn)/2;const d=mx-mn;if(d<1e-6){_h=0;_s=0;return}_s=_l>0.5?d/(2-mx-mn):d/(mx+mn);_h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);_h*=60}
function hue2(p,q,t){if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p}
function hsl2rgb(h,s,l){h=((h%360)+360)%360/360;if(s<1e-6){_r=_g=_b=l;return}const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;_r=hue2(p,q,h+1/3);_g=hue2(p,q,h);_b=hue2(p,q,h-1/3)}
function curveLUT(pts){
  const n=pts.length,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),dx=[],m=[],c=[];
  for(let i=0;i<n-1;i++){dx[i]=Math.max(1e-4,xs[i+1]-xs[i]);m[i]=(ys[i+1]-ys[i])/dx[i]}
  c[0]=m[0];c[n-1]=m[n-2];
  for(let i=1;i<n-1;i++){if(m[i-1]*m[i]<=0)c[i]=0;else{const cm=dx[i-1]+dx[i];c[i]=3*cm/((cm+dx[i])/m[i-1]+(cm+dx[i-1])/m[i])}}
  const lut=new Float32Array(256);let seg=0;
  for(let i=0;i<256;i++){const x=i/255;while(seg<n-2&&x>xs[seg+1])seg++;const h=dx[seg],t=clamp((x-xs[seg])/h,0,1),t2=t*t,t3=t2*t;
    lut[i]=clamp((2*t3-3*t2+1)*ys[seg]+(t3-2*t2+t)*h*c[seg]+(-2*t3+3*t2)*ys[seg+1]+(t3-t2)*h*c[seg+1],0,1)}
  return lut;
}
const isId=p=>p.length===2&&p[0][0]===0&&p[0][1]===0&&p[1][0]===1&&p[1][1]===1;
function curveSet(cv){
  if(isId(cv.rgb)&&isId(cv.r)&&isId(cv.g)&&isId(cv.b))return null;
  const M=curveLUT(cv.rgb),out=[];
  for(const ch of['r','g','b']){const L=curveLUT(cv[ch]),c=new Float32Array(256);for(let i=0;i<256;i++)c[i]=L[Math.round(M[i]*255)];out.push(c)}
  return out;
}
function hash(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295}

/* ============ 흐림(국소 대비·샤프닝용) ============ */
function bpass(a,b,w,h,r,horiz){
  const n=horiz?w:h,m=horiz?h:w,sA=horiz?4:4*w,sL=horiz?4*w:4,win=2*r+1;
  for(let line=0;line<m;line++){const base=line*sL;for(let c=0;c<3;c++){
    let sum=0;for(let k=-r;k<=r;k++){sum+=a[base+(k<0?0:k>=n?n-1:k)*sA+c]}
    for(let i=0;i<n;i++){b[base+i*sA+c]=sum/win;const ad=i+r+1,rm=i-r;sum+=a[base+(ad>=n?n-1:ad)*sA+c]-a[base+(rm<0?0:rm)*sA+c]}}}
}
function boxBlur(src,w,h,r){
  if(r<1)return src;const t=new Uint8ClampedArray(src.length),o=new Uint8ClampedArray(src.length),o2=new Uint8ClampedArray(src.length);
  bpass(src,t,w,h,r,true);bpass(t,o,w,h,r,false);bpass(o,t,w,h,r,true);bpass(t,o2,w,h,r,false);return o2;
}

/* ============ 기하(자르기·회전·기울기) ============ */
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
function applyGeo(srcC,geo,longEdge){
  const w=srcC.width,h=srcC.height,k=((geo.rot%4)+4)%4,sw=k%2?h:w,sh=k%2?w:h;
  let A=mk(sw,sh),c=A.getContext('2d');c.translate(sw/2,sh/2);c.rotate(k*Math.PI/2);if(geo.flip)c.scale(-1,1);c.drawImage(srcC,-w/2,-h/2);
  if(geo.angle){const a=geo.angle*Math.PI/180,s=Math.cos(Math.abs(a))+Math.sin(Math.abs(a))*Math.max(sw/sh,sh/sw),B=mk(sw,sh),d=B.getContext('2d');
    d.translate(sw/2,sh/2);d.rotate(a);d.scale(s,s);d.drawImage(A,-sw/2,-sh/2);A=B}
  const cr=geo.crop,cx=cr.x*sw,cy=cr.y*sh,cw=Math.max(1,cr.w*sw),ch=Math.max(1,cr.h*sh),sc=Math.min(1,longEdge/Math.max(cw,ch));
  const O=mk(cw*sc,ch*sc);O.getContext('2d').drawImage(A,cx,cy,cw,ch,0,0,O.width,O.height);return O;
}

/* ============ 마스크 ============ */
const newMask=type=>({id:YC.uid(),type,name:{brush:'브러시',linear:'선형 그라데이션',radial:'방사형 그라데이션',lum:'휘도 범위',color:'색 범위'}[type],
  invert:false,amount:100,feather:50,adj:{exposure:0,contrast:0,saturation:0,temp:0,highlights:0,shadows:0},
  p:type==='linear'?{x1:0.5,y1:0.2,x2:0.5,y2:0.8}:type==='radial'?{cx:0.5,cy:0.5,rx:0.3,ry:0.3}:type==='lum'?{lo:0.6,hi:1,sm:0.15}:type==='color'?{hue:120,range:50,smin:0.1}:{},strokes:[]});
function renderBrush(mask,w,h){
  const c=mk(w,h),x=c.getContext('2d'),long=Math.max(w,h);x.fillStyle='#000';x.fillRect(0,0,w,h);
  for(const s of mask.strokes){const rad=Math.max(1,s.r*long),hard=1-s.feather/100,step=Math.max(1,rad*0.25);
    const stamp=(px,py)=>{const g=x.createRadialGradient(px,py,rad*hard*0.99,px,py,rad);const col=s.erase?'0,0,0':'255,255,255';
      g.addColorStop(0,`rgba(${col},${s.flow})`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.fillRect(px-rad,py-rad,rad*2,rad*2)};
    x.globalCompositeOperation='source-over';
    let prev=null;for(const p of s.pts){const px=p[0]*w,py=p[1]*h;if(prev){const dx=px-prev[0],dy=py-prev[1],d=Math.hypot(dx,dy),n=Math.max(1,Math.ceil(d/step));for(let i=1;i<=n;i++)stamp(prev[0]+dx*i/n,prev[1]+dy*i/n)}else stamp(px,py);prev=[px,py]}}
  const id=x.getImageData(0,0,w,h).data,a=new Uint8ClampedArray(w*h);for(let i=0;i<a.length;i++)a[i]=id[i*4];return a;
}
function maskAlpha(m,px,py,w,h,r,g,b,brush,idx){
  let a=0;const p=m.p;
  if(m.type==='brush')a=brush?brush[idx]/255:0;
  else if(m.type==='linear'){const dx=p.x2-p.x1,dy=p.y2-p.y1,len=dx*dx+dy*dy||1e-6,t=((px/w-p.x1)*dx+(py/h-p.y1)*dy)/len;a=1-sstep(0,1,t)}
  else if(m.type==='radial'){const d=Math.hypot((px/w-p.cx)/Math.max(0.01,p.rx),(py/h-p.cy)/Math.max(0.01,p.ry));a=1-sstep(1-m.feather/100,1,d)}
  else if(m.type==='lum'){const L=0.2126*r+0.7152*g+0.0722*b;a=sstep(p.lo-p.sm,p.lo+1e-4,L)*(1-sstep(p.hi,p.hi+p.sm+1e-4,L))}
  else{rgb2hsl(r,g,b);const dh=Math.abs(((_h-p.hue+540)%360)-180);a=(1-sstep(p.range*0.5,p.range,dh))*(_s>p.smin?1:0)}
  if(m.invert)a=1-a;return a*m.amount/100;
}
function localAdj(m,r,g,b){
  const A=m.adj;_r=r;_g=g;_b=b;
  if(A.exposure){const k=Math.pow(2,A.exposure);_r=Math.sqrt(clamp(r*r*k,0,1));_g=Math.sqrt(clamp(g*g*k,0,1));_b=Math.sqrt(clamp(b*b*k,0,1))}
  if(A.temp){const t=A.temp/100;_r=clamp(_r*(1+0.3*t),0,1);_b=clamp(_b*(1-0.3*t),0,1)}
  const L=0.2126*_r+0.7152*_g+0.0722*_b;
  if(A.highlights||A.shadows){const sh=(A.highlights/100*0.25)*sstep(0.5,1,L)+(A.shadows/100*0.25)*(1-sstep(0,0.5,L));_r+=sh;_g+=sh;_b+=sh}
  if(A.contrast){const k=1+A.contrast/100;_r=(_r-0.5)*k+0.5;_g=(_g-0.5)*k+0.5;_b=(_b-0.5)*k+0.5}
  if(A.saturation){const k=1+A.saturation/100,L2=0.2126*_r+0.7152*_g+0.0722*_b;_r=L2+(_r-L2)*k;_g=L2+(_g-L2)*k;_b=L2+(_b-L2)*k}
}

/* ============ 현상 파이프라인 ============ */
function pipeline(src,w,h,A,masks,opt){
  const d=src,out=new Uint8ClampedArray(d.length),f=Math.max(w,h)/PREV;
  const gain=Math.pow(2,A.exposure),tw=A.temp/100,tn=A.tint/100;
  const wr=gain*(1+0.35*tw)*(1+0.1*tn),wg=gain*(1-0.2*tn),wbl=gain*(1-0.35*tw)*(1+0.1*tn);
  const hiK=A.highlights/100*0.25,shK=A.shadows/100*0.25,whK=A.whites/100*0.2,blK=A.blacks/100*0.2,cK=1+A.contrast/100;
  const cur=curveSet(A.curves),S=A.saturation/100,V=A.vibrance/100;
  const mix=A.mixer,useMix=mix.h.some(Boolean)||mix.s.some(Boolean)||mix.l.some(Boolean);
  const G=A.grade,useGr=['sh','mid','hi'].some(k=>G[k].s>0||G[k].l!==0);
  const gv={};for(const k of['sh','mid','hi']){hsl2rgb(G[k].h,1,0.5);gv[k]=[(_r-0.5)*G[k].s/100*0.35,(_g-0.5)*G[k].s/100*0.35,(_b-0.5)*G[k].s/100*0.35,G[k].l/100*0.25]}
  const bw=A.bw>0,bwm=A.bwmix.some(Boolean);
  const cl=A.clarity/100,tx=A.texture/100,sp=A.sharpen/100,dh=A.dehaze/100,vg=A.vignette/100,gr=A.grain/100;
  const needB=cl!==0||tx!==0||sp!==0;
  let b0=null,b1=null,b2=null;
  if(needB){if(sp)b0=boxBlur(d,w,h,Math.max(1,Math.round(1.2*f)));if(tx)b1=boxBlur(d,w,h,Math.max(2,Math.round(4*f)));if(cl)b2=boxBlur(d,w,h,Math.max(3,Math.round(14*f)))}
  const brush=masks.map(m=>m.type==='brush'?renderBrush(m,w,h):null);
  const lo=opt&&opt.showMask?masks.findIndex(m=>m.id===opt.showMask):-1;
    const hw=new Float32Array(8);
  for(let py=0;py<h;py++){const ny=(py/h-0.5)*2;for(let px=0;px<w;px++){
    const i=(py*w+px)*4,idx=py*w+px;
    let r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
    /* 선형 공간(감마 2.0 근사)에서 노출·화이트밸런스 */
    if(gain!==1||tw||tn){r=Math.sqrt(clamp(r*r*wr,0,1));g=Math.sqrt(clamp(g*g*wg,0,1));b=Math.sqrt(clamp(b*b*wbl,0,1))}
    let L=0.2126*r+0.7152*g+0.0722*b;
    if(hiK||shK||whK||blK){const s=hiK*sstep(0.5,1,L)+shK*(1-sstep(0,0.5,L))+whK*sstep(0.75,1,L)+blK*(1-sstep(0,0.25,L));r+=s;g+=s;b+=s}
    if(cK!==1){r=(r-0.5)*cK+0.5;g=(g-0.5)*cK+0.5;b=(b-0.5)*cK+0.5}
    r=clamp(r,0,1);g=clamp(g,0,1);b=clamp(b,0,1);
    if(cur){r=cur[0][Math.round(r*255)];g=cur[1][Math.round(g*255)];b=cur[2][Math.round(b*255)]}
    if(S||V){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),m=(1+S)*(1+V*(1-(mx-mn))),L2=0.2126*r+0.7152*g+0.0722*b;r=L2+(r-L2)*m;g=L2+(g-L2)*m;b=L2+(b-L2)*m}
    if(useMix){
      r=clamp(r,0,1);g=clamp(g,0,1);b=clamp(b,0,1);rgb2hsl(r,g,b);
      if(_s>0.001){let sw=0;for(let k=0;k<8;k++){const dd=Math.abs(((_h-BHUE[k]+540)%360)-180);hw[k]=Math.max(0,1-dd/55);sw+=hw[k]}
        let dH=0,dS=0,dL=0;for(let k=0;k<8;k++){dH+=hw[k]*mix.h[k]*0.3;dS+=hw[k]*mix.s[k]/100;dL+=hw[k]*mix.l[k]/100}
        if(dH||dS||dL){hsl2rgb(_h+dH,clamp(_s*(1+dS),0,1),clamp(_l+dL*0.25*_s,0,1));r=_r;g=_g;b=_b}}
    }
    if(useGr){const l=0.2126*r+0.7152*g+0.0722*b,ws=1-sstep(0,0.5,l),wh=sstep(0.5,1,l),wm=1-Math.abs(2*l-1);
      for(const[k,wt]of[['sh',ws],['mid',wm],['hi',wh]]){const v=gv[k];r+=(v[0]+v[3])*wt;g+=(v[1]+v[3])*wt;b+=(v[2]+v[3])*wt}}
    if(bw){let gray=0.2126*r+0.7152*g+0.0722*b;
      if(bwm){rgb2hsl(clamp(r,0,1),clamp(g,0,1),clamp(b,0,1));let adj=0;for(let k=0;k<8;k++){const dd=Math.abs(((_h-BHUE[k]+540)%360)-180);adj+=Math.max(0,1-dd/55)*A.bwmix[k]/100}gray+=adj*0.4*_s}
      r=g=b=gray}
    if(dh){const mn=Math.min(r,g,b);if(dh>0){const a=0.6*dh*mn,den=Math.max(0.2,1-a);r=(r-a)/den;g=(g-a)/den;b=(b-a)/den}else{const k=-dh*0.25;r+=k*(0.8-r);g+=k*(0.8-g);b+=k*(0.8-b)}}
    if(needB){const mid=1-Math.abs(2*(0.2126*r+0.7152*g+0.0722*b)-1);
      if(b2&&cl){const k=cl*mid*1.2;r+=k*(r-b2[i]/255);g+=k*(g-b2[i+1]/255);b+=k*(b-b2[i+2]/255)}
      if(b1&&tx){r+=tx*(r-b1[i]/255);g+=tx*(g-b1[i+1]/255);b+=tx*(b-b1[i+2]/255)}
      if(b0&&sp){const k=sp*1.5;r+=k*(r-b0[i]/255);g+=k*(g-b0[i+1]/255);b+=k*(b-b0[i+2]/255)}}
    if(vg){const nx=(px/w-0.5)*2,fo=sstep(0.35,1,Math.hypot(nx,ny)/1.414);if(vg<0){const k=1+vg*fo;r*=k;g*=k;b*=k}else{const k=vg*fo;r+=k*(1-r);g+=k*(1-g);b+=k*(1-b)}}
    if(gr){const n=(hash(px,py)-0.5)*gr*0.3;r+=n;g+=n;b+=n}
    if(masks.length){r=clamp(r,0,1);g=clamp(g,0,1);b=clamp(b,0,1);
      for(let mi=0;mi<masks.length;mi++){const m=masks[mi],a=maskAlpha(m,px,py,w,h,r,g,b,brush[mi],idx);
        if(a>0.002){localAdj(m,r,g,b);r+=(_r-r)*a;g+=(_g-g)*a;b+=(_b-b)*a}}}
    if(lo>=0){const a=maskAlpha(masks[lo],px,py,w,h,clamp(r,0,1),clamp(g,0,1),clamp(b,0,1),brush[lo],idx);r=r*(1-0.55*a)+0.9*0.55*a;g=g*(1-0.55*a);b=b*(1-0.55*a)}
    out[i]=r*255;out[i+1]=g*255;out[i+2]=b*255;out[i+3]=255;
  }}
  return out;
}

/* ============ EXIF(JPEG 기본 항목) ============ */
function readExif(buf){
  try{const v=new DataView(buf);if(v.getUint16(0)!==0xFFD8)return null;let o=2;
    while(o<v.byteLength-4){const mk2=v.getUint16(o),len=v.getUint16(o+2);
      if(mk2===0xFFE1&&v.getUint32(o+4)===0x45786966){const t=o+10,le=v.getUint16(t)===0x4949,u16=p=>v.getUint16(p,le),u32=p=>v.getUint32(p,le),res={};
        const str=(p,n)=>{let s='';for(let i=0;i<n;i++){const c=v.getUint8(p+i);if(!c)break;s+=String.fromCharCode(c)}return s.trim()};
        const rat=p=>u32(p)/(u32(p+4)||1);
        const ifd=(p,fn)=>{const n=u16(p);for(let i=0;i<n;i++){const e=p+2+i*12;fn(u16(e),u16(e+2),u32(e+4),e+8)}};
        let exifP=0;
        ifd(t+u32(t+4),(tag,ty,cnt,vp)=>{const dp=cnt*(ty===2?1:ty===5?8:2)>4?t+u32(vp):vp;
          if(tag===0x010F)res.make=str(dp,cnt);else if(tag===0x0110)res.model=str(dp,cnt);else if(tag===0x8769)exifP=u32(vp)});
        if(exifP)ifd(t+exifP,(tag,ty,cnt,vp)=>{const dp=cnt*(ty===2?1:ty===5?8:2)>4?t+u32(vp):vp;
          if(tag===0x829A)res.exposure=rat(dp);else if(tag===0x829D)res.fnumber=rat(dp);else if(tag===0x8827)res.iso=u16(vp);
          else if(tag===0x9003)res.date=str(dp,cnt);else if(tag===0x920A)res.focal=rat(dp)});
        return res}
      if((mk2&0xFF00)!==0xFF00)break;o+=2+len}}catch(_){}
  return null;
}

/* ============ 상태 ============ */
const photos=[];let active=null,sel=new Set(),view='adjusted',splitPos=0.5,showHist=true,clipWarn=false,showMaskId=null,editMaskId=null;
let clipboardAdj=null,tab='basic',curveCh='rgb',brushOpt={size:6,feather:60,flow:0.8,erase:false};
const byId=id=>photos.find(p=>p.id===id);
const sliders=[];
let baseC=null,baseKey='',baseData=null;

/* ============ 작업실 구성 ============ */
const ws=YC.workspace({title:'LightCraft',intro:'사진을 비파괴로 현상하고 라이브러리로 정리한 뒤 PNG·JPEG·WebP로 내보냅니다.',subtitle:'원본은 그대로 두고 조정값만 저장하는 비파괴 현상 작업실입니다. 모든 처리는 이 브라우저 안에서 이뤄지며 RAW(DNG 등)는 지원하지 않습니다.'});
const root=ws.root;
const canvas=el('canvas',{style:'display:block;max-width:100%;margin:0 auto;touch-action:none;cursor:crosshair','aria-label':'보정 미리보기'});
const stage=el('div',{class:'ycp-stage',style:'min-height:320px;padding:8px;display:flex;align-items:center;justify-content:center'},el('p',{class:'ycp-note',id:'lc-empty'},'사진을 불러오면 이곳에 표시됩니다. JPEG, PNG, WebP 등 브라우저가 열 수 있는 형식을 쓸 수 있습니다.'),canvas);
canvas.hidden=true;
const histC=el('canvas',{width:256,height:80,style:'width:100%;height:80px;background:#101014;border-radius:6px','aria-label':'히스토그램'});
const infoBox=el('p',{class:'ycp-note'},'');
const tbar=el('div',{class:'ycp-row'});
const side=el('div',{class:'ycp-side'});
const main=el('div',{class:'ycp-main'},tbar,stage,infoBox);
const grid=el('div',{class:'ycp-grid rev'},main,side);
const libWrap=el('div',{style:'margin-top:12px'});
root.insertBefore(grid,ws.status);root.insertBefore(libWrap,ws.status);

const say=YC.say;
function slider(label,get,set,min,max,step,reg=true){
  const w=YC.range(label,{min,max,step,value:get(),reset:0},v=>{if(!active)return;set(v);rerender()});
  w.input.addEventListener('change',()=>commit());
  if(reg)sliders.push({w,get});return w;
}
function refreshUI(){sliders.forEach(s=>s.w.set(s.get()));drawCurve();renderMaskPanel();updateInfo();syncCrop()}

/* ---- 도구 막대 ---- */
tbar.append(
  YC.btn('사진 열기',async()=>{const fs=await YC.pick('image/*',true);if(fs.length)await addFiles(fs)},{primary:true}),
  YC.btn('원본 보기',()=>{view=view==='before'?'adjusted':'before';rerender();say(view==='before'?'원본(보정 전)을 표시합니다.':'보정 결과를 표시합니다.')}),
  YC.btn('좌우 분할 비교',()=>{view=view==='split'?'adjusted':'split';rerender()}),
  YC.btn('설정 복사',()=>{if(!active)return;clipboardAdj=YC.clone({adj:active.adj,masks:active.masks});say('조정값을 복사했습니다.')}),
  YC.btn('설정 붙여넣기',()=>{if(!clipboardAdj){say('먼저 설정을 복사해 주세요.',true);return}const t=sel.size?[...sel].map(byId):[active];applyTo(t.filter(Boolean),clipboardAdj.adj,clipboardAdj.masks)}),
  YC.btn('보정 초기화',()=>{if(!active)return;active.adj=DEF();active.masks=[];editMaskId=showMaskId=null;commit();refreshUI();rerender()}),
  YC.btn('실행 취소',()=>{hist.undo()&&afterHistory()}),YC.btn('다시 실행',()=>{hist.redo()&&afterHistory()})
);
const splitW=YC.range('분할 위치',{min:5,max:95,value:50,unit:'%'},v=>{splitPos=v/100;if(view==='split')rerender()});
const opts=YC.row(YC.check('히스토그램',true,v=>{showHist=v;histC.parentElement.hidden=!v}),YC.check('클리핑 경고',false,v=>{clipWarn=v;rerender()}));
side.append(YC.group('히스토그램',el('div',null,histC),opts,el('p',{class:'ycp-note'},'클리핑 경고를 켜면 하이라이트가 날아간 곳은 붉은색, 섀도가 뭉개진 곳은 푸른색으로 표시됩니다.'),splitW));

/* ---- 탭 ---- */
const panels={};const tabsBox=YC.tabs([['basic','기본'],['curve','톤 커브'],['color','색상'],['detail','디테일·효과'],['geo','자르기·회전'],['mask','마스크'],['preset','프리셋'],['out','내보내기·정보']],id=>{tab=id;for(const k in panels)panels[k].hidden=k!==id});
side.append(tabsBox);
const mkPanel=id=>{const p=el('div',{class:'ycp-group'});p.hidden=id!=='basic';panels[id]=p;side.append(p);return p};
const A=()=>active.adj;
const S=(label,key,min,max,step)=>slider(label,()=>active?A()[key]:0,v=>{A()[key]=v},min,max,step);

let p=mkPanel('basic');
p.append(S('노출 (EV)','exposure',-5,5,0.05),S('대비','contrast',-100,100,1),S('하이라이트','highlights',-100,100,1),S('섀도','shadows',-100,100,1),S('흰색','whites',-100,100,1),S('검정','blacks',-100,100,1),
  el('h3',null,'화이트 밸런스'),S('색온도','temp',-100,100,1),S('색조','tint',-100,100,1),el('h3',null,'색감'),S('활기','vibrance',-100,100,1),S('채도','saturation',-100,100,1));

p=mkPanel('detail');
p.append(S('명료도','clarity',-100,100,1),S('텍스처','texture',-100,100,1),S('디헤이즈','dehaze',-100,100,1),S('샤프닝','sharpen',0,100,1),S('비네트','vignette',-100,100,1),S('그레인','grain',0,100,1),
  el('p',{class:'ycp-note'},'명료도·텍스처·샤프닝은 흐림 연산을 쓰므로 큰 사진에서는 미리보기가 조금 느릴 수 있습니다. 그레인은 같은 위치에 같은 무늬가 나오도록 고정 난수를 씁니다.'));

/* 톤 커브 */
p=mkPanel('curve');
const cvC=el('canvas',{width:220,height:220,style:'width:220px;max-width:100%;background:#101014;border-radius:6px;touch-action:none;cursor:crosshair','aria-label':'톤 커브 편집'});
const chSel=YC.select('채널',[['rgb','RGB'],['r','빨강'],['g','초록'],['b','파랑']],'rgb',v=>{curveCh=v;drawCurve()});
p.append(chSel,cvC,YC.row(YC.btn('이 채널 초기화',()=>{if(!active)return;A().curves[curveCh]=[[0,0],[1,1]];commit();drawCurve();rerender()}),YC.btn('전체 커브 초기화',()=>{if(!active)return;A().curves=DEF().curves;commit();drawCurve();rerender()})),
  el('p',{class:'ycp-note'},'빈 곳을 클릭하면 점이 추가되고, 드래그로 이동합니다. 점을 더블클릭하면 삭제됩니다.'));
function drawCurve(){
  const x=cvC.getContext('2d'),W=220;x.clearRect(0,0,W,W);x.strokeStyle='#2c2c35';x.lineWidth=1;
  for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*W/4,0);x.lineTo(i*W/4,W);x.moveTo(0,i*W/4);x.lineTo(W,i*W/4);x.stroke()}
  x.strokeStyle='#454550';x.beginPath();x.moveTo(0,W);x.lineTo(W,0);x.stroke();
  if(!active)return;const pts=A().curves[curveCh],lut=curveLUT(pts),col={rgb:'#f6f6f8',r:'#ff6b6b',g:'#6bff9a',b:'#6ba6ff'}[curveCh];
  x.strokeStyle=col;x.lineWidth=2;x.beginPath();for(let i=0;i<256;i++){const px=i/255*W,py=W-lut[i]*W;i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();
  x.fillStyle=col;for(const q of pts){x.beginPath();x.arc(q[0]*W,W-q[1]*W,4,0,7);x.fill()}
}
{let drag=-1;
  const pos=e=>{const r=cvC.getBoundingClientRect();return[clamp((e.clientX-r.left)/r.width,0,1),clamp(1-(e.clientY-r.top)/r.height,0,1)]};
  cvC.addEventListener('pointerdown',e=>{if(!active)return;const pts=A().curves[curveCh],[x,y]=pos(e);let hit=pts.findIndex(q=>Math.hypot((q[0]-x)*220,(q[1]-y)*220)<10);
    if(hit<0){pts.push([x,y]);pts.sort((a,b)=>a[0]-b[0]);hit=pts.findIndex(q=>q[0]===x&&q[1]===y)}
    drag=hit;cvC.setPointerCapture(e.pointerId);drawCurve();rerender()});
  cvC.addEventListener('pointermove',e=>{if(drag<0||!active)return;const pts=A().curves[curveCh],[x,y]=pos(e),q=pts[drag];
    if(drag===0||drag===pts.length-1){q[1]=y}else{q[0]=clamp(x,pts[drag-1][0]+0.02,pts[drag+1][0]-0.02);q[1]=y}drawCurve();rerender()});
  cvC.addEventListener('pointerup',()=>{if(drag>=0){drag=-1;commit()}});
  cvC.addEventListener('dblclick',e=>{if(!active)return;const pts=A().curves[curveCh],[x,y]=pos(e),i=pts.findIndex(q=>Math.hypot((q[0]-x)*220,(q[1]-y)*220)<10);
    if(i>0&&i<pts.length-1){pts.splice(i,1);commit();drawCurve();rerender()}});
}

/* 색상: 믹서, 그레이딩, 흑백 */
p=mkPanel('color');
const mixTab=el('div');const bwBox=el('div');
const mixSel=YC.select('믹서 항목',[['h','색조'],['s','채도'],['l','명도']],'h',v=>{mixMode=v;buildMix()});let mixMode='h';
function buildMix(){mixTab.replaceChildren();BANDS.forEach((n,i)=>{const w=YC.range(n,{min:-100,max:100,value:0,reset:0},v=>{if(!active)return;A().mixer[mixMode][i]=v;rerender()});
  w.input.value=active?A().mixer[mixMode][i]:0;w.out.textContent=w.input.value;w.input.addEventListener('change',()=>commit());w.refresh=()=>{w.input.value=A().mixer[mixMode][i];w.out.textContent=w.input.value};mixTab.append(w)})}
function buildBw(){bwBox.replaceChildren();BANDS.forEach((n,i)=>{const w=YC.range(n,{min:-100,max:100,value:0,reset:0},v=>{if(!active)return;A().bwmix[i]=v;rerender()});
  w.input.value=active?A().bwmix[i]:0;w.out.textContent=w.input.value;w.input.addEventListener('change',()=>commit());bwBox.append(w)})}
p.append(el('h3',null,'8밴드 색상 믹서'),mixSel,mixTab,el('h3',null,'컬러 그레이딩'));
const gradeUI={};
for(const[k,n]of[['sh','섀도'],['mid','미드톤'],['hi','하이라이트']]){
  const hh=slider(n+' 색조',()=>active?A().grade[k].h:0,v=>{A().grade[k].h=v},0,360,1),ss=slider(n+' 채도',()=>active?A().grade[k].s:0,v=>{A().grade[k].s=v},0,100,1),ll=slider(n+' 명도',()=>active?A().grade[k].l:0,v=>{A().grade[k].l=v},-100,100,1);
  p.append(hh,ss,ll);}
const bwCk=YC.check('흑백으로 변환',false,v=>{if(!active)return;A().bw=v?1:0;commit();rerender()});
p.append(el('h3',null,'흑백 변환'),bwCk,el('p',{class:'ycp-note'},'아래 슬라이더는 흑백일 때 각 색상이 얼마나 밝게 표현되는지 조절합니다.'),bwBox);

/* 자르기·회전 */
p=mkPanel('geo');
const cropIn={};
const cropRow=(label,key)=>slider(label,()=>active?Math.round(active.geo.crop[key]*100):0,v=>{active.geo.crop[key]=v/100;fixCrop(key)},key==='w'||key==='h'?5:0,100,1);
function fixCrop(k){const c=active.geo.crop;c.w=clamp(c.w,0.05,1);c.h=clamp(c.h,0.05,1);c.x=clamp(c.x,0,1-c.w);c.y=clamp(c.y,0,1-c.h);baseKey=''}
const asp=YC.select('비율 프리셋',[['free','자유'],['1','1:1'],['1.3333','4:3'],['1.5','3:2'],['1.7778','16:9'],['0.8','4:5'],['0.5625','9:16']],'free',v=>{if(!active||v==='free')return;const a=+v,dm=dims();let w=1,h=w*dm.w/(a*dm.h);if(h>1){h=1;w=h*a*dm.h/dm.w}const c=active.geo.crop;c.w=w;c.h=h;c.x=(1-w)/2;c.y=(1-h)/2;baseKey='';commit();syncCrop();rerender()});
function dims(){const g=active.geo,k=((g.rot%4)+4)%4,w=active.w,h=active.h;return k%2?{w:h,h:w}:{w,h}}
p.append(slider('기울기 보정 (도)',()=>active?active.geo.angle:0,v=>{active.geo.angle=v;baseKey=''},-45,45,0.1),
  YC.row(YC.btn('왼쪽 90도',()=>rot(-1)),YC.btn('오른쪽 90도',()=>rot(1)),YC.btn('좌우 반전',()=>{if(!active)return;active.geo.flip=!active.geo.flip;baseKey='';commit();rerender()})),
  asp,cropIn.x=cropRow('자르기 X','x'),cropIn.y=cropRow('자르기 Y','y'),cropIn.w=cropRow('자르기 너비','w'),cropIn.h=cropRow('자르기 높이','h'),
  YC.btn('자르기 해제',()=>{if(!active)return;active.geo.crop={x:0,y:0,w:1,h:1};baseKey='';commit();syncCrop();rerender()}));
function rot(d){if(!active)return;active.geo.rot=((active.geo.rot+d)%4+4)%4;active.geo.crop={x:0,y:0,w:1,h:1};baseKey='';commit();syncCrop();rerender()}
function syncCrop(){}

/* 마스크 */
p=mkPanel('mask');
const maskList=el('div',{class:'ycp-list'}),maskEdit=el('div');
p.append(el('p',{class:'ycp-note'},'마스크를 만들고 선택한 뒤, 미리보기 위에서 직접 그리거나 끌어 영역을 정합니다. 선형: 시작점에서 끝점으로 드래그. 방사형: 중심에서 바깥으로 드래그. 브러시: 칠하기.'),
  YC.row(...[['brush','브러시'],['linear','선형'],['radial','방사형'],['lum','휘도 범위'],['color','색 범위']].map(([t,n])=>YC.btn(n+' 추가',()=>{if(!active)return;const m=newMask(t);active.masks.push(m);editMaskId=m.id;showMaskId=m.id;commit();renderMaskPanel();rerender()}))),maskList,maskEdit);
function renderMaskPanel(){
  maskList.replaceChildren();maskEdit.replaceChildren();if(!active)return;
  active.masks.forEach((m,i)=>{const it=el('div',{class:'ycp-item'+(m.id===editMaskId?' sel':''),role:'button',tabindex:0},el('span',{class:'n'},(i+1)+'. '+m.name),
    YC.btn('삭제',e=>{e&&e.stopPropagation&&e.stopPropagation();active.masks.splice(i,1);if(editMaskId===m.id)editMaskId=showMaskId=null;commit();renderMaskPanel();rerender()}));
    const pick=()=>{editMaskId=m.id;showMaskId=m.id;renderMaskPanel();rerender()};it.addEventListener('click',pick);it.addEventListener('keydown',e=>{if(e.key==='Enter')pick()});maskList.append(it)});
  const m=active.masks.find(x=>x.id===editMaskId);if(!m)return;
  const ms=(label,get,set,min,max,step)=>{const w=YC.range(label,{min,max,step,value:get(),reset:0},v=>{set(v);rerender()});w.input.addEventListener('change',commit);return w};
  maskEdit.append(el('h3',null,m.name+' 설정'),
    YC.check('마스크 영역을 붉게 표시',showMaskId===m.id,v=>{showMaskId=v?m.id:null;rerender()}),YC.check('반전',m.invert,v=>{m.invert=v;commit();rerender()}),
    ms('적용량',()=>m.amount,v=>{m.amount=v},0,100,1));
  if(m.type==='radial')maskEdit.append(ms('경계 부드러움',()=>m.feather,v=>{m.feather=v},0,100,1));
  if(m.type==='lum')maskEdit.append(ms('하한',()=>m.p.lo*100,v=>{m.p.lo=v/100},0,100,1),ms('상한',()=>m.p.hi*100,v=>{m.p.hi=v/100},0,100,1),ms('부드러움',()=>m.p.sm*100,v=>{m.p.sm=v/100},0,50,1));
  if(m.type==='color')maskEdit.append(ms('대상 색조',()=>m.p.hue,v=>{m.p.hue=v},0,360,1),ms('범위',()=>m.p.range,v=>{m.p.range=v},5,120,1),ms('최소 채도',()=>m.p.smin*100,v=>{m.p.smin=v/100},0,100,1));
  if(m.type==='brush')maskEdit.append(ms('붓 크기 (%)',()=>brushOpt.size,v=>{brushOpt.size=v},1,30,1),ms('경계 부드러움',()=>brushOpt.feather,v=>{brushOpt.feather=v},0,100,1),ms('농도',()=>brushOpt.flow*100,v=>{brushOpt.flow=v/100},5,100,1),
    YC.check('지우개(칠한 영역 지우기)',brushOpt.erase,v=>{brushOpt.erase=v}),YC.btn('칠한 내용 모두 지우기',()=>{m.strokes=[];commit();rerender()}));
  maskEdit.append(el('h3',null,'이 영역의 보정'));
  for(const[k,n,mn,mx,st]of[['exposure','노출 (EV)',-4,4,0.05],['contrast','대비',-100,100,1],['highlights','하이라이트',-100,100,1],['shadows','섀도',-100,100,1],['saturation','채도',-100,100,1],['temp','색온도',-100,100,1]])
    maskEdit.append(ms(n,()=>m.adj[k],v=>{m.adj[k]=v},mn,mx,st));
}

/* 프리셋 */
p=mkPanel('preset');
const userList=el('div',{class:'ycp-list'});
const presetName=YC.text('새 프리셋 이름',{value:''},()=>{});
p.append(el('h3',null,'내장 프리셋'),el('div',{class:'ycp-list'},PRESETS.map(([n,v])=>el('div',{class:'ycp-item',role:'button',tabindex:0,onclick:()=>usePreset(v),onkeydown:e=>{if(e.key==='Enter')usePreset(v)}},el('span',{class:'n'},n)))),
  el('h3',null,'내 프리셋'),presetName,YC.btn('현재 조정값을 프리셋으로 저장',()=>{if(!active)return;const n=presetName.input.value.trim();if(!n){say('프리셋 이름을 입력해 주세요.',true);return}const u=loadUser();u.push([n,YC.clone(active.adj)]);saveUser(u);presetName.input.value='';renderUser();say('프리셋을 저장했습니다.')}),userList,
  el('p',{class:'ycp-note'},'내 프리셋은 이 브라우저(localStorage)에만 저장됩니다. 브라우저 데이터를 지우면 사라집니다.'));
function loadUser(){try{return JSON.parse(localStorage.getItem('yc-light-presets')||'[]')}catch(_){return[]}}
function saveUser(u){try{localStorage.setItem('yc-light-presets',JSON.stringify(u))}catch(_){say('프리셋을 저장하지 못했습니다(저장 공간 제한).',true)}}
function renderUser(){userList.replaceChildren();const u=loadUser();if(!u.length)userList.append(el('p',{class:'ycp-note'},'저장한 프리셋이 없습니다.'));
  u.forEach(([n,v],i)=>userList.append(el('div',{class:'ycp-item'},el('span',{class:'n',role:'button',tabindex:0,onclick:()=>useFull(v)},n),YC.btn('삭제',()=>{u.splice(i,1);saveUser(u);renderUser()}))))}
renderUser();
function usePreset(v){if(!active)return;const t=sel.size>1?[...sel].map(byId).filter(Boolean):[active];t.forEach(ph=>{ph.adj=merge(DEF(),v)});commit();refreshUI();rerender();say('프리셋을 적용했습니다'+(t.length>1?' ('+t.length+'장)':'')+'.')}
function useFull(adj){if(!active)return;const t=sel.size>1?[...sel].map(byId).filter(Boolean):[active];t.forEach(ph=>{ph.adj=merge(DEF(),adj)});commit();refreshUI();rerender()}
function applyTo(list,adj,masks){list.forEach(ph=>{ph.adj=merge(DEF(),adj);ph.masks=YC.clone(masks||[])});commit();refreshUI();rerender();say(list.length+'장에 조정값을 적용했습니다.')}

/* 내보내기·정보 */
p=mkPanel('out');
const exp={fmt:'image/jpeg',q:90,long:0,scope:'cur'};
p.append(YC.select('형식',[['image/jpeg','JPEG'],['image/png','PNG'],['image/webp','WebP']],exp.fmt,v=>exp.fmt=v),YC.range('품질',{min:40,max:100,value:90,unit:'%'},v=>exp.q=v),
  YC.num('긴 변 크기(px, 0=원본)',{min:0,max:MAXSRC,value:0},v=>exp.long=clamp(Math.round(v)||0,0,MAXSRC)),
  YC.select('대상',[['cur','현재 사진'],['sel','선택한 사진'],['all','필터에 보이는 전체']],'cur',v=>exp.scope=v),
  YC.btn('내보내기',()=>doExport(),{primary:true}),
  el('p',{class:'ycp-note'},'여러 장은 ZIP으로 묶어 내려받습니다. 한 변이 '+MAXSRC+'px를 넘는 사진은 불러올 때 축소됩니다. EXIF 정보는 내보낸 파일에 포함되지 않으며, 원본 파일은 수정하지 않습니다. PNG는 품질 설정이 적용되지 않습니다.'),
  el('h3',null,'사진 정보'),el('div',{id:'lc-info',class:'ycp-note'}));
function updateInfo(){const b=document.getElementById('lc-info');if(!b)return;if(!active){b.textContent='사진을 선택해 주세요.';return}
  const e=active.exif,r=[active.name,active.w+' × '+active.h+' px',YC.fmtBytes(active.size)];
  if(e){if(e.make||e.model)r.push('카메라: '+[e.make,e.model].filter(Boolean).join(' '));if(e.exposure)r.push('노출 시간: '+(e.exposure<1?'1/'+Math.round(1/e.exposure):e.exposure)+' 초');if(e.fnumber)r.push('조리개: f/'+e.fnumber.toFixed(1));if(e.iso)r.push('ISO '+e.iso);if(e.focal)r.push('초점 거리: '+e.focal.toFixed(0)+' mm');if(e.date)r.push('촬영: '+e.date)}else r.push('EXIF 정보를 찾지 못했습니다(JPEG에만 표시됩니다).');
  b.innerHTML=r.map(YC.esc).join('<br>');infoBox.textContent=active.name+' · '+active.w+' × '+active.h+' px'}

/* ============ 렌더링 ============ */
function geoKey(){return JSON.stringify(active.geo)+'|'+active.id}
function ensureBase(){
  const k=geoKey();if(baseKey===k&&baseC)return;
  baseC=applyGeo(active.prev,active.geo,PREV);baseData=baseC.getContext('2d').getImageData(0,0,baseC.width,baseC.height);baseKey=k;
}
function doRender(){
  if(!active||!active.prev){canvas.hidden=true;return}
  canvas.hidden=false;document.getElementById('lc-empty').hidden=true;ensureBase();
  const w=baseC.width,h=baseC.height;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const ctx=canvas.getContext('2d');let out;
  if(view==='before')out=baseData.data;
  else{out=pipeline(baseData.data,w,h,active.adj,active.masks,{showMask:showMaskId});}
  const img=new ImageData(new Uint8ClampedArray(out),w,h),d=img.data;
  // 히스토그램과 클리핑
  const hist=[new Uint32Array(256),new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)];
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];hist[0][r]++;hist[1][g]++;hist[2][b]++;hist[3][(0.2126*r+0.7152*g+0.0722*b)|0]++;
    if(clipWarn&&view!=='before'){if(r>=254||g>=254||b>=254){d[i]=255;d[i+1]=40;d[i+2]=40}else if(r<=2&&g<=2&&b<=2){d[i]=40;d[i+1]=80;d[i+2]=255}}}
  if(view==='split'){const sx=Math.round(w*splitPos),b=baseData.data;for(let y=0;y<h;y++){const o=y*w*4;d.set(b.subarray(o,o+sx*4),o)}}
  ctx.putImageData(img,0,0);
  if(view==='split'){ctx.fillStyle='#70f0bd';ctx.fillRect(Math.round(w*splitPos)-1,0,2,h)}
  drawHist(hist);
}
function drawHist(hist){
  const x=histC.getContext('2d'),W=256,H=80;x.clearRect(0,0,W,H);let mx=1;for(let c=0;c<4;c++)for(let i=2;i<254;i++)mx=Math.max(mx,hist[c][i]);
  const cols=['rgba(255,80,80,.55)','rgba(80,255,120,.55)','rgba(90,140,255,.55)','rgba(255,255,255,.8)'];
  x.globalCompositeOperation='lighter';for(let c=0;c<3;c++){x.fillStyle=cols[c];for(let i=0;i<256;i++){const v=Math.min(1,hist[c][i]/mx)*H;x.fillRect(i,H-v,1,v)}}
  x.globalCompositeOperation='source-over';x.strokeStyle=cols[3];x.beginPath();for(let i=0;i<256;i++){const v=Math.min(1,hist[3][i]/mx)*H;i?x.lineTo(i,H-v):x.moveTo(i,H-v)}x.stroke();
}
const rerender=YC.raf(()=>{try{doRender()}catch(e){say('미리보기를 그리지 못했습니다: '+e.message,true)}});

/* 캔버스 상호작용(마스크 그리기) */
{let down=false,cur=null;
  const pos=e=>{const r=canvas.getBoundingClientRect();return[clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)]};
  canvas.addEventListener('pointerdown',e=>{if(!active||tab!=='mask')return;const m=active.masks.find(x=>x.id===editMaskId);if(!m||view==='before')return;
    const[x,y]=pos(e);down=true;canvas.setPointerCapture(e.pointerId);
    if(m.type==='brush'){cur={r:brushOpt.size/100,feather:brushOpt.feather,flow:brushOpt.flow,erase:brushOpt.erase,pts:[[x,y]]};m.strokes.push(cur)}
    else if(m.type==='linear'){m.p.x1=x;m.p.y1=y;m.p.x2=x;m.p.y2=y+0.001}else if(m.type==='radial'){m.p.cx=x;m.p.cy=y}
    rerender()});
  canvas.addEventListener('pointermove',e=>{if(!down)return;const m=active.masks.find(x=>x.id===editMaskId);if(!m)return;const[x,y]=pos(e);
    if(m.type==='brush'&&cur)cur.pts.push([x,y]);else if(m.type==='linear'){m.p.x2=x;m.p.y2=y}else if(m.type==='radial'){m.p.rx=Math.max(0.02,Math.abs(x-m.p.cx));m.p.ry=Math.max(0.02,Math.abs(y-m.p.cy))}
    rerender()});
  const end=()=>{if(down){down=false;cur=null;commit()}};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
}

/* ============ 라이브러리 ============ */
const filt={q:'',rating:0,flag:'all',album:'all'};
const libBar=el('div',{class:'ycp-row'});
const grid2=el('div',{style:'position:relative;overflow:auto;height:230px;background:#16161b;border:1px solid #2c2c35;border-radius:8px','tabindex':'0','aria-label':'사진 라이브러리'});
const gInner=el('div',{style:'position:relative'});grid2.append(gInner);
const albumSel=el('select',{'aria-label':'앨범 필터'});
const flagSel=YC.select('플래그',[['all','전체'],['pick','채택'],['reject','제외'],['none','없음']],'all',v=>{filt.flag=v;layoutLib()});
const ratingSel=YC.select('최소 별점',[0,1,2,3,4,5].map(n=>[n,n?n+'점 이상':'전체']),0,v=>{filt.rating=+v;layoutLib()});
const searchIn=YC.text('파일명 검색',{value:''},v=>{filt.q=v.toLowerCase();layoutLib()});
albumSel.addEventListener('change',()=>{filt.album=albumSel.value;layoutLib()});
const curRate=YC.select('별점',[0,1,2,3,4,5].map(n=>[n,n?n+'점':'없음']),0,v=>{sel.size?[...sel].forEach(id=>{byId(id).rating=+v}):active&&(active.rating=+v);commit();layoutLib()});
const curFlag=YC.select('선택한 사진 플래그',[['none','없음'],['pick','채택'],['reject','제외']],'none',v=>{(sel.size?[...sel].map(byId):[active]).forEach(x=>x&&(x.flag=v));commit();layoutLib()});
const albumIn=YC.text('앨범 이름',{value:''},()=>{});
libBar.append(YC.btn('모두 선택(현재 필터)',()=>{visible().forEach(x=>sel.add(x.id));layoutLib()}),YC.btn('선택 해제',()=>{sel.clear();if(active)sel.add(active.id);layoutLib()}),
  searchIn,ratingSel,flagSel,el('label',{class:'ycp-field two'},el('span',null,'앨범'),albumSel),curRate,curFlag,albumIn,
  YC.btn('앨범에 담기',()=>{const n=albumIn.input.value.trim();if(!n||!active){say('앨범 이름을 입력하고 사진을 선택해 주세요.',true);return}(sel.size?[...sel].map(byId):[active]).forEach(x=>x&&(x.album=n));albumIn.input.value='';commit();refreshAlbums();layoutLib();say('앨범 "'+n+'"에 담았습니다.')}),
  YC.btn('앨범에서 빼기',()=>{(sel.size?[...sel].map(byId):[active]).forEach(x=>x&&(x.album=''));commit();refreshAlbums();layoutLib()}),
  YC.btn('선택한 사진 삭제',()=>{const ids=sel.size?[...sel]:active?[active.id]:[];if(!ids.length)return;if(!confirm(ids.length+'장을 라이브러리에서 제거할까요? 원본 파일은 삭제되지 않습니다.'))return;
    ids.forEach(id=>{const i=photos.findIndex(x=>x.id===id);if(i>=0)photos.splice(i,1)});sel.clear();if(!photos.includes(active)){active=null;baseKey='';if(photos[0])activate(photos[0]);else{canvas.hidden=true;document.getElementById('lc-empty').hidden=false}}hist.reset();refreshAlbums();layoutLib();rerender();updateInfo()}));
libWrap.append(el('h3',{style:'font-size:12px;letter-spacing:.1em;color:#a8a8b2;margin:0 0 6px'},'라이브러리'),libBar,grid2,el('p',{class:'ycp-note'},'클릭하면 편집하고, Ctrl/Shift+클릭으로 여러 장을 선택합니다. 프리셋과 설정 붙여넣기는 선택한 사진 모두에 적용됩니다.'));
function refreshAlbums(){const cur=filt.album,names=[...new Set(photos.map(x=>x.album).filter(Boolean))];albumSel.replaceChildren(el('option',{value:'all'},'전체'),...names.map(n=>el('option',{value:n,selected:n===cur},n)));if(cur!=='all'&&!names.includes(cur))filt.album='all'}
function visible(){return photos.filter(x=>(!filt.q||x.name.toLowerCase().includes(filt.q))&&x.rating>=filt.rating&&(filt.flag==='all'||x.flag===filt.flag)&&(filt.album==='all'||x.album===filt.album))}
const ITEM_W=108,ITEM_H=128;
function layoutLib(){
  const list=visible(),cols=Math.max(1,Math.floor(grid2.clientWidth/ITEM_W)),rows=Math.ceil(list.length/cols);
  gInner.style.height=Math.max(1,rows*ITEM_H)+'px';paintLib(list,cols);
}
function paintLib(list,cols){
  list=list||visible();cols=cols||Math.max(1,Math.floor(grid2.clientWidth/ITEM_W));
  const top=grid2.scrollTop,r0=Math.max(0,Math.floor(top/ITEM_H)-1),r1=Math.ceil((top+grid2.clientHeight)/ITEM_H)+1;
  gInner.replaceChildren();
  for(let r=r0;r<r1;r++)for(let c=0;c<cols;c++){const x=list[r*cols+c];if(!x)continue;
    const flagTxt={pick:'채택',reject:'제외',none:''}[x.flag],flagCol={pick:'#70f0bd',reject:'#ff8795',none:'#36363f'}[x.flag];
    const it=el('div',{role:'button',tabindex:0,'aria-label':x.name+(x.missing?' (원본 연결 필요)':''),style:`position:absolute;left:${c*ITEM_W+4}px;top:${r*ITEM_H+4}px;width:${ITEM_W-8}px;height:${ITEM_H-8}px;border:2px solid ${sel.has(x.id)?'#70f0bd':flagCol};border-radius:7px;background:#1b1b21;overflow:hidden;cursor:pointer;font-size:10px`,
      onclick:e=>{if(e.ctrlKey||e.metaKey){sel.has(x.id)?sel.delete(x.id):sel.add(x.id);paintLib()}else if(e.shiftKey&&active){const a=list.indexOf(active),b=list.indexOf(x);sel.clear();for(let i=Math.min(a,b);i<=Math.max(a,b);i++)sel.add(list[i].id);paintLib()}else{sel.clear();sel.add(x.id);activate(x)}},
      onkeydown:e=>{if(e.key==='Enter'){sel.clear();sel.add(x.id);activate(x)}}},
      el('img',{src:x.thumbURL,alt:'',style:'width:100%;height:84px;object-fit:cover;display:block'}),
      el('div',{style:'padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'},x.name),
      el('div',{style:'padding:0 4px;color:#a8a8b2'},(x.rating?x.rating+'점 ':'')+flagTxt+(x.missing?' 연결 필요':'')));
    gInner.append(it)}
}
grid2.addEventListener('scroll',YC.raf(()=>paintLib()));
window.addEventListener('resize',YC.debounce(layoutLib,150));

/* ============ 사진 불러오기·활성화 ============ */
async function decode(file){
  let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(_){const u=URL.createObjectURL(file);try{bmp=await YC.loadImage(u)}finally{setTimeout(()=>URL.revokeObjectURL(u),3000)}}
  const w0=bmp.width||bmp.naturalWidth,h0=bmp.height||bmp.naturalHeight,sc=Math.min(1,MAXSRC/Math.max(w0,h0)),c=mk(w0*sc,h0*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);if(bmp.close)bmp.close();return{c,w0,h0,scaled:sc<1};
}
async function addFiles(files){
  let n=0,skipped=[];
  for(const f of files){
    if(!/^image\//.test(f.type)&&!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)){skipped.push(f.name);continue}
    try{say('불러오는 중: '+f.name+' ('+(++n)+'/'+files.length+')');const d=await decode(f);
      const t=mk(96,96),tx=t.getContext('2d'),s=Math.max(96/d.c.width,96/d.c.height);tx.drawImage(d.c,(96-d.c.width*s)/2,(96-d.c.height*s)/2,d.c.width*s,d.c.height*s);
      let exif=null;if(/jpe?g/i.test(f.type+f.name))exif=readExif(await f.slice(0,131072).arrayBuffer());
      const ph={id:YC.uid(),name:f.name,size:f.size,file:f,w:d.c.width,h:d.c.height,thumbURL:t.toDataURL('image/jpeg',0.7),exif,rating:0,flag:'none',album:'',adj:DEF(),geo:GEO(),masks:[],src:d.c,prev:null};
      mkPrev(ph);photos.push(ph);if(d.scaled)say(f.name+': 큰 사진이라 긴 변 '+MAXSRC+'px로 축소해 불러왔습니다.')}
    catch(e){skipped.push(f.name)}}
  refreshAlbums();layoutLib();
  if(skipped.length)say('불러오지 못한 파일: '+skipped.join(', '),true);else say(n+'장을 불러왔습니다.');
  if(!active&&photos.length)activate(photos[photos.length-n>=0?photos.length-n:0]);
  hist.reset();
}
function mkPrev(ph){const s=Math.min(1,2200/Math.max(ph.src.width,ph.src.height));ph.prev=s<1?(()=>{const c=mk(ph.src.width*s,ph.src.height*s);c.getContext('2d').drawImage(ph.src,0,0,c.width,c.height);return c})():ph.src}
async function activate(ph){
  if(active&&active!==ph&&active.src&&photos.length>1){active.src=null;active.prev=null} // 메모리 절약: 비활성 사진은 디코딩 결과를 버림
  active=ph;baseKey='';editMaskId=showMaskId=null;
  if(!ph.src&&ph.file){try{const d=await decode(ph.file);ph.src=d.c;mkPrev(ph)}catch(e){say('사진을 다시 열지 못했습니다: '+ph.name,true);return}}
  if(!ph.prev){say('원본 파일이 연결되어 있지 않습니다. "원본 다시 연결"로 파일을 지정해 주세요.',true);canvas.hidden=true;refreshUI();layoutLib();return}
  buildMix();buildBw();bwCk.input.checked=!!ph.adj.bw;curRate.input.value=ph.rating;curFlag.input.value=ph.flag;
  refreshUI();layoutLib();rerender();
}
function afterHistory(){if(active){buildMix();buildBw();bwCk.input.checked=!!active.adj.bw;refreshUI();baseKey='';rerender()}layoutLib()}

/* ============ 내보내기 ============ */
async function renderFull(ph,longEdge){
  const d=await decode(ph.file),g=applyGeo(d.c,ph.geo,longEdge>0?longEdge:Infinity),w=g.width,h=g.height,id=g.getContext('2d').getImageData(0,0,w,h);
  const out=pipeline(id.data,w,h,ph.adj,ph.masks,{});const c=mk(w,h);c.getContext('2d').putImageData(new ImageData(out,w,h),0,0);return c;
}
async function doExport(){
  const list=exp.scope==='cur'?(active?[active]:[]):exp.scope==='sel'?[...sel].map(byId).filter(Boolean):visible();
  if(!list.length){say('내보낼 사진이 없습니다.',true);return}
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[exp.fmt],files=[];let i=0;
  for(const ph of list){if(ph.missing||!ph.file){say(ph.name+': 원본이 연결되지 않아 건너뜁니다.',true);continue}
    say('처리 중: '+ph.name+' ('+(++i)+'/'+list.length+')');await new Promise(r=>setTimeout(r,20));
    try{const c=await renderFull(ph,exp.long),blob=await YC.canvasBlob(c,exp.fmt,exp.q/100);
      if(blob.type!==exp.fmt){say('이 브라우저는 '+exp.fmt+' 형식 저장을 지원하지 않습니다.',true);return}
      files.push({name:ph.name.replace(/\.[^.]+$/,'')+'-lightcraft.'+ext,blob})}catch(e){say(ph.name+' 처리 실패: '+e.message,true)}}
  if(!files.length)return;
  if(files.length===1){YC.download(files[0].blob,files[0].name);say('내보냈습니다: '+files[0].name+' ('+YC.fmtBytes(files[0].blob.size)+')');return}
  const used={};const zf=[];for(const f of files){let n=f.name;if(used[n]){n=n.replace(/(\.[^.]+)$/,'-'+used[n]+'$1')}used[f.name]=(used[f.name]||0)+1;zf.push({name:n,data:new Uint8Array(await f.blob.arrayBuffer())})}
  YC.download(YC.zip(zf),'lightcraft-export.zip');say(files.length+'장을 ZIP으로 내보냈습니다.');
}
YC.quickExport(()=>{exp.scope='cur';doExport()});

/* ============ 기록·프로젝트 ============ */
const snap=()=>photos.map(x=>({id:x.id,adj:x.adj,geo:x.geo,masks:x.masks,rating:x.rating,flag:x.flag,album:x.album}));
const hist=YC.history(snap,s=>{s.forEach(o=>{const x=byId(o.id);if(x){x.adj=o.adj;x.geo=o.geo;x.masks=o.masks;x.rating=o.rating;x.flag=o.flag;x.album=o.album}});baseKey=''});
YC.bindHistoryKeys(hist,root);
function commit(){hist.commit();YC.dirty()}
hist.commit();

async function toDataURL(f){return YC.readDataURL(f)}
YC.adapter({
  export(){
    const total=photos.reduce((a,x)=>a+(x.file?x.size:0),0),embed=total<=10*1024*1024;
    return {version:1,active:active&&active.id,embed,photos:photos.map(x=>({id:x.id,name:x.name,size:x.size,w:x.w,h:x.h,thumbURL:x.thumbURL,exif:x.exif,rating:x.rating,flag:x.flag,album:x.album,adj:x.adj,geo:x.geo,masks:x.masks,
      data:embed&&x.file?x._dataURL||null:null,type:x.file&&x.file.type}))};
  },
  async import(st){
    photos.length=0;sel.clear();active=null;
    for(const o of st.photos||[]){const ph={...o,adj:merge(DEF(),o.adj),geo:Object.assign(GEO(),o.geo),masks:o.masks||[],src:null,prev:null,file:null,missing:true};
      if(o.data){try{const b=await (await fetch(o.data)).blob();ph.file=new File([b],o.name,{type:o.type||b.type});ph.missing=false}catch(_){}}
      photos.push(ph)}
    refreshAlbums();layoutLib();const first=byId(st.active)||photos[0];if(first)await activate(first);hist.reset();
    const miss=photos.filter(x=>x.missing).length;if(miss)say(miss+'장의 원본이 프로젝트에 포함되어 있지 않습니다. "원본 다시 연결"로 같은 이름의 파일을 지정해 주세요.',true);
  }
});
// 프로젝트에 원본을 담기 위해 파일을 dataURL 로 미리 만들어 둠(10MB 이하일 때만)
const _origAdd=addFiles;
async function cacheData(){for(const x of photos){if(x.file&&!x._dataURL&&x.size<=10*1024*1024){try{x._dataURL=await toDataURL(x.file)}catch(_){}}}}
setInterval(()=>{if(photos.length&&photos.reduce((a,x)=>a+x.size,0)<=10*1024*1024)cacheData()},1500);
libBar.append(YC.btn('원본 다시 연결',async()=>{const fs=await YC.pick('image/*',true);let n=0;for(const f of fs){const ph=photos.find(x=>x.name===f.name&&x.missing);if(ph){ph.file=f;ph.missing=false;n++;try{const d=await decode(f);ph.src=d.c;mkPrev(ph);ph.w=d.c.width;ph.h=d.c.height}catch(_){}}}
  say(n?n+'장을 다시 연결했습니다.':'이름이 같은 연결 대상이 없습니다.',!n);layoutLib();if(active&&active.missing===false)activate(active)}));

/* 파일 끌어놓기 */
root.addEventListener('dragover',e=>{e.preventDefault()});
root.addEventListener('drop',e=>{e.preventDefault();const fs=[...e.dataTransfer.files];if(fs.length)addFiles(fs)});
layoutLib();updateInfo();drawCurve();
window.__lightcraft={pipeline,applyGeo,curveLUT,photos,addFiles,activate,get active(){return active},hist};
})();
