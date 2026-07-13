const { Redis } = require("@upstash/redis");

// Liga à base de dados na nuvem usando as variáveis de ambiente do Render
const hasRedisCreds = process.env.REDIS_URL && process.env.REDIS_TOKEN;
const redis = hasRedisCreds ? new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN
}) : null;

// Variáveis locais para que o bot continue a ler os dados instantaneamente
let users = {};
let guilds = {};
let tournaments = {};
let lotteries = {};
let cryptoPrices = {};
let footballMatches = {};
let footballBets = {};
let chatHistory = [];
let webSessions = {};

// Função para descarregar os dados da nuvem assim que o bot liga
async function initDatabase() {
  if (!redis) {
    console.warn("⚠️ REDIS_URL ou REDIS_TOKEN ausentes no ambiente. O bot funcionará com base de dados vazia em memória.");
    return;
  }
  try {
    console.log("A carregar dados do Upstash Redis...");
    users = (await redis.get("casino:users")) || {};
    guilds = (await redis.get("casino:guilds")) || {};
    tournaments = (await redis.get("casino:tournaments")) || {};
    lotteries = (await redis.get("casino:lotteries")) || {};
    cryptoPrices = (await redis.get("casino:crypto")) || { BTC: 50000, ETH: 3000, SOL: 150, DOGE: 0.1 };
    footballMatches = (await redis.get("casino:football:matches")) || {};
    footballBets = (await redis.get("casino:football:bets")) || {};
    chatHistory = (await redis.get("casino:chat:history")) || [];
    webSessions = (await redis.get("casino:websessions")) || {};
    console.log("Dados carregados com sucesso da Nuvem!");
  } catch (err) {
    console.error("Erro ao carregar dados do Redis:", err);
  }
}
initDatabase();

let saveTimeout = null;
function persist() {
  if (!redis) return;
  // Agrupa as escritas para não sobrecarregar a rede a cada jogada
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    try {
      await redis.set("casino:users", users);
      await redis.set("casino:guilds", guilds);
      await redis.set("casino:tournaments", tournaments);
      await redis.set("casino:lotteries", lotteries);
      await redis.set("casino:crypto", cryptoPrices);
      await redis.set("casino:football:matches", footballMatches);
      await redis.set("casino:football:bets", footballBets);
      await redis.set("casino:chat:history", chatHistory);
      await redis.set("casino:websessions", webSessions);
      console.log("Dados salvos na Nuvem com sucesso!");
    } catch (err) {
      console.error("Erro ao persistir dados no Redis Remoto:", err);
    }
    saveTimeout = null;
  }, 1000);
}

const DEFAULT_BALANCE = 1000;
const HISTORY_LIMIT = 20;

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function defaultUser() {
  return {
    balance: DEFAULT_BALANCE,
    bank: 0,
    lastDaily: 0,
    dailyStreak: 0,
    vipLevel: 0,
    inventory: [],
    cooldowns: {},
    stats: { wins: 0, losses: 0, wagered: 0, wonCoins: 0, lostCoins: 0 },
    xp: 0,
    level: 1,
    badges: [],
    loan: null,
    history: [],
    lastRobbedAt: 0,
    lastInterestAt: Date.now(),
    jackpotStreak: 0,
    crypto: { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 },
    equippedFrame: null,
    equippedBg: null
  };
}

function getUser(guildId, userId) {
  const k = key(guildId, userId);
  if (!users[k]) {
    users[k] = defaultUser();
    persist();
    return users[k];
  }
  const u = users[k];
  const d = defaultUser();
  let migrated = false;
  for (const field of Object.keys(d)) {
    if (u[field] === undefined) { u[field] = d[field]; migrated = true; }
  }
  if (u.stats) {
    if (u.stats.wonCoins === undefined) { u.stats.wonCoins = 0; migrated = true; }
    if (u.stats.lostCoins === undefined) { u.stats.lostCoins = 0; migrated = true; }
  }
  if (migrated) persist();
  return u;
}

function broadcastBalanceUpdate(guildId, userId) {
  try {
    const webServer = require('./webServer');
    if (webServer.broadcastToGuild) {
      const u = getUser(guildId, userId);
      webServer.broadcastToGuild(guildId, 'balance_update', {
        userId,
        balance: u.balance,
        bank: u.bank,
        stats: u.stats
      });
    }
  } catch (err) {
    // Ignora falhas antes do webServer estar pronto
  }
}

function saveUser(guildId, userId, data) {
  users[key(guildId, userId)] = data;
  persist();
  broadcastBalanceUpdate(guildId, userId);
}

function addBalance(guildId, userId, amount) {
  const u = getUser(guildId, userId);
  u.balance += amount;
  if (u.balance < 0) u.balance = 0;
  persist();
  broadcastBalanceUpdate(guildId, userId);
  return u.balance;
}

function addBank(guildId, userId, amount) {
  const u = getUser(guildId, userId);
  u.bank += amount;
  if (u.bank < 0) u.bank = 0;
  persist();
  broadcastBalanceUpdate(guildId, userId);
  return u.bank;
}

function tickBankInterest() {
  const now = Date.now();
  const applied = [];
  for (const k of Object.keys(users)) {
    const [guildId] = k.split(':');
    const u = users[k];
    if (u.bank <= 0) continue;
    const cfg = getGuildConfig(guildId);
    if (now - (u.lastInterestAt || 0) >= cfg.bankInterestIntervalMs) {
      const interest = Math.round(u.bank * (cfg.bankInterestPercent / 100));
      if (interest > 0) {
        u.bank += interest;
        applied.push({ guildId, userId: k.split(':')[1], interest });
      }
      u.lastInterestAt = now;
    }
  }
  if (applied.length > 0) persist();
  return applied;
}

function setCooldown(guildId, userId, command, ms) {
  const u = getUser(guildId, userId);
  let finalMs = ms;
  if (u.vipLevel === 2) {
    finalMs = Math.round(ms * 0.65); // -35% cooldown
  } else if (u.vipLevel === 3) {
    finalMs = Math.round(ms * 0.25); // -75% cooldown (mínimo)
  }
  u.cooldowns[command] = Date.now() + finalMs;
  persist();
}

function getCooldown(guildId, userId, command) {
  const u = getUser(guildId, userId);
  const until = u.cooldowns[command] || 0;
  return Math.max(0, until - Date.now());
}

function recordResult(guildId, userId, won, wagered) {
  const u = getUser(guildId, userId);
  u.stats.wagered += wagered;
  if (won) u.stats.wins += 1; else u.stats.losses += 1;
  persist();
}

function pushHistory(guildId, userId, entry) {
  const u = getUser(guildId, userId);
  u.history.unshift({ ...entry, timestamp: Date.now() });
  if (u.history.length > HISTORY_LIMIT) u.history.length = HISTORY_LIMIT;
  persist();
}

function getHistory(guildId, userId, limit = 10) {
  const u = getUser(guildId, userId);
  return u.history.slice(0, limit);
}

function getLeaderboard(guildId, limit = 10) {
  return Object.entries(users)
    .filter(([k]) => k.startsWith(`${guildId}:`))
    .map(([k, v]) => ({ userId: k.split(':')[1], ...v }))
    .sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))
    .slice(0, limit);
}

function getGlobalLeaderboard(limit = 10) {
  const globalUsers = {};
  for (const [k, v] of Object.entries(users)) {
    const userId = k.split(':')[1];
    if (!globalUsers[userId]) {
      globalUsers[userId] = {
        userId,
        balance: 0,
        bank: 0,
        xp: 0,
        level: 1,
        username: v.username || userId,
        equippedFrame: v.equippedFrame || 'frame_none',
        vipLevel: v.vipLevel || 0
      };
    }
    globalUsers[userId].balance += v.balance || 0;
    globalUsers[userId].bank += v.bank || 0;
    globalUsers[userId].xp += v.xp || 0;
    if (v.level > globalUsers[userId].level) {
      globalUsers[userId].level = v.level;
    }
    if (v.username && v.username !== userId) {
      globalUsers[userId].username = v.username;
    }
    if (v.equippedFrame && v.equippedFrame !== 'frame_none') {
      globalUsers[userId].equippedFrame = v.equippedFrame;
    }
    if (v.vipLevel > globalUsers[userId].vipLevel) {
      globalUsers[userId].vipLevel = v.vipLevel;
    }
  }
  return Object.values(globalUsers)
    .sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))
    .slice(0, limit);
}

function getGlobalTournamentLeaderboard(limit = 10) {
  const globalUsers = {};
  for (const [k, v] of Object.entries(users)) {
    const userId = k.split(':')[1];
    if (!globalUsers[userId]) {
      globalUsers[userId] = {
        userId,
        score: 0,
        username: v.username || userId,
        vipLevel: v.vipLevel || 0
      };
    }
    globalUsers[userId].score += v.tournamentScore || 0;
    if (v.username && v.username !== userId) {
      globalUsers[userId].username = v.username;
    }
    if (v.vipLevel > globalUsers[userId].vipLevel) {
      globalUsers[userId].vipLevel = v.vipLevel;
    }
  }
  return Object.values(globalUsers)
    .filter(u => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function getAllUserIdsForGuild(guildId) {
  return Object.keys(users)
    .filter(k => k.startsWith(`${guildId}:`))
    .map(k => k.split(':')[1]);
}

function resetUser(guildId, userId) {
  users[key(guildId, userId)] = defaultUser();
  persist();
  return users[key(guildId, userId)];
}

function resetAllUsers(guildId) {
  let count = 0;
  for (const k of Object.keys(users)) {
    if (k.startsWith(`${guildId}:`)) {
      users[k] = defaultUser();
      count += 1;
    }
  }
  persist();
  return count;
}

function xpForLevel(level) {
  return 100 * level;
}

function addXp(guildId, userId, amount) {
  const u = getUser(guildId, userId);
  u.xp += amount;
  let leveledUp = false;
  let need = xpForLevel(u.level);
  while (u.xp >= need) {
    u.xp -= need;
    u.level += 1;
    leveledUp = true;
    need = xpForLevel(u.level);
  }
  persist();
  return { level: u.level, xp: u.xp, xpNeeded: need, leveledUp };
}

function addBadge(guildId, userId, badgeId) {
  const u = getUser(guildId, userId);
  if (u.badges.includes(badgeId)) return false;
  u.badges.push(badgeId);
  persist();
  return true;
}

const DEFAULT_GUILD_CONFIG = {
  houseEdgePercent: 3, minBet: 10, maxBet: 5000, dailyAmount: 250, startingBalance: DEFAULT_BALANCE,
  slotsCooldownMs: 5000, blackjackCooldownMs: 8000, rouletteCooldownMs: 8000, diceCooldownMs: 5000,
  coinflipCooldownMs: 4000, higherlowerCooldownMs: 5000, minesCooldownMs: 5000, crashCooldownMs: 5000,
  workMin: 50, workMax: 300, workCooldownMs: 60 * 60 * 1000, bankInterestPercent: 1, bankInterestIntervalMs: 24 * 60 * 60 * 1000,
  robSuccessChance: 40, robMinPercent: 10, robMaxPercent: 30, robFailFinePercent: 15, robCooldownMs: 30 * 60 * 1000,
  loanMaxAmount: 10000, loanInterestPercent: 15, loanDurationMs: 3 * 24 * 60 * 60 * 1000, lotteryTicketPrice: 100,
  lotteryDrawDay: 0, lotteryDrawHour: 20, logChannelId: null, bigWinThreshold: 1000, autoTournamentEnabled: false,
  autoTournamentDurationHours: 24, autoTournamentDay: 0, autoTournamentHour: 20, lastAutoTournamentAt: 0, levelRoles: {}, balanceRoles: {}
};

function getGuildConfig(guildId) {
  if (!guilds[guildId]) {
    guilds[guildId] = { ...DEFAULT_GUILD_CONFIG };
    persist();
    return guilds[guildId];
  }
  const cfg = guilds[guildId];
  let migrated = false;
  for (const field of Object.keys(DEFAULT_GUILD_CONFIG)) {
    if (cfg[field] === undefined) { cfg[field] = DEFAULT_GUILD_CONFIG[field]; migrated = true; }
  }
  if (cfg.bigWinThreshold === undefined || cfg.bigWinThreshold > 1000) {
    cfg.bigWinThreshold = 1000;
    migrated = true;
  }
  if (migrated) persist();
  return cfg;
}

function setGuildConfig(guildId, patch) {
  const cfg = getGuildConfig(guildId);
  Object.assign(cfg, patch);
  persist();
  return cfg;
}

function getLoan(guildId, userId) {
  return getUser(guildId, userId).loan;
}

function createLoan(guildId, userId, principal, interestPercent, durationMs) {
  const u = getUser(guildId, userId);
  const owed = Math.round(principal * (1 + interestPercent / 100));
  u.loan = { principal, owed, createdAt: Date.now(), dueAt: Date.now() + durationMs };
  u.balance += principal;
  persist();
  return u.loan;
}

// PORTADO do database.js antigo: pagar um empréstimo em curso
function repayLoan(guildId, userId, amount) {
  const u = getUser(guildId, userId);
  if (!u.loan) return null;
  const pay = Math.min(amount, u.loan.owed);
  u.loan.owed -= pay;
  u.balance -= pay;
  if (u.loan.owed <= 0) u.loan = null;
  persist();
  return u.loan;
}

// PORTADO do database.js antigo: marcar timestamp do último roubo sofrido
function setRobbedNow(guildId, userId) {
  const u = getUser(guildId, userId);
  u.lastRobbedAt = Date.now();
  persist();
}

// ---- TORNEIOS (portado do database.js antigo, faltavam no ficheiro Redis) ----
function startTournament(guildId, { durationMs, name, prize, channelId, startedBy }) {
  tournaments[guildId] = {
    active: true,
    name: name || 'Torneio do casino',
    prize: prize || 0,
    channelId,
    startedBy,
    startTime: Date.now(),
    endTime: Date.now() + durationMs,
    scores: {}
  };

  // Reset local user tournamentScore parameter in this guild
  for (const [k, v] of Object.entries(users)) {
    if (k.startsWith(`${guildId}:`)) {
      v.tournamentScore = 0;
    }
  }

  persist();
  return tournaments[guildId];
}

function getTournament(guildId) {
  return tournaments[guildId] || null;
}

function isTournamentActive(guildId) {
  const t = tournaments[guildId];
  return !!(t && t.active && Date.now() < t.endTime);
}

function addTournamentScore(guildId, userId, net) {
  if (!isTournamentActive(guildId)) return;
  const t = tournaments[guildId];
  t.scores[userId] = (t.scores[userId] || 0) + net;
  
  const u = getUser(guildId, userId);
  u.tournamentScore = (u.tournamentScore || 0) + net;

  persist();
}

function getTournamentLeaderboard(guildId, limit = 10) {
  const t = tournaments[guildId];
  if (!t) return [];
  return Object.entries(t.scores)
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function endTournament(guildId) {
  const t = tournaments[guildId];
  if (!t) return null;
  t.active = false;
  persist();
  return t;
}

function getAllGuildIdsWithTournamentSupport() {
  return Object.keys(guilds);
}

function saveTournament(guildId, data) {
  tournaments[guildId] = data;
  persist();
}

// ---- LOTARIA (getLottery agora cria registo por defeito, como no ficheiro antigo;
// buyLotteryTickets e drawLottery estavam completamente em falta) ----
function getLottery(guildId) {
  if (!lotteries[guildId]) {
    lotteries[guildId] = { jackpot: 0, tickets: {}, drawsCompleted: 0, lastDrawAt: Date.now() };
    persist();
  }
  if (lotteries[guildId].lastDrawAt === undefined) {
    lotteries[guildId].lastDrawAt = Date.now();
    persist();
  }
  return lotteries[guildId];
}

function saveLottery(guildId, data) {
  lotteries[guildId] = data;
  persist();
}

function buyLotteryTickets(guildId, userId, quantity, pricePerTicket) {
  const cost = quantity * pricePerTicket;
  const u = getUser(guildId, userId);
  if (u.balance < cost) return null;
  u.balance -= cost;
  addTournamentScore(guildId, userId, -cost);
  const l = getLottery(guildId);
  l.tickets[userId] = (l.tickets[userId] || 0) + quantity;
  l.jackpot += Math.round(cost * 0.8);
  persist();
  return { cost, totalTickets: l.tickets[userId], jackpot: l.jackpot };
}

function drawLottery(guildId) {
  const l = getLottery(guildId);
  const pool = [];
  for (const [userId, qty] of Object.entries(l.tickets)) {
    for (let i = 0; i < qty; i++) pool.push(userId);
  }
  let winnerId = null;
  let prize = 0;
  if (pool.length > 0) {
    winnerId = pool[Math.floor(Math.random() * pool.length)];
    prize = l.jackpot;
    addBalance(guildId, winnerId, prize);
    addTournamentScore(guildId, winnerId, prize);
  }
  const totalTickets = pool.length;
  lotteries[guildId] = { jackpot: 0, tickets: {}, drawsCompleted: (l.drawsCompleted || 0) + 1, lastDrawAt: Date.now() };
  persist();
  return { winnerId, prize, totalTickets };
}

function getCryptoPrices() {
  if (!cryptoPrices || Object.keys(cryptoPrices).length === 0) {
    cryptoPrices = { BTC: 50000, ETH: 3000, SOL: 150, DOGE: 0.1 };
  }
  return cryptoPrices;
}

function setCryptoPrices(prices) {
  cryptoPrices = prices;
  persist();
}

function buyCrypto(guildId, userId, coin, amount, price) {
  const u = getUser(guildId, userId);
  const cost = Math.round(amount * price);
  if (u.balance < cost) return null;
  u.balance -= cost;
  if (!u.crypto) u.crypto = { BTC: 0, ETH: 0, SOL: 0, DOGE: 0 };
  u.crypto[coin] = (u.crypto[coin] || 0) + amount;
  persist();
  return { balance: u.balance, holdings: u.crypto[coin] };
}

function sellCrypto(guildId, userId, coin, amount, price) {
  const u = getUser(guildId, userId);
  if (!u.crypto || (u.crypto[coin] || 0) < amount) return null;
  const gain = Math.round(amount * price);
  u.balance += gain;
  u.crypto[coin] = (u.crypto[coin] || 0) - amount;
  persist();
  return { balance: u.balance, holdings: u.crypto[coin] };
}

function getFootballMatches(guildId) {
  if (!footballMatches[guildId]) footballMatches[guildId] = [];
  return footballMatches[guildId];
}

function saveFootballMatches(guildId, matches) {
  footballMatches[guildId] = matches;
  persist();
}

function getFootballBets(guildId) {
  if (!footballBets[guildId]) footballBets[guildId] = [];
  return footballBets[guildId];
}

function saveFootballBets(guildId, bets) {
  footballBets[guildId] = bets;
  persist();
}

function getChatHistory() {
  const now = Date.now();
  chatHistory = chatHistory.filter(msg => now - msg.timestamp < 24 * 60 * 60 * 1000);
  return chatHistory;
}

function addChatMessage(msg) {
  chatHistory.push(msg);
  const now = Date.now();
  chatHistory = chatHistory.filter(msg => now - msg.timestamp < 24 * 60 * 60 * 1000);
  persist();
}

function getWebSession(token) {
  return webSessions[token] || null;
}

function setWebSession(token, data) {
  webSessions[token] = data;
  persist();
}

function deleteWebSession(token) {
  delete webSessions[token];
  persist();
}

module.exports = {
  getUser, saveUser, addBalance, addBank, tickBankInterest, setCooldown, getCooldown,
  recordResult, pushHistory, getHistory, getLeaderboard, getGlobalLeaderboard, resetUser, resetAllUsers,
  xpForLevel, addXp, addBadge, getGuildConfig, setGuildConfig, DEFAULT_BALANCE,
  getLoan, createLoan, repayLoan, setRobbedNow,
  startTournament, getTournament, isTournamentActive, addTournamentScore,
  getTournamentLeaderboard, getGlobalTournamentLeaderboard, endTournament, getAllGuildIdsWithTournamentSupport, saveTournament,
  getLottery, saveLottery, buyLotteryTickets, drawLottery,
  getCryptoPrices, setCryptoPrices, buyCrypto, sellCrypto, getAllUserIdsForGuild,
  getFootballMatches, saveFootballMatches, getFootballBets, saveFootballBets,
  getChatHistory, addChatMessage, broadcastBalanceUpdate,
  getWebSession, setWebSession, deleteWebSession,
  getUsersData: () => users
};