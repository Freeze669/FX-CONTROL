/* Enhanced app: icons (SVG data), airports, enemies, fighters, loading overlay, improved selection */
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

const entities = []; // planes, fighters, enemies
const airports = [];
let last = performance.now();
function rand(min,max){return Math.random()*(max-min)+min}
function callsign(){const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ";return chars[Math.floor(Math.random()*chars.length)]+chars[Math.floor(Math.random()*chars.length)]+Math.floor(rand(10,999)).toString();}

// SVG icon data URLs (simple vector icons)
function svgDataURL(svg){ return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg); }
const svgPlane = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23ffffff" d="M2 12l20-9-7 9 7 9z"/></svg>');
const svgFighter = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23ff4444" d="M2 12l20-9-7 9 7 9z"/></svg>');
const svgEnemy = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ff2d55"/></svg>');
const svgAirport = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="4" rx="1" fill="%232dd4bf"/></svg>');

const imgPlane = new Image(); imgPlane.src = svgPlane;
const imgFighter = new Image(); imgFighter.src = svgFighter;
const imgEnemy = new Image(); imgEnemy.src = svgEnemy;
const imgAirport = new Image(); imgAirport.src = svgAirport;

function spawnPlane(type='civil', x=null, y=null, hdg=null){
  const angle = rand(0,Math.PI*2);
  const r = Math.max(W,H)/2 + 60;
  const px = x!==null? x : cx + Math.cos(angle)*r;
  const py = y!==null? y : cy + Math.sin(angle)*r;
  const phd = hdg!==null? hdg : ((angle + Math.PI) % (Math.PI*2));
  const base = {id:Date.now().toString(36)+Math.floor(Math.random()*1000),call:callsign(),x:px,y:py,hdg:phd,spd:rand(80,220),alt:rand(2000,36000),selected:false,type:type};
  if(type==='fighter'){ base.spd = 800; base.targetId = null; }
  if(type==='enemy'){ base.spd = rand(160,300); }
  entities.push(base);
}

function spawnAirport(x,y,name){ airports.push({x,y,name,r:28}); }

// Create some airports relative to center
function initAirports(){
  spawnAirport(cx - 120, cy - 80, 'FX-ONE');
  spawnAirport(cx + 140, cy + 60, 'FX-TWO');
}
initAirports();

function update(dt){
  // entity behavior
  for(let i=entities.length-1;i>=0;i--){
    const p = entities[i];
    if(p.type==='fighter' && p.targetId){
      const target = entities.find(e=>e.id===p.targetId);
      if(!target){ entities.splice(i,1); continue; }
      // steer towards target
      const dx = target.x - p.x, dy = target.y - p.y; const dist = Math.hypot(dx,dy);
      const desired = Math.atan2(dy,dx);
      // small heading smoothing
      let diff = desired - p.hdg; while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2; p.hdg += diff*0.15;
      const speed = p.spd*(dt/1000)/2.5;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      if(dist<24){ // intercepted
        // remove enemy and fighter
        const ti = entities.indexOf(target); if(ti>=0) entities.splice(ti,1);
        entities.splice(i,1);
      }
    } else {
      // normal movement for civil/enemy
      const speed = (p.spd*(dt/1000)/2.5) || 0;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      if(p.x<-300||p.x>W+300||p.y<-300||p.y>H+300){ entities.splice(i,1); }
    }
  }
}

function drawRadar(){
  ctx.clearRect(0,0,W,H);
  // background subtle texture
  const grad = ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#051122'); grad.addColorStop(1,'#071428');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  // rings
  ctx.save(); ctx.translate(cx,cy);
  const maxR = Math.min(W,H)/2 - 20;
  ctx.strokeStyle = 'rgba(200,240,255,0.04)'; ctx.lineWidth = 1;
  for(let r= maxR; r>0; r-=maxR/4){ ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();
}

function drawEntities(){
  // draw airports
  airports.forEach(a=>{
    ctx.drawImage(imgAirport, a.x-12, a.y-12, 24,24);
    ctx.fillStyle = 'rgba(230,242,255,0.8)'; ctx.font='12px system-ui'; ctx.fillText(a.name, a.x+16, a.y+4);
  });
  entities.forEach(p=>{
    const dx = p.x, dy = p.y;
    if(p.type==='enemy'){
      ctx.drawImage(imgEnemy, dx-10, dy-10, 20,20);
    } else if(p.type==='fighter'){
      ctx.save(); ctx.translate(dx,dy); ctx.rotate(p.hdg); ctx.drawImage(imgFighter, -10, -10, 20,20); ctx.restore();
    } else {
      ctx.save(); ctx.translate(dx,dy); ctx.rotate(p.hdg); ctx.drawImage(imgPlane, -10, -10, 20,20); ctx.restore();
    }
    ctx.fillStyle = p.selected? 'rgba(255,206,102,0.95)' : 'rgba(230,242,255,0.95)'; ctx.font='12px system-ui'; ctx.fillText(p.call, dx+14, dy-6);
    ctx.fillStyle = 'rgba(230,242,255,0.6)'; ctx.font='11px system-ui'; ctx.fillText(Math.round(p.alt)+' ft', dx+14, dy+8);
  });
}

function loop(now){
  const dt = now - last; last = now;
  update(dt);
  drawRadar();
  drawEntities();
  requestAnimationFrame(loop);
}

// initial spawning
for(let i=0;i<6;i++) spawnPlane('civil');
setInterval(()=>{ if(entities.filter(e=>e.type==='civil').length<8) spawnPlane('civil'); }, 1800);
setInterval(()=>{ if(entities.filter(e=>e.type==='enemy').length<3) spawnPlane('enemy'); }, 6500);

// UI and interaction
const info = document.getElementById('info');
const controls = document.getElementById('controls');
const selectedDiv = document.getElementById('selected');
function selectEntity(p){ entities.forEach(x=>x.selected=false); if(p){ p.selected=true; controls.classList.remove('hidden'); selectedDiv.textContent = p.call + ' • ' + Math.round(p.alt)+' ft • '+Math.round(p.spd)+' kt'; info.textContent = '' } else { controls.classList.add('hidden'); info.textContent = 'Tapez un avion pour le sélectionner' } }

function findEntityAt(x,y){ // topmost first
  for(let i=entities.length-1;i>=0;i--){ const p=entities[i]; const dx=p.x-x, dy=p.y-y; if(Math.hypot(dx,dy)<30) return p; }
  // airports
  for(let a of airports){ if(Math.hypot(a.x-x,a.y-y) < a.r) return {airport:a}; }
  return null;
}

canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const item = findEntityAt(x,y);
  if(item && item.airport){ // clicked airport: spawn civilian from there
    spawnPlane('civil', item.airport.x+20, item.airport.y+6, rand(0,Math.PI*2));
    info.textContent = 'Avion lancé depuis ' + item.airport.name;
    setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200);
    return;
  }
  selectEntity(item);
});

function commandTurn(deltaDeg){ const p = entities.find(x=>x.selected); if(!p) return; p.hdg += (deltaDeg*Math.PI/180); }
function commandSpeed(dv){ const p = entities.find(x=>x.selected); if(!p) return; p.spd = Math.max(40, p.spd + dv); }
function commandAlt(dA){ const p = entities.find(x=>x.selected); if(!p) return; p.alt = Math.max(0, p.alt + dA); selectedDiv.textContent = p.call + ' • ' + Math.round(p.alt)+' ft • '+Math.round(p.spd)+' kt'; }

document.getElementById('left').addEventListener('click', ()=>commandTurn(-15));
document.getElementById('right').addEventListener('click', ()=>commandTurn(15));
document.getElementById('slow').addEventListener('click', ()=>commandSpeed(-20));
document.getElementById('fast').addEventListener('click', ()=>commandSpeed(20));
document.getElementById('climb').addEventListener('click', ()=>commandAlt(1000));
document.getElementById('desc').addEventListener('click', ()=>commandAlt(-1000));

// Dispatch fighter button
const dispatchBtn = document.createElement('button'); dispatchBtn.textContent = '🔧 Dispatch Fighter'; dispatchBtn.style.marginTop='8px'; dispatchBtn.addEventListener('click', ()=>{
  const p = entities.find(x=>x.selected); if(!p) return; // find nearest airport
  let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
  if(nearest){ spawnPlane('fighter', nearest.x+6, nearest.y, Math.atan2(p.y-nearest.y,p.x-nearest.x)); const f = entities[entities.length-1]; f.targetId = p.id; info.textContent='Fighter lancé depuis '+nearest.name; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1500); }
});
controls.appendChild(dispatchBtn);

// loading overlay: hide after small delay when images ready
function hideLoading(){ const L = document.getElementById('loading'); if(L) L.style.display='none'; }
Promise.all([imgPlane.decode?.().catch(()=>{}), imgFighter.decode?.().catch(()=>{}), imgEnemy.decode?.().catch(()=>{}), imgAirport.decode?.().catch(()=>{})]).finally(()=>{ setTimeout(hideLoading, 500); requestAnimationFrame(loop); });

// basic touch selection
let touchStart = null;
canvas.addEventListener('touchstart', e=>{ const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); touchStart={x:t.clientX-rect.left,y:t.clientY-rect.top,time:Date.now()}; });
canvas.addEventListener('touchend', e=>{ const t = touchStart; if(!t) return; const now = Date.now(); const item = findEntityAt(t.x,t.y); selectEntity(item); touchStart=null; });
