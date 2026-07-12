const db = require('./database');
const { baseEmbed, fmt, COLORS } = require('./embeds');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // verifica a cada 5 minutos

// encontra um canal de texto para anunciar: prioriza o canal de logs, senão o primeiro canal de texto onde o bot pode escrever
async function resolveAnnounceChannel(client, guildId, preferredChannelId) {
  if (preferredChannelId) {
    const ch = await client.channels.fetch(preferredChannelId).catch(() => null);
    if (ch) return ch;
  }
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return null;
  const channels = await guild.channels.fetch().catch(() => null);
  if (!channels) return null;
  return channels.find(c => c && c.isTextBased && c.isTextBased() && c.viewable) || null;
}

async function checkLotteries(client) {
  const now = new Date();
  for (const guildId of db.getAllGuildIdsWithTournamentSupport()) {
    const cfg = db.getGuildConfig(guildId);
    const lottery = db.getLottery(guildId);
    const dueByTime = now.getDay() === cfg.lotteryDrawDay && now.getHours() >= cfg.lotteryDrawHour;
    const notDrawnThisWeek = (Date.now() - (lottery.lastDrawAt || 0)) >= WEEK_MS - CHECK_INTERVAL_MS;
    if (!(dueByTime && notDrawnThisWeek)) continue;

    const result = db.drawLottery(guildId);
    if (!result.winnerId) continue; // ninguém comprou bilhetes, não há nada a anunciar

    const channel = await resolveAnnounceChannel(client, guildId, cfg.logChannelId);
    if (!channel) continue;
    try {
      await channel.send({
        embeds: [
          baseEmbed('🎟️ Sorteio da lotaria!', COLORS.gold)
            .setDescription(`<@${result.winnerId}> ganhou o jackpot de **${fmt(result.prize)}**!\nTotal de bilhetes vendidos: ${result.totalTickets}.`)
        ]
      });
    } catch (err) {
      console.error('Falha ao anunciar a lotaria:', err.message);
    }
  }
}

async function checkAutoTournaments(client) {
  const now = new Date();
  for (const guildId of db.getAllGuildIdsWithTournamentSupport()) {
    const cfg = db.getGuildConfig(guildId);
    if (!cfg.autoTournamentEnabled) continue;
    if (db.isTournamentActive(guildId)) continue;

    const dueByTime = now.getDay() === cfg.autoTournamentDay && now.getHours() >= cfg.autoTournamentHour;
    const notStartedThisWeek = (Date.now() - (cfg.lastAutoTournamentAt || 0)) >= WEEK_MS - CHECK_INTERVAL_MS;
    if (!(dueByTime && notStartedThisWeek)) continue;

    const channel = await resolveAnnounceChannel(client, guildId, cfg.logChannelId);
    if (!channel) continue;

    db.startTournament(guildId, {
      durationMs: cfg.autoTournamentDurationHours * 60 * 60 * 1000,
      name: 'Torneio semanal do casino',
      prize: 0,
      channelId: channel.id,
      startedBy: client.user.id
    });
    db.setGuildConfig(guildId, { lastAutoTournamentAt: Date.now() });

    try {
      await channel.send({
        embeds: [
          baseEmbed('🏆 Torneio semanal — começou!', COLORS.gold)
            .setDescription(`Quem ganhar mais moedas líquidas em qualquer jogo do casino nas próximas **${cfg.autoTournamentDurationHours}h** vence.\nUsa \`/torneio\` para veres a tabela classificativa.`)
        ]
      });
    } catch (err) {
      console.error('Falha ao anunciar torneio automático:', err.message);
    }
  }
}

function fluctuateCrypto() {
  const prices = db.getCryptoPrices();
  const updatedPrices = {};
  
  const bounds = {
    BTC: { min: 30000, max: 100000 },
    ETH: { min: 1500, max: 5000 },
    SOL: { min: 80, max: 300 },
    DOGE: { min: 0.05, max: 0.5 }
  };

  for (const [coin, price] of Object.entries(prices)) {
    const change = 1 + (Math.random() * 0.05 - 0.025);
    let newPrice = price * change;
    
    const limit = bounds[coin] || { min: 1, max: 1000000 };
    newPrice = Math.max(limit.min, Math.min(limit.max, newPrice));
    
    if (coin === 'DOGE') {
      updatedPrices[coin] = Math.round(newPrice * 1000) / 1000;
    } else {
      updatedPrices[coin] = Math.round(newPrice);
    }
  }
  db.setCryptoPrices(updatedPrices);
}

function startEconomyWatcher(client) {
  // Flutua ao iniciar para dar dinamismo inicial
  fluctuateCrypto();

  setInterval(async () => {
    db.tickBankInterest();
    fluctuateCrypto();
    await checkLotteries(client).catch(err => console.error('Erro no watcher da lotaria:', err.message));
    await checkAutoTournaments(client).catch(err => console.error('Erro no watcher de torneios automáticos:', err.message));
  }, CHECK_INTERVAL_MS);
}

module.exports = { startEconomyWatcher };