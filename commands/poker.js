const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { newDeck, handStr } = require('../utils/deck');
const { evaluateHand, compareHands } = require('../utils/pokerHand');
const { resultEmbed, baseEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('5 card draw contra o bot: troca até 3 cartas e compara mãos')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'poker');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'poker', 10000);
    db.addBalance(guildId, userId, -bet);

    const deck = newDeck();
    let player = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    const bot = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

    const options = player.map((c, idx) => ({
      label: `${c.rank}${c.suit}`,
      value: String(idx)
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('poker_swap')
        .setPlaceholder('Seleciona até 3 cartas para trocar (ou nenhuma)')
        .setMinValues(0)
        .setMaxValues(5)
        .addOptions(options)
    );
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('poker_confirm').setLabel('Confirmar troca').setStyle(ButtonStyle.Primary)
    );

    const embed = baseEmbed('🃏 Poker — 5 card draw', COLORS.gold)
      .setDescription(`A tua mão: **${handStr(player)}**\n\nEscolhe as cartas que queres trocar (máx. 3) e depois confirma.`);

    const reply = await interaction.reply({ embeds: [embed], components: [selectRow, confirmRow], fetchReply: true });

    let toSwap = [];

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 45000 });

    collector.on('collect', async i => {
      if (i.customId === 'poker_swap') {
        toSwap = i.values.map(v => parseInt(v, 10));
        if (toSwap.length > 3) {
          return i.reply({ content: 'Só podes trocar até 3 cartas. Confirma na mesma para trocar as 3 primeiras selecionadas.', ephemeral: true });
        }
        return i.deferUpdate();
      }

      if (i.customId === 'poker_confirm') {
        for (const idx of toSwap.slice(0, 3)) {
          player[idx] = deck.pop();
        }

        const playerHand = evaluateHand(player);
        const botHand = evaluateHand(bot);
        const cmp = compareHands(playerHand, botHand);

        let outcome, message;
        if (cmp > 0) { outcome = 'win'; message = `Ganhaste com **${playerHand.name}** contra **${botHand.name}** do bot.`; }
        else if (cmp === 0) { outcome = 'push'; message = `Empate: ambos com **${playerHand.name}**.`; }
        else { outcome = 'lose'; message = `O bot venceu com **${botHand.name}** contra o teu **${playerHand.name}**.`; }

        let winnings = 0;
        if (outcome === 'win') winnings = bet * 2;
        if (outcome === 'push') winnings = bet;
        const net = winnings - bet;
        if (winnings > 0) db.addBalance(guildId, userId, winnings);
        db.recordResult(guildId, userId, net > 0, bet);
        db.addTournamentScore(guildId, userId, net);
        const newBalance = db.getUser(guildId, userId).balance;

        const finalEmbed = resultEmbed({
          title: '🃏 Poker — resultado',
          description: `A tua mão final: ${handStr(player)}\nMão do bot: ${handStr(bot)}\n\n${message}`,
          won: net > 0,
          fields: [
            { name: 'Aposta', value: fmt(bet), inline: true },
            { name: net >= 0 ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
            { name: 'Saldo', value: fmt(newBalance), inline: true }
          ]
        });

        collector.stop('done');
        await i.update({ embeds: [finalEmbed], components: [] });
        const { xpResult, newBadges } = await progression.afterGame(i, { game: 'Poker', bet, net, won: net > 0 });
        return progression.notify(i, xpResult, newBadges);
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        try { await interaction.editReply({ components: [] }); } catch {}
      }
    });
  }
};
