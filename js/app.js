const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');
let W, H, cx, cy;
function resize(){
  const dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth = canvas.offsetWidth;
  H = canvas.clientHeight = canvas.offsetHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  cx = W/2; cy = H/2;
}
window.addEventListener('resize', resize);
resize();

const planes = [];
let last = performance.now();
function rand(min,max){return Math.random()*(max-min)+min}
function callsign(){const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ";return chars[Math.floor(Math.random()*chars.length)]+chars[Math.floor(Math.random()*chars.length)]+Math.floor(rand(10,999)).toString();}
function spawnPlane(){
  const angle = rand(0,Math.PI*2);
  const r = Math.max(W,H)/2 + 60;
  const x = cx + Math.cos(angle)*r;
  const y = cy + Math.sin(angle)*r;
  const hdg = (angle + Math.PI) % (Math.PI*2);
  planes.push({id:Date.now().toString(36)+Math.floor(Math.random()*1000),call:callsign(),x,y,hdg,spd:rand(80,320),alt:rand(2000,36000),selected:false});
}

function update(dt){
  planes.forEach(p=>{
    const vx = Math.cos(p.hdg)*p.spd*(dt/1000)/2.5;
    const vy = Math.sin(p.hdg)*p.spd*(dt/1000)/2.5;
    p.x += vx; p.y += vy;
    if(p.x<-200||p.x>W+200||p.y<-200||p.y>H+200){
      const i = planes.indexOf(p);
      if(i>=0) planes.splice(i,1);
    }
  });
}

function drawRadar(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = 'rgba(5,12,34,0.6)'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(cx,cy);
  const maxR = Math.min(W,H)/2 - 20;
  ctx.strokeStyle = 'rgba(200,240,255,0.06)'; ctx.lineWidth = 1;
  for(let r= maxR; r>0; r-=maxR/4){ ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-maxR,0); ctx.lineTo(maxR,0); ctx.moveTo(0,-maxR); ctx.lineTo(0,maxR); ctx.stroke();
  ctx.restore();
}

function drawPlanes(){
  planes.forEach(p=>{
    const dx = p.x; const dy = p.y;
    ctx.save();
    ctx.translate(dx,dy);
    ctx.rotate(p.hdg);
    ctx.fillStyle = p.selected? '#ffce66' : '#2dd4bf';
    ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6,5); ctx.lineTo(-6,-5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(230,242,255,0.9)'; ctx.font='12px system-ui'; ctx.fillText(p.call, dx+12, dy-8);
    ctx.fillStyle = 'rgba(230,242,255,0.6)'; ctx.font='11px system-ui'; ctx.fillText(Math.round(p.alt)+' ft', dx+12, dy+8);
  });
}

function loop(now){
  const dt = now - last; last = now;
  update(dt);
  drawRadar();
  drawPlanes();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(()=>{ if(planes.length<8) spawnPlane(); }, 1500);

const info = document.getElementById('info');
const controls = document.getElementById('controls');
const selectedDiv = document.getElementById('selected');
function selectPlane(p){ planes.forEach(x=>x.selected=false); if(p){ p.selected=true; controls.classList.remove('hidden'); selectedDiv.textContent = p.call + ' • ' + Math.round(p.alt)+' ft • '+Math.round(p.spd)+' kt'; info.textContent = '' } else { controls.classList.add('hidden'); info.textContent = 'Tapez un avion pour le sélectionner' } }

function findPlaneAt(x,y){
  for(let i=0;i<planes.length;i++){ const p=planes[i]; const dx=p.x-x, dy=p.y-y; if(Math.hypot(dx,dy)<22) return p; }
  return null;
}

canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const p = findPlaneAt(x,y); selectPlane(p);
});

function commandTurn(deltaDeg){ const p = planes.find(x=>x.selected); if(!p) return; p.hdg += (deltaDeg*Math.PI/180); }
function commandSpeed(dv){ const p = planes.find(x=>x.selected); if(!p) return; p.spd = Math.max(40, p.spd + dv); }
function commandAlt(dA){ const p = planes.find(x=>x.selected); if(!p) return; p.alt = Math.max(0, p.alt + dA); selectedDiv.textContent = p.call + ' • ' + Math.round(p.alt)+' ft • '+Math.round(p.spd)+' kt'; }

document.getElementById('left').addEventListener('click', ()=>commandTurn(-15));
document.getElementById('right').addEventListener('click', ()=>commandTurn(15));
document.getElementById('slow').addEventListener('click', ()=>commandSpeed(-20));
document.getElementById('fast').addEventListener('click', ()=>commandSpeed(20));
document.getElementById('climb').addEventListener('click', ()=>commandAlt(1000));
document.getElementById('desc').addEventListener('click', ()=>commandAlt(-1000));

// touch: long press + drag to set heading
let touchStart = null;
canvas.addEventListener('touchstart', e=>{
  const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); const x = t.clientX-rect.left; const y = t.clientY-rect.top; touchStart={x,y,time:Date.now()};
});
canvas.addEventListener('touchend', e=>{
  const t = touchStart; if(!t) return; const now = Date.now(); if(now - t.time > 600){
    const rect = canvas.getBoundingClientRect(); const x = t.x; const y = t.y; const p = findPlaneAt(x,y); selectPlane(p);
  } else {
    const rect = canvas.getBoundingClientRect(); const x = t.x; const y = t.y; const p = findPlaneAt(x,y); selectPlane(p);
  }
  touchStart = null;
});
