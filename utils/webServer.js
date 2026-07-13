const express = require('express');
const db = require('./database');
const webTokens = require('./webTokens');
 
const chatClients = new Set();
const activeDuels = new Map();
let globalWins = [];
const activeMinesGames = new Map();
const activeCrashGames = new Map();
const DIRTY_COUNT = 14;
const TOTAL_TILES = 16;
const TIME_LIMIT_SECONDS = 20;
const TRAP_COUNT = 3;
const TRAP_PENALTY_SECONDS = 3;
const RESPAWN_INTERVAL_MS = 3500;
const MAX_RESPAWNS = 6;
 
function renderInvalidPage() {
  return `<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8"><title>Link inválido</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Nunito', sans-serif; background:#1F3B2C; color:#DCEEE3; min-height:100vh;
    display:flex; align-items:center; justify-content:center; text-align:center; margin:0; padding:24px; }
  .box { max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; }
  p { color:#a9c7b7; font-size:14px; }
</style></head>
<body><div class="box">
  <h1>🔒 Este link já não é válido</h1>
  <p>Ou já foi usado, ou passaram mais de 10 minutos desde que foi gerado. Volta ao Discord e usa <code>/trabalhar</code> outra vez para receberes um link novo.</p>
</div></body></html>`;
}
 
function renderGamePage(token) {
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A tua casa — Faxina Rápida</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --mint:#DCEEE3; --mint-deep:#C3E4D2; --pine:#1F3B2C; --bubble:#6FB8D9;
    --sun:#FFC94D; --sun-deep:#F2A93C; --charcoal:#26312B;
    --dirty:#B08968; --dirty-dark:#8A6A4F; --clean:#F4FBF7; --white:#fff;
    --trap:#D9634F; --trap-dark:#B04836;
    --shadow: rgba(31,59,44,0.18);
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Nunito',sans-serif; background:linear-gradient(180deg,var(--mint),var(--mint-deep));
    color:var(--charcoal); min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:24px 16px 50px; }
  h1,.display { font-family:'Baloo 2',sans-serif; }
  header { width:100%; max-width:420px; text-align:center; margin-bottom:16px; }
  .eyebrow { display:inline-block; background:var(--pine); color:var(--mint); font-weight:800; font-size:11px;
    letter-spacing:.08em; text-transform:uppercase; padding:4px 12px; border-radius:999px; margin-bottom:10px; }
  h1 { font-size:26px; color:var(--pine); margin:0 0 6px; }
  header p { font-size:14px; color:#3f5346; margin:0; }
  .hud { display:flex; gap:10px; margin:16px 0; flex-wrap:wrap; justify-content:center; }
  .hud-card { background:var(--white); border-radius:14px; padding:10px 16px; box-shadow:0 5px 0 var(--shadow); text-align:center; min-width:90px; }
  .hud-card .label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#6b7c70; font-weight:700; }
  .hud-card .value { font-family:'Baloo 2',sans-serif; font-size:20px; color:var(--pine); font-weight:700; }
  .room-frame { background:var(--white); border-radius:22px; padding:16px; box-shadow:0 8px 0 var(--shadow); width:100%; max-width:380px; transition:transform .15s ease; }
  .room-frame.shake { animation:shake .35s ease; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
  .timer-track { width:100%; height:9px; background:#e7f1ea; border-radius:999px; overflow:hidden; margin-bottom:12px; }
  .timer-fill { height:100%; background:linear-gradient(90deg,var(--bubble),var(--sun)); border-radius:999px; transition:width .2s linear; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .tile { position:relative; aspect-ratio:1; border-radius:12px; border:none; cursor:pointer; font-size:22px;
    display:flex; align-items:center; justify-content:center; background:var(--dirty);
    box-shadow:inset 0 -4px 0 var(--dirty-dark); transition:transform .08s ease, background .25s ease; user-select:none; }
  .tile:active { transform:scale(.9); }
  .tile.clean { background:var(--clean); box-shadow:inset 0 -4px 0 #d7ece1; cursor:default; pointer-events:none; }
  .tile.trap { background:var(--trap); box-shadow:inset 0 -4px 0 var(--trap-dark); }
  .tile.trap.sprung { background:var(--clean); box-shadow:inset 0 -4px 0 #d7ece1; cursor:default; pointer-events:none; }
  .sparkle { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:18px;
    opacity:0; animation:pop .5s ease forwards; pointer-events:none; }
  @keyframes pop { 0%{opacity:1;transform:scale(.6)} 100%{opacity:0;transform:scale(1.5) translateY(-16px)} }
  .result { display:none; text-align:center; margin-top:18px; background:var(--pine); color:var(--mint);
    border-radius:18px; padding:20px; max-width:380px; width:100%; }
  .result.show { display:block; }
  .result h2 { margin:0 0 6px; color:var(--sun); font-size:22px; }
  .result p { margin:0; font-size:13px; color:#bcd6c6; }
  .note { max-width:380px; font-size:11px; color:#5c6f61; text-align:center; margin-top:14px; line-height:1.6; }
</style>
</head>
<body>
 
<header>
  <span class="eyebrow">A tua casa</span>
  <h1>Limpa antes do tempo acabar!</h1>
  <p>Cuidado com os 🐭 — roubam-te tempo. E não relaxes, a sujidade pode voltar.</p>
</header>
 
<div class="hud">
  <div class="hud-card"><div class="label">Limpo</div><div class="value" id="cleanedValue">0/${DIRTY_COUNT}</div></div>
  <div class="hud-card"><div class="label">Tempo</div><div class="value" id="timeValue">${TIME_LIMIT_SECONDS}s</div></div>
</div>
 
<div class="room-frame" id="roomFrame">
  <div class="timer-track"><div class="timer-fill" id="timerFill" style="width:100%"></div></div>
  <div class="grid" id="grid"></div>
</div>
 
<div class="result" id="result">
  <h2 id="resultTitle">A processar...</h2>
  <p id="resultText"></p>
</div>
 
<p class="note">Podes fechar esta página assim que veres o resultado — o saldo já fica guardado no bot.</p>
 
<script>
  const TOKEN = ${JSON.stringify(token)};
  const DIRTY_COUNT = ${DIRTY_COUNT};
  const TOTAL_TILES = ${TOTAL_TILES};
  const TIME_LIMIT = ${TIME_LIMIT_SECONDS};
  const TRAP_COUNT = ${TRAP_COUNT};
  const TRAP_PENALTY = ${TRAP_PENALTY_SECONDS};
  const RESPAWN_INTERVAL_MS = ${RESPAWN_INTERVAL_MS};
  const MAX_RESPAWNS = ${MAX_RESPAWNS};
  const DIRT_EMOJI = ['🧹','🧽','🪣','🧼'];
 
  let progress = 0;
  let finished = false;
  let timeLeft = TIME_LIMIT;
  let timerInterval = null;
  let respawnInterval = null;
  let respawnsUsed = 0;
  let dirtyTileEls = [];
 
  const grid = document.getElementById('grid');
  const cleanedValueEl = document.getElementById('cleanedValue');
  const timeValueEl = document.getElementById('timeValue');
  const timerFillEl = document.getElementById('timerFill');
  const roomFrame = document.getElementById('roomFrame');
  const resultBox = document.getElementById('result');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
 
  function buildGrid() {
    grid.innerHTML = '';
    dirtyTileEls = [];
    const indices = [...Array(TOTAL_TILES).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const dirtyIdx = new Set(indices.slice(0, DIRTY_COUNT));
    const trapIdx = new Set(indices.slice(DIRTY_COUNT, DIRTY_COUNT + TRAP_COUNT));
 
    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.createElement('button');
      tile.className = 'tile';
      if (dirtyIdx.has(i)) {
        markDirty(tile);
        dirtyTileEls.push(tile);
      } else if (trapIdx.has(i)) {
        tile.classList.add('trap');
        tile.textContent = '🐭';
        tile.addEventListener('click', () => springTrap(tile));
      } else {
        tile.classList.add('clean');
      }
      grid.appendChild(tile);
    }
  }
 
  function markDirty(tile) {
    tile.classList.remove('clean');
    tile.textContent = DIRT_EMOJI[Math.floor(Math.random() * DIRT_EMOJI.length)];
    tile.onclick = () => cleanTile(tile);
  }
 
  function sparkleOn(tile, emoji) {
    const sparkle = document.createElement('span');
    sparkle.className = 'sparkle';
    sparkle.textContent = emoji;
    tile.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 500);
  }
 
  function cleanTile(tile) {
    if (finished || tile.classList.contains('clean')) return;
    tile.textContent = '';
    tile.classList.add('clean');
    tile.onclick = null;
    sparkleOn(tile, '✨');
 
    progress++;
    cleanedValueEl.textContent = Math.max(progress, 0) + '/' + DIRTY_COUNT;
    if (progress >= DIRTY_COUNT) finish();
  }
 
  function springTrap(tile) {
    if (finished || tile.classList.contains('sprung')) return;
    tile.classList.add('sprung');
    tile.textContent = '💥';
    tile.onclick = null;
    sparkleOn(tile, '💢');
    roomFrame.classList.remove('shake');
    void roomFrame.offsetWidth;
    roomFrame.classList.add('shake');
 
    timeLeft = Math.max(timeLeft - TRAP_PENALTY, 0);
    timeValueEl.textContent = timeLeft + 's';
    timerFillEl.style.width = Math.max((timeLeft / TIME_LIMIT) * 100, 0) + '%';
    if (timeLeft <= 0) finish();
  }
 
  function respawnDirt() {
    if (finished || respawnsUsed >= MAX_RESPAWNS || timeLeft <= 5) return;
    const cleanedOriginals = dirtyTileEls.filter(t => t.classList.contains('clean'));
    if (cleanedOriginals.length === 0) return;
    const tile = cleanedOriginals[Math.floor(Math.random() * cleanedOriginals.length)];
    markDirty(tile);
    respawnsUsed++;
    progress--;
    cleanedValueEl.textContent = Math.max(progress, 0) + '/' + DIRTY_COUNT;
  }
 
  function startTimer() {
    timerInterval = setInterval(() => {
      timeLeft--;
      timeValueEl.textContent = Math.max(timeLeft, 0) + 's';
      timerFillEl.style.width = Math.max((timeLeft / TIME_LIMIT) * 100, 0) + '%';
      if (timeLeft <= 0) finish();
    }, 1000);
    respawnInterval = setInterval(respawnDirt, RESPAWN_INTERVAL_MS);
  }
 
  async function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timerInterval);
    clearInterval(respawnInterval);
    roomFrame.style.opacity = '0.5';
    resultBox.classList.add('show');
    resultTitle.textContent = 'A guardar no bot...';
    resultText.textContent = '';
 
    const cleaned = Math.max(progress, 0);
 
    try {
      const res = await fetch('/api/trabalho/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, cleaned })
      });
      const data = await res.json();
      if (!res.ok) {
        resultTitle.textContent = 'Ups!';
        resultText.textContent = data.error || 'Não foi possível guardar o resultado. Volta ao Discord e tenta de novo.';
      } else {
        resultTitle.textContent = 'Sucesso!';
        resultText.textContent = 'Ganhaste ' + data.reward + ' moedas! Já estão na tua conta.';
      }
    } catch (err) {
      resultTitle.textContent = 'Erro!';
      resultText.textContent = 'Erro de rede. Tenta de novo.';
    }
  }
  buildGrid();
  startTimer();
</script>
</body>
</html>`;
}
 
let discordClient = null;

const activeJobs = new Map();

function getSession(req) {
  let token = null;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split('; ').map(c => {
        const parts = c.split('=');
        return [parts[0], parts.slice(1).join('=')];
      })
    );
    token = cookies.session_token;
  }
  
  if (!token && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) return null;
  return db.getWebSession(token);
}

function createSession(guildId, userId) {
  const crypto = require('crypto');
  const sessionToken = crypto.randomBytes(32).toString('hex');
  db.setWebSession(sessionToken, { guildId, userId });
  return sessionToken;
}

const app = express();
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));
 
app.get('/', (req, res) => {
  res.send('Bot e Site Online 24/7!');
});
 
app.get('/trabalho', (req, res) => {
  const token = req.query.token;
  if (!token || !webTokens.peekToken(token)) {
    return res.send(renderInvalidPage());
  }
  res.redirect(`/trabalho.html?token=${token}`);
});
 
app.get('/trabalho/:token', (req, res) => {
  const token = req.params.token;
  if (!token || !webTokens.peekToken(token)) {
    return res.send(renderInvalidPage());
  }
  res.redirect(`/trabalho.html?token=${token}`);
});

app.get('/pescar', (req, res) => {
  const token = req.query.token;
  if (!token || !webTokens.peekToken(token)) {
    return res.send(renderInvalidPage());
  }
  const entry = webTokens.consumeToken(token);
  if (!entry) return res.send(renderInvalidPage());

  const { guildId, userId } = entry;
  const cooldown = db.getCooldown(guildId, userId, 'pescar');
  if (cooldown > 0) {
    return res.send(`<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8"><title>Cooldown</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Nunito', sans-serif; background:#0d1e16; color:#DCEEE3; min-height:100vh;
    display:flex; align-items:center; justify-content:center; text-align:center; margin:0; padding:24px; }
  .box { max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; color:#FACA2B; }
  p { color:#a9c7b7; font-size:14px; }
</style></head>
<body><div class="box">
  <h1>⏳ Em Cooldown</h1>
  <p>Já pescaste recentemente. Volta mais tarde.</p>
</div></body></html>`);
  }

  const crypto = require('crypto');
  const jobToken = crypto.randomBytes(16).toString('hex');
  activeJobs.set(jobToken, {
    guildId,
    userId,
    job: 'pesca',
    startedAt: Date.now()
  });

  res.redirect(`/pesca.html?jobToken=${jobToken}`);
});

app.get('/pescar/:token', (req, res) => {
  const token = req.params.token;
  if (!token || !webTokens.peekToken(token)) {
    return res.send(renderInvalidPage());
  }
  const entry = webTokens.consumeToken(token);
  if (!entry) return res.send(renderInvalidPage());

  const { guildId, userId } = entry;
  const cooldown = db.getCooldown(guildId, userId, 'pescar');
  if (cooldown > 0) {
    return res.send(`<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8"><title>Cooldown</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Nunito', sans-serif; background:#0d1e16; color:#DCEEE3; min-height:100vh;
    display:flex; align-items:center; justify-content:center; text-align:center; margin:0; padding:24px; }
  .box { max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; color:#FACA2B; }
  p { color:#a9c7b7; font-size:14px; }
</style></head>
<body><div class="box">
  <h1>⏳ Em Cooldown</h1>
  <p>Já pescaste recentemente. Volta mais tarde.</p>
</div></body></html>`);
  }

  const crypto = require('crypto');
  const jobToken = crypto.randomBytes(16).toString('hex');
  activeJobs.set(jobToken, {
    guildId,
    userId,
    job: 'pesca',
    startedAt: Date.now()
  });

  res.redirect(`/pesca.html?jobToken=${jobToken}`);
});

app.get('/pesca', (req, res) => {
  res.redirect(`/pescar?token=${req.query.token || ''}`);
});

app.get('/pesca/:token', (req, res) => {
  res.redirect(`/pescar/${req.params.token}`);
});

app.get('/hackear', (req, res) => {
  const token = req.query.token;
  if (!token || !webTokens.peekToken(token)) {
    return res.send(renderInvalidPage());
  }
  const entry = webTokens.consumeToken(token);
  if (!entry) return res.send(renderInvalidPage());

  const { guildId, userId } = entry;
  const cooldown = db.getCooldown(guildId, userId, 'hackear');
  if (cooldown > 0) {
    return res.send(`<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8"><title>Cooldown</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Nunito', sans-serif; background:#0d1e16; color:#DCEEE3; min-height:100vh;
    display:flex; align-items:center; justify-content:center; text-align:center; margin:0; padding:24px; }
  .box { max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; color:#39ff14; }
  p { color:#a9c7b7; font-size:14px; }
</style></head>
<body><div class="box">
  <h1>⏳ Em Cooldown</h1>
  <p>Já hackeaste recentemente. Volta mais tarde.</p>
</div></body></html>`);
  }

  const crypto = require('crypto');
  const jobToken = crypto.randomBytes(16).toString('hex');
  activeJobs.set(jobToken, {
    guildId,
    userId,
    job: 'hack',
    startedAt: Date.now()
  });

  res.redirect(`/hack.html?jobToken=${jobToken}`);
});

app.get('/hackear/:token', (req, res) => {
  const token = req.params.token;
  if (!token || !webTokens.peekToken(token)) {
    return res.send(renderInvalidPage());
  }
  const entry = webTokens.consumeToken(token);
  if (!entry) return res.send(renderInvalidPage());

  const { guildId, userId } = entry;
  const cooldown = db.getCooldown(guildId, userId, 'hackear');
  if (cooldown > 0) {
    return res.send(`<!DOCTYPE html>
<html lang="pt-PT"><head><meta charset="UTF-8"><title>Cooldown</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Nunito', sans-serif; background:#0d1e16; color:#DCEEE3; min-height:100vh;
    display:flex; align-items:center; justify-content:center; text-align:center; margin:0; padding:24px; }
  .box { max-width:360px; }
  h1 { font-size:22px; margin-bottom:8px; color:#39ff14; }
  p { color:#a9c7b7; font-size:14px; }
</style></head>
<body><div class="box">
  <h1>⏳ Em Cooldown</h1>
  <p>Já hackeaste recentemente. Volta mais tarde.</p>
</div></body></html>`);
  }

  const crypto = require('crypto');
  const jobToken = crypto.randomBytes(16).toString('hex');
  activeJobs.set(jobToken, {
    guildId,
    userId,
    job: 'hack',
    startedAt: Date.now()
  });

  res.redirect(`/hack.html?jobToken=${jobToken}`);
});

app.get('/hack', (req, res) => {
  res.redirect(`/hackear?token=${req.query.token || ''}`);
});

app.get('/hack/:token', (req, res) => {
  res.redirect(`/hackear/${req.params.token}`);
});

app.get('/api/login-dashboard', (req, res) => {
  const token = req.query.token;
  const redirectUrl = req.query.redirect || '/dashboard.html';
  if (!token) {
    return res.status(400).send('Token de login em falta.');
  }
  const entry = webTokens.consumeToken(token);
  if (!entry) {
    return res.status(400).send('Token inválido ou expirado. Volta ao Discord e usa /painel outra vez.');
  }
  
  const { guildId, userId } = entry;
  const sessionToken = createSession(guildId, userId);
  
  if (discordClient) {
    discordClient.users.fetch(userId).then(uObj => {
      if (uObj) {
        const u = db.getUser(guildId, userId);
        u.username = uObj.username;
        u.avatar = uObj.displayAvatarURL({ size: 128 }) || uObj.defaultAvatarURL;
        db.saveUser(guildId, userId, u);
      }
    }).catch(() => {});
  }
  
  res.setHeader('Set-Cookie', `session_token=${sessionToken}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
  const separator = redirectUrl.includes('?') ? '&' : '?';
  res.redirect(`${redirectUrl}${separator}token=${sessionToken}`);
});

app.get('/api/login-fake', (req, res) => {
  const users = db.getUsersData();
  const keys = Object.keys(users || {});
  
  let guildId = process.env.GUILD_ID;
  let userId = null;
  
  if (keys.length > 0) {
    const parts = keys[0].split(':');
    guildId = parts[0];
    userId = parts[1];
  } else {
    guildId = guildId || '123456789012345678';
    userId = '123456789012345678';
    db.getUser(guildId, userId);
  }
  
  const sessionToken = createSession(guildId, userId);
  res.setHeader('Set-Cookie', `session_token=${sessionToken}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
  
  return res.json({ success: true, token: sessionToken });
});

app.get('/api/global-wins', (req, res) => {
  return res.json(globalWins);
});

// ─── RASPADINHA GAME ENDPOINT ──────────────────────────────────────────────────
app.post('/api/games/raspadinha/buy', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { cost } = req.body;
    
    const validCosts = [100, 500, 1000];
    if (!validCosts.includes(cost)) {
      return res.status(400).json({ error: 'Custo de raspadinha inválido.' });
    }

    const cfg = db.getGuildConfig(guildId);
    const user = db.getUser(guildId, userId);

    if (user.balance < cost) {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }

    // Cooldown
    const cooldown = db.getCooldown(guildId, userId, 'raspadinha');
    if (cooldown > 0) {
      return res.status(400).json({ error: `Espera mais ${(cooldown / 1000).toFixed(1)}s.` });
    }
    db.setCooldown(guildId, userId, 'raspadinha', 2000); // 2 segundos cooldown

    // Gerar a raspadinha
    const winChance = 0.35; // 35% chance to win
    const isWinner = Math.random() < winChance;
    const grid = Array(9).fill(null);
    
    if (isWinner) {
      const rand = Math.random();
      let winSym = '🍒';
      if (rand < 0.02) winSym = '7️⃣';
      else if (rand < 0.08) winSym = '💎';
      else if (rand < 0.20) winSym = '🍇';
      else if (rand < 0.50) winSym = '🍋';
      else winSym = '🍒';

      let placed = 0;
      while (placed < 3) {
        const idx = Math.floor(Math.random() * 9);
        if (grid[idx] === null) {
          grid[idx] = winSym;
          placed++;
        }
      }
    }

    const pool = ['🍒', '🍋', '🍇', '💎', '7️⃣', '❌', '🍀'];
    for (let i = 0; i < 9; i++) {
      if (grid[i] !== null) continue;
      const counts = {};
      grid.forEach(s => { if (s) counts[s] = (counts[s] || 0) + 1; });
      const safePool = pool.filter(s => (counts[s] || 0) < 2);
      const sym = safePool.length > 0 ? safePool[Math.floor(Math.random() * safePool.length)] : '❌';
      grid[i] = sym;
    }

    // Contar repetições para definir prémio
    const finalCounts = {};
    grid.forEach(s => { finalCounts[s] = (finalCounts[s] || 0) + 1; });
    
    let won = false;
    let winningSym = null;
    let mult = 0;

    const symMults = {
      '🍒': 2,
      '🍋': 3.5,
      '🍇': 6,
      '💎': 15,
      '7️⃣': 50
    };

    for (const [sym, count] of Object.entries(finalCounts)) {
      if (count >= 3 && symMults[sym] !== undefined) {
        won = true;
        winningSym = sym;
        mult = symMults[sym];
        break;
      }
    }

    const winnings = won ? cost * mult : 0;
    const net = winnings - cost;

    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, won, cost);
    db.addTournamentScore(guildId, userId, net);

    let xpResult = null;
    let newBadges = [];
    try {
      const progression = require('./progression');
      const ctx = {
        guildId,
        userId,
        member: null,
        client: discordClient,
        channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Raspadinha', bet: cost, net, won, isWeb: true });
      xpResult = prog.xpResult;
      newBadges = prog.newBadges;
    } catch (e) {
      console.error("Erro na progressão da Raspadinha:", e);
    }

    const isJackpot = mult >= 15;
    if (won && (winnings >= cfg.bigWinThreshold || isJackpot)) {
      const u = db.getUser(guildId, userId);
      const displayName = u.username || userId;
      
      const isJackpot = mult >= 15;
      const msg = `🎉 **${displayName}** ganhou **${winnings} 🪙** na Raspadinha de ${cost} (Acertou em 3x ${winningSym})!`;
      
      await announceWebEvent(guildId, 'win', {
        title: isJackpot ? '🎰 VITÓRIA RARA na Raspadinha!' : '🎉 Raspadinha Premiada!',
        message: msg,
        username: displayName,
        game: 'Raspadinha',
        amount: winnings,
        bet: cost,
        isJackpot
      });
    }

    return res.json({
      success: true,
      card: grid,
      won,
      winnings,
      net,
      balance: db.getUser(guildId, userId).balance,
      xpResult,
      newBadges
    });

  } catch (err) {
    console.error("Erro ao comprar raspadinha:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ─── RULETA GAME ENDPOINT ─────────────────────────────────────────────────────
app.post('/api/games/roulette/spin', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { bet, type, number } = req.body;
    
    const cfg = db.getGuildConfig(guildId);
    const user = db.getUser(guildId, userId);

    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return res.status(400).json({ error: `A aposta deve estar entre ${cfg.minBet} e ${cfg.maxBet} 🪙` });
    }
    if (user.balance < bet) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    const cooldown = db.getCooldown(guildId, userId, 'roleta');
    if (cooldown > 0) {
      return res.status(400).json({ error: `Espera mais ${(cooldown / 1000).toFixed(1)}s.` });
    }

    db.setCooldown(guildId, userId, 'roleta', cfg.rouletteCooldownMs);

    const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    function colorOf(n) {
      if (n === 0) return 'verde';
      return RED_NUMBERS.has(n) ? 'vermelho' : 'preto';
    }

    const spin = Math.floor(Math.random() * 37); // 0-36
    const color = colorOf(spin);

    let won = false;
    let mult = 0;
    if (type === 'vermelho' && color === 'vermelho') { won = true; mult = 2; }
    else if (type === 'preto' && color === 'preto') { won = true; mult = 2; }
    else if (type === 'par' && spin !== 0 && spin % 2 === 0) { won = true; mult = 2; }
    else if (type === 'impar' && spin % 2 !== 0) { won = true; mult = 2; }
    else if (type === 'coluna1' && [1,4,7,10,13,16,19,22,25,28,31,34].includes(spin)) { won = true; mult = 3; }
    else if (type === 'coluna2' && [2,5,8,11,14,17,20,23,26,29,32,35].includes(spin)) { won = true; mult = 3; }
    else if (type === 'coluna3' && [3,6,9,12,15,18,21,24,27,30,33,36].includes(spin)) { won = true; mult = 3; }
    else if (type === 'numero' && spin === parseInt(number, 10)) { won = true; mult = 35; }

    const winnings = won ? bet * mult : 0;
    const net = winnings - bet;

    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, won, bet);
    db.addTournamentScore(guildId, userId, net);

    let xpResult = null;
    let newBadges = [];
    try {
      const progression = require('./progression');
      const ctx = {
        guildId,
        userId,
        member: null,
        client: discordClient,
        channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Roleta', bet, net, won, isWeb: true });
      xpResult = prog.xpResult;
      newBadges = prog.newBadges;
    } catch (e) {
      console.error("Erro na progressão da Roleta:", e);
    }

    const isJackpot = type === 'numero' && won;
    if (won && (winnings >= cfg.bigWinThreshold || isJackpot)) {
      const u = db.getUser(guildId, userId);
      const displayName = u.username || userId;
      const colorEmoji = { vermelho: '🔴', preto: '⚫', verde: '🟢' }[color];
      
      const isJackpot = type === 'numero' && won;
      const msg = `🎉 **${displayName}** ganhou **${winnings} 🪙** na Roleta (Bola caiu no ${spin} ${colorEmoji}, aposta: ${type})!`;
      
      await announceWebEvent(guildId, 'win', {
        title: isJackpot ? '🎰 VITÓRIA RARA na Roleta!' : '🎉 Ganho na Roleta!',
        message: msg,
        username: displayName,
        game: 'Roleta',
        amount: winnings,
        bet,
        isJackpot
      });
    }

    return res.json({
      success: true,
      spin,
      color,
      won,
      winnings,
      net,
      balance: db.getUser(guildId, userId).balance,
      xpResult,
      newBadges
    });

  } catch (err) {
    console.error("Erro ao girar a roleta:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ─── MINES GAME ENDPOINTS ────────────────────────────────────────────────────
app.post('/api/games/mines/start', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet, minesCount } = req.body;
    
    const cfg = db.getGuildConfig(guildId);
    if (isNaN(bet) || bet < cfg.minBet || bet > cfg.maxBet) {
      return res.status(400).json({ error: `A aposta deve estar entre ${cfg.minBet} e ${cfg.maxBet}.` });
    }
    if (isNaN(minesCount) || minesCount < 1 || minesCount > 15) {
      return res.status(400).json({ error: 'Número de minas inválido (deve ser entre 1 e 15).' });
    }
    
    const user = db.getUser(guildId, userId);
    if (user.balance < bet) {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    
    db.addBalance(guildId, userId, -bet);
    db.broadcastBalanceUpdate(guildId, userId);
    
    const GRID_SIZE = 20;
    const board = Array(GRID_SIZE).fill('safe');
    const minePositions = new Set();
    while (minePositions.size < minesCount) {
      minePositions.add(Math.floor(Math.random() * GRID_SIZE));
    }
    for (const idx of minePositions) {
      board[idx] = 'mine';
    }
    
    const revealed = new Set();
    
    activeMinesGames.set(userId, {
      guildId,
      bet,
      minesCount,
      board,
      revealed,
      status: 'playing'
    });
    
    return res.json({
      success: true,
      gridSize: GRID_SIZE,
      minesCount,
      bet,
      newBalance: db.getUser(guildId, userId).balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao iniciar o jogo.' });
  }
});

app.post('/api/games/mines/reveal', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { userId } = session;
    const game = activeMinesGames.get(userId);
    if (!game || game.status !== 'playing') {
      return res.status(400).json({ error: 'Nenhum jogo ativo de Mines.' });
    }
    
    const { cellIndex } = req.body;
    if (isNaN(cellIndex) || cellIndex < 0 || cellIndex >= game.board.length) {
      return res.status(400).json({ error: 'Posição inválida.' });
    }
    
    if (game.revealed.has(cellIndex)) {
      return res.status(400).json({ error: 'Célula já revelada.' });
    }
    
    const GRID_SIZE = 20;
    const HOUSE_EDGE = 0.97;
    
    function combinations(n, k) {
      if (k < 0 || k > n) return 0;
      k = Math.min(k, n - k);
      let result = 1;
      for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
      return result;
    }
    
    function multiplierFor(revealedCount, mines) {
      const fair = combinations(GRID_SIZE, revealedCount) / combinations(GRID_SIZE - mines, revealedCount);
      return Math.max(1, fair * HOUSE_EDGE);
    }
    
    game.revealed.add(cellIndex);
    
    if (game.board[cellIndex] === 'mine') {
      game.status = 'lost';
      activeMinesGames.delete(userId);
      db.recordResult(game.guildId, userId, false, game.bet);
      db.addTournamentScore(game.guildId, userId, -game.bet);
      
      return res.json({
        success: true,
        exploded: true,
        grid: game.board,
        newBalance: db.getUser(game.guildId, userId).balance
      });
    }
    
    const safeCellsCount = GRID_SIZE - game.minesCount;
    const currentMult = multiplierFor(game.revealed.size, game.minesCount);
    
    if (game.revealed.size === safeCellsCount) {
      const winnings = Math.round(game.bet * currentMult);
      const net = winnings - game.bet;
      db.addBalance(game.guildId, userId, winnings);
      db.recordResult(game.guildId, userId, true, game.bet);
      db.addTournamentScore(game.guildId, userId, net);
      db.broadcastBalanceUpdate(game.guildId, userId);
      
      activeMinesGames.delete(userId);
      
      let displayName = userId;
      if (discordClient) {
        const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
        if (uObj) displayName = uObj.username;
        const guild = discordClient.guilds.cache.get(game.guildId) || await discordClient.guilds.fetch(game.guildId).catch(() => null);
        if (guild) {
          const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
          if (member) displayName = member.displayName;
        }
      }
      
      const title = '💣 MINES: Campo Limpo! 🏆';
      const msg = `**${displayName}** limpou o Campo Minado e ganhou **${winnings.toLocaleString('pt-PT')} 🪙** (x${currentMult.toFixed(2)})!`;
      announceWebEvent(game.guildId, 'win', { title, message: msg, username: displayName, game: 'Mines', amount: winnings, bet: game.bet });
      
      return res.json({
        success: true,
        exploded: false,
        cleared: true,
        multiplier: currentMult,
        winnings,
        revealedCells: Array.from(game.revealed),
        newBalance: db.getUser(game.guildId, userId).balance
      });
    }
    
    return res.json({
      success: true,
      exploded: false,
      cleared: false,
      multiplier: currentMult,
      revealedCells: Array.from(game.revealed)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao revelar célula.' });
  }
});

app.post('/api/games/mines/cashout', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { userId } = session;
    const game = activeMinesGames.get(userId);
    if (!game || game.status !== 'playing') {
      return res.status(400).json({ error: 'Nenhum jogo ativo para efetuar o saque.' });
    }
    
    if (game.revealed.size === 0) {
      return res.status(400).json({ error: 'Tens de revelar pelo menos uma célula antes de sacar.' });
    }
    
    const GRID_SIZE = 20;
    const HOUSE_EDGE = 0.97;
    
    function combinations(n, k) {
      if (k < 0 || k > n) return 0;
      k = Math.min(k, n - k);
      let result = 1;
      for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
      return result;
    }
    
    function multiplierFor(revealedCount, mines) {
      const fair = combinations(GRID_SIZE, revealedCount) / combinations(GRID_SIZE - mines, revealedCount);
      return Math.max(1, fair * HOUSE_EDGE);
    }
    
    const currentMult = multiplierFor(game.revealed.size, game.minesCount);
    const winnings = Math.round(game.bet * currentMult);
    const net = winnings - game.bet;
    
    db.addBalance(game.guildId, userId, winnings);
    db.recordResult(game.guildId, userId, true, game.bet);
    db.addTournamentScore(game.guildId, userId, net);
    db.broadcastBalanceUpdate(game.guildId, userId);
    
    activeMinesGames.delete(userId);
    
    let displayName = userId;
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) displayName = uObj.username;
      const guild = discordClient.guilds.cache.get(game.guildId) || await discordClient.guilds.fetch(game.guildId).catch(() => null);
      if (guild) {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member) displayName = member.displayName;
      }
    }
    
    const title = '💣 MINES: Saque efetuado! 💰';
    const msg = `**${displayName}** sacou **${winnings.toLocaleString('pt-PT')} 🪙** no Campo Minado com multiplicador **x${currentMult.toFixed(2)}**!`;
    announceWebEvent(game.guildId, 'win', { title, message: msg, username: displayName, game: 'Mines', amount: winnings, bet: game.bet });
    
    return res.json({
      success: true,
      winnings,
      multiplier: currentMult,
      newBalance: db.getUser(game.guildId, userId).balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao efetuar saque.' });
  }
});

// ─── CRASH GAME ENDPOINTS ────────────────────────────────────────────────────
app.post('/api/games/crash/start', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet } = req.body;
    
    const cfg = db.getGuildConfig(guildId);
    if (isNaN(bet) || bet < cfg.minBet || bet > cfg.maxBet) {
      return res.status(400).json({ error: `A aposta deve estar entre ${cfg.minBet} e ${cfg.maxBet}.` });
    }
    
    const user = db.getUser(guildId, userId);
    if (user.balance < bet) {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    
    db.addBalance(guildId, userId, -bet);
    db.broadcastBalanceUpdate(guildId, userId);
    
    function generateCrashPoint() {
      if (Math.random() < 0.05) return 1.00;
      const r = Math.random();
      const point = Math.min(20, (1 / (1 - r)) * 0.97);
      return Math.max(1.02, Math.round(point * 100) / 100);
    }
    
    const crashPoint = generateCrashPoint();
    
    function getCrashTimeMs(cp) {
      let mult = 1.0;
      let ticks = 0;
      while (mult < cp && ticks < 150) {
        mult = Math.round(mult * 1.06 * 100) / 100;
        ticks++;
      }
      return ticks * 700;
    }
    
    const crashTimeMs = getCrashTimeMs(crashPoint);
    
    const now = Date.now();
    activeCrashGames.set(userId, {
      guildId,
      bet,
      crashPoint,
      crashTimeMs,
      startTime: now,
      status: 'playing'
    });
    
    return res.json({
      success: true,
      startTime: now,
      tickMs: 700,
      growth: 1.06,
      crashTimeMs,
      crashPoint,
      newBalance: db.getUser(guildId, userId).balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao iniciar o Crash.' });
  }
});

app.post('/api/games/crash/cashout', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { userId } = session;
    const game = activeCrashGames.get(userId);
    if (!game || game.status !== 'playing') {
      return res.status(400).json({ error: 'Nenhum jogo ativo de Crash.' });
    }
    
    const elapsedMs = Date.now() - game.startTime;
    
    if (elapsedMs >= game.crashTimeMs) {
      game.status = 'crashed';
      activeCrashGames.delete(userId);
      db.recordResult(game.guildId, userId, false, game.bet);
      db.addTournamentScore(game.guildId, userId, -game.bet);
      db.broadcastBalanceUpdate(game.guildId, userId);
      
      return res.json({
        success: true,
        crashed: true,
        crashPoint: game.crashPoint,
        newBalance: db.getUser(game.guildId, userId).balance
      });
    }
    
    game.status = 'cashed_out';
    activeCrashGames.delete(userId);
    
    function getCrashMultiplierAt(timeMs) {
      const ticks = Math.floor(timeMs / 700);
      let mult = 1.0;
      for (let i = 0; i < ticks; i++) {
        mult = Math.round(mult * 1.06 * 100) / 100;
      }
      return mult;
    }
    
    const multiplier = getCrashMultiplierAt(elapsedMs);
    const winnings = Math.round(game.bet * multiplier);
    const net = winnings - game.bet;
    
    db.addBalance(game.guildId, userId, winnings);
    db.recordResult(game.guildId, userId, true, game.bet);
    db.addTournamentScore(game.guildId, userId, net);
    db.broadcastBalanceUpdate(game.guildId, userId);
    
    let displayName = userId;
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) displayName = uObj.username;
      const guild = discordClient.guilds.cache.get(game.guildId) || await discordClient.guilds.fetch(game.guildId).catch(() => null);
      if (guild) {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member) displayName = member.displayName;
      }
    }
    
    const title = '📈 CRASH: Saque efetuado! 🚀';
    const msg = `**${displayName}** sacou **${winnings.toLocaleString('pt-PT')} 🪙** no Crash com multiplicador **x${multiplier.toFixed(2)}**!`;
    announceWebEvent(game.guildId, 'win', { title, message: msg, username: displayName, game: 'Crash', amount: winnings, bet: game.bet });
    
    return res.json({
      success: true,
      crashed: false,
      multiplier,
      winnings,
      newBalance: db.getUser(game.guildId, userId).balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao efetuar saque no Crash.' });
  }
});

app.get('/api/profile/data', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autorizado. Faz login de novo.' });
    }

    const { guildId } = session;
    const targetUserId = req.query.userId;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Utilizador não especificado.' });
    }

    const user = db.getUser(guildId, targetUserId);
    const prices = db.getCryptoPrices();

    let username = 'Utilizador';
    let avatar = null;
    let isStaff = false;

    if (discordClient) {
      const uObj = discordClient.users.cache.get(targetUserId) || await discordClient.users.fetch(targetUserId).catch(() => null);
      if (uObj) {
        username = uObj.username;
        avatar = uObj.displayAvatarURL({ size: 128 }) || uObj.defaultAvatarURL;
      }

      const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = guild.members.cache.get(targetUserId) || await guild.members.fetch(targetUserId).catch(() => null);
        if (member) {
          const hasPerm = member.permissions.has('Administrator');
          const hasRole = member.roles.cache.some(r => r.name.toLowerCase() === 'administrador');
          if (hasPerm || hasRole) {
            isStaff = true;
          }
        }
      }
    }

    const { ACHIEVEMENTS } = require('./progression');

    return res.json({
      guildId,
      userId: targetUserId,
      username,
      avatar,
      isStaff,
      balance: user.balance,
      bank: user.bank,
      level: user.level,
      xp: user.xp,
      xpNeeded: db.xpForLevel(user.level),
      vipLevel: user.vipLevel || 0,
      stats: user.stats || { wins: 0, losses: 0, wagered: 0, wonCoins: 0, lostCoins: 0 },
      badges: user.badges || [],
      inventory: user.inventory || [],
      history: db.getHistory(guildId, targetUserId, 10),
      cryptoPrices: prices,
      cryptoHoldings: user.crypto || { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 },
      equippedFrame: user.equippedFrame || null,
      equippedBg: user.equippedBg || null,
      allAchievements: ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc }))
    });
  } catch (err) {
    console.error('Erro em /api/profile/data:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/members/search', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const { guildId } = session;
    const query = (req.query.q || '').toLowerCase().trim();

    const uIds = db.getAllUserIdsForGuild(guildId);
    const results = [];

    for (const id of uIds) {
      let username = 'Jogador';
      let avatar = null;
      
      const uObj = discordClient ? (discordClient.users.cache.get(id) || await discordClient.users.fetch(id).catch(() => null)) : null;
      if (uObj) {
        username = uObj.username;
        avatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
      }

      if (!query || username.toLowerCase().includes(query)) {
        results.push({ userId: id, username, avatar });
      }
      if (results.length >= 10) break; // Limite de 10 resultados para performance
    }

    return res.json(results);
  } catch (err) {
    console.error('Erro em /api/members/search:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/leaderboard/data', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId } = session;
    const scope = req.query.scope || 'local';

    const rawLeaderboard = scope === 'global'
      ? db.getGlobalLeaderboard(100)
      : db.getLeaderboard(guildId, 100);

    const leaderboard = await Promise.all(
      rawLeaderboard.map(async (entry, index) => {
        let uName = entry.username || `Jogador #${index + 1}`;
        let uAvatar = null;
        if (discordClient) {
          const uObj = discordClient.users.cache.get(entry.userId) || await discordClient.users.fetch(entry.userId).catch(() => null);
          if (uObj) {
            uName = uObj.username;
            uAvatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
          }
        }
        return {
          userId: entry.userId,
          username: uName,
          avatar: uAvatar,
          balance: entry.balance,
          bank: entry.bank,
          level: entry.level,
          xp: entry.xp
        };
      })
    );

    return res.json(leaderboard);
  } catch (err) {
    console.error('Erro em /api/leaderboard/data:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/dashboard/data', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autorizado. Faz login de novo.' });
    }

    const { guildId, userId } = session;
    const user = db.getUser(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    const prices = db.getCryptoPrices();

    let username = 'Utilizador';
    let avatar = null;
    let isAdmin = false;

    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) {
        username = uObj.username;
        avatar = uObj.displayAvatarURL({ size: 128 }) || uObj.defaultAvatarURL;
      }

      const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const hasPerm = member.permissions.has('Administrator');
          const hasRole = member.roles.cache.some(r => r.name.toLowerCase() === 'administrador');
          if (hasPerm || hasRole) {
            isAdmin = true;
          }
        }
      }
    }

    const rawLeaderboard = db.getLeaderboard(guildId, 10);
    const leaderboard = await Promise.all(
      rawLeaderboard.map(async (entry, index) => {
        let uName = `Jogador #${index + 1}`;
        let uAvatar = null;
        if (discordClient) {
          const uObj = discordClient.users.cache.get(entry.userId) || await discordClient.users.fetch(entry.userId).catch(() => null);
          if (uObj) {
            uName = uObj.username;
            uAvatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
          }
        }
        return {
          userId: entry.userId,
          username: uName,
          avatar: uAvatar,
          balance: entry.balance,
          bank: entry.bank,
          level: entry.level,
          xp: entry.xp
        };
      })
    );

    const rawGlobalLeaderboard = db.getGlobalLeaderboard(10);
    const globalLeaderboard = await Promise.all(
      rawGlobalLeaderboard.map(async (entry, index) => {
        let uName = entry.username || `Jogador Global #${index + 1}`;
        let uAvatar = null;
        if (discordClient) {
          const uObj = discordClient.users.cache.get(entry.userId) || await discordClient.users.fetch(entry.userId).catch(() => null);
          if (uObj) {
            uName = uObj.username;
            uAvatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
          }
        }
        return {
          userId: entry.userId,
          username: uName,
          avatar: uAvatar,
          balance: entry.balance,
          bank: entry.bank,
          level: entry.level,
          xp: entry.xp
        };
      })
    );

    const { ACHIEVEMENTS } = require('./progression');
    const { ITEMS } = require('../commands/shop');

    const workCooldown = db.getCooldown(guildId, userId, 'trabalhar');
    const pescaCooldown = db.getCooldown(guildId, userId, 'pescar');
    const hackCooldown = db.getCooldown(guildId, userId, 'hackear');
    const crimeCooldown = db.getCooldown(guildId, userId, 'crime');
    const robCooldown = db.getCooldown(guildId, userId, 'roubar');

    const now = Date.now();
    const sinceLastDaily = now - (user.lastDaily || 0);
    const dailyCooldown = Math.max(0, (24 * 60 * 60 * 1000) - sinceLastDaily);

    const userTournament = db.getTournament(guildId);
    const rawTournamentLeaderboard = db.getTournamentLeaderboard(guildId, 10);
    const tournamentLeaderboard = await Promise.all(
      rawTournamentLeaderboard.map(async (entry, index) => {
        let uName = `Jogador #${index + 1}`;
        let uAvatar = null;
        if (discordClient) {
          const uObj = discordClient.users.cache.get(entry.userId) || await discordClient.users.fetch(entry.userId).catch(() => null);
          if (uObj) {
            uName = uObj.username;
            uAvatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
          }
        }
        return {
          userId: entry.userId,
          username: uName,
          avatar: uAvatar,
          score: entry.score
        };
      })
    );

    const rawGlobalTournamentLeaderboard = db.getGlobalTournamentLeaderboard(10);
    const globalTournamentLeaderboard = await Promise.all(
      rawGlobalTournamentLeaderboard.map(async (entry, index) => {
        let uName = entry.username || `Jogador Global #${index + 1}`;
        let uAvatar = null;
        if (discordClient) {
          const uObj = discordClient.users.cache.get(entry.userId) || await discordClient.users.fetch(entry.userId).catch(() => null);
          if (uObj) {
            uName = uObj.username;
            uAvatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
          }
        }
        return {
          userId: entry.userId,
          username: uName,
          avatar: uAvatar,
          score: entry.score
        };
      })
    );

    return res.json({
      guildId,
      userId,
      username,
      avatar,
      isAdmin,
      balance: user.balance,
      bank: user.bank,
      level: user.level,
      xp: user.xp,
      xpNeeded: db.xpForLevel(user.level),
      vipLevel: user.vipLevel || 0,
      stats: user.stats || { wins: 0, losses: 0, wagered: 0, wonCoins: 0, lostCoins: 0 },
      badges: user.badges || [],
      inventory: user.inventory || [],
      history: db.getHistory(guildId, userId, 10),
      leaderboard,
      globalLeaderboard,
      tournament: {
        active: db.isTournamentActive(guildId),
        name: userTournament?.name || 'Sem Torneio Ativo',
        endTime: userTournament?.endTime || 0,
        prize: userTournament?.prize || 0,
        leaderboard: tournamentLeaderboard,
        globalLeaderboard: globalTournamentLeaderboard
      },
      cryptoPrices: prices,
      cryptoHoldings: user.crypto || { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 },
      contracts: user.contracts || [],
      equippedFrame: user.equippedFrame || null,
      equippedBg: user.equippedBg || null,
      allAchievements: ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc })),
      shopItems: ITEMS,
      cooldowns: {
        work: workCooldown,
        pesca: pescaCooldown,
        hack: hackCooldown,
        crime: crimeCooldown,
        rob: robCooldown,
        daily: dailyCooldown
      }
    });
  } catch (err) {
    console.error('Erro em /api/dashboard/data:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/daily/claim', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const cfg = db.getGuildConfig(guildId);
    const user = db.getUser(guildId, userId);

    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const sinceLast = now - (user.lastDaily || 0);

    if (sinceLast < DAY_MS) {
      const remaining = DAY_MS - sinceLast;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      return res.status(400).json({ error: `Já recolheste hoje. Podes voltar daqui a ${hours}h ${mins}m.` });
    }

    if (sinceLast <= 2 * DAY_MS) {
      user.dailyStreak += 1;
    } else {
      user.dailyStreak = 1;
    }
    user.lastDaily = now;

    // --- Sorteio da Roda da Fortuna ---
    const r = Math.random() * 100;
    let sectorIndex = 0;
    let type = 'coins';
    let rewardAmount = 0;
    let streakBonus = 0;

    if (r < 35) {
      sectorIndex = 0; // 150 🪙
      rewardAmount = 150;
    } else if (r < 60) {
      sectorIndex = 1; // 300 🪙
      rewardAmount = 300;
    } else if (r < 78) {
      sectorIndex = 2; // 500 🪙
      rewardAmount = 500;
    } else if (r < 88) {
      sectorIndex = 3; // 1000 🪙
      rewardAmount = 1000;
    } else if (r < 93) {
      sectorIndex = 4; // 2500 🪙
      rewardAmount = 2500;
    } else if (r < 95) {
      sectorIndex = 5; // 5000 🪙
      rewardAmount = 5000;
    } else if (r < 98) {
      sectorIndex = 6; // XP ⚡
      type = 'xp';
      rewardAmount = 150;
    } else {
      sectorIndex = 7; // Trabalho 🧹
      type = 'reset';
      rewardAmount = 0;
    }

    if (type === 'coins') {
      streakBonus = Math.min(user.dailyStreak * 20, 500);
      const totalCoins = rewardAmount + streakBonus;
      user.balance += totalCoins;
      db.pushHistory(guildId, userId, { game: 'Roda da Fortuna (Moedas)', bet: 0, net: totalCoins });
    } else if (type === 'xp') {
      user.xp = (user.xp || 0) + rewardAmount;
      const xpNeeded = (user.level || 1) * 100;
      if (user.xp >= xpNeeded) {
        user.xp -= xpNeeded;
        user.level = (user.level || 1) + 1;
      }
      db.pushHistory(guildId, userId, { game: 'Roda da Fortuna (XP)', bet: 0, net: 0 });
    } else if (type === 'reset') {
      user.lastWork = 0;
      user.lastPesca = 0;
      user.lastHack = 0;
      db.pushHistory(guildId, userId, { game: 'Roda da Fortuna (Reset)', bet: 0, net: 0 });
    }

    db.saveUser(guildId, userId, user);

    // --- Enviar Embed para o canal de logs/alertas do Discord ---
    if (discordClient && cfg.logChannelId) {
      (async () => {
        try {
          const channel = await discordClient.channels.fetch(cfg.logChannelId).catch(() => null);
          if (channel && typeof channel.send === 'function') {
            let prizeString = '';
            const fields = [
              { name: 'Jogador', value: `<@${userId}>`, inline: true },
              { name: 'Streak', value: `🔥 ${user.dailyStreak} dias`, inline: true }
            ];

            if (type === 'coins') {
              prizeString = `💰 **+${rewardAmount + streakBonus} 🪙**\n*(Base: ${rewardAmount} | Streak: +${streakBonus})*`;
              fields.push({ name: 'Novo Saldo', value: `${Math.round(user.balance).toLocaleString('pt-PT')} 🪙`, inline: true });
            } else if (type === 'xp') {
              prizeString = `⚡ **+150 XP**`;
              fields.push({ name: 'Nível Atual', value: `Nível ${user.level}`, inline: true });
            } else if (type === 'reset') {
              prizeString = `🧹 **Reset de Cooldowns**\n*(Trabalho, Pesca e Hack)*`;
            }

            fields.unshift({ name: 'Prémio Ganho', value: prizeString, inline: true });

            await channel.send({
              embeds: [{
                title: '🎡 Roda da Fortuna — Bónus Diário',
                color: 0xfaca2b, // ouro
                description: `🎉 <@${userId}> girou a roleta no site do casino!`,
                fields,
                timestamp: new Date().toISOString(),
                footer: { text: 'Casino Arena — Roda da Fortuna' }
              }]
            });
          }
        } catch (dErr) {
          console.error('Falha ao enviar log da roleta para o Discord:', dErr);
        }
      })();
    }

    return res.json({
      success: true,
      sectorIndex,
      type,
      amount: rewardAmount + streakBonus,
      bonus: streakBonus,
      streak: user.dailyStreak,
      balance: user.balance,
      cooldown: DAY_MS
    });
  } catch (err) {
    console.error('Erro em /api/daily/claim:', err);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.get('/api/admin/reset-daily', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).send("<h2>Não autorizado. Faz login primeiro acedendo ao painel.</h2>");
    }

    const { guildId, userId } = session;
    const user = db.getUser(guildId, userId);
    user.lastDaily = 0;
    db.saveUser(guildId, userId, user);

    return res.send(`
      <div style="font-family:'Outfit',sans-serif; background:#090e0c; color:#fff; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <h2 style="color:#57f287;">✨ Daily Cooldown Resetado!</h2>
        <p style="color:#9ca3af;">O teu lastDaily foi definido como 0. Já podes voltar a girar a roleta!</p>
        <br>
        <a href="/dashboard.html" style="background:#57f287; color:#050e08; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:800;">Ir para a Roleta 🎡</a>
      </div>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao resetar.");
  }
});

app.post('/api/shop/buy', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  const { guildId, userId } = session;
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'Item não especificado.' });

  const { ITEMS } = require('../commands/shop');
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(400).json({ error: 'Item inválido.' });

  const user = db.getUser(guildId, userId);
  if (user.balance < item.price) {
    return res.status(400).json({ error: 'Saldo insuficiente.' });
  }
  if (user.inventory.includes(item.id)) {
    return res.status(400).json({ error: 'Já tens este item.' });
  }

  user.balance -= item.price;
  user.inventory.push(item.id);
  if (item.vipLevel) user.vipLevel = Math.max(user.vipLevel, item.vipLevel);
  db.saveUser(guildId, userId, user);

  db.pushHistory(guildId, userId, { game: `Loja Web (${item.name})`, bet: item.price, net: -item.price });

  return res.json({ success: true, balance: user.balance, inventory: user.inventory });
});

app.post('/api/crypto/contract/create', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  const { guildId, userId } = session;
  const { coin, amount, direction, entryPrice, duration } = req.body;

  if (!['BTC', 'ETH', 'SOL', 'DOGE'].includes(coin) || typeof amount !== 'number' || amount < 10 || !['up', 'down'].includes(direction) || typeof entryPrice !== 'number') {
    return res.status(400).json({ error: 'Parâmetros de contrato inválidos.' });
  }

  const user = db.getUser(guildId, userId);
  if (user.balance < amount) {
    return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
  }

  let durationMs = 60 * 1000; 
  if (duration === '5m') {
    durationMs = 5 * 60 * 1000;
  } else if (duration === '15m') {
    durationMs = 15 * 60 * 1000;
  }

  // Subtrair o investimento imediatamente
  user.balance -= amount;

  const contractId = 'c_' + Math.random().toString(36).substr(2, 9);
  const newContract = {
    id: contractId,
    coin,
    amount,
    direction,
    entryPrice,
    expiryTime: Date.now() + durationMs,
    status: 'pending',
    payout: 0,
    createdAt: Date.now()
  };

  user.contracts = user.contracts || [];
  user.contracts.unshift(newContract);
  db.saveUser(guildId, userId, user);

  return res.json({ success: true, balance: user.balance, contract: newContract });
});

app.post('/api/crypto/contract/resolve', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  const { guildId, userId } = session;
  const { contractId, exitPrice } = req.body;

  if (!contractId || typeof exitPrice !== 'number') {
    return res.status(400).json({ error: 'Parâmetros de resolução inválidos.' });
  }

  const user = db.getUser(guildId, userId);
  user.contracts = user.contracts || [];
  const contract = user.contracts.find(c => c.id === contractId);

  if (!contract) {
    return res.status(404).json({ error: 'Contrato não encontrado.' });
  }

  if (contract.status !== 'pending') {
    return res.status(400).json({ error: 'Contrato já foi resolvido.' });
  }

  // Validar se o tempo já expirou (com margem de tolerância de 1.5s)
  if (Date.now() < contract.expiryTime - 1500) {
    return res.status(400).json({ error: 'O contrato ainda não expirou.' });
  }

  // Determinar vencedor
  const isUp = contract.direction === 'up';
  let won = false;
  if (isUp && exitPrice > contract.entryPrice) won = true;
  if (!isUp && exitPrice < contract.entryPrice) won = true;

  let payout = 0;
  if (won) {
    payout = Math.round(contract.amount * 1.85); // Retorno de 85% de lucro
    user.balance += payout;
    contract.status = 'won';
    contract.payout = payout;
    db.pushHistory(guildId, userId, {
      game: `Crypto Option (${contract.coin} ${isUp ? '▲' : '▼'})`,
      bet: contract.amount,
      net: payout - contract.amount
    });
  } else {
    contract.status = 'lost';
    contract.payout = 0;
    db.pushHistory(guildId, userId, {
      game: `Crypto Option (${contract.coin} ${isUp ? '▲' : '▼'})`,
      bet: contract.amount,
      net: -contract.amount
    });
  }

  // Limitar histórico de contratos guardados na DB a 30 por performance
  if (user.contracts.length > 30) {
    user.contracts = user.contracts.slice(0, 30);
  }

  db.saveUser(guildId, userId, user);

  // Regista na progressão e conquistas do casino
  const progression = require('./progression');
  progression.afterGameForMember({
    guildId,
    channelId: null,
    client: discordClient
  }, { id: userId, user: { id: userId } }, {
    game: 'Opções Binárias',
    bet: contract.amount,
    net: payout - contract.amount,
    won: won
  }).catch(err => console.error('Erro na progressão de Opções Binárias:', err));

  return res.json({ success: true, balance: user.balance, contract });
});



app.post('/api/games/coinflip', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet, side } = req.body;
    
    if (typeof bet !== 'number' || bet < 10 || !['cara', 'coroa'].includes(side)) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }
    
    const user = db.getUser(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    
    if (bet > user.balance) return res.status(400).json({ error: 'Saldo insuficiente.' });
    if (bet < cfg.minBet || bet > cfg.maxBet) return res.status(400).json({ error: `Aposta fora dos limites (${cfg.minBet} - ${cfg.maxBet}).` });
    
    const cooldown = db.getCooldown(guildId, userId, 'coinflip');
    if (cooldown > 0) return res.status(400).json({ error: `Espera mais ${(cooldown/1000).toFixed(1)}s.` });
    db.setCooldown(guildId, userId, 'coinflip', cfg.coinflipCooldownMs || 4000);
    
    const result = Math.random() < 0.50 ? 'cara' : 'coroa';
    const won = result === side;
    const winnings = won ? bet * 2 : 0;
    const net = winnings - bet;
    
    user.balance += net;
    db.saveUser(guildId, userId, user);
    
    db.recordResult(guildId, userId, won, bet);
    db.addTournamentScore(guildId, userId, net);
    
    const progression = require('./progression');
    const ctx = {
      guildId, userId, member: null, client: discordClient, channelId: null,
      user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
    };
    const prog = await progression.applyProgressionFor(ctx, { game: 'Coinflip', bet, net, won, isWeb: true });
    
    if (won && winnings >= cfg.bigWinThreshold) {
      const displayName = user.username || userId;
      const title = '🪙 Vitória no Coinflip!';
      const msg = `🎉 **${displayName}** apostou **${bet} 🪙** no Coinflip (escolheu ${side.toUpperCase()}) e ganhou! O resultado foi ${result.toUpperCase()}! 🚀`;
      announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Coinflip', amount: winnings, bet, isJackpot: false });
    }
    
    return res.json({ success: true, result, won, winnings, netReward: net, newBalance: user.balance, xpResult: prog.xpResult, newBadges: prog.newBadges });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/games/dice', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet, prediction, type } = req.body;
    
    if (typeof bet !== 'number' || bet < 10) return res.status(400).json({ error: 'Aposta inválida.' });
    
    const user = db.getUser(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    
    if (bet > user.balance) return res.status(400).json({ error: 'Saldo insuficiente.' });
    if (bet < cfg.minBet || bet > cfg.maxBet) return res.status(400).json({ error: `Aposta fora dos limites (${cfg.minBet} - ${cfg.maxBet}).` });
    
    const cooldown = db.getCooldown(guildId, userId, 'dice');
    if (cooldown > 0) return res.status(400).json({ error: `Espera mais ${(cooldown/1000).toFixed(1)}s.` });
    db.setCooldown(guildId, userId, 'dice', cfg.diceCooldownMs || 5000);
    
    const roll = Math.floor(Math.random() * 6) + 1;
    let won = false;
    let multiplier = 0;
    
    if (type === 'exact') {
      const target = parseInt(prediction, 10);
      if (target >= 1 && target <= 6) {
        won = roll === target;
        multiplier = 5.7;
      }
    } else if (type === 'parity') {
      if (prediction === 'par') won = roll % 2 === 0;
      else if (prediction === 'impar') won = roll % 2 !== 0;
      multiplier = 1.95;
    } else if (type === 'range') {
      if (prediction === 'alto') won = roll >= 4;
      else if (prediction === 'baixo') won = roll <= 3;
      multiplier = 1.95;
    }
    
    const winnings = won ? Math.round(bet * multiplier) : 0;
    const net = winnings - bet;
    
    user.balance += net;
    db.saveUser(guildId, userId, user);
    
    db.recordResult(guildId, userId, won, bet);
    db.addTournamentScore(guildId, userId, net);
    
    const progression = require('./progression');
    const ctx = {
      guildId, userId, member: null, client: discordClient, channelId: null,
      user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
    };
    const prog = await progression.applyProgressionFor(ctx, { game: 'Dados', bet, net, won, isWeb: true });
    
    if (won && winnings >= cfg.bigWinThreshold) {
      const displayName = user.username || userId;
      const title = '🎲 Vitória nos Dados!';
      const msg = `🎉 **${displayName}** apostou **${bet} 🪙** nos Dados e ganhou! Saiu o número ${roll}! 🚀`;
      announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Dados', amount: winnings, bet, isJackpot: type === 'exact' });
    }
    
    return res.json({ success: true, roll, won, winnings, netReward: net, newBalance: user.balance, xpResult: prog.xpResult, newBadges: prog.newBadges });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

const hlSessions = new Map();

app.post('/api/games/higherlower/start', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet } = req.body;
    
    if (typeof bet !== 'number' || bet < 10) return res.status(400).json({ error: 'Aposta inválida.' });
    
    const user = db.getUser(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    
    if (bet > user.balance) return res.status(400).json({ error: 'Saldo insuficiente.' });
    if (bet < cfg.minBet || bet > cfg.maxBet) return res.status(400).json({ error: `Aposta fora dos limites (${cfg.minBet} - ${cfg.maxBet}).` });
    
    const cooldown = db.getCooldown(guildId, userId, 'higherlower');
    if (cooldown > 0) return res.status(400).json({ error: `Espera mais ${(cooldown/1000).toFixed(1)}s.` });
    db.setCooldown(guildId, userId, 'higherlower', cfg.higherlowerCooldownMs || 5000);
    
    user.balance -= bet;
    db.saveUser(guildId, userId, user);
    
    const deck = require('./deck');
    const ranks = deck.RANKS || ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suits = ['♠', '♥', '♦', '♣'];
    
    const randomCard = () => ({
      rank: ranks[Math.floor(Math.random() * ranks.length)],
      suit: suits[Math.floor(Math.random() * suits.length)]
    });
    
    const currentCard = randomCard();
    const hlSession = {
      guildId,
      userId,
      bet,
      currentCard,
      multiplier: 1.0,
      rounds: 0,
      ranks,
      suits,
      randomCard
    };
    
    hlSessions.set(`${guildId}:${userId}`, hlSession);
    
    return res.json({
      success: true,
      card: currentCard,
      multiplier: hlSession.multiplier,
      rounds: hlSession.rounds,
      newBalance: user.balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/games/higherlower/action', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { choice } = req.body;
    
    const key = `${guildId}:${userId}`;
    const game = hlSessions.get(key);
    if (!game) return res.status(400).json({ error: 'Nenhum jogo ativo.' });
    
    const user = db.getUser(guildId, userId);
    
    if (choice === 'cashout') {
      const winnings = Math.round(game.bet * game.multiplier);
      const net = winnings - game.bet;
      
      user.balance += winnings;
      db.saveUser(guildId, userId, user);
      
      db.recordResult(guildId, userId, true, game.bet);
      db.addTournamentScore(guildId, userId, net);
      
      const progression = require('./progression');
      const ctx = {
        guildId, userId, member: null, client: discordClient, channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Higher/Lower', bet: game.bet, net, won: true, isWeb: true });
      
      const cfg = db.getGuildConfig(guildId);
      if (winnings >= cfg.bigWinThreshold) {
        const displayName = user.username || userId;
        const title = '🔼🔽 Vitória no Higher/Lower!';
        const msg = `🎉 **${displayName}** sacou **${winnings} 🪙** no Higher/Lower com multiplicador x${game.multiplier.toFixed(2)}! 🚀`;
        announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Higher/Lower', amount: winnings, bet: game.bet, isJackpot: false });
      }
      
      hlSessions.delete(key);
      
      return res.json({
        success: true,
        status: 'cashout',
        winnings,
        netReward: net,
        newBalance: user.balance,
        xpResult: prog.xpResult,
        newBadges: prog.newBadges
      });
    }
    
    const nextCard = game.randomCard();
    const curIdx = game.ranks.indexOf(game.currentCard.rank);
    const nextIdx = game.ranks.indexOf(nextCard.rank);
    
    if (nextIdx === curIdx) {
      game.currentCard = nextCard;
      return res.json({
        success: true,
        status: 'push',
        card: nextCard,
        multiplier: game.multiplier,
        rounds: game.rounds
      });
    }
    
    const correct = choice === 'higher' ? nextIdx > curIdx : nextIdx < curIdx;
    game.currentCard = nextCard;
    
    if (!correct) {
      const net = -game.bet;
      db.recordResult(guildId, userId, false, game.bet);
      db.addTournamentScore(guildId, userId, net);
      
      const progression = require('./progression');
      const ctx = {
        guildId, userId, member: null, client: discordClient, channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Higher/Lower', bet: game.bet, net, won: false, isWeb: true });
      
      hlSessions.delete(key);
      
      return res.json({
        success: true,
        status: 'lost',
        card: nextCard,
        netReward: net,
        newBalance: user.balance,
        xpResult: prog.xpResult,
        newBadges: prog.newBadges
      });
    }
    
    game.rounds += 1;
    const probability = choice === 'higher'
      ? (game.ranks.length - 1 - curIdx) / (game.ranks.length - 1)
      : curIdx / (game.ranks.length - 1);
    
    const HOUSE_EDGE = 0.95;
    const stepMult = probability > 0 ? HOUSE_EDGE / probability : 2;
    game.multiplier *= Math.min(stepMult, 4);
    
    return res.json({
      success: true,
      status: 'playing',
      card: nextCard,
      multiplier: game.multiplier,
      rounds: game.rounds
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ─── ROLETA RUSSA SOLO ────────────────────────────────────────────────────────
const russaSessions = new Map();

app.post('/api/games/russa/start', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet } = req.body;
    
    if (typeof bet !== 'number' || bet < 10) return res.status(400).json({ error: 'Aposta inválida.' });
    
    const user = db.getUser(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    
    if (bet > user.balance) return res.status(400).json({ error: 'Saldo insuficiente.' });
    if (bet < cfg.minBet || bet > cfg.maxBet) return res.status(400).json({ error: `Aposta fora dos limites (${cfg.minBet} - ${cfg.maxBet}).` });
    
    const cooldown = db.getCooldown(guildId, userId, 'roleta-russa');
    if (cooldown > 0) return res.status(400).json({ error: `Espera mais ${(cooldown/1000).toFixed(1)}s.` });
    db.setCooldown(guildId, userId, 'roleta-russa', 4000);
    
    // Deduct bet
    user.balance -= bet;
    db.saveUser(guildId, userId, user);
    
    const bulletPosition = Math.floor(Math.random() * 6);
    const russaSession = {
      guildId,
      userId,
      bet,
      bulletPosition,
      currentChamber: 0,
      round: 1
    };
    
    russaSessions.set(`${guildId}:${userId}`, russaSession);
    
    return res.json({
      success: true,
      round: russaSession.round,
      currentChamber: russaSession.currentChamber,
      newBalance: user.balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/games/russa/action', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { choice } = req.body;
    
    const key = `${guildId}:${userId}`;
    const game = russaSessions.get(key);
    if (!game) return res.status(400).json({ error: 'Nenhum jogo ativo.' });
    
    const user = db.getUser(guildId, userId);
    const MULTIPLIERS = [1.2, 1.5, 2.0, 3.0, 5.0];
    
    if (choice === 'cashout') {
      if (game.round <= 1) return res.status(400).json({ error: 'Não podes sacar na primeira ronda.' });
      
      const mult = MULTIPLIERS[game.round - 2];
      const winnings = Math.round(game.bet * mult);
      const net = winnings - game.bet;
      
      user.balance += winnings;
      db.saveUser(guildId, userId, user);
      
      db.recordResult(guildId, userId, true, game.bet);
      db.addTournamentScore(guildId, userId, net);
      
      const progression = require('./progression');
      const ctx = {
        guildId, userId, member: null, client: discordClient, channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Roleta Russa', bet: game.bet, net, won: true, isWeb: true });
      
      const cfg = db.getGuildConfig(guildId);
      if (winnings >= cfg.bigWinThreshold) {
        const displayName = user.username || userId;
        const title = '💥 Vitória na Roleta Russa!';
        const msg = `🎉 **${displayName}** sobreviveu e sacou **${winnings} 🪙** na Roleta Russa (x${mult.toFixed(2)})! 🔫`;
        announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Roleta Russa', amount: winnings, bet: game.bet, isJackpot: false });
      }
      
      russaSessions.delete(key);
      
      return res.json({
        success: true,
        status: 'cashout',
        winnings,
        netReward: net,
        newBalance: user.balance,
        xpResult: prog.xpResult,
        newBadges: prog.newBadges
      });
    }
    
    // Pulling trigger
    const isBullet = game.currentChamber === game.bulletPosition;
    
    if (isBullet) {
      const net = -game.bet;
      db.recordResult(guildId, userId, false, game.bet);
      db.addTournamentScore(guildId, userId, net);
      
      const progression = require('./progression');
      const ctx = {
        guildId, userId, member: null, client: discordClient, channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Roleta Russa', bet: game.bet, net, won: false, isWeb: true });
      
      russaSessions.delete(key);
      
      return res.json({
        success: true,
        status: 'dead',
        chamber: game.currentChamber,
        netReward: net,
        newBalance: user.balance,
        xpResult: prog.xpResult,
        newBadges: prog.newBadges
      });
    }
    
    // Survived
    const nextChamber = game.currentChamber + 1;
    const currentRound = game.round;
    
    if (currentRound >= 5) {
      // Auto cashout maximum multiplier (5.0x)
      const mult = 5.0;
      const winnings = Math.round(game.bet * mult);
      const net = winnings - game.bet;
      
      user.balance += winnings;
      db.saveUser(guildId, userId, user);
      
      db.recordResult(guildId, userId, true, game.bet);
      db.addTournamentScore(guildId, userId, net);
      
      const progression = require('./progression');
      const ctx = {
        guildId, userId, member: null, client: discordClient, channelId: null,
        user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
      };
      const prog = await progression.applyProgressionFor(ctx, { game: 'Roleta Russa', bet: game.bet, net, won: true, isWeb: true });
      
      const cfg = db.getGuildConfig(guildId);
      if (winnings >= cfg.bigWinThreshold) {
        const displayName = user.username || userId;
        const title = '💥 VITÓRIA MÁXIMA na Roleta Russa!';
        const msg = `🎉 **${displayName}** sobreviveu a todas as 5 rondas da Roleta Russa e ganhou **${winnings} 🪙** (x5.00)! 🔫`;
        announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Roleta Russa', amount: winnings, bet: game.bet, isJackpot: true });
      }
      
      russaSessions.delete(key);
      
      return res.json({
        success: true,
        status: 'autowin',
        winnings,
        netReward: net,
        newBalance: user.balance,
        xpResult: prog.xpResult,
        newBadges: prog.newBadges
      });
    }
    
    // Prepare next round
    game.currentChamber = nextChamber;
    game.round += 1;
    
    return res.json({
      success: true,
      status: 'survived',
      round: game.round,
      currentChamber: game.currentChamber
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ─── POKER SOLO ───────────────────────────────────────────────────────────────
const pokerSessions = new Map();

app.post('/api/games/poker/start', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet } = req.body;
    
    if (typeof bet !== 'number' || bet < 10) return res.status(400).json({ error: 'Aposta inválida.' });
    
    const user = db.getUser(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    
    if (bet > user.balance) return res.status(400).json({ error: 'Saldo insuficiente.' });
    if (bet < cfg.minBet || bet > cfg.maxBet) return res.status(400).json({ error: `Aposta fora dos limites (${cfg.minBet} - ${cfg.maxBet}).` });
    
    const cooldown = db.getCooldown(guildId, userId, 'poker');
    if (cooldown > 0) return res.status(400).json({ error: `Espera mais ${(cooldown/1000).toFixed(1)}s.` });
    db.setCooldown(guildId, userId, 'poker', 6000);
    
    // Deduct bet
    user.balance -= bet;
    db.saveUser(guildId, userId, user);
    
    const deck = require('./deck');
    const d = deck.newDeck();
    
    const playerCards = [d.pop(), d.pop(), d.pop(), d.pop(), d.pop()];
    const botCards = [d.pop(), d.pop(), d.pop(), d.pop(), d.pop()];
    
    const key = `${guildId}:${userId}`;
    pokerSessions.set(key, {
      guildId,
      userId,
      bet,
      deck: d,
      playerCards,
      botCards
    });
    
    return res.json({
      success: true,
      playerCards,
      newBalance: user.balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/games/poker/swap', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { swapIndices } = req.body;
    
    if (!Array.isArray(swapIndices)) return res.status(400).json({ error: 'swapIndices inválido.' });
    
    const key = `${guildId}:${userId}`;
    const game = pokerSessions.get(key);
    if (!game) return res.status(400).json({ error: 'Nenhum jogo ativo.' });
    
    const user = db.getUser(guildId, userId);
    const d = game.deck;
    const playerCards = [...game.playerCards];
    const botCards = game.botCards;
    
    const swapped = [];
    swapIndices.slice(0, 3).forEach(idx => {
      if (idx >= 0 && idx < 5) {
        playerCards[idx] = d.pop();
        swapped.push(idx);
      }
    });
    
    const pokerHand = require('./pokerHand');
    const pEval = pokerHand.evaluateHand(playerCards);
    const bEval = pokerHand.evaluateHand(botCards);
    const cmp = pokerHand.compareHands(pEval, bEval);
    
    let result = '';
    let winnings = 0;
    
    if (cmp > 0) {
      result = 'win';
      winnings = game.bet * 2;
    } else if (cmp === 0) {
      result = 'push';
      winnings = game.bet;
    } else {
      result = 'lose';
      winnings = 0;
    }
    
    const net = winnings - game.bet;
    user.balance += winnings;
    db.saveUser(guildId, userId, user);
    
    const won = result === 'win';
    db.recordResult(guildId, userId, won, game.bet);
    db.addTournamentScore(guildId, userId, net);
    
    db.pushHistory(guildId, userId, { game: `Poker vs Bot (Resultado)`, bet: game.bet, net });
    
    const progression = require('./progression');
    const ctx = {
      guildId, userId, member: null, client: discordClient, channelId: null,
      user: discordClient ? (discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null)) : null
    };
    const prog = await progression.applyProgressionFor(ctx, { game: 'Poker', bet: game.bet, net, won, isWeb: true });
    
    const cfg = db.getGuildConfig(guildId);
    if (won && winnings >= cfg.bigWinThreshold) {
      const displayName = user.username || userId;
      const title = '🃏 Vitória no Poker!';
      const msg = `🎉 **${displayName}** ganhou **${winnings} 🪙** no Poker com ${pEval.name} contra ${bEval.name}! 🚀`;
      announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Poker', amount: winnings, bet: game.bet, isJackpot: false });
    }
    
    pokerSessions.delete(key);
    
    return res.json({
      success: true,
      playerCards,
      botCards,
      swapped,
      playerHand: pEval,
      botHand: bEval,
      result,
      winnings,
      netReward: net,
      newBalance: user.balance,
      xpResult: prog.xpResult,
      newBadges: prog.newBadges
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});
// ─── DUELOS & COINFLIP PVP ───────────────────────────────────────────────────

app.get('/api/duels', (req, res) => {
  try {
    const list = Array.from(activeDuels.values());
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar duelos' });
  }
});

app.post('/api/duels/create', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { bet, choice } = req.body;
    
    if (typeof bet !== 'number' || bet < 10 || !['cara', 'coroa'].includes(choice)) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }
    
    const user = db.getUser(guildId, userId);
    if (user.balance < bet) return res.status(400).json({ error: 'Saldo insuficiente.' });
    
    const duelId = require('crypto').randomBytes(8).toString('hex');
    const newDuel = {
      id: duelId,
      guildId,
      creatorId: userId,
      creatorName: user.username || userId,
      creatorAvatar: user.avatar,
      creatorChoice: choice,
      bet,
      createdAt: Date.now()
    };
    
    user.balance -= bet;
    db.saveUser(guildId, userId, user);
    
    activeDuels.set(duelId, newDuel);
    
    return res.json({ success: true, duel: newDuel, newBalance: user.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/duels/join', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { duelId } = req.body;
    
    const duel = activeDuels.get(duelId);
    if (!duel) return res.status(404).json({ error: 'Duelo não encontrado ou já resolvido.' });
    
    if (duel.creatorId === userId) {
      return res.status(400).json({ error: 'Não podes aceitar o teu próprio duelo!' });
    }
    
    const joiner = db.getUser(guildId, userId);
    if (joiner.balance < duel.bet) return res.status(400).json({ error: 'Saldo insuficiente.' });
    
    joiner.balance -= duel.bet;
    db.saveUser(guildId, userId, joiner);
    
    const roll = Math.random() < 0.50 ? 'cara' : 'coroa';
    const creatorWon = duel.creatorChoice === roll;
    
    const winnerId = creatorWon ? duel.creatorId : userId;
    const loserId = creatorWon ? userId : duel.creatorId;
    
    const totalWinnings = duel.bet * 2;
    
    const winnerUser = db.getUser(guildId, winnerId);
    winnerUser.balance += totalWinnings;
    db.saveUser(guildId, winnerId, winnerUser);
    
    const loserUser = db.getUser(guildId, loserId);
    
    db.recordResult(guildId, winnerId, true, duel.bet);
    db.recordResult(guildId, loserId, false, duel.bet);
    db.addTournamentScore(guildId, winnerId, duel.bet);
    db.addTournamentScore(guildId, loserId, -duel.bet);
    
    db.pushHistory(guildId, winnerId, { game: `Duelo Coinflip PvP (Vitória)`, bet: duel.bet, net: duel.bet });
    db.pushHistory(guildId, loserId, { game: `Duelo Coinflip PvP (Derrota)`, bet: duel.bet, net: -duel.bet });
    
    const cfg = db.getGuildConfig(guildId);
    if (totalWinnings >= cfg.bigWinThreshold) {
      const displayName = winnerUser.username || winnerId;
      const title = '⚔️ Vitória em Duelo PvP!';
      const msg = `🎉 **${displayName}** venceu o Duelo Coinflip contra **${loserUser.username || loserId}** e levou o pote de **${totalWinnings} 🪙**! 🚀`;
      announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Duelo PvP', amount: totalWinnings, bet: duel.bet, isJackpot: false });
    }
    
    activeDuels.delete(duelId);
    
    return res.json({
      success: true,
      roll,
      winnerId,
      creatorWon,
      winnings: totalWinnings,
      newBalance: joiner.balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/duels/cancel', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { duelId } = req.body;
    
    const duel = activeDuels.get(duelId);
    if (!duel) return res.status(404).json({ error: 'Duelo não encontrado.' });
    
    if (duel.creatorId !== userId) {
      return res.status(403).json({ error: 'Apenas o criador pode cancelar este duelo.' });
    }
    
    const user = db.getUser(guildId, userId);
    user.balance += duel.bet;
    db.saveUser(guildId, userId, user);
    
    activeDuels.delete(duelId);
    
    return res.json({ success: true, newBalance: user.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/bank/loan', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const loan = db.getLoan(guildId, userId);
    const cfg = db.getGuildConfig(guildId);
    
    return res.json({
      success: true,
      loan,
      maxAmount: cfg.loanMaxAmount,
      interestPercent: cfg.loanInterestPercent
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/bank/loan/request', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { amount } = req.body;
    
    const cfg = db.getGuildConfig(guildId);
    if (typeof amount !== 'number' || amount <= 0 || amount > cfg.loanMaxAmount) {
      return res.status(400).json({ error: `Valor inválido (máx: ${cfg.loanMaxAmount} 🪙).` });
    }
    
    const activeLoan = db.getLoan(guildId, userId);
    if (activeLoan) return res.status(400).json({ error: 'Já tens um empréstimo ativo. Paga-o primeiro!' });
    
    const loan = db.createLoan(guildId, userId, amount, cfg.loanInterestPercent, cfg.loanDurationMs);
    const user = db.getUser(guildId, userId);
    
    return res.json({ success: true, loan, newBalance: user.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/bank/loan/repay', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { amount } = req.body;
    
    const loan = db.getLoan(guildId, userId);
    if (!loan) return res.status(400).json({ error: 'Não tens nenhum empréstimo ativo.' });
    
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'Valor de pagamento inválido.' });
    
    const user = db.getUser(guildId, userId);
    if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
    
    const updatedLoan = db.repayLoan(guildId, userId, amount);
    const updatedUser = db.getUser(guildId, userId);
    
    return res.json({ success: true, loan: updatedLoan, newBalance: updatedUser.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.get('/api/lottery/state', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const lottery = db.getLottery(guildId);
    const cfg = db.getGuildConfig(guildId);
    const myTickets = lottery.tickets[userId] || 0;
    
    return res.json({
      success: true,
      jackpot: lottery.jackpot,
      ticketPrice: cfg.lotteryTicketPrice,
      myTickets,
      lastDrawAt: lottery.lastDrawAt
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/lottery/buy', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { quantity } = req.body;
    
    if (typeof quantity !== 'number' || quantity <= 0) return res.status(400).json({ error: 'Quantidade de bilhetes inválida.' });
    
    const cfg = db.getGuildConfig(guildId);
    const cost = quantity * cfg.lotteryTicketPrice;
    
    const user = db.getUser(guildId, userId);
    if (user.balance < cost) return res.status(400).json({ error: 'Saldo insuficiente.' });
    
    const result = db.buyLotteryTickets(guildId, userId, quantity, cfg.lotteryTicketPrice);
    if (!result) return res.status(400).json({ error: 'Erro ao comprar bilhetes.' });
    
    const updatedUser = db.getUser(guildId, userId);
    
    return res.json({
      success: true,
      myTickets: result.totalTickets,
      jackpot: result.jackpot,
      newBalance: updatedUser.balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/transfer', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { targetUserId, amount } = req.body;
    
    if (!targetUserId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Parâmetros de transferência inválidos.' });
    }
    
    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Não podes transferir moedas para ti próprio!' });
    }
    
    const user = db.getUser(guildId, userId);
    if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente.' });
    
    const targetUser = db.getUser(guildId, targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'Destinatário não encontrado.' });
    
    db.addBalance(guildId, userId, -amount);
    db.addBalance(guildId, targetUserId, amount);
    
    db.pushHistory(guildId, userId, { game: `Transferência Enviada`, bet: amount, net: -amount });
    db.pushHistory(guildId, targetUserId, { game: `Transferência Recebida`, bet: 0, net: amount });
    
    // Announce event to Discord (Logs)
    if (discordClient) {
      try {
        const cfg = db.getGuildConfig(guildId);
        const logChan = cfg.logChannelId ? await discordClient.channels.fetch(cfg.logChannelId).catch(() => null) : null;
        if (logChan) {
          const uName = user.username || userId;
          const tName = targetUser.username || targetUserId;
          await logChan.send(`💸 **${uName}** transferiu **${amount} 🪙** para **${tName}** no Site.`);
        }
      } catch {}
    }
    
    return res.json({ success: true, newBalance: user.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/rob', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });
    
    const { guildId, userId } = session;
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'ID do destinatário em falta.' });
    }
    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Não podes roubar-te a ti próprio!' });
    }
    
    const cfg = db.getGuildConfig(guildId);
    
    const cooldown = db.getCooldown(guildId, userId, 'roubar');
    if (cooldown > 0) {
      return res.status(400).json({ error: `Estás sob vigilância. Espera mais ${(cooldown/60000).toFixed(0)} min.` });
    }
    
    const robber = db.getUser(guildId, userId);
    const victim = db.getUser(guildId, targetUserId);
    if (!victim) {
      return res.status(404).json({ error: 'Vítima não encontrada no servidor.' });
    }
    
    if (victim.balance < 50) {
      return res.status(400).json({ error: 'A vítima não tem moedas suficientes na carteira.' });
    }
    
    db.setCooldown(guildId, userId, 'roubar', cfg.robCooldownMs || 15 * 60 * 1000);
    
    const success = Math.random() * 100 < (cfg.robSuccessChance || 50);
    
    if (success) {
      const minP = cfg.robMinPercent || 10;
      const maxP = cfg.robMaxPercent || 30;
      const percent = minP + Math.random() * (maxP - minP);
      const amount = Math.round(victim.balance * (percent / 100));
      
      db.addBalance(guildId, targetUserId, -amount);
      db.addBalance(guildId, userId, amount);
      db.setRobbedNow(guildId, targetUserId);
      
      db.pushHistory(guildId, userId, { game: `Roubo bem-sucedido`, bet: 0, net: amount });
      db.pushHistory(guildId, targetUserId, { game: `Foste Roubado`, bet: 0, net: -amount });
      
      if (discordClient) {
        try {
          const logChan = cfg.logChannelId ? await discordClient.channels.fetch(cfg.logChannelId).catch(() => null) : null;
          if (logChan) {
            const rName = robber.username || userId;
            const vName = victim.username || targetUserId;
            await logChan.send(`🕵️ **${rName}** roubou **${amount} 🪙** a **${vName}** no Site.`);
          }
        } catch {}
      }
      
      return res.json({ success: true, won: true, amount, newBalance: robber.balance });
    } else {
      const finePercent = cfg.robFailFinePercent || 10;
      const fine = Math.round(robber.balance * (finePercent / 100)) || 50;
      
      db.addBalance(guildId, userId, -fine);
      db.addBalance(guildId, targetUserId, fine);
      
      db.pushHistory(guildId, userId, { game: `Falha ao Roubar`, bet: 0, net: -fine });
      db.pushHistory(guildId, targetUserId, { game: `Multa Recebida de Roubo`, bet: 0, net: fine });
      
      if (discordClient) {
        try {
          const logChan = cfg.logChannelId ? await discordClient.channels.fetch(cfg.logChannelId).catch(() => null) : null;
          if (logChan) {
            const rName = robber.username || userId;
            const vName = victim.username || targetUserId;
            await logChan.send(`🚨 **${rName}** falhou ao roubar **${vName}** no Site e pagou uma multa de **${fine} 🪙**.`);
          }
        } catch {}
      }
      
      return res.json({ success: true, won: false, fine, newBalance: robber.balance });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/jobs/start', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  const { guildId, userId } = session;
  const { job } = req.body;
  if (!['trabalhar', 'pesca', 'hack', 'crime'].includes(job)) {
    return res.status(400).json({ error: 'Trabalho inválido.' });
  }

  const cooldownKey = job === 'trabalhar' ? 'trabalhar' : (job === 'pesca' ? 'pescar' : (job === 'hack' ? 'hackear' : 'crime'));
  const cooldown = db.getCooldown(guildId, userId, cooldownKey);
  if (cooldown > 0) {
    return res.status(400).json({ error: 'Este trabalho ainda está em cooldown.' });
  }

  const crypto = require('crypto');
  const jobToken = crypto.randomBytes(16).toString('hex');
  activeJobs.set(jobToken, {
    guildId,
    userId,
    job,
    startedAt: Date.now()
  });

  return res.json({ success: true, jobToken });
});

app.post('/api/jobs/complete', async (req, res) => {
  const { jobToken, score } = req.body;
  if (!jobToken) return res.status(400).json({ error: 'Token em falta.' });

  const activeJob = activeJobs.get(jobToken);
  if (!activeJob) return res.status(400).json({ error: 'Token de trabalho inválido ou expirado.' });

  activeJobs.delete(jobToken);

  const { guildId, userId, job, startedAt } = activeJob;
  const elapsed = Date.now() - startedAt;

  if (elapsed < 3000) {
    return res.status(400).json({ error: 'Trabalho completado demasiado depressa!' });
  }

  const cfg = db.getGuildConfig(guildId);
  let reward = 0;
  let cooldownKey = '';
  let cooldownMs = 0;
  let gameName = '';

  if (job === 'pesca') {
    const scoreSafe = Math.max(0, Math.min(score || 0, 3));
    const performance = scoreSafe / 3;
    reward = Math.round(80 + (250 - 80) * performance);
    cooldownKey = 'pescar';
    cooldownMs = 30 * 60 * 1000;
    gameName = 'Pesca Rápida';
  } else if (job === 'hack') {
    const scoreSafe = Math.max(0, Math.min(score || 0, 5));
    const performance = scoreSafe / 5;
    reward = Math.round(150 + (500 - 150) * performance);
    cooldownKey = 'hackear';
    cooldownMs = 45 * 60 * 1000;
    gameName = 'Hackear o Banco';
  } else if (job === 'trabalhar') {
    const scoreSafe = Math.max(0, Math.min(score || 0, DIRTY_COUNT));
    const performance = scoreSafe / DIRTY_COUNT;
    reward = Math.round(cfg.workMin + (cfg.workMax - cfg.workMin) * performance);
    cooldownKey = 'trabalhar';
    cooldownMs = cfg.workCooldownMs;
    gameName = 'Faxina Rápida';
  } else if (job === 'crime') {
    cooldownKey = 'crime';
    cooldownMs = 30 * 60 * 1000;
    gameName = 'Crime';
    if (score > 0) {
      reward = Math.round(200 + Math.random() * 600);
    } else {
      const user = db.getUser(guildId, userId);
      const finePercent = 10 + Math.floor(Math.random() * 6);
      reward = -Math.round(user.balance * (finePercent / 100)) || -50;
    }
  } else {
    return res.status(400).json({ error: 'Trabalho inválido.' });
  }

  const newBalance = db.addBalance(guildId, userId, reward);
  db.setCooldown(guildId, userId, cooldownKey, cooldownMs);
  db.pushHistory(guildId, userId, { game: gameName, bet: 0, net: reward });

  const progression = require('./progression');
  
  const progResult = await progression.afterGameForMember({
    guildId,
    channelId: null,
    client: discordClient
  }, { id: userId, user: { id: userId } }, {
    game: gameName,
    bet: 0,
    net: reward,
    won: reward > 0
  }).catch(err => console.error('Erro ao processar progressão web:', err));

  return res.json({
    success: true,
    reward,
    balance: newBalance,
    xpResult: progResult?.xpResult,
    newBadges: progResult?.newBadges
  });
});
 
app.post('/api/trabalho/completar', (req, res) => {
  try {
    const { token, cleaned } = req.body || {};
 
    if (!token || typeof cleaned !== 'number') {
      return res.status(400).json({ error: 'Pedido inválido.' });
    }
 
    const entry = webTokens.consumeToken(token);
    if (!entry) {
      return res.status(400).json({ error: 'Este link já expirou ou já foi usado. Volta ao Discord e usa /trabalhar outra vez.' });
    }
 
    const { guildId, userId } = entry;
    const cfg = db.getGuildConfig(guildId);
 
    const cleanedSafe = Math.max(0, Math.min(cleaned, DIRTY_COUNT));
    const performance = cleanedSafe / DIRTY_COUNT;
    const reward = Math.round(cfg.workMin + (cfg.workMax - cfg.workMin) * performance);
 
    const newBalance = db.addBalance(guildId, userId, reward);
    db.setCooldown(guildId, userId, 'trabalhar', cfg.workCooldownMs);
    db.pushHistory(guildId, userId, { game: 'Faxina Rápida', bet: 0, net: reward });

    const progression = require('./progression');
    progression.afterGameForMember({
      guildId,
      channelId: null,
      client: discordClient
    }, { id: userId, user: { id: userId } }, {
      game: 'Faxina Rápida',
      bet: 0,
      net: reward,
      won: reward > 0
    }).catch(err => console.error('Erro ao processar progressão web:', err));
 
    return res.json({ reward, balance: newBalance });
  } catch (err) {
    console.error('Erro em /api/trabalho/completar:', err);
    return res.status(500).json({ error: 'Erro no servidor ao guardar o resultado. Tenta de novo.' });
  }
});

// =========================================================================
// ⚙️ ENDPOINTS DE ADMINISTRAÇÃO SECURE (ADMINISTRATOR PERMISSION ONLY)
// =========================================================================

async function checkAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado. Faz login primeiro.' });

  const { guildId, userId } = session;
  if (!discordClient) return res.status(500).json({ error: 'Cliente Discord offline.' });

  try {
    const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(404).json({ error: 'Servidor Guilda não encontrado.' });

    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return res.status(403).json({ error: 'Membro não encontrado no servidor.' });
    }

    const hasPerm = member.permissions.has('Administrator');
    const hasRole = member.roles.cache.some(r => r.name.toLowerCase() === 'administrador');

    if (!hasPerm && !hasRole) {
      return res.status(403).json({ error: 'Acesso negado. Precisas de ter cargo Administrador no Discord para aceder a esta página.' });
    }
    next();
  } catch (err) {
    console.error('Erro na verificação de administrador:', err);
    return res.status(500).json({ error: 'Erro de verificação.' });
  }
}

app.get('/api/admin/users', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const usersData = db.getUsersData ? db.getUsersData() : require('./database').getUsersData?.() || {};

    const guildKeys = Object.keys(usersData).filter(k => k.startsWith(`${guildId}:`));

    const list = await Promise.all(
      guildKeys.map(async k => {
        const parts = k.split(':');
        const uId = parts[1];
        const uData = usersData[k];

        let uName = `Jogador ${uId}`;
        if (discordClient) {
          const uObj = discordClient.users.cache.get(uId) || await discordClient.users.fetch(uId).catch(() => null);
          if (uObj) uName = uObj.username;
        }

        return {
          userId: uId,
          username: uName,
          balance: uData.balance,
          bank: uData.bank,
          vipLevel: uData.vipLevel || 0,
          level: uData.level || 1,
          xp: uData.xp || 0,
          crypto: uData.crypto || { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 },
          lastDaily: uData.lastDaily || 0,
          equippedFrame: uData.equippedFrame || null,
          equippedBg: uData.equippedBg || null
        };
      })
    );

    return res.json(list);
  } catch (err) {
    console.error('Erro em /api/admin/users:', err);
    res.status(500).json({ error: 'Erro ao carregar utilizadores.' });
  }
});

app.post('/api/admin/user/update', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const { targetUserId, balance, bank, level, xp, vipLevel, crypto, equippedFrame, equippedBg } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId em falta.' });

    const usersData = db.getUsersData ? db.getUsersData() : require('./database').getUsersData?.() || {};
    const uKey = `${guildId}:${targetUserId}`;
    
    if (!usersData[uKey]) {
      return res.status(404).json({ error: 'Jogador não encontrado na base de dados.' });
    }

    const uData = usersData[uKey];

    if (typeof balance === 'number') uData.balance = balance;
    if (typeof bank === 'number') uData.bank = bank;
    if (typeof level === 'number') uData.level = level;
    if (typeof xp === 'number') uData.xp = xp;
    if (typeof vipLevel === 'number') uData.vipLevel = vipLevel;
    if (crypto && typeof crypto === 'object') {
      uData.crypto = { ...uData.crypto, ...crypto };
    }
    if (typeof equippedFrame === 'string') {
      uData.equippedFrame = equippedFrame === 'none' ? null : equippedFrame;
    }
    if (typeof equippedBg === 'string') {
      uData.equippedBg = equippedBg === 'none' ? null : equippedBg;
    }

    db.saveUser(guildId, targetUserId, uData);
    return res.json({ success: true, user: uData });
  } catch (err) {
    console.error('Erro em /api/admin/user/update:', err);
    res.status(500).json({ error: 'Erro ao atualizar utilizador.' });
  }
});

app.post('/api/admin/user/clear-cooldowns', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const { targetUserId } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId em falta.' });

    const usersData = db.getUsersData ? db.getUsersData() : require('./database').getUsersData?.() || {};
    const uKey = `${guildId}:${targetUserId}`;

    if (!usersData[uKey]) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    const uData = usersData[uKey];
    uData.cooldowns = {};
    uData.lastDaily = 0;

    db.saveUser(guildId, targetUserId, uData);
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro em /api/admin/user/clear-cooldowns:', err);
    res.status(500).json({ error: 'Erro ao limpar cooldowns.' });
  }
});

app.post('/api/admin/user/reset', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId em falta.' });

    db.resetUser(guildId, targetUserId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro em /api/admin/user/reset:', err);
    res.status(500).json({ error: 'Erro ao resetar saldo do jogador.' });
  }
});

app.post('/api/admin/users/reset-all', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const count = db.resetAllUsers(guildId);
    return res.json({ success: true, count });
  } catch (err) {
    console.error('Erro em /api/admin/users/reset-all:', err);
    res.status(500).json({ error: 'Erro ao resetar todos os saldos.' });
  }
});

app.get('/api/admin/channels', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    if (!discordClient) return res.json([]);
    
    const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.json([]);
    
    const channels = guild.channels.cache
      .filter(c => c.type === 0) // GuildText channels
      .map(c => ({ id: c.id, name: c.name }));
    
    return res.json(channels);
  } catch (err) {
    return res.json([]);
  }
});

app.get('/api/admin/tournament/status', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const t = db.getTournament(guildId);
    return res.json({
      active: db.isTournamentActive(guildId),
      name: t?.name || 'Nenhum',
      endTime: t?.endTime || 0,
      prize: t?.prize || 0,
      startedBy: t?.startedBy || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao ler estado do torneio.' });
  }
});

app.post('/api/admin/tournament/start', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId, userId } = session;
    const { durationHours, name, prize, channelId } = req.body;
    
    const existing = db.getTournament(guildId);
    if (existing && existing.active) {
      return res.status(400).json({ error: 'Já existe um torneio ativo.' });
    }
    
    const hours = parseInt(durationHours, 10);
    if (isNaN(hours) || hours <= 0) {
      return res.status(400).json({ error: 'Duração inválida.' });
    }
    
    db.startTournament(guildId, {
      durationMs: hours * 60 * 60 * 1000,
      name: name || 'Torneio do casino',
      prize: parseInt(prize, 10) || 0,
      channelId: channelId || null,
      startedBy: userId
    });
    
    // Envia anúncio se configurado
    if (discordClient && channelId) {
      const channel = await discordClient.channels.fetch(channelId).catch(() => null);
      if (channel) {
        const { baseEmbed, COLORS } = require('./embeds');
        const embed = baseEmbed(`🏆 ${name} — começou!`, COLORS.gold)
          .setDescription(`Um novo torneio foi iniciado a partir do Painel Web!\nQuem ganhar mais moedas líquidas em qualquer jogo do casino nas próximas **${hours}h** vence.\nUsa \`/torneio\` no Discord ou consulta a Dashboard do site para veres a classificação!`);
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao iniciar torneio.' });
  }
});

app.post('/api/admin/tournament/end', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const t = db.getTournament(guildId);
    if (!t || !t.active) {
      return res.status(400).json({ error: 'Nenhum torneio ativo.' });
    }
    const { concludeTournament } = require('./tournamentEngine');
    await concludeTournament(discordClient, guildId);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao terminar torneio.' });
  }
});

app.get('/api/admin/config', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const cfg = db.getGuildConfig(guildId);
    return res.json(cfg);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao obter configurações.' });
  }
});

app.post('/api/admin/config/update', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const {
      minBet, maxBet, dailyAmount, startingBalance, houseEdgePercent,
      workMin, workMax, bankInterestPercent, robSuccessChance,
      robFailFinePercent, loanMaxAmount, lotteryTicketPrice,
      bigWinThreshold, logChannelId, chatBridgeChannelId, announcementChannelId,
      autoTournamentEnabled, autoTournamentDay, autoTournamentHour, autoTournamentDurationHours
    } = req.body;

    const patch = {};
    if (typeof minBet === 'number') patch.minBet = minBet;
    if (typeof maxBet === 'number') patch.maxBet = maxBet;
    if (typeof dailyAmount === 'number') patch.dailyAmount = dailyAmount;
    if (typeof startingBalance === 'number') patch.startingBalance = startingBalance;
    if (typeof houseEdgePercent === 'number') patch.houseEdgePercent = houseEdgePercent;
    if (typeof workMin === 'number') patch.workMin = workMin;
    if (typeof workMax === 'number') patch.workMax = workMax;
    if (typeof bankInterestPercent === 'number') patch.bankInterestPercent = bankInterestPercent;
    if (typeof robSuccessChance === 'number') patch.robSuccessChance = robSuccessChance;
    if (typeof robFailFinePercent === 'number') patch.robFailFinePercent = robFailFinePercent;
    if (typeof loanMaxAmount === 'number') patch.loanMaxAmount = loanMaxAmount;
    if (typeof lotteryTicketPrice === 'number') patch.lotteryTicketPrice = lotteryTicketPrice;
    if (typeof bigWinThreshold === 'number') patch.bigWinThreshold = bigWinThreshold;
    if (logChannelId !== undefined) patch.logChannelId = logChannelId === 'none' ? null : logChannelId;
    if (chatBridgeChannelId !== undefined) patch.chatBridgeChannelId = chatBridgeChannelId === 'none' ? null : chatBridgeChannelId;
    if (announcementChannelId !== undefined) patch.announcementChannelId = announcementChannelId === 'none' ? null : announcementChannelId;
    if (typeof autoTournamentEnabled === 'boolean') patch.autoTournamentEnabled = autoTournamentEnabled;
    if (typeof autoTournamentDay === 'number') patch.autoTournamentDay = autoTournamentDay;
    if (typeof autoTournamentHour === 'number') patch.autoTournamentHour = autoTournamentHour;
    if (typeof autoTournamentDurationHours === 'number') patch.autoTournamentDurationHours = autoTournamentDurationHours;

    const updated = db.setGuildConfig(guildId, patch);
    return res.json({ success: true, config: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar configurações.' });
  }
});

app.get('/api/admin/stats', checkAdmin, async (req, res) => {
  try {
    const session = getSession(req);
    const { guildId } = session;
    const usersData = db.getUsersData ? db.getUsersData() : require('./database').getUsersData?.() || {};

    const guildKeys = Object.keys(usersData).filter(k => k.startsWith(`${guildId}:`));

    let totalCirculatingCoins = 0;
    let totalBankCoins = 0;
    let totalLevelSum = 0;
    const vipCounts = { vip0: 0, vip1: 0, vip2: 0, vip3: 0, vip4: 0 };

    guildKeys.forEach(k => {
      const u = usersData[k];
      totalCirculatingCoins += (u.balance || 0) + (u.bank || 0);
      totalBankCoins += (u.bank || 0);
      totalLevelSum += (u.level || 1);
      
      const vipLvl = u.vipLevel || 0;
      if (vipLvl === 0) vipCounts.vip0++;
      else if (vipLvl === 1) vipCounts.vip1++;
      else if (vipLvl === 2) vipCounts.vip2++;
      else if (vipLvl === 3) vipCounts.vip3++;
      else if (vipLvl >= 4) vipCounts.vip4++;
    });

    const totalPlayers = guildKeys.length;
    const avgLevel = totalPlayers > 0 ? (totalLevelSum / totalPlayers).toFixed(1) : 1;

    return res.json({
      totalCirculatingCoins,
      totalBankCoins,
      totalPlayers,
      avgLevel,
      vipCounts
    });
  } catch (err) {
    console.error('Erro em /api/admin/stats:', err);
    res.status(500).json({ error: 'Erro ao gerar estatísticas.' });
  }
});

app.post('/api/profile/equip', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { type, itemId } = req.body;

    if (!['frame', 'bg'].includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido.' });
    }

    const user = db.getUser(guildId, userId);

    if (itemId && itemId !== 'none' && !user.inventory.includes(itemId)) {
      return res.status(400).json({ error: 'Não possuis este cosmético.' });
    }

    const equipVal = (itemId === 'none' || !itemId) ? null : itemId;

    if (type === 'frame') {
      user.equippedFrame = equipVal;
    } else if (type === 'bg') {
      user.equippedBg = equipVal;
    }

    db.saveUser(guildId, userId, user);
    return res.json({ success: true, equippedFrame: user.equippedFrame, equippedBg: user.equippedBg });
  } catch (err) {
    console.error('Erro em /api/profile/equip:', err);
    res.status(500).json({ error: 'Erro ao equipar cosmético.' });
  }
});

app.post('/api/profile/custom-banner', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { bannerUrl } = req.body;

    const user = db.getUser(guildId, userId);

    if (!user.inventory.includes('custom_banner')) {
      return res.status(403).json({ error: 'Não tens o item Banner Personalizado na tua carteira.' });
    }

    user.customBannerUrl = bannerUrl || '';
    db.saveUser(guildId, userId, user);
    
    // Broadcast win event or sse event to update dashboard
    announceWebEvent(guildId, 'balance_update', { userId, balance: user.balance });

    return res.json({ success: true, customBannerUrl: user.customBannerUrl });
  } catch (err) {
    console.error('Erro em /api/profile/custom-banner:', err);
    res.status(500).json({ error: 'Erro ao guardar banner.' });
  }
});

app.get('/api/chat/stream', async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).send('Não autorizado.');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Enviar histórico inicial
  res.write(`event: history\ndata: ${JSON.stringify(db.getChatHistory())}\n\n`);

  chatClients.add(res);

  req.on('close', () => {
    chatClients.delete(res);
  });
});

app.post('/api/chat/send', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    const cleanMessage = message.trim().slice(0, 150);

    let username = 'Utilizador';
    let avatar = null;

    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) {
        username = uObj.username;
        avatar = uObj.displayAvatarURL({ size: 64 }) || uObj.defaultAvatarURL;
      }
    }

    const broadcast = (entry) => {
      const ssePayload = `event: message\ndata: ${JSON.stringify(entry)}\n\n`;
      chatClients.forEach(client => {
        try {
          client.write(ssePayload);
        } catch (err) {
          chatClients.delete(client);
        }
      });
    };

    // --- Comando Coinflip /cf ---
    if (cleanMessage.startsWith('/coinflip ') || cleanMessage.startsWith('/cf ')) {
      const parts = cleanMessage.split(/\s+/);
      const amountArg = parts[1];
      const sideArg = parts[2] ? parts[2].toLowerCase() : null;

      if (!amountArg || !sideArg || (sideArg !== 'cara' && sideArg !== 'coroa')) {
        return res.status(400).json({ error: 'Uso correto: /coinflip <quantia> <cara|coroa>' });
      }

      const user = db.getUser(guildId, userId);
      let amount = 0;
      if (amountArg.toLowerCase() === 'all') {
        amount = user.balance;
      } else {
        amount = parseInt(amountArg, 10);
      }

      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Aposta inválida.' });
      }

      if (user.balance < amount) {
        return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
      }

      // Processar aposta
      user.balance -= amount;
      const win = Math.random() < 0.5;
      const coinResult = win ? sideArg : (sideArg === 'cara' ? 'coroa' : 'cara');
      
      let netResult = -amount;
      let msgText = '';

      if (win) {
        const payout = amount * 2;
        user.balance += payout;
        netResult = amount;
        msgText = `🪙 [COINFLIP] @${username} apostou ${amount.toLocaleString('pt-PT')} 🪙 em ${sideArg.toUpperCase()}... Deu ${coinResult.toUpperCase()}! Ganhou ${payout.toLocaleString('pt-PT')} 🪙! 🎉`;
      } else {
        msgText = `🪙 [COINFLIP] @${username} apostou ${amount.toLocaleString('pt-PT')} 🪙 em ${sideArg.toUpperCase()}... Deu ${coinResult.toUpperCase()}! Perdeu ${amount.toLocaleString('pt-PT')} 🪙! 😢`;
      }

      db.saveUser(guildId, userId, user);
      db.pushHistory(guildId, userId, { game: 'Chat Coinflip', bet: amount, net: netResult });

      const systemEntry = {
        id: Date.now() + Math.random().toString(),
        userId: 'system',
        username: '🤖 Coinflip Casino',
        avatar: 'https://cdn-icons-png.flaticon.com/512/217/217853.png',
        message: msgText,
        timestamp: Date.now()
      };

      db.addChatMessage(systemEntry);
      broadcast(systemEntry);

      return res.json({ success: true, entry: systemEntry });
    }

    const userObj = db.getUser(guildId, userId);
    const chatEntry = {
      id: Date.now() + Math.random().toString(),
      userId,
      username,
      avatar,
      message: cleanMessage,
      timestamp: Date.now(),
      equippedFrame: userObj.equippedFrame || null
    };

    db.addChatMessage(chatEntry);

    broadcast(chatEntry);

    // Enviar mensagem para o canal do Discord (Ponte de Chat)
    try {
      const cfg = db.getGuildConfig(guildId);
      if (cfg && cfg.chatBridgeChannelId && discordClient) {
        const channel = discordClient.channels.cache.get(cfg.chatBridgeChannelId) || await discordClient.channels.fetch(cfg.chatBridgeChannelId).catch(() => null);
        if (channel) {
          await channel.send(`💬 **[Site] ${username}**: ${cleanMessage}`).catch(() => {});
        }
      }
    } catch (bridgeErr) {
      console.error("Erro ao enviar mensagem para a ponte de chat no Discord:", bridgeErr);
    }

    return res.json({ success: true, entry: chatEntry });
  } catch (err) {
    console.error('Erro ao enviar mensagem de chat:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

const SYMBOLS_WEB = [
  { emoji: '🍒', weight: 30, mult: 2 },
  { emoji: '🍋', weight: 25, mult: 3 },
  { emoji: '🍇', weight: 20, mult: 4 },
  { emoji: '🔔', weight: 12, mult: 8 },
  { emoji: '💎', weight: 8, mult: 15 },
  { emoji: '7️⃣', weight: 5, mult: 40 }
];

function spinWeb() {
  const total = SYMBOLS_WEB.reduce((s, x) => s + x.weight, 0);
  const roll = () => {
    let r = Math.random() * total;
    for (const s of SYMBOLS_WEB) {
      if (r < s.weight) return s;
      r -= s.weight;
    }
    return SYMBOLS_WEB[0];
  };
  return [roll(), roll(), roll()];
}

app.post('/api/games/slots', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Sessão inválida. Por favor, faz login novamente.' });
    
    const { guildId, userId } = session;
    const { bet } = req.body;
    
    const cfg = db.getGuildConfig(guildId);
    if (isNaN(bet) || bet < cfg.minBet || bet > cfg.maxBet) {
      return res.status(400).json({ error: `A aposta deve estar entre ${cfg.minBet} e ${cfg.maxBet}.` });
    }
    
    const user = db.getUser(guildId, userId);
    if (user.balance < bet) {
      return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
    }
    
    const result = spinWeb();
    const [a, b, c] = result;
    let winnings = 0;
    let win = false;
    
    if (a.emoji === b.emoji && b.emoji === c.emoji) {
      winnings = bet * a.mult;
      win = true;
    } else if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
      winnings = Math.round(bet * 1.5);
      win = true;
    } else {
      winnings = 0;
      win = false;
    }
    
    const net = winnings - bet;
    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, net > 0, bet);
    db.addTournamentScore(guildId, userId, net);
    
    const isJackpot = a.emoji === b.emoji && b.emoji === c.emoji;
    const progression = require('./progression');
    progression.recordJackpot(guildId, userId, isJackpot);
    
    let displayName = userId;
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) {
        displayName = uObj.username;
      }
      const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member) {
          displayName = member.displayName;
          const fakeInteraction = { guildId, client: discordClient, channelId: null };
          await progression.afterGameForMember(fakeInteraction, member, { game: 'Slots Web', bet, net, won: net > 0 }, true).catch(console.error);
        }
      }
    }
    
    const updatedUser = db.getUser(guildId, userId);

    // Announce wins via Discord + Web Chat + SSE lateral pop-up
    if (win && (winnings >= cfg.bigWinThreshold || isJackpot)) {
      const reelStr = [a.emoji, b.emoji, c.emoji].join(' ');
      let title = isJackpot ? '🎰 JACKPOT na Slot Machine!' : '🎰 Vitória na Slot Machine!';
      let msg = `**${displayName}** ganhou **${winnings.toLocaleString('pt-PT')} 🪙** nas Slots! ${reelStr}`;
      announceWebEvent(guildId, 'win', { title, message: msg, username: displayName, game: 'Slots', amount: winnings, bet, isJackpot });
    }
    
    return res.json({
      success: true,
      reels: [a.emoji, b.emoji, c.emoji],
      win,
      netReward: winnings,
      newBalance: updatedUser.balance
    });
  } catch (err) {
    console.error('Erro na Slot Machine Web:', err);
    res.status(500).json({ error: 'Erro interno ao girar Slots.' });
  }
});

app.post('/api/chat/duel/invite', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { opponentUserId, amount } = req.body;

    if (!opponentUserId || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Parâmetros de duelo inválidos.' });
    }

    if (userId === opponentUserId) {
      return res.status(400).json({ error: 'Não podes desafiar-te a ti próprio!' });
    }

    const challenger = db.getUser(guildId, userId);
    const opponent = db.getUser(guildId, opponentUserId);

    if (!opponent) {
      return res.status(404).json({ error: 'Oponente não encontrado.' });
    }

    if (challenger.balance < amount) {
      return res.status(400).json({ error: 'Não tens saldo suficiente na carteira.' });
    }

    // Bloquear moedas do desafiante
    challenger.balance -= amount;
    db.saveUser(guildId, userId, challenger);

    let opponentName = opponent.username || 'Jogador';
    if (discordClient) {
      const uObj = discordClient.users.cache.get(opponentUserId) || await discordClient.users.fetch(opponentUserId).catch(() => null);
      if (uObj) opponentName = uObj.username;
    }

    let challengerName = challenger.username || 'Jogador';
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) challengerName = uObj.username;
    }

    const duelId = 'd_' + Math.random().toString(36).substr(2, 9);
    const duel = {
      id: duelId,
      guildId,
      challengerId: userId,
      challengerName,
      opponentId: opponentUserId,
      opponentName,
      amount,
      status: 'pending'
    };

    activeDuels.set(duelId, duel);

    const systemEntry = {
      id: Date.now() + Math.random().toString(),
      userId: 'system',
      username: '⚔️ Duelos Casino',
      avatar: 'https://cdn-icons-png.flaticon.com/512/1069/1069800.png',
      message: `⚔️ [DESAFIO] @${challengerName} desafiou @${opponentName} para um duelo de Coinflip de ${amount.toLocaleString('pt-PT')} 🪙!`,
      duel: {
        id: duelId,
        challengerId: userId,
        opponentId: opponentUserId,
        amount
      },
      timestamp: Date.now()
    };

    db.addChatMessage(systemEntry);

    // Broadcast
    const ssePayload = `event: message\ndata: ${JSON.stringify(systemEntry)}\n\n`;
    chatClients.forEach(client => {
      try {
        client.write(ssePayload);
      } catch (err) {
        chatClients.delete(client);
      }
    });

    return res.json({ success: true, duelId });
  } catch (err) {
    console.error('Erro ao convidar para duelo:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/chat/duel/accept', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { duelId } = req.body;

    const duel = activeDuels.get(duelId);
    if (!duel) {
      return res.status(404).json({ error: 'Duelo não encontrado.' });
    }

    if (duel.status !== 'pending') {
      return res.status(400).json({ error: 'Este duelo já não está pendente.' });
    }

    if (duel.opponentId !== userId) {
      return res.status(403).json({ error: 'Apenas o oponente desafiado pode aceitar o duelo.' });
    }

    const opponent = db.getUser(guildId, userId);
    if (opponent.balance < duel.amount) {
      return res.status(400).json({ error: 'Não tens saldo suficiente na carteira.' });
    }

    // Deduzir moedas do oponente
    opponent.balance -= duel.amount;
    db.saveUser(guildId, userId, opponent);

    // Coinflip
    const win = Math.random() < 0.5; // true -> challenger ganha, false -> opponent ganha
    const winnerId = win ? duel.challengerId : duel.opponentId;
    const winnerName = win ? duel.challengerName : duel.opponentName;
    const loserName = win ? duel.opponentName : duel.challengerName;
    const payout = duel.amount * 2;

    const winner = db.getUser(guildId, winnerId);
    winner.balance += payout;
    db.saveUser(guildId, winnerId, winner);

    duel.status = 'accepted';
    activeDuels.delete(duelId);

    // Remover a opção de botão limpando a aposta na mensagem anterior do histórico
    const oldEntry = db.getChatHistory().find(h => h.duel && h.duel.id === duelId);
    if (oldEntry) oldEntry.duel = null;

    // Mensagem de sistema com resultado
    const systemEntry = {
      id: Date.now() + Math.random().toString(),
      userId: 'system',
      username: '⚔️ Duelos Casino',
      avatar: 'https://cdn-icons-png.flaticon.com/512/1069/1069800.png',
      message: `🏆 [VENCEDOR] @${duel.opponentName} aceitou o desafio! A moeda rodou... e deu vitória para @${winnerName}! Ganhou ${payout.toLocaleString('pt-PT')} 🪙! (Derrotado: @${loserName})`,
      timestamp: Date.now()
    };

    db.addChatMessage(systemEntry);

    // Broadcast
    const ssePayload = `event: message\ndata: ${JSON.stringify(systemEntry)}\n\n`;
    chatClients.forEach(client => {
      try {
        client.write(ssePayload);
      } catch (err) {
        chatClients.delete(client);
      }
    });

    db.pushHistory(guildId, duel.challengerId, { game: 'Duelo Coinflip Web', bet: duel.amount, net: win ? duel.amount : -duel.amount });
    db.pushHistory(guildId, duel.opponentId, { game: 'Duelo Coinflip Web', bet: duel.amount, net: !win ? duel.amount : -duel.amount });

    return res.json({ success: true, winnerName });
  } catch (err) {
    console.error('Erro ao aceitar duelo:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/chat/duel/decline', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { duelId } = req.body;

    const duel = activeDuels.get(duelId);
    if (!duel) {
      return res.status(404).json({ error: 'Duelo não encontrado.' });
    }

    if (duel.status !== 'pending') {
      return res.status(400).json({ error: 'Duelo já resolvido.' });
    }

    if (duel.opponentId !== userId && duel.challengerId !== userId) {
      return res.status(403).json({ error: 'Apenas os envolvidos podem cancelar ou recusar.' });
    }

    // Devolver moedas do desafiante
    const challenger = db.getUser(guildId, duel.challengerId);
    challenger.balance += duel.amount;
    db.saveUser(guildId, duel.challengerId, challenger);

    duel.status = 'declined';
    activeDuels.delete(duelId);

    // Limpar o objeto duel da mensagem do histórico para tirar os botões
    const oldEntry = db.getChatHistory().find(h => h.duel && h.duel.id === duelId);
    if (oldEntry) oldEntry.duel = null;

    const actionText = (userId === duel.opponentId) ? 'recusou' : 'cancelou';
    const systemEntry = {
      id: Date.now() + Math.random().toString(),
      userId: 'system',
      username: '⚔️ Duelos Casino',
      avatar: 'https://cdn-icons-png.flaticon.com/512/1069/1069800.png',
      message: `❌ [DUELO] O duelo de ${duel.amount.toLocaleString('pt-PT')} 🪙 entre @${duel.challengerName} e @${duel.opponentName} foi ${actionText}.`,
      timestamp: Date.now()
    };

    db.addChatMessage(systemEntry);

    // Broadcast
    const ssePayload = `event: message\ndata: ${JSON.stringify(systemEntry)}\n\n`;
    chatClients.forEach(client => {
      try {
        client.write(ssePayload);
      } catch (err) {
        chatClients.delete(client);
      }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao recusar duelo:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});
 
// --- Jogo de Blackjack Multiplayer Web ---
const bjTable = {
  players: [], // { userId, guildId, username, avatar, cards: [], bet, status: 'playing'|'stood'|'bust'|'blackjack', score: 0 }
  dealerCards: [],
  status: 'waiting', // waiting, betting, dealing, players_turn, dealer_turn, resolving
  currentPlayerIndex: 0,
  turnTimeLeft: 0,
  betTimeLeft: 0,
  resolveTimeLeft: 0,
  deck: []
};

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = [
    { name: 'A', value: 11 },
    { name: '2', value: 2 },
    { name: '3', value: 3 },
    { name: '4', value: 4 },
    { name: '5', value: 5 },
    { name: '6', value: 6 },
    { name: '7', value: 7 },
    { name: '8', value: 8 },
    { name: '9', value: 9 },
    { name: '10', value: 10 },
    { name: 'J', value: 10 },
    { name: 'Q', value: 10 },
    { name: 'K', value: 10 }
  ];
  let deck = [];
  for (let d = 0; d < 6; d++) {
    for (const suit of suits) {
      for (const val of values) {
        deck.push({ suit, name: val.name, val: val.value });
      }
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateHandScore(cards) {
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    score += card.val;
    if (card.name === 'A') aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

function advancePlayerTurn() {
  let nextIdx = bjTable.players.findIndex((p, idx) => idx > bjTable.currentPlayerIndex && p.status === 'playing');
  if (nextIdx === -1) {
    bjTable.status = 'dealer_turn';
    bjTable.turnTimeLeft = 0;
  } else {
    bjTable.currentPlayerIndex = nextIdx;
    bjTable.turnTimeLeft = 15;
  }
}

function resolvePayouts() {
  const dScore = calculateHandScore(bjTable.dealerCards);
  const dBust = dScore > 21;
  const dBJ = dScore === 21 && bjTable.dealerCards.length === 2;

  bjTable.players.forEach(async p => {
    const pScore = p.score;
    const pBJ = p.status === 'blackjack';
    
    if (pScore > 21) {
      p.payoutResult = 0;
      p.resultText = 'Rebentou (Bust)';
      return;
    }

    if (pBJ) {
      if (dBJ) {
        p.payoutResult = p.bet;
        p.resultText = 'Empate (Push)';
      } else {
        p.payoutResult = Math.round(p.bet * 2.5);
        p.resultText = 'Blackjack! 🎉';
      }
    } else {
      if (dBust) {
        p.payoutResult = p.bet * 2;
        p.resultText = 'Venceu! Dealer Rebentou';
      } else if (dBJ) {
        p.payoutResult = 0;
        p.resultText = 'Perdeu (Dealer BJ)';
      } else if (pScore > dScore) {
        p.payoutResult = p.bet * 2;
        p.resultText = 'Venceu! 🏆';
      } else if (pScore === dScore) {
        p.payoutResult = p.bet;
        p.resultText = 'Empate (Push)';
      } else {
        p.payoutResult = 0;
        p.resultText = 'Perdeu';
      }
    }

    const net = p.payoutResult - p.bet;
    if (p.payoutResult > 0) {
      const u = db.getUser(p.guildId, p.userId);
      u.balance += p.payoutResult;
      db.saveUser(p.guildId, p.userId, u);
    }
    db.pushHistory(p.guildId, p.userId, { game: 'Blackjack Online Web', bet: p.bet, net });
    db.addTournamentScore(p.guildId, p.userId, net);

    // Progressão
    try {
      const progression = require('./progression');
      const ctx = {
        guildId: p.guildId,
        userId: p.userId,
        member: null,
        client: discordClient,
        channelId: null,
        user: discordClient ? (discordClient.users.cache.get(p.userId) || await discordClient.users.fetch(p.userId).catch(() => null)) : null
      };
      await progression.applyProgressionFor(ctx, { game: 'Blackjack', bet: p.bet, net, won: net > 0, isWeb: true });
    } catch (e) {
      console.error("Erro na progressão do Blackjack:", e);
    }

    const cfg = db.getGuildConfig(p.guildId);
    if (net > 0 && (p.payoutResult >= cfg.bigWinThreshold || pBJ)) {
      const username = p.username || 'Jogador';
      const title = pBJ ? '🃏 BLACKJACK no Casino!' : '🃏 Vitória no Blackjack!';
      const msg = `**${username}** ganhou **${p.payoutResult.toLocaleString('pt-PT')} 🪙** no Blackjack!`;
      announceWebEvent(p.guildId, 'win', { title, message: msg, username, game: 'Blackjack', amount: p.payoutResult, bet: p.bet, isJackpot: pBJ });
    }
  });
}

function tickBlackjackTable() {
  try {
    if (bjTable.status === 'betting') {
      bjTable.betTimeLeft--;
      if (bjTable.betTimeLeft <= 0) {
        if (bjTable.players.length === 0) {
          bjTable.status = 'waiting';
        } else {
          bjTable.status = 'dealing';
          bjTable.deck = createDeck();
          
          bjTable.players.forEach(p => {
            p.cards = [bjTable.deck.pop(), bjTable.deck.pop()];
            p.score = calculateHandScore(p.cards);
            if (p.score === 21) {
              p.status = 'blackjack';
            } else {
              p.status = 'playing';
            }
          });

          bjTable.dealerCards = [bjTable.deck.pop(), bjTable.deck.pop()];

          let nextIdx = bjTable.players.findIndex(p => p.status === 'playing');
          if (nextIdx === -1) {
            bjTable.status = 'dealer_turn';
            bjTable.turnTimeLeft = 0;
          } else {
            bjTable.status = 'players_turn';
            bjTable.currentPlayerIndex = nextIdx;
            bjTable.turnTimeLeft = 15;
          }
        }
      }
    } else if (bjTable.status === 'players_turn') {
      bjTable.turnTimeLeft--;
      if (bjTable.turnTimeLeft <= 0) {
        const p = bjTable.players[bjTable.currentPlayerIndex];
        if (p) {
          p.status = 'stood';
        }
        advancePlayerTurn();
      }
    } else if (bjTable.status === 'dealer_turn') {
      const score = calculateHandScore(bjTable.dealerCards);
      if (score < 17) {
        bjTable.dealerCards.push(bjTable.deck.pop());
      } else {
        bjTable.status = 'resolving';
        bjTable.resolveTimeLeft = 10;
        resolvePayouts();
      }
    } else if (bjTable.status === 'resolving') {
      bjTable.resolveTimeLeft--;
      if (bjTable.resolveTimeLeft <= 0) {
        bjTable.players = [];
        bjTable.dealerCards = [];
        bjTable.status = 'waiting';
      }
    }
  } catch (err) {
    console.error('Erro no loop do Blackjack:', err);
  }
}

setInterval(tickBlackjackTable, 1000);

app.get('/api/blackjack/state', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  let visibleDealerCards = [...bjTable.dealerCards];
  if (bjTable.status === 'players_turn' && visibleDealerCards.length > 0) {
    visibleDealerCards[1] = { suit: '?', name: '?', val: 0 };
  }

  res.json({
    players: bjTable.players.map(p => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      cards: p.cards,
      bet: p.bet,
      status: p.status,
      score: p.score,
      payoutResult: p.payoutResult,
      resultText: p.resultText
    })),
    dealerCards: visibleDealerCards,
    dealerScore: bjTable.status === 'players_turn' ? (visibleDealerCards[0] ? visibleDealerCards[0].val : 0) : calculateHandScore(bjTable.dealerCards),
    status: bjTable.status,
    currentPlayerIndex: bjTable.currentPlayerIndex,
    turnTimeLeft: bjTable.turnTimeLeft,
    betTimeLeft: bjTable.betTimeLeft,
    resolveTimeLeft: bjTable.resolveTimeLeft,
    currentPlayerUserId: bjTable.players[bjTable.currentPlayerIndex] ? bjTable.players[bjTable.currentPlayerIndex].userId : null
  });
});

app.post('/api/blackjack/join', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { bet } = req.body;

    if (isNaN(bet) || bet <= 0) {
      return res.status(400).json({ error: 'Aposta inválida.' });
    }

    if (bjTable.status !== 'waiting' && bjTable.status !== 'betting') {
      return res.status(400).json({ error: 'A mesa não está em fase de apostas.' });
    }

    if (bjTable.players.some(p => p.userId === userId)) {
      return res.status(400).json({ error: 'Já estás sentado nesta mesa.' });
    }

    const u = db.getUser(guildId, userId);
    if (u.balance < bet) {
      return res.status(400).json({ error: 'Não tens moedas suficientes.' });
    }

    let username = u.username || 'Jogador';
    let avatar = 'https://discord.com/assets/c09a8c6637e654c9e832190a2d44b40a.png';
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) {
        username = uObj.username;
        avatar = uObj.avatarURL({ extension: 'png', size: 128 }) || `https://cdn.discordapp.com/embed/avatars/${parseInt(uObj.discriminator) % 5}.png`;
      }
    }

    u.balance -= bet;
    db.saveUser(guildId, userId, u);

    bjTable.players.push({
      userId,
      guildId,
      username,
      avatar,
      cards: [],
      bet,
      status: 'waiting',
      score: 0
    });

    if (bjTable.status === 'waiting') {
      bjTable.status = 'betting';
      bjTable.betTimeLeft = 20;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao entrar no blackjack:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/blackjack/hit', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { userId } = session;

    if (bjTable.status !== 'players_turn') {
      return res.status(400).json({ error: 'Não é a vez dos jogadores.' });
    }

    const currentPlayer = bjTable.players[bjTable.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return res.status(403).json({ error: 'Não é a tua vez de jogar.' });
    }

    const card = bjTable.deck.pop();
    currentPlayer.cards.push(card);
    currentPlayer.score = calculateHandScore(currentPlayer.cards);

    if (currentPlayer.score > 21) {
      currentPlayer.status = 'bust';
      advancePlayerTurn();
    } else if (currentPlayer.score === 21) {
      currentPlayer.status = 'stood';
      advancePlayerTurn();
    } else {
      bjTable.turnTimeLeft = 15;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao pedir carta:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/blackjack/stand', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { userId } = session;

    if (bjTable.status !== 'players_turn') {
      return res.status(400).json({ error: 'Não é a vez dos jogadores.' });
    }

    const currentPlayer = bjTable.players[bjTable.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.userId !== userId) {
      return res.status(403).json({ error: 'Não é a tua vez de jogar.' });
    }

    currentPlayer.status = 'stood';
    advancePlayerTurn();

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao parar turno:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
 
let sseClients = [];

app.get('/api/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('Token em falta');
  
  const { verifyToken } = require('./webTokens');
  const payload = verifyToken(token);
  if (!payload) return res.status(401).send('Token inválido');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const clientObj = { res, userId: payload.userId, guildId: payload.guildId };
  sseClients.push(clientObj);
  
  req.on('close', () => {
    sseClients = sseClients.filter(c => c.res !== res);
  });
});

function broadcastToGuild(guildId, eventType, data) {
  const payload = JSON.stringify({ type: eventType, data });
  sseClients.forEach(c => {
    if (c.guildId === guildId) {
      try {
        c.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        // Ignora erros de escrita em ligações fechadas
      }
    }
  });
}

function broadcastChatToWeb(guildId, msg) {
  const ssePayload = `event: message\ndata: ${JSON.stringify(msg)}\n\n`;
  chatClients.forEach(client => {
    try {
      client.write(ssePayload);
    } catch (err) {
      chatClients.delete(client);
    }
  });
}

// --- Jogo de Roleta Multiplayer Web ---
const rMultiTable = {
  status: 'betting', // 'betting' | 'spinning' | 'resolving'
  timeLeft: 30, // segundos para apostar / rodar / mostrar resultados
  lastSpin: null,
  lastColor: null,
  bets: [], // { userId, guildId, username, bet, type, number }
  history: [] // { spin, color }
};

function tickRouletteTable() {
  try {
    if (rMultiTable.status === 'betting') {
      rMultiTable.timeLeft--;
      if (rMultiTable.timeLeft <= 0) {
        rMultiTable.status = 'spinning';
        rMultiTable.timeLeft = 6; // 6 segundos de rotação
        
        // Gerar número vencedor da roleta
        const spin = Math.floor(Math.random() * 37);
        const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
        const color = spin === 0 ? 'verde' : (RED_NUMBERS.has(spin) ? 'vermelho' : 'preto');
        rMultiTable.lastSpin = spin;
        rMultiTable.lastColor = color;
      }
    } else if (rMultiTable.status === 'spinning') {
      rMultiTable.timeLeft--;
      if (rMultiTable.timeLeft <= 0) {
        rMultiTable.status = 'resolving';
        rMultiTable.timeLeft = 6; // 6 segundos para ver resultados
        
        const spin = rMultiTable.lastSpin;
        const color = rMultiTable.lastColor;
        
        // Resolver apostas
        rMultiTable.bets.forEach(async (b) => {
          let won = false;
          let mult = 0;
          if (b.type === 'vermelho' && color === 'vermelho') { won = true; mult = 2; }
          else if (b.type === 'preto' && color === 'preto') { won = true; mult = 2; }
          else if (b.type === 'par' && spin !== 0 && spin % 2 === 0) { won = true; mult = 2; }
          else if (b.type === 'impar' && spin % 2 !== 0) { won = true; mult = 2; }
          else if (b.type === 'coluna1' && [1,4,7,10,13,16,19,22,25,28,31,34].includes(spin)) { won = true; mult = 3; }
          else if (b.type === 'coluna2' && [2,5,8,11,14,17,20,23,26,29,32,35].includes(spin)) { won = true; mult = 3; }
          else if (b.type === 'coluna3' && [3,6,9,12,15,18,21,24,27,30,33,36].includes(spin)) { won = true; mult = 3; }
          else if (b.type === 'numero' && spin === parseInt(b.number, 10)) { won = true; mult = 35; }
          
          const winnings = won ? b.bet * mult : 0;
          const net = winnings - b.bet;
          
          // O saldo da aposta já foi deduzido na criação, por isso adicionamos o winnings
          if (winnings > 0) {
            db.addBalance(b.guildId, b.userId, winnings);
          }
          db.recordResult(b.guildId, b.userId, won, b.bet);
          db.addTournamentScore(b.guildId, b.userId, net);
          
          // Progressão
          try {
            const progression = require('./progression');
            const ctx = {
              guildId: b.guildId,
              userId: b.userId,
              member: null,
              client: discordClient,
              channelId: null,
              user: discordClient ? (discordClient.users.cache.get(b.userId) || await discordClient.users.fetch(b.userId).catch(() => null)) : null
            };
            await progression.applyProgressionFor(ctx, { game: 'Roleta Multijogador', bet: b.bet, net, won, isWeb: true });
          } catch(e) {}

          const cfg = db.getGuildConfig(b.guildId);
          if (won && (winnings >= cfg.bigWinThreshold || b.type === 'numero')) {
            const colorEmoji = { vermelho: '🔴', preto: '⚫', verde: '🟢' }[color];
            const title = b.type === 'numero' ? '🎰 VITÓRIA RARA na Roleta Multi!' : '🎉 Ganho na Roleta Multi!';
            const msg = `🎉 **${b.username}** ganhou **${winnings} 🪙** na Roleta Multijogador (Bola caiu no ${spin} ${colorEmoji}, aposta: ${b.type})!`;
            announceWebEvent(b.guildId, 'win', { title, message: msg, username: b.username, game: 'Roleta Multi', amount: winnings, bet: b.bet, isJackpot: (b.type === 'numero') });
          }
        });
        
        // Histórico
        rMultiTable.history.unshift({ spin, color });
        if (rMultiTable.history.length > 8) rMultiTable.history.pop();
      }
    } else if (rMultiTable.status === 'resolving') {
      rMultiTable.timeLeft--;
      if (rMultiTable.timeLeft <= 0) {
        rMultiTable.status = 'betting';
        rMultiTable.timeLeft = 30;
        rMultiTable.bets = [];
      }
    }
  } catch (err) {
    console.error('Erro no loop do Roulette Multi:', err);
  }
}

setInterval(tickRouletteTable, 1000);

// Endpoint de Estado
app.get('/api/games/roulette-multi/state', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  // Ocultar o número vencedor durante a aposta ou rotação para evitar cheats
  const hideResult = rMultiTable.status === 'betting' || rMultiTable.status === 'spinning';
  
  return res.json({
    status: rMultiTable.status,
    timeLeft: rMultiTable.timeLeft,
    lastSpin: hideResult ? null : rMultiTable.lastSpin,
    lastColor: hideResult ? null : rMultiTable.lastColor,
    bets: rMultiTable.bets,
    history: rMultiTable.history
  });
});

// Endpoint de Aposta
app.post('/api/games/roulette-multi/bet', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { bet, type, number } = req.body;
    
    const cfg = db.getGuildConfig(guildId);
    const user = db.getUser(guildId, userId);

    if (rMultiTable.status !== 'betting') {
      return res.status(400).json({ error: 'As apostas já fecharam para esta rodada.' });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return res.status(400).json({ error: `A aposta deve estar entre ${cfg.minBet} e ${cfg.maxBet} 🪙` });
    }
    if (user.balance < bet) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }
    
    // Evitar apostas duplicadas por utilizador na mesma rodada para simplificar
    if (rMultiTable.bets.some(b => b.userId === userId)) {
      return res.status(400).json({ error: 'Já tens uma aposta ativa nesta rodada.' });
    }

    let uName = user.username || userId;
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) uName = uObj.username;
    }

    // Deduzir o saldo imediatamente da aposta
    db.addBalance(guildId, userId, -bet);

    rMultiTable.bets.push({
      userId,
      guildId,
      username: uName,
      bet,
      type,
      number: type === 'numero' ? parseInt(number, 10) : null
    });

    return res.json({
      success: true,
      balance: db.getUser(guildId, userId).balance
    });

  } catch (err) {
    console.error("Erro ao apostar na Roleta Multi:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado no servidor web:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});
 
// ─── Global Event Announcer ────────────────────────────────────────────────────
// Announces wins, level-ups, and purchases to:
// 1) All web clients via SSE (pop-up alert on the side)
// 2) The configured Discord announcement channel
// 3) The web global chat as a system message
async function announceWebEvent(guildId, eventType, details) {
  try {
    let resolvedUsername = details.username;
    if (resolvedUsername && /^\d+$/.test(resolvedUsername)) {
      const dbUser = db.getUser(guildId, resolvedUsername);
      if (dbUser && dbUser.username && !/^\d+$/.test(dbUser.username)) {
        resolvedUsername = dbUser.username;
      }
    }
    
    if (details.message && details.username && /^\d+$/.test(details.username) && resolvedUsername !== details.username) {
      details.message = details.message.replace(new RegExp(details.username, 'g'), resolvedUsername);
    }
    
    details.username = resolvedUsername;

    if (eventType === 'win') {
      globalWins.unshift({
        username: details.username,
        game: details.game,
        amount: details.amount,
        bet: details.bet,
        timestamp: Date.now()
      });
      if (globalWins.length > 20) {
        globalWins.pop();
      }
    }

    // 1. SSE Broadcast to all web clients in this guild (lateral pop-up)
    broadcastToGuild(guildId, 'game_win_alert', { eventType, ...details });

    let shouldAnnouncePublicly = true;
    if (eventType === 'win') {
      const cfg = db.getGuildConfig(guildId);
      const isJackpot = !!details.isJackpot;
      const isBigWin = details.amount >= (cfg.bigWinThreshold || 1000);
      shouldAnnouncePublicly = isJackpot || isBigWin;
    }

    if (shouldAnnouncePublicly) {
      // 2. Web chat system message
      const systemMsg = {
        userId: 'system',
        username: '🎰 Casino',
        content: details.message || '🎉 Evento no casino!',
        timestamp: Date.now(),
        isSystem: true,
      };
      db.addChatMessage(systemMsg);
      broadcastChatToWeb(guildId, systemMsg);

      // 3. Discord announcement channel (if configured)
      if (discordClient) {
        const cfg = db.getGuildConfig(guildId);
        const channelId = cfg.announcementChannelId;
        if (channelId) {
          try {
            const ch = await discordClient.channels.fetch(channelId);
            if (ch) {
              const { EmbedBuilder } = require('discord.js');
              const color = eventType === 'win' ? 0x57F287 : eventType === 'levelup' ? 0xFACA2B : 0x5865F2;
              const emoji = eventType === 'win' ? '🎉' : eventType === 'levelup' ? '⬆️' : '🛒';
              const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${emoji} ${details.title || 'Evento no Casino'}`)
                .setDescription(details.message || '')
                .setTimestamp()
                .setFooter({ text: 'Casino Arena Web' });
              await ch.send({ embeds: [embed] });
            }
          } catch (err) {
            // Canal pode não existir ou bot sem permissão
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao anunciar evento web:', err);
  }
}

// ==========================================
// 👥 JOGO DE ROLETA RUSSA MULTIPLAYER WEB 👥
// ==========================================
const russaRooms = new Map(); // roomId -> roomState

function tickRussaRooms() {
  try {
    for (const [roomId, room] of russaRooms.entries()) {
      if (room.status === 'waiting') {
        // If at least 2 players are in, start lobby countdown
        if (room.players.length >= 2) {
          room.lobbyCountdown--;
          if (room.lobbyCountdown <= 0) {
            room.status = 'playing';
            room.turnIdx = 0;
            room.timer = 15;
            room.bulletChamber = Math.floor(Math.random() * 6);
            room.currentChamber = 0;
            room.history.push("🔫 O jogo começou! O tambor foi girado. Quem puxa primeiro?");
          }
        } else {
          room.lobbyCountdown = 10; // reset
        }
      } 
      else if (room.status === 'playing') {
        room.timer--;
        if (room.timer <= 0) {
          // Timeout! Force trigger pull for the current player
          executeRussaPull(roomId, true);
        }
      } 
      else if (room.status === 'finished') {
        room.cleanupTimer--;
        if (room.cleanupTimer <= 0) {
          russaRooms.delete(roomId);
        }
      }
    }
  } catch (err) {
    console.error("Erro no ticker da Roleta Russa Multi:", err);
  }
}

async function executeRussaPull(roomId, isTimeout = false) {
  const room = russaRooms.get(roomId);
  if (!room || room.status !== 'playing') return;

  const activePlayer = room.players[room.turnIdx];
  if (!activePlayer) return;

  const displayName = activePlayer.username;
  const isBullet = room.currentChamber === room.bulletChamber;
  
  if (isBullet) {
    // 💥 BANG! Player is eliminated
    activePlayer.status = 'dead';
    room.history.push(`💥 [ELIMINADO] @${displayName} puxou o gatilho... BANG! Eliminado da mesa.`);
    
    // Check remaining alive players
    const alivePlayers = room.players.filter(p => p.status === 'alive');
    if (alivePlayers.length === 1) {
      // 🏆 Winner found!
      const winner = alivePlayers[0];
      room.status = 'finished';
      room.winner = winner.username;
      room.cleanupTimer = 10; // Delete room after 10s
      room.history.push(`🏆 [VENCEDOR] @${winner.username} sobreviveu à Roleta Russa e ganhou o pote de ${room.pot.toLocaleString('pt-PT')} 🪙!`);

      // Pay winner
      try {
        const u = db.getUser(room.guildId, winner.userId);
        u.balance += room.pot;
        db.saveUser(room.guildId, winner.userId, u);
        
        db.recordResult(room.guildId, winner.userId, true, room.bet);
        db.addTournamentScore(room.guildId, winner.userId, room.pot - room.bet);
        
        const ctx = { guildId: room.guildId, userId: winner.userId, member: null, client: discordClient, channelId: null, user: null };
        const progression = require('./progression');
        await progression.applyProgressionFor(ctx, { game: 'Roleta Russa Multiplayer', bet: room.bet, net: room.pot - room.bet, won: true, isWeb: true });

        // Announcement
        announceWebEvent(room.guildId, 'win', {
          title: '🔫 Sobrevivente da Roleta Russa!',
          message: `👑 **${winner.username}** sobreviveu à Roleta Russa Multiplayer de **${room.bet.toLocaleString('pt-PT')} 🪙** e levou o pote de **${room.pot.toLocaleString('pt-PT')} 🪙**!`,
          username: winner.username,
          game: 'Roleta Russa Multi',
          amount: room.pot,
          bet: room.bet
        });
      } catch(e) {
        console.error("Erro ao pagar vencedor de russa multi:", e);
      }
    } else {
      // Gun reloads with 1 bullet in 6 chambers
      room.bulletChamber = Math.floor(Math.random() * 6);
      room.currentChamber = 0;
      room.history.push("🔄 O revólver foi recarregado e o tambor girado. O jogo continua!");
      advanceRussaTurn(room);
    }
  } else {
    // 🟢 CLICK! Player survives
    room.history.push(`🍀 [SEGURO] @${displayName} puxou o gatilho... click! Sobreviveu.`);
    room.currentChamber++;
    advanceRussaTurn(room);
  }
}

function advanceRussaTurn(room) {
  let nextIdx = room.turnIdx;
  for (let i = 0; i < room.players.length; i++) {
    nextIdx = (nextIdx + 1) % room.players.length;
    if (room.players[nextIdx].status === 'alive') {
      room.turnIdx = nextIdx;
      room.timer = 15;
      return;
    }
  }
}

// Russian Roulette Multiplayer API Endpoints
app.get('/api/games/russa-multi/rooms', (req, res) => {
  const list = Array.from(russaRooms.values()).map(r => ({
    id: r.id,
    bet: r.bet,
    status: r.status,
    players: r.players.map(p => ({ username: p.username, avatar: p.avatar, status: p.status }))
  }));
  return res.json(list);
});

app.get('/api/games/russa-multi/state/:roomId', (req, res) => {
  const room = russaRooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
  return res.json({
    id: room.id,
    bet: room.bet,
    pot: room.pot,
    status: room.status,
    players: room.players,
    turnIdx: room.turnIdx,
    timer: room.timer,
    winner: room.winner,
    currentChamber: room.currentChamber,
    history: room.history
  });
});

app.post('/api/games/russa-multi/join', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { bet, roomId } = req.body;

    const user = db.getUser(guildId, userId);
    
    let room;
    if (roomId) {
      room = russaRooms.get(roomId);
      if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
      if (room.status !== 'waiting') return res.status(400).json({ error: 'Esta sala já iniciou o jogo.' });
      if (room.players.length >= 6) return res.status(400).json({ error: 'Esta sala está cheia.' });
      if (room.players.some(p => p.userId === userId)) return res.status(400).json({ error: 'Já estás nesta sala.' });
      if (user.balance < room.bet) return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
      
      user.balance -= room.bet;
      db.saveUser(guildId, userId, user);

      room.players.push({
        userId,
        username: user.username || userId,
        avatar: user.avatar || 'https://discord.com/assets/c09a8c6637e654c9e832190a2d44b40a.png',
        status: 'alive'
      });
      room.pot += room.bet;
      room.history.push(`📥 @${user.username || userId} entrou na sala.`);
      
      // Start immediately if full
      if (room.players.length === 6) {
        room.status = 'playing';
        room.turnIdx = 0;
        room.timer = 15;
        room.bulletChamber = Math.floor(Math.random() * 6);
        room.currentChamber = 0;
        room.history.push("🔫 A sala encheu! O jogo começou! O tambor foi girado.");
      }
    } else {
      // Create room
      if (isNaN(bet) || bet < 100) return res.status(400).json({ error: 'Aposta mínima de 100 moedas.' });
      if (user.balance < bet) return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });

      user.balance -= bet;
      db.saveUser(guildId, userId, user);

      const newRoomId = 'ru_' + Math.random().toString(36).substr(2, 9);
      room = {
        id: newRoomId,
        guildId,
        bet,
        pot: bet,
        status: 'waiting',
        lobbyCountdown: 10,
        players: [{
          userId,
          username: user.username || userId,
          avatar: user.avatar || 'https://discord.com/assets/c09a8c6637e654c9e832190a2d44b40a.png',
          status: 'alive'
        }],
        turnIdx: 0,
        timer: 15,
        bulletChamber: 0,
        currentChamber: 0,
        winner: null,
        history: [`📥 @${user.username || userId} criou a sala com aposta de ${bet.toLocaleString('pt-PT')} 🪙.`]
      };
      russaRooms.set(newRoomId, room);
    }

    announceWebEvent(guildId, 'balance_update', { userId, balance: user.balance });
    return res.json({ success: true, roomId: room.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao entrar na sala.' });
  }
});

app.post('/api/games/russa-multi/pull', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { roomId } = req.body;
    const room = russaRooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });
    if (room.status !== 'playing') return res.status(400).json({ error: 'O jogo não está em curso.' });

    const activePlayer = room.players[room.turnIdx];
    if (activePlayer.userId !== session.userId) {
      return res.status(403).json({ error: 'Não é o teu turno!' });
    }

    await executeRussaPull(roomId, false);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
});

app.post('/api/games/russa-multi/leave', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { roomId } = req.body;
    const room = russaRooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Sala não encontrada.' });

    const pIdx = room.players.findIndex(p => p.userId === session.userId);
    if (pIdx !== -1) {
      const p = room.players[pIdx];
      room.players.splice(pIdx, 1);
      
      // Refund if waiting
      if (room.status === 'waiting') {
        const u = db.getUser(room.guildId, session.userId);
        u.balance += room.bet;
        db.saveUser(room.guildId, session.userId, u);
        room.pot -= room.bet;
        announceWebEvent(room.guildId, 'balance_update', { userId: session.userId, balance: u.balance });
      }

      room.history.push(`📤 @${p.username} saiu da sala.`);

      if (room.players.length === 0) {
        russaRooms.delete(roomId);
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao sair.' });
  }
});

// ==========================================
// 📈 JOGO DE CRASH MULTIPLAYER WEB 📈
// ==========================================
const crashState = {
  status: 'betting', // 'betting' | 'climbing' | 'crashed'
  timeLeft: 10.0, // Countdown para apostas ou ver resultado
  multiplier: 1.0,
  bets: [], // { userId, guildId, username, bet, autoCashout, cashedOut, cashedAt }
  history: [1.54, 2.80, 1.12, 4.50, 1.05, 8.43, 2.10, 1.35], // últimos crashpoints
  crashPoint: 1.0,
  startTime: null
};

function tickCrash() {
  try {
    if (crashState.status === 'betting') {
      crashState.timeLeft -= 0.1;
      if (crashState.timeLeft <= 0) {
        // Start round!
        crashState.status = 'climbing';
        crashState.startTime = Date.now();
        crashState.multiplier = 1.0;
        
        // Calculate crashpoint with standard house edge formula
        const rand = Math.random();
        // 3% chance of instant crash at 1.00
        crashState.crashPoint = rand < 0.03 ? 1.00 : parseFloat((0.98 / (1 - rand)).toFixed(2));
      }
    } 
    else if (crashState.status === 'climbing') {
      const elapsed = (Date.now() - crashState.startTime) / 1000;
      // Exponential rise formula: multiplier increases by 7.5% per second
      crashState.multiplier = parseFloat(Math.pow(Math.E, 0.075 * elapsed).toFixed(2));

      // Check auto-cashouts for players still in
      crashState.bets.forEach(async (b) => {
        if (!b.cashedOut && b.autoCashout && crashState.multiplier >= b.autoCashout) {
          if (b.autoCashout <= crashState.crashPoint) {
            await executeCrashCashout(b.userId, b.autoCashout);
          }
        }
      });

      // Check if crashed
      if (crashState.multiplier >= crashState.crashPoint) {
        crashState.multiplier = crashState.crashPoint;
        crashState.status = 'crashed';
        crashState.timeLeft = 5.0; // 5 segundos para ver crashpoint

        // Add to history
        crashState.history.unshift(crashState.crashPoint);
        if (crashState.history.length > 10) crashState.history.pop();
        
        // Save database statistics for lost bets
        crashState.bets.forEach(b => {
          if (!b.cashedOut) {
            db.recordResult(b.guildId, b.userId, false, b.bet);
            db.addTournamentScore(b.guildId, b.userId, -b.bet);
            
            const ctx = { guildId: b.guildId, userId: b.userId, member: null, client: discordClient, channelId: null, user: null };
            const progression = require('./progression');
            progression.applyProgressionFor(ctx, { game: 'Crash Multiplayer', bet: b.bet, net: -b.bet, won: false, isWeb: true }).catch(console.error);
          }
        });
      }
    } 
    else if (crashState.status === 'crashed') {
      crashState.timeLeft -= 0.1;
      if (crashState.timeLeft <= 0) {
        // Restart cycle
        crashState.status = 'betting';
        crashState.timeLeft = 10.0;
        crashState.multiplier = 1.0;
        crashState.bets = [];
      }
    }
  } catch (err) {
    console.error("Erro no ticker do Crash Multi:", err);
  }
}

async function executeCrashCashout(userId, cashoutMultiplier) {
  const bet = crashState.bets.find(b => b.userId === userId && !b.cashedOut);
  if (!bet) return null;

  bet.cashedOut = true;
  bet.cashedAt = cashoutMultiplier;
  
  const winnings = Math.round(bet.bet * cashoutMultiplier);
  const net = winnings - bet.bet;

  try {
    const user = db.getUser(bet.guildId, userId);
    user.balance += winnings;
    db.saveUser(bet.guildId, userId, user);

    db.recordResult(bet.guildId, userId, true, bet.bet);
    db.addTournamentScore(bet.guildId, userId, net);

    const ctx = { guildId: bet.guildId, userId, member: null, client: discordClient, channelId: null, user: null };
    const progression = require('./progression');
    await progression.applyProgressionFor(ctx, { game: 'Crash Multiplayer', bet: bet.bet, net, won: true, isWeb: true });

    // Announce big wins
    const cfg = db.getGuildConfig(bet.guildId);
    if (winnings >= cfg.bigWinThreshold) {
      announceWebEvent(bet.guildId, 'win', {
        title: '📈 Multiplicador do Crash batido!',
        message: `🚀 **${bet.username}** retirou a **x${cashoutMultiplier.toFixed(2)}** no Crash Multiplayer e ganhou **${winnings.toLocaleString('pt-PT')} 🪙**!`,
        username: bet.username,
        game: 'Crash Multi',
        amount: winnings,
        bet: bet.bet
      });
    }

    announceWebEvent(bet.guildId, 'balance_update', { userId, balance: user.balance });
    return winnings;
  } catch (err) {
    console.error("Erro ao processar cashout de crash multi:", err);
    return null;
  }
}

// Multiplayer Crash API Endpoints
app.get('/api/games/crash-multi/state', (req, res) => {
  return res.json({
    status: crashState.status,
    timeLeft: crashState.timeLeft,
    multiplier: crashState.multiplier,
    history: crashState.history,
    bets: crashState.bets.map(b => ({
      userId: b.userId,
      username: b.username,
      bet: b.bet,
      cashedOut: b.cashedOut,
      cashedAt: b.cashedAt
    }))
  });
});

app.post('/api/games/crash-multi/bet', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    const { guildId, userId } = session;
    const { bet, autoCashout } = req.body;

    if (crashState.status !== 'betting') {
      return res.status(400).json({ error: 'Apostas fechadas para esta ronda.' });
    }

    if (isNaN(bet) || bet < 10) {
      return res.status(400).json({ error: 'Aposta mínima de 10 moedas.' });
    }

    if (crashState.bets.some(b => b.userId === userId)) {
      return res.status(400).json({ error: 'Já apostaste nesta ronda.' });
    }

    const user = db.getUser(guildId, userId);
    if (user.balance < bet) {
      return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
    }

    user.balance -= bet;
    db.saveUser(guildId, userId, user);

    crashState.bets.push({
      userId,
      guildId,
      username: user.username || userId,
      bet,
      autoCashout: autoCashout ? parseFloat(autoCashout) : null,
      cashedOut: false,
      cashedAt: null
    });

    announceWebEvent(guildId, 'balance_update', { userId, balance: user.balance });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registar aposta.' });
  }
});

app.post('/api/games/crash-multi/cashout', async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Não autorizado.' });

    if (crashState.status !== 'climbing') {
      return res.status(400).json({ error: 'Cashout indisponível.' });
    }

    const bet = crashState.bets.find(b => b.userId === session.userId && !b.cashedOut);
    if (!bet) {
      return res.status(400).json({ error: 'Nenhuma aposta ativa para cashout.' });
    }

    const winnings = await executeCrashCashout(session.userId, crashState.multiplier);
    if (winnings !== null) {
      return res.json({ success: true, winnings, cashedAt: crashState.multiplier });
    } else {
      return res.status(400).json({ error: 'Erro ao processar cashout.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Run multiplayer tickers
setInterval(tickRussaRooms, 1000);
setInterval(tickCrash, 100);

function startServer(port, client) {
  discordClient = client;
  app.listen(port, () => {
    console.log(`Servidor web ativo na porta ${port}`);
  });
}
 
module.exports = { startServer, broadcastToGuild, broadcastChatToWeb, announceWebEvent };