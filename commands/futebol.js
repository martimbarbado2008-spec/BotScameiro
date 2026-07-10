const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('futebol')
    .setDescription('Recebe um link pessoal para acederes ao Sportsbook de futebol no site'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do bot.', ephemeral: true });
    }

    // Cria token seguro de login para quem executa o comando
    const token = webTokens.createToken(guildId, userId);
    const link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}&redirect=${encodeURIComponent('/futebol.html')}`;

    const embed = baseEmbed('⚽ Casino Sportsbook Arena', COLORS.gold)
      .setDescription('Abre o link abaixo para acederes à Arena de Apostas de futebol do casino. Lá podes apostar moedas do casino (🪙) em jogos virtuais das ligas **Liga Portugal**, **Premier League** e **Champions League** com odds atualizadas!\n\n**O link é pessoal e expira em 10 minutos.**');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir Casino Arena ⚽')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
