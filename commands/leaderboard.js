const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Mostra os jogadores mais ricos do servidor'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const top = db.getLeaderboard(guildId, 10);

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

    const baseUrl = process.env.WEB_BASE_URL;
    const payload = { embeds: [embed] };

    if (baseUrl) {
      // Cria token seguro de login para quem executa o comando
      const token = webTokens.createToken(guildId, userId);
      const link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}&redirect=${encodeURIComponent('/leaderboard.html')}`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Ver Classificação no Site 🌐')
          .setStyle(ButtonStyle.Link)
          .setURL(link)
      );
      payload.components = [row];
    }

    return interaction.reply(payload);
  }
};
