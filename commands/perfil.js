const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const webTokens = require('../utils/webTokens');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Recebe um link pessoal para veres o teu Perfil ou o de outro utilizador no site')
    .addUserOption(option =>
      option.setName('utilizador')
        .setDescription('O utilizador cujo perfil pretendes visualizar')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('utilizador');

    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do bot.', ephemeral: true });
    }

    // Cria token seguro de login para quem executa o comando
    const token = webTokens.createToken(guildId, userId);
    
    let link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}`;
    let embedTitle = '🎴 Perfil e Painel Web';
    let embedDesc = 'Abre o link abaixo para acederes ao teu perfil do casino. Lá podes ver as tuas estatísticas detalhadas, carteira, cotações crypto, badges, comprar itens na loja e jogar mini-jogos!\n\n**O link é pessoal e expira em 10 minutos.**';
    let buttonLabel = 'Abrir o meu Perfil 🎴';

    if (targetUser && targetUser.id !== userId) {
      const redirect = `/perfil.html?userId=${targetUser.id}`;
      link += `&redirect=${encodeURIComponent(redirect)}`;
      embedTitle = `🎴 Perfil de ${targetUser.username}`;
      embedDesc = `Abre o link abaixo para visualizares o perfil de **${targetUser.username}** no site do casino. Podes ver as estatísticas dele, conquistas, inventário e investimentos.\n\n**O link expira em 10 minutos.**`;
      buttonLabel = `Ver Perfil de ${targetUser.username} 🌐`;
    }

    const embed = baseEmbed(embedTitle, COLORS.gold)
      .setDescription(embedDesc);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
