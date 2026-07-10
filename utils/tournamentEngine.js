const db = require('./database');
const { baseEmbed, fmt, COLORS } = require('./embeds');

async function concludeTournament(client, guildId) {
  const t = db.getTournament(guildId);
  if (!t || !t.active) return;

  const top = db.getTournamentLeaderboard(guildId, 3);
  db.endTournament(guildId);

  let description;
  if (top.length === 0) {
    description = 'Ninguém pontuou durante o torneio. Sem vencedor desta vez.';
  } else {
    const winner = top[0];
    if (t.prize > 0) {
      db.addBalance(guildId, winner.userId, t.prize);
    }
    const medals = ['🥇', '🥈', '🥉'];
    description = top.map((e, i) => `${medals[i]} <@${e.userId}> — ${e.score >= 0 ? '+' : ''}${fmt(e.score)}`).join('\n');
    if (t.prize > 0) {
      description += `\n\n<@${winner.userId}> venceu e recebeu o prémio de ${fmt(t.prize)}!`;
    }
  }

  const embed = baseEmbed(`🏆 ${t.name} — terminou!`, COLORS.win).setDescription(description);

  if (t.channelId) {
    try {
      const channel = await client.channels.fetch(t.channelId);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Não foi possível anunciar o fim do torneio:', err.message);
    }
  }
}

// verifica periodicamente todos os servidores com torneio ativo e conclui os que já expiraram
function startTournamentWatcher(client, intervalMs = 30000) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const t = db.getTournament(guild.id);
      if (t && t.active && Date.now() >= t.endTime) {
        await concludeTournament(client, guild.id);
      }
    }
  }, intervalMs);
}

module.exports = { concludeTournament, startTournamentWatcher };
