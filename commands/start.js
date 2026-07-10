const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Mostra todos os comandos e funcionalidades do casino'),

  async execute(interaction) {
    const introEmbed = baseEmbed('🎰 Casino Bot — guia de comandos', COLORS.gold)
      .setDescription('Bem-vindo ao casino! Aqui tens tudo o que podes fazer, dividido por categoria.');

    const gamesEmbed = baseEmbed('🎮 Jogos', COLORS.info)
      .addFields(
        { name: '/slots', value: 'Desafia a slot machine.' },
        { name: '/blackjack', value: 'Blackjack contra o dealer, com botões Pedir carta / Parar.' },
        { name: '/blackjack-mesa', value: 'Mesa de blackjack multijogador: outros entram e jogam por turnos contra o dealer.' },
        { name: '/roleta', value: 'Roleta europeia: aposta em vermelho, preto, par, ímpar ou número exato.' },
        { name: '/dados', value: 'Aposta em par, ímpar ou no total exato de dois dados.' },
        { name: '/poker', value: '5 card draw contra o bot, com troca de até 3 cartas.' },
        { name: '/coinflip', value: 'Cara ou coroa rápido contra a casa.' },
        { name: '/higherlower', value: 'Adivinha se a próxima carta é maior ou menor. Saca a qualquer momento.' },
        { name: '/mines', value: 'Campo minado: revela células seguras e saca antes de acertares numa mina.' },
        { name: '/crash', value: 'O multiplicador sobe em tempo real — saca antes que rebente!' },
        { name: '/lotaria comprar|info', value: 'Compra bilhetes semanais para o jackpot acumulado.' }
      );

    const economyEmbed = baseEmbed('💰 Economia', COLORS.win)
      .addFields(
        { name: '/saldo [utilizador]', value: 'Vê o teu saldo ou o de outro jogador.' },
        { name: '/diario', value: 'Recolhe o bónus diário, com bónus de streak.' },
        { name: '/trabalhar', value: 'Ganha dinheiro no mini-jogo web de faxina.' },
        { name: '/pescar', value: 'Ganha dinheiro no mini-jogo web de pesca.' },
        { name: '/hackear', value: 'Ganha dinheiro no mini-jogo web de hacking.' },
        { name: '/banco depositar|levantar', value: 'Guarda dinheiro no banco, protegido de roubos.' },
        { name: '/emprestimo pedir|pagar|estado', value: 'Pede dinheiro emprestado ao casino, com juro e prazo.' },
        { name: '/roubar utilizador', value: 'Tenta roubar % da carteira de outro jogador — risco de multa se falhares.' },
        { name: '/leaderboard', value: 'Ranking dos jogadores mais ricos do servidor.' },
        { name: '/loja', value: 'Compra VIP (Bronze, Prata, Ouro) e cosméticos.' },
        { name: '/apostar oponente valor', value: 'Desafia outro jogador para um coin flip.' },
        { name: '/duelo oponente valor', value: 'Desafia outro jogador para pedra-papel-tesoura ao melhor de 3.' }
      );

    const progressionEmbed = baseEmbed('📈 Progressão', COLORS.gold)
      .addFields(
        { name: '/perfil [utilizador]', value: 'Cartão de perfil: nível, XP, saldo, estatísticas e conquistas.' },
        { name: '/conquistas [utilizador]', value: 'Lista de conquistas e quais já desbloqueaste.' },
        { name: '/historico [utilizador]', value: 'Mostra as últimas jogadas de um jogador.' }
      );

    const tournamentEmbed = baseEmbed('🏆 Torneios', COLORS.gold)
      .addFields(
        { name: '/torneio', value: 'Vê o estado e a tabela classificativa do torneio ativo.' }
      );

    const adminEmbed = baseEmbed('🛠️ Administração', COLORS.neutral)
      .setDescription('Requer permissão de gerir servidor ou administrador.')
      .addFields(
        { name: '/casino-config ver', value: 'Mostra a configuração atual do servidor.' },
        { name: '/casino-config definir campo valor', value: 'Altera valores numéricos (apostas, trabalho, juros, roubo, empréstimos, lotaria...).' },
        { name: '/casino-config canal-logs', value: 'Define o canal onde o bot regista jogadas e anuncia prémios grandes.' },
        { name: '/casino-config cargo-nivel / cargo-saldo', value: 'Define cargos atribuídos automaticamente por nível ou saldo.' },
        { name: '/casino-config torneio-automatico', value: 'Ativa torneios semanais automáticos (dia, hora, duração).' },
        { name: '/torneio-admin criar', value: 'Inicia um torneio manual.' },
        { name: '/torneio-admin terminar', value: 'Termina já o torneio ativo e anuncia o vencedor.' },
        { name: '/reset-saldo jogador|todos', value: 'Reseta o saldo de um jogador ou de todo o servidor.' },
        { name: '/parar-bot', value: 'Desliga o bot em segurança.' }
      )
      .setFooter({ text: 'Usa / no chat para ver todas as opções de cada comando.' });

    const baseUrl = process.env.WEB_BASE_URL;
    const payload = {
      embeds: [introEmbed, gamesEmbed, economyEmbed, progressionEmbed, tournamentEmbed, adminEmbed]
    };

    if (baseUrl) {
      const link = `${baseUrl.replace(/\/$/, '')}/guia.html`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Ver Guia no Site 🌐')
          .setStyle(ButtonStyle.Link)
          .setURL(link)
      );
      payload.components = [row];
    }

    const reply = await interaction.reply(payload);
  }
};
