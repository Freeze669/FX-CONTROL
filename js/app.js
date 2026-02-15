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
const cam = {x:0,y:0,zoom:0.6}; // Reduced zoom for larger map view
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
// Transport/Cargo planes
const svgCargo = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="18" width="52" height="28" fill="%23ffa500" stroke="%23404040"/><text x="32" y="38" font-size="9" text-anchor="middle" fill="%23404040">CARGO</text></svg>');
const svgA330 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="20" width="52" height="24" fill="%23c8e6ff" stroke="%231a3a5a"/><text x="32" y="38" font-size="10" text-anchor="middle" fill="%231a3a5a">A330</text></svg>');
const svgB777 = svgDataURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect rx="6" ry="6" x="6" y="20" width="52" height="24" fill="%23ffe6cc" stroke="%23404020"/><text x="32" y="38" font-size="10" text-anchor="middle" fill="%23404020">B777</text></svg>');

const imgPlane = new Image(); imgPlane.src = svgPlane;
const imgFighter = new Image(); imgFighter.src = svgFighter;
const imgEnemy = new Image(); imgEnemy.src = svgEnemy;
const imgAirport = new Image(); imgAirport.src = svgAirport;
const imgCargo = new Image(); imgCargo.src = svgCargo;
const imgA330 = new Image(); imgA330.src = svgA330;
const imgB777 = new Image(); imgB777.src = svgB777;

// stylized world map SVG as background (low-detail, abstract continents)
const svgWorld = svgDataURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
  <rect width="100%" height="100%" fill="none"/>
  <g fill="%231c3a4a" opacity="0.55">
    <path d="M120 140c30-20 80-40 140-30 40 7 90 35 120 20 20-10 40-40 80-46 30-5 70 6 100 22 18 10 32 30 40 50 12 30 4 70-18 92-28 28-76 36-120 30-46-6-92-30-140-30-46 0-86 18-124 6-28-9-44-34-42-64 2-24 10-48 26-62z"/>
    <path d="M20 260c20-30 70-50 120-44 34 4 76 28 110 30 40 2 84-14 120-6 36 8 68 36 92 58 22 20 30 46 26 76-6 46-56 74-102 80-46 6-98-6-140-24-40-16-82-44-120-74-30-24-54-58-56-96-1-16 2-30 12-36z"/>
    <path d="M480 40c60 6 120 36 170 70 40 28 70 66 82 106 10 34 2 76-20 104-28 36-78 54-124 52-40-2-84-22-120-44-34-20-68-48-92-82-22-30-28-70-10-104 18-34 56-64 134-102z"/>
  </g>
  <g fill="%23dbeff7" opacity="0.07">
    <circle cx="200" cy="100" r="6" />
    <circle cx="420" cy="220" r="6" />
    <circle cx="560" cy="70" r="6" />
  </g>
</svg>`);
const imgWorldMap = new Image(); imgWorldMap.src = svgWorld;

function spawnPlane(type='civil', x=null, y=null, hdg=null){
  const angle = rand(0,Math.PI*2);
  const r = Math.max(W,H)/1.5 + 120; // Larger spawn radius for bigger map
  const px = x!==null? x : cx + Math.cos(angle)*r;
  const py = y!==null? y : cy + Math.sin(angle)*r;
  const phd = hdg!==null? hdg : ((angle + Math.PI) % (Math.PI*2));
  const base = {id:Date.now().toString(36)+Math.floor(Math.random()*1000),call:callsign(),x:px,y:py,hdg:phd,spd:rand(80,220),alt:rand(2000,36000),selected:false,type:type};
  // assign model and tweak speeds
  if(type==='fighter'){ base.spd = 380; base.targetId = null; base.model = 'F-16'; base.img = svgFighter; }
  else if(type==='enemy'){ base.spd = rand(160,300); base.model = 'Unknown'; base.img = svgEnemy; }
  else if(type==='cargo' || type==='transport'){ 
    base.spd = rand(140,200); // Cargo planes are slower
    base.alt = rand(18000,30000); // Usually fly lower
    const cargoModels = ['Cargo','A330F','B777F'];
    base.model = cargoModels[Math.floor(Math.random()*cargoModels.length)];
    if(base.model==='Cargo') base.img = svgCargo;
    else if(base.model==='A330F') base.img = svgA330;
    else if(base.model==='B777F') base.img = svgB777;
    else base.img = svgCargo;
  }
  else { // civil passenger
    const civilModels = ['A320','B737','E195','A321','A330','B777'];
    base.model = civilModels[Math.floor(Math.random()*civilModels.length)];
    // pick model-specific SVG
    if(base.model==='A320') base.img = svgA320;
    else if(base.model==='B737') base.img = svgB737;
    else if(base.model==='E195') base.img = svgE195;
    else if(base.model==='A321') base.img = svgA321;
    else if(base.model==='A330') base.img = svgA330;
    else if(base.model==='B777') base.img = svgB777;
    else base.img = svgPlane;
  }
  
  // record spawn time to avoid immediate interception on spawn
  base._spawnTime = performance.now();
  entities.push(base);
}

function spawnAirport(x,y,name){ airports.push({x,y,name,r:28}); }

// define a set of cities and countries (for background map-like look) - enlarged for bigger map
const countries = [
  {x: -400, y: -160, w: 720, h: 440, name: 'Pays A', color: 'rgba(20,60,100,0.18)'},
  {x: 80, y: 120, w: 840, h: 520, name: 'Pays B', color: 'rgba(40,30,70,0.14)'},
  {x: -680, y: 240, w: 480, h: 320, name: 'Pays C', color: 'rgba(60,40,20,0.08)'},
  {x: 600, y: -200, w: 600, h: 380, name: 'Pays D', color: 'rgba(30,50,80,0.15)'}
];

// cities computed relative to current canvas center (cx, cy) - more cities for larger map
function getCities(){
  return [
    {x: cx - 320, y: cy - 180, name: 'Ville Nord'},
    {x: cx + 240, y: cy + 160, name: 'Ville Sud'},
    {x: cx - 120, y: cy + 280, name: 'Ville Est'},
    {x: cx + 440, y: cy - 80, name: 'Ville Ouest'},
    {x: cx - 400, y: cy + 100, name: 'Ville Centre-Est'},
    {x: cx + 300, y: cy - 200, name: 'Ville Centre-Ouest'}
  ];
}

// Create airports based on cities so there are more airports - more airports for larger map
function initAirports(){
  airports.length = 0;
  // core/central airports (major hubs)
  spawnAirport(cx - 240, cy - 160, 'FX-ONE');
  spawnAirport(cx + 280, cy + 120, 'FX-TWO');
  spawnAirport(cx, cy, 'FX-HUB');
  spawnAirport(cx - 500, cy + 200, 'FX-CARGO');
  // city airports
  for(const c of getCities()){ spawnAirport(c.x, c.y, 'APT '+c.name.replace(/\s+/g,'')); }
}
initAirports();

// Airspace zones and routes (recomputed on resize) - waypoints for ATC
const zones = [];
const routes = [];
const waypoints = [];
function initZonesAndRoutes(){
  zones.length = 0; routes.length = 0; waypoints.length = 0;
  // Larger control zones for bigger map
  zones.push({x:cx, y:cy-80, r:320, name:'CTR PRINCIPAL', color:'rgba(45,212,191,0.08)'});
  zones.push({x:cx+360, y:cy+160, r:220, name:'TMA EST', color:'rgba(255,90,90,0.06)'});
  zones.push({x:cx-400, y:cy+200, r:200, name:'TMA CARGO', color:'rgba(255,165,0,0.06)'});
  // add city zones for realism
  for(const c of getCities()){ zones.push({x:c.x, y:c.y, r:120, name: c.name+' CTR', color:'rgba(200,220,255,0.05)'}); }
  // Flight routes (airways)
  routes.push([{x:cx-440,y:cy+20},{x:cx-120,y:cy-80},{x:cx+80,y:cy-40},{x:cx+320,y:cy+120}]);
  routes.push([{x:cx-500,y:cy+200},{x:cx-200,y:cy+100},{x:cx+100,y:cy+60},{x:cx+400,y:cy+180}]);
  routes.push([{x:cx-300,y:cy-200},{x:cx,y:cy-100},{x:cx+200,y:cy-60},{x:cx+500,y:cy+40}]);
  // Waypoints for navigation
  waypoints.push({x:cx-300, y:cy-150, name:'WPT1'});
  waypoints.push({x:cx+200, y:cy+100, name:'WPT2'});
  waypoints.push({x:cx-100, y:cy+200, name:'WPT3'});
  waypoints.push({x:cx+350, y:cy-100, name:'WPT4'});
  waypoints.push({x:cx, y:cy, name:'WPT5'});
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
      // but avoid immediate destroy right after spawn (spawn grace period)
      if(p._mode==='intercept' && dist<26){
        const nowt = performance.now();
        const grace = 1200; // ms after spawn before interception allowed
        if((!p._spawnTime) || (nowt - p._spawnTime) > grace){
          const ti = entities.indexOf(target); if(ti>=0) entities.splice(ti,1);
          entities.splice(i,1);
        }
      }
    } else {
      // normal movement for civil/enemy
      // if returning to airport, steer to nearest airport
      if(p.returning){ let nearest=null; let dmin=Infinity; for(let a of airports){ const d=Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){dmin=d;nearest=a;} } if(nearest){ p.hdg = Math.atan2(nearest.y-p.y, nearest.x-p.x); if(dmin<18){ p.returning=false; p.spd = Math.max(60, p.spd*0.8); } } }
      const speed = (p.spd*(dt/1000)/2.5) || 0;
      p.x += Math.cos(p.hdg)*speed; p.y += Math.sin(p.hdg)*speed;
      // Larger bounds for bigger map
      if(p.x<-1200||p.x>W+1200||p.y<-1200||p.y>H+1200){ entities.splice(i,1); }
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
  // draw world map image behind everything (if loaded) - larger for bigger view
  try{
    const mapW = Math.max(W,H) * 2.4; const mapH = mapW * 0.5;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(imgWorldMap, cx - mapW/2, cy - mapH/2, mapW, mapH);
    ctx.globalAlpha = 1.0;
  }catch(e){}
  for(const c of countries){ ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.strokeRect(c.x, c.y, c.w, c.h); ctx.fillStyle = 'rgba(230,242,255,0.04)'; ctx.font='11px system-ui'; ctx.fillText(c.name, c.x+8, c.y+14); }
  // draw city dots
  for(const c of getCities()){ ctx.beginPath(); ctx.fillStyle='rgba(255,230,180,0.9)'; ctx.arc(c.x, c.y, 5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(230,242,255,0.9)'; ctx.font='12px system-ui'; ctx.fillText(c.name, c.x + 10, c.y + 4); }
  ctx.restore();
  // subtle grid - larger spacing for bigger map
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1;
  const g = 60; // Larger grid spacing
  for(let x = - (cam.x % g); x < W; x += g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y = - (cam.y % g); y < H; y += g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawRadar(){
  // draw zones (world coordinates assumed)
  // draw zones
  zones.forEach(z=>{
    ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,Math.PI*2);
    ctx.fillStyle = z.color; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(230,242,255,0.8)'; ctx.font='13px system-ui'; ctx.fillText(z.name, z.x - 30, z.y - z.r + 20);
  });
  // draw route lines (airways)
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(45,212,191,0.25)';
  routes.forEach(route=>{ 
    ctx.beginPath(); 
    route.forEach((pt,i)=>{ 
      if(i===0) ctx.moveTo(pt.x,pt.y); 
      else ctx.lineTo(pt.x,pt.y); 
    }); 
    ctx.stroke();
    // Draw route labels
    if(route.length > 1) {
      const mid = Math.floor(route.length / 2);
      ctx.fillStyle = 'rgba(45,212,191,0.4)'; ctx.font='10px system-ui';
      ctx.fillText('AWY', route[mid].x + 5, route[mid].y - 5);
    }
  });
  // draw waypoints
  waypoints.forEach(wp=>{
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 4, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,0,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,0,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,200,0.9)'; ctx.font='11px system-ui';
    ctx.fillText(wp.name, wp.x + 8, wp.y - 6);
  });
  // rings - larger for bigger map
  ctx.save(); ctx.translate(cx,cy);
  const maxR = Math.min(W,H)/1.5 - 20;
  ctx.strokeStyle = 'rgba(200,240,255,0.05)'; ctx.lineWidth = 1;
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
    } else if(p.type==='cargo' || p.type==='transport'){
      ctx.save(); ctx.translate(dx,dy); ctx.rotate(p.hdg);
      // Use preloaded image or create one
      let cargoImg = imgCargo;
      if(p.model==='A330F') cargoImg = imgA330;
      else if(p.model==='B777F') cargoImg = imgB777;
      ctx.drawImage(cargoImg, -12, -12, 24,24); ctx.restore();
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

// initial spawning - more variety including transport planes
for(let i=0;i<4;i++) spawnPlane('civil');
for(let i=0;i<2;i++) spawnPlane('cargo'); // Add cargo planes
setInterval(()=>{ if(entities.filter(e=>e.type==='civil').length<10) spawnPlane('civil'); }, 2000);
setInterval(()=>{ if(entities.filter(e=>e.type==='cargo'||e.type==='transport').length<4) spawnPlane('cargo'); }, 4000);
// reduce enemy spawn frequency and max count to make game less hostile
setInterval(()=>{ if(entities.filter(e=>e.type==='enemy').length<2) spawnPlane('enemy'); }, 15000);

// Don't start the main loop automatically - wait for user to click the server button
// startMainLoop(); // Commented out - will be started when user clicks the server button

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
  const p = entities.find(x=>x.selected); if(!p) return;
  // Only allow destruction if a fighter has been dispatched to target this plane
  if(p.type !== 'fighter'){
    const fighter = entities.find(e=>e.type==='fighter' && e.targetId===p.id);
    if(!fighter){ info.textContent = 'Impossible: envoyer d\'abord un avion de chasse'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); return; }
    // if there is a fighter targeting, allow manual destroy (simulate fighter interception)
    const idx = entities.indexOf(p); if(idx>=0){ entities.splice(idx,1); info.textContent='Cible neutralisée par le chasseur'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
    return;
  }
  // if selected is a fighter, allow destroying its target or self
  if(p.type==='fighter' && p.targetId){ const target = entities.find(e=>e.id===p.targetId); if(target){ const ti=entities.indexOf(target); if(ti>=0) entities.splice(ti,1); info.textContent='Cible détruite par le chasseur'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); return; } }
  // otherwise remove the fighter itself
  const idxf = entities.indexOf(p); if(idxf>=0){ entities.splice(idxf,1); info.textContent='Avion de chasse retiré'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
});

const _elAlert = document.getElementById('alert'); if(_elAlert) _elAlert.addEventListener('click', ()=>{
  const p = entities.find(x=>x.selected); if(!p) return; // command to return to nearest airport
  let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
  if(nearest){ p.returning = true; p.hdg = Math.atan2(nearest.y-p.y, nearest.x-p.x); p.spd = Math.max(60, p.spd*0.8); info.textContent='Ordre: revenir à '+nearest.name; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1200); }
});

const _elDispatch = document.getElementById('dispatch'); if(_elDispatch) _elDispatch.addEventListener('click', ()=>{
  const p = entities.find(x=>x.selected); if(!p) return; let nearest = null; let dmin = Infinity; for(let a of airports){ const d = Math.hypot(a.x-p.x,a.y-p.y); if(d<dmin){ dmin=d; nearest=a; } }
  if(nearest){ spawnPlane('fighter', nearest.x+6, nearest.y, Math.atan2(p.y-nearest.y,p.x-nearest.x)); const f = entities[entities.length-1]; f.targetId = p.id; f._mode='intercept'; info.textContent='Fighter lancé depuis '+nearest.name; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',1500); }
});

const _elTraj = document.getElementById('traj'); if(_elTraj) _elTraj.addEventListener('click', ()=>{ showTrajectory = !showTrajectory; info.textContent = showTrajectory? 'Trajectoires: ON' : 'Trajectoires: OFF'; setTimeout(()=>info.textContent='Tapez un avion pour le sélectionner',900); });

// loading overlay: hide after small delay when images ready
function hideLoading(){ const L = document.getElementById('loading'); if(L){ try{ L.style.display='none'; }catch(e){} } }
// Ensure promises are real promises (some browsers may not implement decode)
const decodes = [imgPlane.decode?.().catch(()=>{}), imgFighter.decode?.().catch(()=>{}), imgEnemy.decode?.().catch(()=>{}), imgAirport.decode?.().catch(()=>{}), imgCargo.decode?.().catch(()=>{}), imgA330.decode?.().catch(()=>{}), imgB777.decode?.().catch(()=>{})].map(p=> p instanceof Promise ? p : Promise.resolve());
Promise.all(decodes).finally(()=>{
  // hide raw loading and show server select UI after brief delay
  setTimeout(()=>{
    hideLoading();
    const sel = document.getElementById('server-select'); 
    if(sel) {
      sel.classList.remove('hidden');
    }
  }, 300);
});
// Safety: if something blocks, forcibly hide loading and show server select after 5s
setTimeout(()=>{ 
  hideLoading(); 
  const sel = document.getElementById('server-select'); 
  if(sel) {
    sel.classList.remove('hidden');
  }
}, 5000);

// wire server selection buttons to actually start the game
function launchServer(name){ 
  const sel = document.getElementById('server-select'); 
  if(sel) sel.classList.add('hidden'); 
  // Show the game canvas and HUD
  const gameMain = document.getElementById('game-main');
  if(gameMain) gameMain.classList.remove('hidden');
  try{ setStatus('Connecté: '+name); }catch(e){} 
  startMainLoop(); 
}

// Simple button click handler
document.addEventListener('DOMContentLoaded', function(){
  const connectBtn = document.getElementById('connect-btn');
  if(connectBtn){
    connectBtn.onclick = function(){
      launchServer('fx-control');
    };
  }
});

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
