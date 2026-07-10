const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('investir')
    .setDescription('Recebe um link pessoal para acederes ao Portal de Investimentos no site'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do bot.', ephemeral: true });
    }

    // Cria token seguro de login para quem executa o comando
    const token = webTokens.createToken(guildId, userId);
    const link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}&redirect=${encodeURIComponent('/investir.html')}`;

    const embed = baseEmbed('📈 Portal de Investimentos Crypto', COLORS.gold)
      .setDescription('Abre o link abaixo para acederes ao Portal de Investimentos do casino. Lá podes comprar e vender criptomoedas fictícias (BTC, ETH, SOL, DOGE) em tempo real usando o saldo da tua carteira.\n\n**O link é pessoal e expira em 10 minutos.**');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir Portal de Investimentos 📈')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
