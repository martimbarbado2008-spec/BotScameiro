const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { newDeck, handStr, blackjackValue } = require('../utils/deck');
const { baseEmbed, resultEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

const JOIN_TIME_MS = 20000;
const TURN_TIME_MS = 30000;

function joinRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bjt_join').setLabel('🃏 Entrar na mesa').setStyle(ButtonStyle.Success).setDisabled(disabled)
  );
}

function turnRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bjt_hit').setLabel('Pedir carta').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('bjt_stand').setLabel('Parar').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack-mesa')
    .setDescription('Abre uma mesa de blackjack multijogador contra o dealer')
    .addIntegerOption(o => o.setName('aposta').setDescription('Aposta que todos os jogadores fazem').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');

    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }

    const host = interaction.user;
    const hostUser = db.getUser(guildId, host.id);
    if (hostUser.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente para essa aposta.', ephemeral: true });
    }

    const players = new Map(); // userId -> { user, hand, done, busted }
    players.set(host.id, { user: host, hand: [], done: false, busted: false });

    const joinEmbed = baseEmbed('🃏 Mesa de Blackjack', COLORS.gold)
      .setDescription(`${host} abriu uma mesa com aposta de **${fmt(bet)}** por jogador.\nQualquer pessoa com saldo suficiente pode entrar nos próximos ${JOIN_TIME_MS / 1000}s.`)
      .addFields({ name: 'Jogadores', value: `${host.username}`, inline: false });

    const reply = await interaction.reply({ embeds: [joinEmbed], components: [joinRow()], fetchReply: true });

    const joinCollector = reply.createMessageComponentCollector({ time: JOIN_TIME_MS });

    joinCollector.on('collect', async i => {
      if (players.has(i.user.id)) {
        return i.reply({ content: 'Já estás na mesa.', ephemeral: true });
      }
      if (i.user.bot) {
        return i.reply({ content: 'Bots não podem jogar.', ephemeral: true });
      }
      const u = db.getUser(guildId, i.user.id);
      if (u.balance < bet) {
        return i.reply({ content: `Precisas de pelo menos ${fmt(bet)} para entrares.`, ephemeral: true });
      }
      players.set(i.user.id, { user: i.user, hand: [], done: false, busted: false });
      await i.reply({ content: 'Entraste na mesa!', ephemeral: true });

      const namesList = [...players.values()].map(p => p.user.username).join(', ');
      try {
        await interaction.editReply({
          embeds: [baseEmbed('🃏 Mesa de Blackjack', COLORS.gold)
            .setDescription(`${host} abriu uma mesa com aposta de **${fmt(bet)}** por jogador.\nQualquer pessoa com saldo suficiente pode entrar.`)
            .addFields({ name: 'Jogadores', value: namesList, inline: false })]
        });
      } catch {}
    });

    joinCollector.on('end', async () => {
      for (const [userId] of players) {
        const u = db.getUser(guildId, userId);
        if (u.balance < bet) players.delete(userId);
        else db.addBalance(guildId, userId, -bet);
      }

      if (players.size === 0) {
        try { await interaction.editReply({ embeds: [baseEmbed('🃏 Mesa de Blackjack', COLORS.neutral).setDescription('Ninguém entrou a tempo.')], components: [] }); } catch {}
        return;
      }

      const deck = newDeck();
      const dealer = [deck.pop(), deck.pop()];
      for (const p of players.values()) {
        p.hand = [deck.pop(), deck.pop()];
        if (blackjackValue(p.hand) === 21) { p.done = true; p.blackjack = true; }
      }

      const order = [...players.values()];
      let turnIdx = order.findIndex(p => !p.done);

      const tableEmbed = () => {
        const embed = baseEmbed('🃏 Mesa de Blackjack', COLORS.gold)
          .addFields({ name: 'Dealer', value: `${handStr([dealer[0]])} 🂠` });
        for (const p of order) {
          embed.addFields({
            name: `${p.user.username}${p.done ? (p.blackjack ? ' (Blackjack!)' : p.busted ? ' (rebentou)' : ' (parou)') : ' (a jogar)'}`,
            value: `${handStr(p.hand)} (${blackjackValue(p.hand)})`,
            inline: true
          });
        }
        return embed;
      };

      const advanceOrFinish = async (i) => {
        turnIdx = order.findIndex(p => !p.done);
        if (turnIdx === -1) {
          while (blackjackValue(dealer) < 17) dealer.push(deck.pop());
          const dealerVal = blackjackValue(dealer);

          const resultLines = [];
          for (const p of order) {
            const playerVal = blackjackValue(p.hand);
            let net;
            if (p.busted) {
              net = -bet;
            } else if (p.blackjack) {
              net = Math.round(bet * 1.5);
              db.addBalance(guildId, p.user.id, bet + net);
            } else if (dealerVal > 21 || playerVal > dealerVal) {
              net = bet;
              db.addBalance(guildId, p.user.id, bet + net);
            } else if (playerVal === dealerVal) {
              net = 0;
              db.addBalance(guildId, p.user.id, bet);
            } else {
              net = -bet;
            }
            db.recordResult(guildId, p.user.id, net > 0, bet);
            db.addTournamentScore(guildId, p.user.id, net);
            db.pushHistory(guildId, p.user.id, { game: 'Blackjack (mesa)', bet, net });
            const sign = net >= 0 ? '+' : '';
            resultLines.push(`**${p.user.username}**: ${handStr(p.hand)} (${playerVal}) → ${sign}${fmt(net)}`);
          }

          const finalEmbed = baseEmbed('🃏 Mesa de Blackjack — resultado final', COLORS.gold)
            .setDescription(`Dealer: ${handStr(dealer)} (${dealerVal})\n\n${resultLines.join('\n')}`);

          await i.update({ embeds: [finalEmbed], components: [] });

          for (const p of order) {
            const member = await interaction.guild.members.fetch(p.user.id).catch(() => null);
            if (!member) continue;
            const playerVal = blackjackValue(p.hand);
            const net = p.busted ? -bet : p.blackjack ? Math.round(bet * 1.5) : (dealerVal > 21 || playerVal > dealerVal) ? bet : playerVal === dealerVal ? 0 : -bet;
            await progression.afterGameForMember(interaction, member, { game: 'Blackjack (mesa)', bet, net, won: net > 0 }).catch(() => {});
          }
          return;
        }

        const current = order[turnIdx];
        await i.update({ embeds: [tableEmbed().addFields({ name: 'Vez de', value: current.user.username })], components: [turnRow()] });
      };

      const turnMsg = await interaction.editReply({
        embeds: [tableEmbed().addFields({ name: 'Vez de', value: order[turnIdx].user.username })],
        components: [turnRow()],
        fetchReply: true
      });

      const turnCollector = turnMsg.createMessageComponentCollector({ time: TURN_TIME_MS * order.length + 15000 });

      turnCollector.on('collect', async i => {
        const current = order[turnIdx];
        if (i.user.id !== current.user.id) {
          return i.reply({ content: `Não é a tua vez, é a vez de ${current.user.username}.`, ephemeral: true });
        }

        if (i.customId === 'bjt_hit') {
          current.hand.push(deck.pop());
          if (blackjackValue(current.hand) > 21) {
            current.busted = true;
            current.done = true;
            return advanceOrFinish(i);
          }
          return i.update({ embeds: [tableEmbed().addFields({ name: 'Vez de', value: current.user.username })], components: [turnRow()] });
        }

        if (i.customId === 'bjt_stand') {
          current.done = true;
          return advanceOrFinish(i);
        }
      });

      turnCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          for (const p of order) {
            if (!p.done) { p.done = true; p.busted = true; }
          }
          try { await interaction.editReply({ embeds: [tableEmbed()], components: [] }); } catch {}
        }
      });
    });
  }
};
