const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Recebe o link de acesso ao Painel de Administração do Casino')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const baseUrl = process.env.WEB_BASE_URL;
    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web do casino ainda não está configurado. Avisa o dono do bot.', ephemeral: true });
    }
    
    const token = require('../../utils/webTokens').createToken(interaction.guildId, interaction.user.id);
    const link = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}&redirect=${encodeURIComponent('/admin.html')}`;

    const embed = baseEmbed('⚙️ Painel de Administração Web', COLORS.gold)
      .setDescription('Usa o botão abaixo para abrires o painel de administração do casino no teu navegador. Lá podes editar saldos de jogadores, configurar parâmetros da economia, taxas de roubo, gerir e iniciar torneios, e muito mais!\n\n**Este link é restrito a administradores e expira em 10 minutos.**');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir Painel Admin ⚙️')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
