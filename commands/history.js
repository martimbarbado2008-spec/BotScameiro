const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Mostra as últimas apostas de um jogador')
    .addUserOption(o => o.setName('utilizador').setDescription('Jogador a consultar')),

  async execute(interaction) {
    const target = interaction.options.getUser('utilizador') || interaction.user;
    const history = db.getHistory(interaction.guildId, target.id, 10);

    if (history.length === 0) {
      return interaction.reply(`${target.username} ainda não tem jogadas registadas.`);
    }

    const lines = history.map(h => {
      const sign = h.net >= 0 ? '+' : '';
      const date = new Date(h.timestamp);
      const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      return `\`${time}\` **${h.game}** — aposta ${fmt(h.bet)} → ${sign}${fmt(h.net)}`;
    });

    const embed = baseEmbed(`📜 Histórico de ${target.username}`, COLORS.neutral)
      .setDescription(lines.join('\n'));

    return interaction.reply({ embeds: [embed] });
  }
};
