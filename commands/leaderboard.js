const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Mostra os jogadores mais ricos do servidor'),

  async execute(interaction) {
    const top = db.getLeaderboard(interaction.guildId, 10);

    if (top.length === 0) {
      return interaction.reply('Ainda ninguém tem saldo registado neste servidor.');
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(top.map(async (entry, i) => {
      let name;
      try {
        const member = await interaction.guild.members.fetch(entry.userId);
        name = member.user.username;
      } catch {
        name = `Utilizador ${entry.userId}`;
      }
      const medal = medals[i] || `${i + 1}.`;
      return `${medal} **${name}** — ${fmt(entry.balance + entry.bank)}`;
    }));

    const embed = baseEmbed('🏆 Leaderboard do casino', COLORS.gold)
      .setDescription(lines.join('\n'));

    return interaction.reply({ embeds: [embed] });
  }
};
