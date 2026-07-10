const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Recebe um link pessoal para acederes ao teu Painel de Controlo no site'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do bot.', ephemeral: true });
    }

    // Cria token seguro de login
    const token = webTokens.createToken(guildId, userId);
    const link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}`;

    const embed = baseEmbed('📊 Painel de Controlo Web', COLORS.gold)
      .setDescription('Abre o link abaixo para acederes ao teu painel pessoal do casino. Lá podes ver a tua carteira, badges, classificação, comprar itens na loja e jogar mini-jogos!\n\n**O link é pessoal e expira em 10 minutos.**');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir o meu Painel 📊')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
