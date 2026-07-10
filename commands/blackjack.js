const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { newDeck, handStr, blackjackValue } = require('../utils/deck');
const { resultEmbed, baseEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

function buildRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Pedir carta').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Parar').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}

function stateEmbed(deck, player, dealer, hideDealer, footer) {
  const dealerDisplay = hideDealer
    ? `${handStr([dealer[0]])} 🂠`
    : `${handStr(dealer)} (${blackjackValue(dealer)})`;

  return baseEmbed('🃏 Blackjack', COLORS.gold)
    .addFields(
      { name: 'A tua mão', value: `${handStr(player)} (${blackjackValue(player)})` },
      { name: 'Mão do dealer', value: dealerDisplay }
    )
    .setFooter({ text: footer || 'Pede carta ou para.' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Joga blackjack contra o dealer')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'blackjack');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'blackjack', cfg.blackjackCooldownMs);
    db.addBalance(guildId, userId, -bet); // retira a aposta já, devolve conforme resultado

    const deck = newDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];

    const finish = async (outcome, message) => {
      let winnings = 0;
      if (outcome === 'win') winnings = bet * 2;
      if (outcome === 'blackjack') winnings = Math.round(bet * 2.5);
      if (outcome === 'push') winnings = bet;
      const net = winnings - bet;
      if (winnings > 0) db.addBalance(guildId, userId, winnings);
      db.recordResult(guildId, userId, net > 0, bet);
      db.addTournamentScore(guildId, userId, net);
      const newBalance = db.getUser(guildId, userId).balance;

      const embed = resultEmbed({
        title: '🃏 Blackjack',
        description: `${handStr(player)} (${blackjackValue(player)}) vs ${handStr(dealer)} (${blackjackValue(dealer)})\n\n${message}`,
        won: net > 0,
        fields: [
          { name: 'Aposta', value: fmt(bet), inline: true },
          { name: net >= 0 ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
          { name: 'Saldo', value: fmt(newBalance), inline: true }
        ]
      });
      return { embed, net };
    };

    if (blackjackValue(player) === 21) {
      const { embed, net } = await finish('blackjack', 'Blackjack natural! Pagamento 3:2.');
      await interaction.reply({ embeds: [embed] });
      const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Blackjack', bet, net, won: net > 0 });
      return progression.notify(interaction, xpResult, newBadges);
    }

    const reply = await interaction.reply({
      embeds: [stateEmbed(deck, player, dealer, true)],
      components: [buildRow()],
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.customId === 'bj_hit') {
        player.push(deck.pop());
        const value = blackjackValue(player);
        if (value > 21) {
          collector.stop('bust');
          const { embed, net } = await finish('lose', 'Rebentaste! O dealer vence.');
          await i.update({ embeds: [embed], components: [buildRow(true)] });
          const { xpResult, newBadges } = await progression.afterGame(i, { game: 'Blackjack', bet, net, won: false });
          return progression.notify(i, xpResult, newBadges);
        }
        return i.update({ embeds: [stateEmbed(deck, player, dealer, true)], components: [buildRow()] });
      }

      if (i.customId === 'bj_stand') {
        while (blackjackValue(dealer) < 17) {
          dealer.push(deck.pop());
        }
        const playerVal = blackjackValue(player);
        const dealerVal = blackjackValue(dealer);
        let outcome, message;
        if (dealerVal > 21 || playerVal > dealerVal) { outcome = 'win'; message = 'Ganhaste!'; }
        else if (playerVal === dealerVal) { outcome = 'push'; message = 'Empate, aposta devolvida.'; }
        else { outcome = 'lose'; message = 'O dealer vence.'; }

        collector.stop('done');
        const { embed, net } = await finish(outcome, message);
        await i.update({ embeds: [embed], components: [buildRow(true)] });
        const { xpResult, newBadges } = await progression.afterGame(i, { game: 'Blackjack', bet, net, won: net > 0 });
        return progression.notify(i, xpResult, newBadges);
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        db.recordResult(guildId, userId, false, bet);
        db.addTournamentScore(guildId, userId, -bet);
        const embed = resultEmbed({
          title: '🃏 Blackjack',
          description: 'Tempo esgotado. A aposta foi perdida.',
          won: false,
          fields: [{ name: 'Perdeste', value: fmt(bet), inline: true }]
        });
        try {
          await interaction.editReply({ embeds: [embed], components: [buildRow(true)] });
          const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Blackjack', bet, net: -bet, won: false });
          await progression.notify(interaction, xpResult, newBadges);
        } catch {}
      }
    });
  }
};
