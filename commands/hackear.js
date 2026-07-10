const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hackear')
    .setDescription('Recebe um link pessoal para infiltrares o banco e ganhares moedas'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const cooldown = db.getCooldown(guildId, userId, 'hackear');
    if (cooldown > 0) {
      const mins = Math.ceil(cooldown / 60000);
      return interaction.reply({ content: `Já hackeaste recentemente. Volta daqui a ${mins}min.`, ephemeral: true });
    }

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web do /hackear ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do servidor.', ephemeral: true });
    }

    const token = webTokens.createToken(guildId, userId);
    const link = `${baseUrl.replace(/\/$/, '')}/hackear/${token}`;

    const embed = baseEmbed('💻 Hora de hackear', COLORS.info)
      .setDescription('Abre o link abaixo para começares a tua infiltração. O link é pessoal, só funciona uma vez e expira em 10 minutos.')
      .addFields({ name: 'Recompensa possível', value: `${fmt(150)} a ${fmt(500)}, conforme o desempenho`, inline: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Infiltrar no banco 💻').setStyle(ButtonStyle.Link).setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
