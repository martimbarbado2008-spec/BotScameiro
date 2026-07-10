const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Mostra todos os comandos do casino e links de acesso rápido'),

  async execute(interaction) {
    const baseUrl = process.env.WEB_BASE_URL;

    if (!baseUrl) {
      return interaction.reply({ content: 'O servidor web do casino ainda não está configurado (falta WEB_BASE_URL no .env). Avisa o dono do servidor.', ephemeral: true });
    }

    const dashboardLink = `${baseUrl.replace(/\/$/, '')}/dashboard.html`;
    const guideLink = `${baseUrl.replace(/\/$/, '')}/guia.html`;

    const embed = baseEmbed('🎰 Casino Arena — Central de Comandos', COLORS.gold)
      .setDescription('Bem-vindo ao **Casino Arena**! Aqui tens todos os comandos disponíveis categorizados. Clica nos botões ou digita-os no chat para jogar!')
      .addFields(
        { 
          name: '🎮 Jogos de Casino', 
          value: '• `/slots` - Joga na máquina clássica de slots\n• `/blackjack` - Joga uma mão contra o Dealer\n• `/mines` - Campo minado clássico\n• `/crash` - Multiplicador de crash crypto\n• `/hl` - Higher or Lower (Maior ou Menor)\n• `/dice` - Joga dados contra a banca\n• `/roulette` - Roleta europeia clássica\n• `/roleta-russa` - Roleta russa extrema\n• `/duel` - Desafia outro jogador\n• `/poker` - Poker Texas Hold\'em\n• `/raspadinha` - Compra raspadinhas\n• `/lottery` - Bilhetes de lotaria' 
        },
        { 
          name: '🧹 Ganhos e Cooldowns', 
          value: '• `/work` - Ganha moedas limpando a casa (Web mini-game)\n• `/pescar` - Mini-game de pesca rápida (Web)\n• `/hackear` - Hackeia o banco (Web)\n• `/diario` - Roda da Fortuna diária no site (🎡)' 
        },
        { 
          name: '🏦 Economia e Bancos', 
          value: '• `/balance` - Vê o teu saldo da carteira e banco\n• `/bank` - Deposita ou levanta moedas do banco\n• `/transferir` - Envia moedas para outro jogador\n• `/loan` - Pede ou paga empréstimos com juros\n• `/shop` - Compra molduras e fundos cosméticos\n• `/crime` - Tenta um crime para ganhar moedas\n• `/rob` - Rouba moedas de outro jogador' 
        },
        { 
          name: '🏅 Perfil e Competição', 
          value: '• `/perfil` - Link para o teu perfil e inventário web\n• `/leaderboard` - Classificação dos mais ricos\n• `/achievements` - Lista de conquistas desbloqueadas\n• `/tournament` - Entra ou consulta torneios ativos' 
        }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir Perfil & Jogos Web 🏠')
        .setStyle(ButtonStyle.Link)
        .setURL(dashboardLink),
      new ButtonBuilder()
        .setLabel('Guia de Comandos Interativo 🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(guideLink)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
