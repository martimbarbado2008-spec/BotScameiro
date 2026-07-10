const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diario')
    .setDescription('Recebe o teu link para girares a Roda da Fortuna no site e ganhares prémios'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do bot.', ephemeral: true });
    }

    // Cria token seguro de login para quem executa o comando
    const token = webTokens.createToken(guildId, userId);
    
    // Redireciona diretamente para a roda.html
    const redirect = '/roda.html';
    const link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}&redirect=${encodeURIComponent(redirect)}`;

    const embed = baseEmbed('🎡 Roda da Fortuna — Bónus Diário', COLORS.gold)
      .setDescription('O bónus diário agora é ganho na nossa **Roda da Fortuna** online!\n\nClica no botão abaixo para abrires o site e girares a roleta. Podes ganhar:\n* 💰 **Moedas de Casino** (até 5000 🪙 + Bónus de Streak!)\n* ⚡ **XP de Nível**\n* 🧹 **Resets de Cooldowns** de Trabalho\n\n*Este link é pessoal e expira em 10 minutos.*');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Girar a Roda da Fortuna 🎡')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
