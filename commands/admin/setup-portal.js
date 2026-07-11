const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-portal')
    .setDescription('Envia a mensagem de portal permanente com botão para entrar no site do casino')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = baseEmbed('🎰 Casino Arena — Portal de Entrada Web', COLORS.gold)
      .setDescription('Bem-vindo ao **Casino Arena**!\n\nClica no botão abaixo para obteres o teu link de acesso pessoal e seguro. A tua Dashboard será aberta, permitindo-te:\n\n• 👤 Ver o teu Perfil e Inventário de Molduras/Fundos\n• 🏆 Consultar Torneios ativos em tempo real\n• 📊 Analisar as tabelas classificativas\n• 💬 Falar no Chat Lateral integrado com o Discord\n• 🎮 Jogar Slot Machine visual direto no browser!\n\n**O botão gera um link temporário seguro visível apenas para ti.**');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_portal')
        .setLabel('Entrar no Casino Web 🌐')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ content: 'Portal configurado com sucesso!', ephemeral: true });
    return interaction.channel.send({ embeds: [embed], components: [row] });
  }
};
