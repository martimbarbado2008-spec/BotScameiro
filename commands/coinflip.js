const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { resultEmbed, baseEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Jogo de Coinflip (cara ou coroa) individual ou duelo')
    .addSubcommand(sub =>
      sub.setName('solo')
         .setDescription('Aposta contra a casa numa moeda ao ar')
         .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1))
         .addStringOption(o => o.setName('escolha').setDescription('Cara ou coroa').setRequired(true)
           .addChoices(
             { name: 'Cara', value: 'cara' },
             { name: 'Coroa', value: 'coroa' }
           ))
    )
    .addSubcommand(sub =>
      sub.setName('desafio')
         .setDescription('Desafia outro jogador para um duelo de coinflip, o vencedor leva tudo')
         .addUserOption(o => o.setName('oponente').setDescription('Quem desafias').setRequired(true))
         .addIntegerOption(o => o.setName('valor').setDescription('Aposta de cada um').setRequired(true).setMinValue(1))
         .addStringOption(o => o.setName('escolha').setDescription('A tua escolha de lado').setRequired(true)
           .addChoices(
             { name: 'Cara', value: 'cara' },
             { name: 'Coroa', value: 'coroa' }
           ))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (subcommand === 'solo') {
      const cfg = db.getGuildConfig(guildId);
      const bet = interaction.options.getInteger('aposta');
      const escolha = interaction.options.getString('escolha');
      const user = db.getUser(guildId, userId);

      const cooldown = db.getCooldown(guildId, userId, 'coinflip');
      if (cooldown > 0) {
        return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
      }
      if (bet < cfg.minBet || bet > cfg.maxBet) {
        return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
      }
      if (user.balance < bet) {
        return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
      }

      db.setCooldown(guildId, userId, 'coinflip', cfg.coinflipCooldownMs);

      const resultado = Math.random() < 0.5 ? 'cara' : 'coroa';
      const won = resultado === escolha;
      const winnings = won ? Math.round(bet * 1.9) : 0;
      const net = winnings - bet;
      db.addBalance(guildId, userId, net);
      db.recordResult(guildId, userId, won, bet);
      db.addTournamentScore(guildId, userId, net);
      const newBalance = db.getUser(guildId, userId).balance;

      const emoji = resultado === 'cara' ? '🙂' : '🪙';
      const embed = resultEmbed({
        title: '🪙 Coinflip Solo',
        description: `A moeda caiu em **${resultado}** ${emoji}`,
        won,
        fields: [
          { name: 'Aposta', value: `${fmt(bet)} (${escolha})`, inline: true },
          { name: won ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
          { name: 'Saldo', value: fmt(newBalance), inline: true }
        ]
      });

      await interaction.reply({ embeds: [embed] });
      const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Coinflip', bet, net, won });
      return progression.notify(interaction, xpResult, newBadges);
    }

    if (subcommand === 'desafio') {
      const challenger = interaction.user;
      const opponent = interaction.options.getUser('oponente');
      const amount = interaction.options.getInteger('valor');
      const choice = interaction.options.getString('escolha');

      if (opponent.id === challenger.id) {
        return interaction.reply({ content: 'Não podes desafiar-te a ti mesmo.', ephemeral: true });
      }
      if (opponent.bot) {
        return interaction.reply({ content: 'Não podes desafiar um bot.', ephemeral: true });
      }

      const challengerUser = db.getUser(guildId, challenger.id);
      const opponentUser = db.getUser(guildId, opponent.id);
      
      if (challengerUser.balance < amount) {
        return interaction.reply({ content: 'Não tens saldo suficiente para essa aposta.', ephemeral: true });
      }
      if (opponentUser.balance < amount) {
        return interaction.reply({ content: `${opponent.username} não tem moedas suficientes para esse duelo.`, ephemeral: true });
      }

      const opponentChoice = choice === 'cara' ? 'coroa' : 'cara';

      const startEmbed = baseEmbed('⚔️ Duelo de Coinflip', COLORS.info)
        .setDescription(`${challenger} desafiou ${opponent} para um duelo de Coinflip de **${fmt(amount)}**!\n\n` +
                        `• **${challenger.username}** escolheu: **${choice.toUpperCase()}**\n` +
                        `• **${opponent.username}** fica com: **${opponentChoice.toUpperCase()}**\n\n` +
                        `${opponent}, aceitas o desafio?`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cf_accept').setLabel('Aceitar Duelo').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cf_decline').setLabel('Recusar Duelo').setStyle(ButtonStyle.Danger)
      );

      const reply = await interaction.reply({ embeds: [startEmbed], components: [row], fetchReply: true });

      const collector = reply.createMessageComponentCollector({
        filter: i => i.user.id === opponent.id,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.customId === 'cf_decline') {
          collector.stop('declined');
          const decEmbed = baseEmbed('⚔️ Duelo Recusado', COLORS.neutral)
            .setDescription(`${opponent.username} recusou o desafio de coinflip de ${challenger.username}.`);
          return i.update({ embeds: [decEmbed], components: [] });
        }

        if (i.customId === 'cf_accept') {
          // Re-verificar saldos
          const cUser = db.getUser(guildId, challenger.id);
          const oUser = db.getUser(guildId, opponent.id);

          if (cUser.balance < amount) {
            collector.stop('cancel_balance');
            return i.update({ content: `Duelo cancelado: ${challenger.username} já não tem saldo suficiente.`, embeds: [], components: [] });
          }
          if (oUser.balance < amount) {
            collector.stop('cancel_balance');
            return i.update({ content: `Duelo cancelado: ${opponent.username} não tem saldo suficiente.`, embeds: [], components: [] });
          }

          // Deduzir apostas
          db.addBalance(guildId, challenger.id, -amount);
          db.addBalance(guildId, opponent.id, -amount);

          // Lançar moeda
          const roll = Math.random() < 0.5 ? 'cara' : 'coroa';
          const challengerWon = choice === roll;
          
          const winner = challengerWon ? challenger : opponent;
          const loser = challengerWon ? opponent : challenger;
          const payout = amount * 2;

          db.addBalance(guildId, winner.id, payout);

          db.recordResult(guildId, winner.id, true, amount);
          db.recordResult(guildId, loser.id, false, amount);
          db.addTournamentScore(guildId, winner.id, amount);
          db.addTournamentScore(guildId, loser.id, -amount);

          const newWinnerBal = db.getUser(guildId, winner.id).balance;
          const newLoserBal = db.getUser(guildId, loser.id).balance;

          const emoji = roll === 'cara' ? '🙂' : '🪙';
          const winEmbed = resultEmbed({
            title: '⚔️ Duelo de Coinflip — Resultado',
            description: `A moeda caiu em **${roll.toUpperCase()}** ${emoji}\n\n🏆 O vencedor é **${winner.username}**! Ganhou **${fmt(payout)}**!`,
            won: true,
            fields: [
              { name: `Vencedor (+${fmt(amount)})`, value: `${winner.username} (Saldo: ${fmt(newWinnerBal)})`, inline: true },
              { name: `Derrotado (-${fmt(amount)})`, value: `${loser.username} (Saldo: ${fmt(newLoserBal)})`, inline: true }
            ]
          });

          collector.stop('done');
          await i.update({ embeds: [winEmbed], components: [] });

          // Tratar XP e Conquistas
          const guild = interaction.guild;
          const winnerMember = await guild.members.fetch(winner.id).catch(() => null);
          const loserMember = await guild.members.fetch(loser.id).catch(() => null);

          if (winnerMember) await progression.afterGameForMember(interaction, winnerMember, { game: 'Duelo Coinflip', bet: amount, net: amount, won: true }).catch(() => {});
          if (loserMember) await progression.afterGameForMember(interaction, loserMember, { game: 'Duelo Coinflip', bet: amount, net: -amount, won: false }).catch(() => {});
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          try {
            await interaction.editReply({
              embeds: [baseEmbed('⚔️ Duelo expirado', COLORS.neutral).setDescription('O oponente não respondeu a tempo.')],
              components: []
            });
          } catch {}
        }
      });
    }
  }
};
