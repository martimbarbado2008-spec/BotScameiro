const db = require('./database');
const { baseEmbed, fmt, COLORS } = require('./embeds');

// ---- Catálogo de conquistas ----
// check(user) -> bool. É avaliado depois de cada jogo, com o utilizador já atualizado.
const ACHIEVEMENTS = [
  { id: 'plays_100', name: '🎮 Jogador Assíduo', desc: 'Jogou 100 vezes', check: u => totalPlays(u) >= 100 },
  { id: 'plays_500', name: '🎯 Veterano do Casino', desc: 'Jogou 500 vezes', check: u => totalPlays(u) >= 500 },
  { id: 'plays_1000', name: '👑 Lenda da Casa', desc: 'Jogou 1000 vezes', check: u => totalPlays(u) >= 1000 },
  { id: 'wagered_100k', name: '💸 Apostador Compulsivo', desc: 'Apostou um total de 100.000', check: u => u.stats.wagered >= 100000 },
  { id: 'rich_50k', name: '💰 Bolsos Cheios', desc: 'Acumulou 50.000 entre carteira e banco', check: u => (u.balance + u.bank) >= 50000 },
  { id: 'rich_1m', name: '🏦 Milionário', desc: 'Acumulou 1.000.000 entre carteira e banco', check: u => (u.balance + u.bank) >= 1000000 },
  { id: 'level_10', name: '⭐ Nível 10', desc: 'Chegou ao nível 10', check: u => u.level >= 10 },
  { id: 'level_25', name: '🌟 Nível 25', desc: 'Chegou ao nível 25', check: u => u.level >= 25 },
  { id: 'level_50', name: '✨ Nível 50', desc: 'Chegou ao nível 50', check: u => u.level >= 50 },
  { id: 'jackpot_streak_3', name: '🎰 Trinca Dourada', desc: 'Ganhou 3 jackpots de slots seguidos', check: u => (u.jackpotStreak || 0) >= 3 }
];

function totalPlays(u) {
  return u.stats.wins + u.stats.losses;
}

function getAchievement(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// ---- XP ----
// ganha-se XP por jogar (não só por ganhar), para incentivar participação sem viciar em risco
function xpForGame(won) {
  return won ? 15 : 5;
}

// ---- Cargos automáticos ----
async function syncLevelRoles(ctx, level) {
  const cfg = db.getGuildConfig(ctx.guildId);
  const member = ctx.member;
  if (!member || !cfg.levelRoles) return;
  for (const [lvl, roleId] of Object.entries(cfg.levelRoles)) {
    if (level >= parseInt(lvl, 10) && !member.roles.cache.has(roleId)) {
      await member.roles.add(roleId).catch(() => {});
    }
  }
}

async function syncBalanceRoles(ctx) {
  const cfg = db.getGuildConfig(ctx.guildId);
  const member = ctx.member;
  if (!member || !cfg.balanceRoles) return;
  const u = db.getUser(ctx.guildId, ctx.userId);
  const total = u.balance + u.bank;
  for (const [threshold, roleId] of Object.entries(cfg.balanceRoles)) {
    if (total >= parseInt(threshold, 10) && !member.roles.cache.has(roleId)) {
      await member.roles.add(roleId).catch(() => {});
    }
  }
}

// ---- Logs e alertas ----
async function logPlay(ctx, { game, bet, net }) {
  const cfg = db.getGuildConfig(ctx.guildId);
  if (!cfg.logChannelId) return;
  try {
    const channel = await ctx.client.channels.fetch(cfg.logChannelId);
    if (!channel) return;
    const sign = net >= 0 ? '+' : '';
    await channel.send({
      embeds: [
        baseEmbed('📋 Registo de jogada', COLORS.neutral)
          .addFields(
            { name: 'Jogador', value: `${ctx.user}`, inline: true },
            { name: 'Jogo', value: game, inline: true },
            { name: 'Aposta', value: fmt(bet), inline: true },
            { name: 'Resultado', value: `${sign}${fmt(net)}`, inline: true }
          )
      ]
    });
  } catch (err) {
    console.error('Falha ao escrever no canal de logs:', err.message);
  }
}

async function announceBigWin(ctx, net, game) {
  const cfg = db.getGuildConfig(ctx.guildId);
  const channelId = cfg.logChannelId || ctx.channelId;
  try {
    const channel = await ctx.client.channels.fetch(channelId);
    if (!channel) return;
    await channel.send({
      embeds: [
        baseEmbed('🎉 Prémio grande!', COLORS.gold)
          .setDescription(`${ctx.user} ganhou **${fmt(net)}** em **${game}**! 🎉`)
      ]
    });
  } catch (err) {
    console.error('Falha ao anunciar prémio grande:', err.message);
  }
}

// núcleo reutilizável: aplica XP/conquistas/cargos/logs a um utilizador concreto.
// ctx = { guildId, userId, member, client, channelId, user } — "user" só é usado nas mensagens de log/alerta.
async function applyProgressionFor(ctx, { game, bet, net, won }) {
  const { guildId, userId } = ctx;
  const u = db.getUser(guildId, userId);

  // Calcular e aplicar bónus VIP se houver lucro líquido positivo
  let vipBonus = 0;
  if (net > 0 && u.vipLevel > 0) {
    const vipPercent = u.vipLevel === 1 ? 0.10 : (u.vipLevel === 2 ? 0.20 : (u.vipLevel === 3 ? 0.35 : 0));
    vipBonus = Math.round(net * vipPercent);
    if (vipBonus > 0) {
      db.addBalance(guildId, userId, vipBonus);
      db.addTournamentScore(guildId, userId, vipBonus);
      net += vipBonus; // aumenta o net total para históricos e logs
    }
  }

  db.pushHistory(guildId, userId, { game, bet, net });
  const xpResult = db.addXp(guildId, userId, xpForGame(won));
  xpResult.vipBonus = vipBonus;

  if (net > 0) {
    u.stats.wonCoins = (u.stats.wonCoins || 0) + net;
  } else if (net < 0) {
    u.stats.lostCoins = (u.stats.lostCoins || 0) + Math.abs(net);
  }

  const newBadges = [];
  for (const ach of ACHIEVEMENTS) {
    if (!u.badges.includes(ach.id) && ach.check(u)) {
      db.addBadge(guildId, userId, ach.id);
      newBadges.push(ach);
    }
  }

  if (xpResult.leveledUp) {
    await syncLevelRoles(ctx, xpResult.level).catch(() => {});
    
    // Anúncio público no chat (apaga após 1 minuto)
    const cfg = db.getGuildConfig(guildId);
    const targetChannelId = ctx.channelId || cfg.logChannelId;
    if (ctx.client && targetChannelId) {
      try {
        const channel = await ctx.client.channels.fetch(targetChannelId).catch(() => null);
        if (channel && typeof channel.send === 'function') {
          const lvlEmbed = baseEmbed('⭐ SUBIDA DE NÍVEL! ⭐', COLORS.gold)
            .setDescription(`🎉 Parabéns ${ctx.user}!\n\nSubiste para o **Nível ${xpResult.level}**! Continua a jogar para dominares o casino! 🚀\n\n*(Esta mensagem auto-destrói-se em 1 minuto)*`);
          
          const annMsg = await channel.send({ embeds: [lvlEmbed] });
          setTimeout(() => {
            annMsg.delete().catch(() => {});
          }, 60000);
        }
      } catch (err) {
        console.error('Erro ao anunciar subida de nível no chat:', err.message);
      }
    }

    // Anunciar no canal de anúncios configurado + chat web
    try {
      const { announceWebEvent } = require('./webServer');
      
      let username = userId;
      if (ctx.member && ctx.member.displayName && ctx.member.displayName !== userId) {
        username = ctx.member.displayName;
      } else if (ctx.user && (ctx.user.username || ctx.user.globalName)) {
        username = ctx.user.globalName || ctx.user.username;
      } else if (ctx.client) {
        try {
          const uObj = ctx.client.users.cache.get(userId) || await ctx.client.users.fetch(userId).catch(() => null);
          if (uObj) {
            username = uObj.username;
          }
          if (guildId) {
            const guildObj = ctx.client.guilds.cache.get(guildId) || await ctx.client.guilds.fetch(guildId).catch(() => null);
            if (guildObj) {
              const mObj = guildObj.members.cache.get(userId) || await guildObj.members.fetch(userId).catch(() => null);
              if (mObj) {
                username = mObj.displayName;
              }
            }
          }
        } catch(e) {}
      }

      await announceWebEvent(guildId, 'levelup', {
        title: `⬆️ Subida de Nível!`,
        message: `**${username}** subiu para o **Nível ${xpResult.level}**! 🚀`,
        username,
        level: xpResult.level
      });
    } catch (err) { /* Ignora erros de circular require */ }
  }
  await syncBalanceRoles(ctx).catch(() => {});

  const cfg = db.getGuildConfig(guildId);
  if (net > 0 && net >= cfg.bigWinThreshold) {
    await announceBigWin(ctx, net, game).catch(() => {});
    try {
      const { announceWebEvent } = require('./webServer');
      const username = ctx.member?.displayName || ctx.user?.username || 'Jogador';
      await announceWebEvent(guildId, 'win', {
        title: `🎉 GRANDE VITÓRIA no Discord!`,
        message: `🎉 **${username}** ganhou **${fmt(net)}** em **${game}** no Discord! 🎉`,
        username,
        game,
        amount: net,
        bet
      });
    } catch (err) { /* Ignora erros de circular require */ }
  }
  if (cfg.logChannelId) {
    await logPlay(ctx, { game, bet, net }).catch(() => {});
  }

  db.saveUser(guildId, userId, u);

  return { xpResult, newBadges };
}

// ---- Ponto de entrada normal, para comandos onde quem joga = quem invocou ----
// game: nome legível ("Slots", "Blackjack", ...); bet: valor apostado; net: ganho líquido (pode ser negativo); won: booleano
async function afterGame(interaction, { game, bet, net, won }) {
  const ctx = {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    member: interaction.member,
    client: interaction.client,
    channelId: interaction.channelId,
    user: interaction.user
  };
  return applyProgressionFor(ctx, { game, bet, net, won });
}

// ---- Ponto de entrada para aplicar a outro jogador (ex: perdedor/vencedor de /apostar ou /duelo) ----
async function afterGameForMember(interaction, member, { game, bet, net, won }) {
  const ctx = {
    guildId: interaction.guildId,
    userId: member.id,
    member,
    client: interaction.client,
    channelId: interaction.channelId,
    user: member.user || member
  };
  return applyProgressionFor(ctx, { game, bet, net, won });
}

// chamado só pelo slots.js para acompanhar jackpots (combinação perfeita) seguidos
function recordJackpot(guildId, userId, hit) {
  const u = db.getUser(guildId, userId);
  u.jackpotStreak = hit ? (u.jackpotStreak || 0) + 1 : 0;
  db.saveUser(guildId, userId, u);
}

// envia um followUp discreto se o jogador subiu de nível ou desbloqueou conquistas
async function notify(interaction, xpResult, newBadges) {
  if (!xpResult.leveledUp && (!newBadges || newBadges.length === 0) && (!xpResult.vipBonus || xpResult.vipBonus <= 0)) return;
  const lines = [];
  if (xpResult.leveledUp) lines.push(`⬆️ Subiste para o **nível ${xpResult.level}**!`);
  for (const b of newBadges || []) lines.push(`🏅 Nova conquista: **${b.name}** — ${b.desc}`);
  if (xpResult.vipBonus > 0) lines.push(`👑 Recebeste **+${fmt(xpResult.vipBonus)}** de Bónus VIP extra por esta vitória!`);
  try {
    await interaction.followUp({ content: lines.join('\n'), ephemeral: true });
  } catch {}
}

module.exports = { ACHIEVEMENTS, getAchievement, afterGame, afterGameForMember, recordJackpot, notify };
