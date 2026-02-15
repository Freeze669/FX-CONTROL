/* Enhanced app: icons (SVG data), airports, enemies, fighters, loading overlay, improved selection */
const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');
// status helper shown in HUD and console
const _statusEl = document.getElementById && document.getElementById('info');
function setStatus(msg){ try{ if(_statusEl) _statusEl.textContent = msg; }catch(e){} console.log('[MiniATC] '+msg); }
setStatus('Initialisation...');
window.addEventListener('error', ev=>{ console.error(ev.error||ev.message); try{ if(_statusEl) _statusEl.textContent = 'Erreur: '+(ev.error?.message||ev.message); }catch(e){} });
window.addEventListener('unhandledrejection', ev=>{ console.error('UnhandledRejection', ev.reason); try{ if(_statusEl) _statusEl.textContent = 'Erreur promise: '+(ev.reason?.message||String(ev.reason)); }catch(e){} });
// camera for pan (world coordinates) - declared early so resize() can use it
const cam = {x:0,y:0,zoom:1};
let isPanning = false, panLast = null;
let W, H, cx, cy;
let _miniatc_loop_started = false;
function startMainLoop(){ if(!_miniatc_loop_started){ _miniatc_loop_started = true; try{ setStatus('Démarrage boucle'); hideLoading(); requestAnimationFrame(loop); setStatus(''); }catch(e){ console.error(e); setStatus('Erreur au démarrage: '+(e.message||e)); } } }
function resize(){
  const dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth = canvas.offsetWidth;
  H = canvas.clientHeight = canvas.offsetHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  cx = W/2; cy = H/2;
  // center camera on world center by default (if camera exists)
  if(typeof cam !== 'undefined'){ cam.x = cx - W/2; cam.y = cy - H/2; }
  // recompute airports/zones based on new center
  initAirports(); initZonesAndRoutes();
}

const entities = []; // planes, fighters, enemies
const airports = [];
let showTrajectory = true;
let last = performance.now();
function rand(min,max){return Math.random()*(max-min)+min}
function callsign(){const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ";return chars[Math.floor(Math.random()*chars.length)]+chars[Math.floor(Math.random()*chars.length)]+Math.floor(rand(10,999)).toString();}

// SVG icon data URLs (simple vector icons)
function svgDataURL(svg){ return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg); }
const svgPlane = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23ffffff" d="M2 12l20-9-7 9 7 9z"/></svg>');
const svgFighter = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23ff4444" d="M2 12l20-9-7 9 7 9z"/></svg>');
const svgEnemy = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ff2d55"/></svg>');
const svgAirport = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="4" rx="1" fill="%232dd4bf"/></svg>');

// model-specific SVGs (nicer images)
const svgA320 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="20" width="52" height="24" fill="%23e6eef8" stroke="%23263b4f"/><text x="32" y="38" font-size="10" text-anchor="middle" fill="%23263b4f">A320</text></svg>');
const svgB737 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="20" width="52" height="24" fill="%23fff4e6" stroke="%233b2b1f"/><text x="32" y="38" font-size="10" text-anchor="middle" fill="%233b2b1f">B737</text></svg>');
const svgE195 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="20" width="52" height="24" fill="%23e8f6ea" stroke="%23294b2f"/><text x="32" y="38" font-size="10" text-anchor="middle" fill="%23294b2f">E195</text></svg>');
const svgA321 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="20" width="52" height="24" fill="%23f0e8ff" stroke="%23284a6f"/><text x="32" y="38" font-size="10" text-anchor="middle" fill="%23284a6f">A321</text></svg>');

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
  // assign model and tweak speeds
  if(type==='fighter'){ base.spd = 380; base.targetId = null; base.model = 'F-16'; base.img = svgFighter; }
  else if(type==='enemy'){ base.spd = rand(160,300); base.model = 'Unknown'; base.img = svgEnemy; }
  else { // civil
    const civilModels = ['A320','B737','E195','A321'];
    base.model = civilModels[Math.floor(Math.random()*civilModels.length)];
    // pick model-specific SVG
    if(base.model==='A320') base.img = svgA320;
    else if(base.model==='B737') base.img = svgB737;
    else if(base.model==='E195') base.img = svgE195;
    else if(base.model==='A321') base.img = svgA321;
    else base.img = svgPlane;
  }
  
  entities.push(base);
}

function spawnAirport(x,y,name){ airports.push({x,y,name,r:28}); }

// define a set of cities and countries (for background map-like look)
const countries = [
  {x: -200, y: -80, w: 360, h: 220, name: 'Pays A', color: 'rgba(20,60,100,0.18)'},
  {x: 40, y: 60, w: 420, h: 260, name: 'Pays B', color: 'rgba(40,30,70,0.14)'},
  {x: -340, y: 120, w: 240, h: 160, name: 'Pays C', color: 'rgba(60,40,20,0.08)'}
];

// cities computed relative to current canvas center (cx, cy)
function getCities(){
  return [
    {x: cx - 160, y: cy - 90, name: 'Ville Nord'},
    {x: cx + 120, y: cy + 80, name: 'Ville Sud'},
    {x: cx - 60, y: cy + 140, name: 'Ville Est'},
    {x: cx + 220, y: cy - 40, name: 'Ville Ouest'}
  ];
}

// Create airports based on cities so there are more airports
function initAirports(){
  airports.length = 0;
  // core/central airports (keep old ones too)
  spawnAirport(cx - 120, cy - 80, 'FX-ONE');
  spawnAirport(cx + 140, cy + 60, 'FX-TWO');
  // city airports
  for(const c of getCities()){ spawnAirport(c.x, c.y, 'APT '+c.name.replace(/\s+/g,'')); }
}
initAirports();

// Airspace zones and routes (recomputed on resize)
const zones = [];
const routes = [];
function initZonesAndRoutes(){
  zones.length = 0; routes.length = 0;
  zones.push({x:cx, y:cy-40, r:160, name:'CTR', color:'rgba(45,212,191,0.06)'});
  zones.push({x:cx+180, y:cy+80, r:110, name:'TMA', color:'rgba(255,90,90,0.05)'});
  // add small city zones for realism
  for(const c of getCities()){ zones.push({x:c.x, y:c.y, r:60, name: c.name+' CTR', color:'rgba(200,220,255,0.04)'}); }
  // example route line
  routes.push([{x:cx-220,y:cy+10},{x:cx-60,y:cy-40},{x:cx+40,y:cy-20},{x:cx+160,y:cy+60}]);
}
initZonesAndRoutes();

// now that `airports` and `zones` are defined above, register resize handler
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>{ setTimeout(resize,120); });
resize();

function update(dt){
  // entity behavior
  for(let i=entities.length-1;i>=0;i--){
    const p = entities[i];
    // maintain trajectory history
    p.history = p.history || [];
    if((p._histTimer||0) <= 0){ p.history.push({x:p.x,y:p.y}); if(p.history.length>120) p.history.shift(); p._histTimer = 200; } else p._histTimer -= dt;

    if(p.type==='fighter' && p.targetId){
      const target = entities.find(e=>e.id===p.targetId);
      if(!target){ entities.splice(i,1); continue; }
      // follow-behind behavior: aim for point behind the target
      const followDist = 80;
      const behindX = target.x - Math.cos(target.hdg)*followDist;
      const behindY = target.y - Math.sin(target.hdg)*followDist;
      const dx = behindX - p.x, dy = behindY - p.y; const dist = Math.hypot(dx,dy);
      const desired = Math.atan2(dy,dx);
      // smooth heading
      let diff = desired - p.hdg; while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2; p.hdg += diff*0.12;
      const speed = p.spd*(dt/1000)/2.5;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      // if in intercept mode and close enough, destroy target
      if(p._mode==='intercept' && dist<26){ const ti = entities.indexOf(target); if(ti>=0) entities.splice(ti,1); entities.splice(i,1); }
    } else {
      // normal movement for civil/enemy
      // if returning to airport, steer to nearest airport
      if(p.returning){ let nearest=null; let dmin=Infinity; for(let a of airports){ const d=Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){dmin=d;nearest=a;} } if(nearest){ p.hdg = Math.atan2(nearest.y-p.y, nearest.x-p.x); if(dmin<18){ p.returning=false; p.spd = Math.max(60, p.spd*0.8); } } }
      const speed = (p.spd*(dt/1000)/2.5) || 0;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      if(p.x<-600||p.x>W+600||p.y<-600||p.y>H+600){ entities.splice(i,1); }
    }
  }
}

function drawBackgroundScreen(){
  ctx.clearRect(0,0,W,H);
  // richer background gradient
  const grad = ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#04101d'); grad.addColorStop(1,'#071428');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  // draw simple country blocks as an abstract map background
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  for(const c of countries){ ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.strokeRect(c.x, c.y, c.w, c.h); ctx.fillStyle = 'rgba(230,242,255,0.04)'; ctx.font='11px system-ui'; ctx.fillText(c.name, c.x+8, c.y+14); }
  // draw city dots
  for(const c of getCities()){ ctx.beginPath(); ctx.fillStyle='rgba(255,230,180,0.9)'; ctx.arc(c.x, c.y, 5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(230,242,255,0.9)'; ctx.font='12px system-ui'; ctx.fillText(c.name, c.x + 10, c.y + 4); }
  ctx.restore();
  // subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1;
  const g = 36;
  for(let x = - (cam.x % g); x < W; x += g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y = - (cam.y % g); y < H; y += g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawRadar(){
  // draw zones (world coordinates assumed)
  // draw zones
  zones.forEach(z=>{
    ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,Math.PI*2);
    ctx.fillStyle = z.color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(230,242,255,0.7)'; ctx.font='12px system-ui'; ctx.fillText(z.name, z.x - 18, z.y - z.r + 18);
  });
  // draw route lines
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(45,212,191,0.18)';
  routes.forEach(route=>{ ctx.beginPath(); route.forEach((pt,i)=>{ if(i===0) ctx.moveTo(pt.x,pt.y); else ctx.lineTo(pt.x,pt.y); }); ctx.stroke(); });
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
    // draw trajectory
    if(showTrajectory && p.history && p.history.length>1){ ctx.beginPath(); ctx.moveTo(p.history[0].x,p.history[0].y); for(let i=1;i<p.history.length;i++){ ctx.lineTo(p.history[i].x,p.history[i].y); } ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.stroke(); }
    if(p.selected){ // halo
      ctx.beginPath(); ctx.arc(dx,dy,26,0,Math.PI*2); ctx.strokeStyle='rgba(255,206,102,0.25)'; ctx.lineWidth=3; ctx.stroke();
    }
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
  drawBackgroundScreen();
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  drawRadar();
  drawEntities();
  ctx.restore();
  requestAnimationFrame(loop);
}

// initial spawning
for(let i=0;i<6;i++) spawnPlane('civil');
setInterval(()=>{ if(entities.filter(e=>e.type==='civil').length<8) spawnPlane('civil'); }, 1800);
// reduce enemy spawn frequency and max count to make game less hostile
setInterval(()=>{ if(entities.filter(e=>e.type==='enemy').length<2) spawnPlane('enemy'); }, 12000);

// ensure the main loop starts immediately (don't wait for image.decode)
startMainLoop();

// UI and interaction
const info = document.getElementById('info');
const controls = document.getElementById('controls');
const selectedDiv = document.getElementById('selected');
function selectEntity(p){ entities.forEach(x=>x.selected=false); if(p){ p.selected=true; controls.classList.remove('hidden');
    selectedDiv.innerHTML = '<strong>'+p.call+'</strong><br>Type: '+(p.type||'civil')+' • ALT: '+Math.round(p.alt)+' ft<br>SPD: '+Math.round(p.spd)+' kt • HDG: '+Math.round((p.hdg*180/Math.PI+360)%360)+'°';
    // update top-right detailed info
    try{
      const panel = document.getElementById('selected-info'); if(panel) panel.classList.remove('hidden');
      const img = document.getElementById('info-img'); if(img) img.src = p.img || svgPlane;
      const it = document.getElementById('info-type'); if(it) it.textContent = 'Type: ' + (p.type||'civil');
      const im = document.getElementById('info-model'); if(im) im.textContent = 'Model: ' + (p.model||'—');
    }catch(e){}
    info.textContent = ''
  } else { controls.classList.add('hidden'); info.textContent = 'Tapez un avion pour le sélectionner' } }

function findEntityAt(x,y){ // x,y are screen coords; convert to world
  const wx = x + cam.x, wy = y + cam.y;
  for(let i=entities.length-1;i>=0;i--){ const p=entities[i]; const dx=p.x-wx, dy=p.y-wy; if(Math.hypot(dx,dy)<30) return p; }
  // airports
  for(let a of airports){ if(Math.hypot(a.x-wx,a.y-wy) < a.r) return {airport:a}; }
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

// hide top-right info when deselecting via click on empty space
canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const item = findEntityAt(x,y);
  if(!item){ const panel = document.getElementById('selected-info'); if(panel) panel.classList.add('hidden'); }
});

function commandTurn(deltaDeg){ const p = entities.find(x=>x.selected); if(!p) return; p.hdg += (deltaDeg*Math.PI/180); }
function commandSpeed(dv){ const p = entities.find(x=>x.selected); if(!p) return; p.spd = Math.max(40, p.spd + dv); }
function commandAlt(dA){ const p = entities.find(x=>x.selected); if(!p) return; p.alt = Math.max(0, p.alt + dA); selectedDiv.textContent = p.call + ' • ' + Math.round(p.alt)+' ft • '+Math.round(p.spd)+' kt'; }

const _elLeft = document.getElementById('left'); if(_elLeft) _elLeft.addEventListener('click', ()=>commandTurn(-15));
const _elRight = document.getElementById('right'); if(_elRight) _elRight.addEventListener('click', ()=>commandTurn(15));
const _elSlow = document.getElementById('slow'); if(_elSlow) _elSlow.addEventListener('click', ()=>commandSpeed(-20));
const _elFast = document.getElementById('fast'); if(_elFast) _elFast.addEventListener('click', ()=>commandSpeed(20));
const _elClimb = document.getElementById('climb'); if(_elClimb) _elClimb.addEventListener('click', ()=>commandAlt(1000));
const _elDesc = document.getElementById('desc'); if(_elDesc) _elDesc.addEventListener('click', ()=>commandAlt(-1000));

// Controls wired to static buttons in the HTML
const _elDestroy = document.getElementById('destroy'); if(_elDestroy) _elDestroy.addEventListener('click', ()=>{
  const p = entities.find(x=>x.selected); if(!p) return; // if fighter selected with target, destroy target
  if(p.type==='fighter' && p.targetId){ const target = entities.find(e=>e.id===p.targetId); if(target){ const ti=entities.indexOf(target); if(ti>=0) entities.splice(ti,1); info.textContent='Cible détruite'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); } return; }
  const idx = entities.indexOf(p); if(idx>=0){ entities.splice(idx,1); info.textContent='Avion détruit'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
});

const _elAlert = document.getElementById('alert'); if(_elAlert) _elAlert.addEventListener('click', ()=>{
  const p = entities.find(x=>x.selected); if(!p) return; // command to return to nearest airport
  let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
  if(nearest){ p.returning = true; p.hdg = Math.atan2(nearest.y-p.y, nearest.x-p.x); p.spd = Math.max(60, p.spd*0.8); info.textContent='Ordre: revenir à '+nearest.name; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
});

const _elDispatch = document.getElementById('dispatch'); if(_elDispatch) _elDispatch.addEventListener('click', ()=>{
  const p = entities.find(x=>x.selected); if(!p) return; let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
  if(nearest){ spawnPlane('fighter', nearest.x+6, nearest.y, Math.atan2(p.y-nearest.y,p.x-nearest.x)); const f = entities[entities.length-1]; f.targetId = p.id; f._mode='follow'; info.textContent='Fighter lancé depuis '+nearest.name; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1500); }
});

const _elTraj = document.getElementById('traj'); if(_elTraj) _elTraj.addEventListener('click', ()=>{ showTrajectory = !showTrajectory; info.textContent = showTrajectory? 'Trajectoires: ON' : 'Trajectoires: OFF'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',900); });

// loading overlay: hide after small delay when images ready
function hideLoading(){ const L = document.getElementById('loading'); if(L){ try{ L.style.display='none'; }catch(e){} } }
// Ensure promises are real promises (some browsers may not implement decode)
const decodes = [imgPlane.decode?.().catch(()=>{}), imgFighter.decode?.().catch(()=>{}), imgEnemy.decode?.().catch(()=>{}), imgAirport.decode?.().catch(()=>{})].map(p=> p instanceof Promise ? p : Promise.resolve());
Promise.all(decodes).finally(()=>{
  setTimeout(hideLoading, 300);
  startMainLoop();
});
// Safety: if something blocks, forcibly hide loading and start loop after 5s
setTimeout(()=>{ hideLoading(); startMainLoop(); }, 5000);

// pan / click handling (mouse)
let mouseDown = false, mouseStart = null, mousePanned = false;
canvas.addEventListener('mousedown', e=>{ mouseDown = true; mouseStart = {x:e.clientX, y:e.clientY}; mousePanned = false; });
window.addEventListener('mousemove', e=>{
  if(!mouseDown) return;
  const dx = e.clientX - mouseStart.x, dy = e.clientY - mouseStart.y;
  if(!mousePanned && Math.hypot(dx,dy) > 6) mousePanned = true;
  if(mousePanned){ cam.x -= dx; cam.y -= dy; mouseStart = {x:e.clientX, y:e.clientY}; }
});
window.addEventListener('mouseup', e=>{ if(mouseDown && !mousePanned){ /* let click handler run */ } mouseDown = false; mousePanned = false; });

// touch: single-finger tap = select, drag = pan
let touchState = null;
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){ const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); touchState = {x:t.clientX-rect.left, y:t.clientY-rect.top, screenX:t.clientX, screenY:t.clientY, time:Date.now(), panned:false}; }
  else if(e.touches.length===2){ // two-finger pan
    const t0 = e.touches[0], t1 = e.touches[1]; touchState = {x: (t0.clientX+t1.clientX)/2, y:(t0.clientY+t1.clientY)/2, screenX:(t0.clientX+t1.clientX)/2, screenY:(t0.clientY+t1.clientY)/2, panned:false}; }
});
canvas.addEventListener('touchmove', e=>{
  if(!touchState) return;
  if(e.touches.length>=1){ const t = e.touches[0]; const dx = t.clientX - touchState.screenX, dy = t.clientY - touchState.screenY; if(Math.hypot(dx,dy)>6){ touchState.panned = true; cam.x -= dx; cam.y -= dy; touchState.screenX = t.clientX; touchState.screenY = t.clientY; } }
});
canvas.addEventListener('touchend', e=>{
  if(!touchState) return; if(!touchState.panned){ const item = findEntityAt(touchState.x,touchState.y); selectEntity(item); }
  touchState = null;
});
