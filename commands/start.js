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

    const token = require('../utils/webTokens').createToken(interaction.guildId, interaction.user.id);
    const redirect = '/dashboard.html';
    const dashboardLink = `${baseUrl.replace(/\/$/, '')}/api/login-dashboard?token=${token}&redirect=${encodeURIComponent(redirect)}`;
    const guideLink = `${baseUrl.replace(/\/$/, '')}/guia.html`;

    const embed = baseEmbed('🎰 Casino Arena — Central de Comandos', COLORS.gold)
      .setDescription('Bem-vindo ao **Casino Arena**! Aqui tens todos os comandos disponíveis categorizados. Clica nos botões ou digita-os no chat para jogar!')
      .addFields(
        { 
          name: '🎮 Jogos de Casino', 
          value: '• `/slots` - Joga na slot machine (Discord e Web 🎰)\n• `/blackjack` - Joga blackjack contra o Dealer\n• `/mines` - Campo minado clássico\n• `/crash` - Multiplicador de crash crypto\n• `/hl` - Higher or Lower (Maior ou Menor)\n• `/dice` - Dados contra a banca\n• `/roulette` - Roleta europeia\n• `/roleta-russa` - Roleta russa extrema\n• `/duel` - Desafia outro jogador a duelo\n• `/coinflip` - Cara ou coroa contra outro jogador\n• `/bet` - Aposta moedas contra a casa\n• `/futebol` - Consulta e aposta em jogos de futebol\n• `/poker` - Texas Hold\'em\n• `/raspadinha` - Raspadinhas da sorte\n• `/lottery` - Bilhetes de lotaria' 
        },
        { 
          name: '🧹 Ganhos e Cooldowns', 
          value: '• `/work` - Ganha moedas limpando a casa (Web)\n• `/pescar` - Mini-game de pesca rápida (Web)\n• `/hackear` - Hackeia o banco central (Web)\n• `/diario` - Roda da Fortuna diária no site (🎡)' 
        },
        { 
          name: '🏦 Economia e Bancos', 
          value: '• `/balance` - Vê o teu saldo da carteira e banco\n• `/bank` - Deposita ou levanta moedas do banco\n• `/transferir` - Envia moedas para outro jogador\n• `/loan` - Pede ou paga empréstimos com juros\n• `/investir` - Gestão de crypto-investimentos (Web)\n• `/shop` - Compra molduras e fundos cosméticos\n• `/crime` - Tenta cometer um crime por moedas\n• `/rob` - Tenta roubar moedas de outro jogador' 
        },
        { 
          name: '🏅 Perfil e Competição', 
          value: '• `/perfil` - Perfil, inventário e histórico no site\n• `/history` - Histórico de transações recentes\n• `/leaderboard` - Classificação dos mais ricos\n• `/achievements` - Lista de conquistas desbloqueadas\n• `/tournament` - Entra ou consulta torneios ativos' 
        },
        {
          name: '⚙️ Administração (Apenas Admins)',
          value: '• `/admin` - Link de login para o Painel Admin do site\n• `/setup-portal` - Envia a mensagem do portal de acesso permanente'
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
