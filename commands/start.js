const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Mostra o link para o guia de comandos interativo do casino'),

  async execute(interaction) {
    const baseUrl = process.env.WEB_BASE_URL;

    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web do casino ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do servidor.', ephemeral: true });
    }

    const link = `${baseUrl.replace(/\/$/, '')}/guia.html`;

    const embed = baseEmbed('🎰 Guia de Comandos do Casino', COLORS.gold)
      .setDescription('Para veres todos os comandos de Jogos, Economia, Progresso, Torneios e Administração, clica no botão abaixo para abrir o nosso guia interativo no site!')
      .addFields(
        { 
          name: '✨ O que encontras no site?', 
          value: '• **Filtros Rápidos** por categoria (Jogos, Admin, etc.)\n• **Barra de Pesquisa** instantânea de comandos\n• **Exemplos e Parâmetros** detalhados\n• **Guia de Início Rápido** passo-a-passo para iniciantes' 
        }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir Guia de Comandos 🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
