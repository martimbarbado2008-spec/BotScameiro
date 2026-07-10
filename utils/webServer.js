const express = require('express');
const db = require('./database');
const webTokens = require('./webTokens');
 
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

const sessions = new Map();
const activeJobs = new Map();

function getSession(req) {
  if (!req.headers.cookie) return null;
  const cookies = Object.fromEntries(
    req.headers.cookie.split('; ').map(c => {
      const parts = c.split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );
  const token = cookies.session_token;
  if (!token) return null;
  return sessions.get(token) || null;
}

function createSession(guildId, userId) {
  const crypto = require('crypto');
  const sessionToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionToken, { guildId, userId });
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
  
  res.setHeader('Set-Cookie', `session_token=${sessionToken}; Path=/; Max-Age=${24 * 60 * 60}; HttpOnly`);
  res.redirect(redirectUrl);
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
    if (discordClient) {
      const uObj = discordClient.users.cache.get(targetUserId) || await discordClient.users.fetch(targetUserId).catch(() => null);
      if (uObj) {
        username = uObj.username;
        avatar = uObj.displayAvatarURL({ size: 128 }) || uObj.defaultAvatarURL;
      }
    }

    const { ACHIEVEMENTS } = require('./progression');

    return res.json({
      guildId,
      userId: targetUserId,
      username,
      avatar,
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
    if (!session) {
      return res.status(401).json({ error: 'Não autorizado. Faz login de novo.' });
    }

    const { guildId } = session;
    const rawLeaderboard = db.getLeaderboard(guildId, 100); // obter top 100
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
    if (discordClient) {
      const uObj = discordClient.users.cache.get(userId) || await discordClient.users.fetch(userId).catch(() => null);
      if (uObj) {
        username = uObj.username;
        avatar = uObj.displayAvatarURL({ size: 128 }) || uObj.defaultAvatarURL;
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

    const { ACHIEVEMENTS } = require('./progression');
    const { ITEMS } = require('../commands/shop');

    const workCooldown = db.getCooldown(guildId, userId, 'trabalhar');
    const pescaCooldown = db.getCooldown(guildId, userId, 'pescar');
    const hackCooldown = db.getCooldown(guildId, userId, 'hackear');

    return res.json({
      guildId,
      userId,
      username,
      avatar,
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
      cryptoPrices: prices,
      cryptoHoldings: user.crypto || { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 },
      allAchievements: ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc })),
      shopItems: ITEMS,
      cooldowns: {
        work: workCooldown,
        pesca: pescaCooldown,
        hack: hackCooldown
      }
    });
  } catch (err) {
    console.error('Erro em /api/dashboard/data:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
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

app.post('/api/crypto/trade', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  const { guildId, userId } = session;
  const { action, coin, amount } = req.body;

  if (!['buy', 'sell'].includes(action) || !['BTC', 'ETH', 'SOL', 'DOGE'].includes(coin) || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Parâmetros inválidos.' });
  }

  const prices = db.getCryptoPrices();
  const price = prices[coin];

  if (action === 'buy') {
    const cost = Math.round(amount * price);
    const user = db.getUser(guildId, userId);
    if (user.balance < cost) {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    const result = db.buyCrypto(guildId, userId, coin, amount, price);
    db.pushHistory(guildId, userId, { game: `Crypto Buy (${coin})`, bet: cost, net: -cost });
    return res.json({ success: true, balance: result.balance, holdings: result.holdings });
  } else {
    const user = db.getUser(guildId, userId);
    if (!user.crypto || (user.crypto[coin] || 0) < amount) {
      return res.status(400).json({ error: 'Holdings insuficientes.' });
    }
    const result = db.sellCrypto(guildId, userId, coin, amount, price);
    const gain = Math.round(amount * price);
    db.pushHistory(guildId, userId, { game: `Crypto Sell (${coin})`, bet: 0, net: gain });
    return res.json({ success: true, balance: result.balance, holdings: result.holdings });
  }
});

app.post('/api/jobs/start', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Não autorizado.' });

  const { guildId, userId } = session;
  const { job } = req.body;
  if (!['trabalhar', 'pesca', 'hack'].includes(job)) {
    return res.status(400).json({ error: 'Trabalho inválido.' });
  }

  const cooldownKey = job === 'trabalhar' ? 'trabalhar' : (job === 'pesca' ? 'pescar' : 'hackear');
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
 
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
 
app.use((err, req, res, next) => {
  console.error('Erro não tratado no servidor web:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});
 
function startServer(port, client) {
  discordClient = client;
  app.listen(port, () => {
    console.log(`Servidor web ativo na porta ${port}`);
  });
}
 
module.exports = { startServer };