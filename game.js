'use strict';
(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const shell = document.querySelector('#game-shell');
  const scoreText = document.querySelector('#score b');
  const soundButton = document.querySelector('#sound');
  const startButton = document.querySelector('#start');
  const KEY = 'line-hearts-save-v1';
  const defaults = { total: 0, specials: 0, sound: true, hundredSeen: false };
  let save = defaults;
  try { save = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { save = defaults; }

  let w = 390, h = 844, dpr = 1, running = false, paused = false, last = 0, gameTime = 0;
  let spawnIn = .8, launchPhase = 0, launchKind = null, slow = 1, eventStage = 0, eventClock = 0;
  const hearts = [], particles = [], stars = [], skyline = [];
  const basket = { x: 195, target: 195, y: 760, width: 112, height: 46, bounce: 0, glow: 0 };
  const vini = { x: 195, y: 135, look: 0, shrug: 0 };
  let audioCtx = null, ambience = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (_) {} };

  function resize() {
    const r = shell.getBoundingClientRect();
    w = r.width; h = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    basket.y = h - Math.max(76, 58 + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab') || 0));
    basket.x = basket.target = clamp(basket.x || w / 2, 62, w - 62); vini.x = w / 2;
    makeScenery();
  }
  function makeScenery() {
    stars.length = 0; skyline.length = 0;
    for (let i = 0; i < 74; i++) stars.push({ x: Math.random() * w, y: Math.random() * h * .68, r: rand(.35, 1.3), p: rand(0, 6.28), near: Math.random() });
    let x = -5;
    while (x < w + 10) { const bw = rand(18, 42); skyline.push({ x, width: bw, height: rand(30, 100), lights: Math.floor(rand(1, 5)) }); x += bw + rand(2, 5); }
  }

  function heartPath(c, x, y, size, rot = 0) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(size / 24, size / 24); c.beginPath();
    c.moveTo(0, 9); c.bezierCurveTo(-3, 5, -12, 0, -12, -7); c.bezierCurveTo(-12, -15, -2, -18, 0, -10); c.bezierCurveTo(2, -18, 12, -15, 12, -7); c.bezierCurveTo(12, 0, 3, 5, 0, 9); c.closePath(); c.restore();
  }
  function fillHeart(x, y, size, color, rot = 0, glow = 0) {
    ctx.save(); if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; } heartPath(ctx, x, y, size, rot); ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = .35; heartPath(ctx, x - size * .16, y - size * .18, size * .25, '#fff', rot); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  }

  function drawBackground() {
    const progress = clamp(save.total / 120, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgb(${10 + progress * 9},${11 + progress * 5},${39 + progress * 7})`); g.addColorStop(.58, '#171631'); g.addColorStop(1, '#281527'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const moonX = w * .8, moonY = h * .15;
    const mg = ctx.createRadialGradient(moonX, moonY, 3, moonX, moonY, 70); mg.addColorStop(0, '#ffe8ad2c'); mg.addColorStop(1, '#ffe8ad00'); ctx.fillStyle = mg; ctx.fillRect(moonX - 75, moonY - 75, 150, 150);
    ctx.fillStyle = '#f5dda7'; ctx.beginPath(); ctx.arc(moonX, moonY, 20, 0, 7); ctx.fill(); ctx.fillStyle = '#12122f'; ctx.beginPath(); ctx.arc(moonX + 8, moonY - 5, 19, 0, 7); ctx.fill();
    const visible = 25 + Math.floor(progress * 49);
    for (let i = 0; i < visible; i++) { const s = stars[i], a = .2 + .55 * (Math.sin(gameTime * (1 + s.near) + s.p) * .5 + .5); ctx.globalAlpha = a; ctx.fillStyle = s.near > .85 ? '#ffd999' : '#dcdcff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // distant clouds
    ctx.fillStyle = '#9d86aa0b'; for (let i = 0; i < 3; i++) { const cx = ((gameTime * (2 + i) + i * w * .43) % (w + 150)) - 75; ctx.beginPath(); ctx.ellipse(cx, h * (.28 + i * .13), 75, 13, 0, 0, 7); ctx.fill(); }
    const base = h - 25; ctx.fillStyle = '#090a19b8';
    skyline.forEach((b, bi) => { ctx.fillRect(b.x, base - b.height, b.width, b.height); if (progress > .16) { ctx.fillStyle = '#e8b772'; for (let j = 0; j < b.lights; j++) if ((j + bi) % 3 !== 0) ctx.fillRect(b.x + 6 + (j % 2) * 10, base - b.height + 12 + Math.floor(j / 2) * 16, 2, 3); ctx.fillStyle = '#090a19b8'; } });
    const glow = ctx.createLinearGradient(0, h * .7, 0, h); glow.addColorStop(0, '#b84d6700'); glow.addColorStop(1, `rgba(171,58,91,${.05 + progress * .08})`); ctx.fillStyle = glow; ctx.fillRect(0, h * .65, w, h * .35);
  }

  function drawVini() {
    const idle = Math.sin(gameTime * 2.1) * 2, throwT = launchPhase ? Math.sin(launchPhase * Math.PI) : 0;
    const y = vini.y + idle - throwT * 4, lean = throwT * .07;
    ctx.save(); ctx.translate(vini.x, y); ctx.rotate(lean); ctx.shadowColor = '#0008'; ctx.shadowBlur = 14;
    // body and legs
    ctx.strokeStyle = '#24213b'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, 35); ctx.lineTo(-12, 52); ctx.moveTo(9, 35); ctx.lineTo(13, 52); ctx.stroke();
    ctx.fillStyle = '#55354f'; ctx.beginPath(); ctx.roundRect(-23, 8, 46, 39, 14); ctx.fill();
    // arms: shrug during event, otherwise hand presents heart
    ctx.strokeStyle = '#d49b82'; ctx.lineWidth = 7; ctx.beginPath();
    if (vini.shrug > 0) { const sy = 18 - vini.shrug * 12; ctx.moveTo(-18, 18); ctx.lineTo(-36, sy); ctx.moveTo(18, 18); ctx.lineTo(36, sy); }
    else { ctx.moveTo(-17, 18); ctx.lineTo(-28, 31); ctx.moveTo(17, 18); ctx.lineTo(25 + throwT * 11, 5 - throwT * 8); }
    ctx.stroke();
    // head + hair
    ctx.fillStyle = '#dca289'; ctx.beginPath(); ctx.arc(0, -8, 25, 0, 7); ctx.fill();
    ctx.fillStyle = '#2c2030'; ctx.beginPath(); ctx.arc(0, -15, 25, Math.PI, 6.28); ctx.lineTo(21, -4); ctx.quadraticCurveTo(8, -25, -23, -6); ctx.fill();
    // eyes follow basket/event
    const ex = vini.look * 2.3; ctx.fillStyle = '#302431'; ctx.beginPath(); ctx.arc(-8 + ex, -7 + Math.abs(vini.look), 1.8, 0, 7); ctx.arc(8 + ex, -7 + Math.abs(vini.look), 1.8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8b4d58'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 5, .25, 2.85); ctx.stroke(); ctx.restore();
    if (launchKind && launchPhase < .7) { const size = 14 + Math.sin(launchPhase * Math.PI) * 3; fillHeart(vini.x + 29, y - 1, size, launchKind.color, -.12, launchKind.glow); }
  }

  function kindRoll(forceNormal = false) {
    const r = forceNormal ? 0 : Math.random();
    if (r > .975) return { type: 'gold', color: '#f5c85b', value: 5, glow: 14 };
    if (r > .89) return { type: 'bright', color: '#f4a7d5', value: 3, glow: 12 };
    if (r > .67) return { type: 'pink', color: '#f2759d', value: 2, glow: 5 };
    return { type: 'red', color: '#ef4966', value: 1, glow: 4 };
  }
  function beginThrow(kind = kindRoll()) { if (launchPhase || eventStage === 1) return; launchKind = kind; launchPhase = .001; }
  function releaseHeart(kind, specialEvent = false) {
    hearts.push({ x: vini.x + 30, y: vini.y, vx: rand(-35, 35), vy: rand(20, 42), gravity: rand(45, 61), size: rand(16, 23), angle: rand(-.4, .4), spin: rand(-.6, .6), sway: rand(9, 19), phase: rand(0, 6), kind, event: specialEvent, trail: 0 });
  }
  function update(dt) {
    gameTime += dt;
    basket.x += (basket.target - basket.x) * (1 - Math.exp(-dt * 22)); basket.bounce = Math.max(0, basket.bounce - dt * 4); basket.glow = Math.max(0, basket.glow - dt * 2.7);
    if (eventStage) updateEvent(dt); else { spawnIn -= dt; if (spawnIn <= 0 && !launchPhase) { beginThrow(); spawnIn = rand(1.05, 1.65); } }
    if (launchPhase) { launchPhase += dt * 2.25; if (launchPhase >= .72 && launchKind) { releaseHeart(launchKind, eventStage === 5); launchKind = null; } if (launchPhase >= 1) launchPhase = 0; }
    const speed = slow;
    for (let i = hearts.length - 1; i >= 0; i--) {
      const p = hearts[i], step = dt * speed; p.vy += p.gravity * step; p.y += p.vy * step; p.x += (p.vx + Math.sin(gameTime * 2.2 + p.phase) * p.sway) * step; p.angle += p.spin * step;
      if ((p.kind.glow > 8 || p.event) && (p.trail -= step) <= 0) { addParticle(p.x, p.y, p.kind.color, true); p.trail = .11; }
      const caught = p.vy > 0 && p.y + p.size * .45 > basket.y - 24 && p.y < basket.y + 12 && Math.abs(p.x - basket.x) < basket.width * .48;
      if (caught) { collect(p); hearts.splice(i, 1); continue; }
      if (p.y > h + 45 || p.x < -60 || p.x > w + 60) hearts.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 24 * dt; if (p.life <= 0) particles.splice(i, 1); }
  }
  function collect(p) {
    const old = save.total; save.total += p.kind.value; if (p.kind.value > 1) save.specials++; persist(); scoreText.textContent = save.total;
    basket.bounce = 1; basket.glow = 1; for (let n = 0; n < (p.kind.value > 2 ? 12 : 7); n++) addParticle(p.x, basket.y - 20, p.kind.color);
    sound(p.kind.type); if (!save.hundredSeen && old < 100 && save.total >= 100) { save.hundredSeen = true; persist(); eventStage = 1; eventClock = 0; chime100(); }
  }
  function addParticle(x, y, color, trail = false) {
    if (particles.length > 110) particles.shift(); particles.push({ x, y, vx: trail ? rand(-4, 4) : rand(-55, 55), vy: trail ? rand(-5, 8) : rand(-75, -20), life: trail ? .4 : rand(.45, .85), max: trail ? .4 : .85, r: trail ? rand(1, 2.2) : rand(1.3, 3), color });
  }
  function updateEvent(dt) {
    eventClock += dt; slow += (.28 - slow) * dt * 2;
    if (eventStage === 1) { vini.look = lerp(vini.look, clamp((basket.x - vini.x) / w * 3, -.7, .7), dt * 2); if (eventClock > 1.3) { eventStage = 2; eventClock = 0; } }
    else if (eventStage === 2) { vini.look = lerp(vini.look, -.4, dt * 3); if (eventClock > .9) { eventStage = 3; eventClock = 0; launchKind = kindRoll(true); } }
    else if (eventStage === 3) { vini.look = lerp(vini.look, .75, dt * 4); if (eventClock > .85) { eventStage = 4; eventClock = 0; vini.shrug = 1; } }
    else if (eventStage === 4) { vini.shrug = Math.sin(clamp(eventClock / 1.1, 0, 1) * Math.PI); if (eventClock > 1.15) { eventStage = 5; eventClock = 0; vini.shrug = 0; launchPhase = .001; } }
    else if (eventStage === 5 && !launchPhase) { eventStage = 6; eventClock = 0; }
    else if (eventStage === 6) { slow += (1 - slow) * dt * 1.5; vini.look += (0 - vini.look) * dt * 2; if (eventClock > 1.4) { eventStage = 0; slow = 1; } }
  }
  function drawBasket() {
    const fullness = clamp(save.total / 100, 0, 1), overflow = Math.max(0, save.total - 70);
    const squash = basket.bounce ? Math.sin(basket.bounce * Math.PI) * .09 : 0;
    ctx.save(); ctx.translate(basket.x, basket.y); ctx.scale(1 + squash, 1 - squash); ctx.shadowColor = `rgba(255,105,133,${basket.glow * .8})`; ctx.shadowBlur = 22 * basket.glow;
    // accumulated hearts behind the rim, deterministic arrangement
    const count = Math.min(32, Math.ceil(save.total / 4));
    for (let i = 0; i < count; i++) { const row = Math.floor(i / 8), col = i % 8, hx = (col - 3.5) * 11 + Math.sin(i * 8.2) * 3, hy = -19 - row * 9 - Math.max(0, row - 1) * fullness * 2; const colors = ['#df3658','#f27398','#ed4f6e','#f3a4bd','#d9345b']; fillHeart(hx, hy, 12, colors[i % colors.length], (i % 3 - 1) * .16, i % 9 === 0 ? 3 : 0); }
    if (overflow > 0) for (let i = 0; i < Math.min(10, Math.ceil(overflow / 13)); i++) fillHeart(-42 + (i * 19) % 88, -52 - Math.floor(i / 5) * 14, 13, i % 4 ? '#ee5274' : '#f2bd69', (i % 3 - 1) * .25, 3);
    // handle, body, weave
    ctx.strokeStyle = '#b76d58'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -17, 43, Math.PI, 0); ctx.stroke();
    const bg = ctx.createLinearGradient(-55, 0, 55, 35); bg.addColorStop(0, '#a65f50'); bg.addColorStop(.5, '#dda078'); bg.addColorStop(1, '#995247'); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-57, -12); ctx.quadraticCurveTo(-51, 32, -42, 36); ctx.quadraticCurveTo(0, 46, 42, 36); ctx.quadraticCurveTo(51, 31, 57, -12); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .27; ctx.strokeStyle = '#613645'; ctx.lineWidth = 1; for (let x = -40; x <= 40; x += 13) { ctx.beginPath(); ctx.moveTo(x - 6, -7); ctx.lineTo(x + 2, 34); ctx.stroke(); } for (let y = 3; y < 32; y += 9) { ctx.beginPath(); ctx.moveTo(-50, y); ctx.quadraticCurveTo(0, y + 7, 50, y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = '#e4a986'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-57, -12); ctx.quadraticCurveTo(0, -3, 57, -12); ctx.stroke();
    ctx.fillStyle = '#482b35'; ctx.font = '600 13px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText('Line ♡', 0, 24); ctx.restore();
  }
  function drawHearts() { hearts.forEach(p => fillHeart(p.x, p.y, p.size, p.kind.color, p.angle, p.kind.glow)); }
  function drawParticles() { particles.forEach(p => { ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.restore(); }); }
  function frame(now) {
    requestAnimationFrame(frame); if (!running || paused) return; const dt = Math.min((now - last) / 1000 || 0, .034); last = now; update(dt); drawBackground(); drawHearts(); drawVini(); drawBasket(); drawParticles();
  }

  function setTarget(clientX) { const r = canvas.getBoundingClientRect(); basket.target = clamp(clientX - r.left, basket.width * .52, w - basket.width * .52); }
  canvas.addEventListener('pointerdown', e => { if (!running) return; canvas.setPointerCapture?.(e.pointerId); setTarget(e.clientX); e.preventDefault(); });
  canvas.addEventListener('pointermove', e => { if (!running) return; if (e.pointerType === 'mouse' || e.buttons) setTarget(e.clientX); e.preventDefault(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); }
  function tone(freq, duration, volume, type = 'sine', delay = 0) {
    if (!save.sound || !audioCtx) return; const t = audioCtx.currentTime + delay, osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + duration); gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + .018); gain.gain.exponentialRampToValueAtTime(.0001, t + duration); osc.connect(gain).connect(audioCtx.destination); osc.start(t); osc.stop(t + duration + .02);
  }
  function sound(kind) { if (kind === 'gold') { tone(660,.35,.07); tone(990,.45,.05,'sine',.08); } else if (kind === 'bright') { tone(590,.28,.055); tone(790,.3,.035,'sine',.05); } else tone(kind === 'pink' ? 520 : 440, .2, .035); }
  function chime100() { tone(392,.7,.05); tone(523,.8,.04,'sine',.18); tone(659,.9,.035,'sine',.38); }
  function ambienceOn() {
    if (!save.sound || !audioCtx || ambience) return; const gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter(), o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(); gain.gain.value = .012; filter.type = 'lowpass'; filter.frequency.value = 480; o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 98; o2.frequency.value = 146.83; o1.connect(filter); o2.connect(filter); filter.connect(gain).connect(audioCtx.destination); o1.start(); o2.start(); ambience = { gain, o1, o2 };
  }
  function ambienceOff() { if (!ambience) return; const a = ambience; a.gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .15); setTimeout(() => { a.o1.stop(); a.o2.stop(); }, 200); ambience = null; }
  function updateSoundUI() { soundButton.setAttribute('aria-pressed', String(save.sound)); soundButton.setAttribute('aria-label', save.sound ? 'Desativar som' : 'Ativar som'); }
  soundButton.addEventListener('click', e => { e.stopPropagation(); save.sound = !save.sound; persist(); updateSoundUI(); if (save.sound) { initAudio(); ambienceOn(); tone(523,.18,.04); } else ambienceOff(); });
  startButton.addEventListener('click', () => { if (running) return; running = true; shell.classList.add('playing'); scoreText.textContent = save.total; if (save.sound) { initAudio(); ambienceOn(); tone(392,.22,.03); tone(523,.35,.025,'sine',.12); } last = performance.now(); });
  document.addEventListener('visibilitychange', () => { paused = document.hidden; if (!paused) { last = performance.now(); if (save.sound && running) { initAudio(); ambienceOn(); } } else ambienceOff(); });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  document.addEventListener('gesturestart', e => e.preventDefault());
  updateSoundUI(); scoreText.textContent = save.total; resize(); drawBackground(); drawVini(); drawBasket(); requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
})();
