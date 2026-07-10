const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trabalhar')
    .setDescription('Recebe um link pessoal para limpares a tua casa e ganhares moedas'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);

    const cooldown = db.getCooldown(guildId, userId, 'trabalhar');
    if (cooldown > 0) {
      const mins = Math.ceil(cooldown / 60000);
      return interaction.reply({ content: `Já trabalhaste recentemente. Volta daqui a ${mins}min.`, ephemeral: true });
    }

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web do /trabalhar ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do servidor.', ephemeral: true });
    }

    const token = webTokens.createToken(guildId, userId);
    const link = `${baseUrl.replace(/\/$/, '')}/trabalho/${token}`;

    const embed = baseEmbed('🧽 Hora de trabalhar', COLORS.info)
      .setDescription('Abre o link abaixo para limpares a tua casa. O link é pessoal, só funciona uma vez e expira em 10 minutos.')
      .addFields({ name: 'Recompensa possível', value: `${fmt(cfg.workMin)} a ${fmt(cfg.workMax)}, conforme o desempenho`, inline: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Abrir a minha casa 🧹').setStyle(ButtonStyle.Link).setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row], });
  }
};
