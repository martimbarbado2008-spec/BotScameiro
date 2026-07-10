const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { RANKS } = require('../utils/deck');
const { baseEmbed, resultEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

const SUITS = ['♠', '♥', '♦', '♣'];
const HOUSE_EDGE = 0.95;

function randomCard() {
  return { rank: RANKS[Math.floor(Math.random() * RANKS.length)], suit: SUITS[Math.floor(Math.random() * SUITS.length)] };
}

function cardStr(c) {
  return `${c.rank}${c.suit}`;
}

function rankIndex(c) {
  return RANKS.indexOf(c.rank);
}

function buildRow(canCashOut, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hl_higher').setLabel('⬆️ Maior').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('hl_lower').setLabel('⬇️ Menor').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId('hl_cashout').setLabel('💰 Sacar').setStyle(ButtonStyle.Primary).setDisabled(disabled || !canCashOut)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('higherlower')
    .setDescription('Adivinha se a próxima carta é maior ou menor. Cada acerto aumenta o multiplicador.')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'higherlower');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'higherlower', cfg.higherlowerCooldownMs);
    db.addBalance(guildId, userId, -bet);

    let current = randomCard();
    let multiplier = 1;
    let rounds = 0;

    const finish = async (i, won, message) => {
      const winnings = won ? Math.round(bet * multiplier) : 0;
      const net = winnings - bet;
      if (winnings > 0) db.addBalance(guildId, userId, winnings);
      db.recordResult(guildId, userId, net > 0, bet);
      db.addTournamentScore(guildId, userId, net);
      const newBalance = db.getUser(guildId, userId).balance;

      const embed = resultEmbed({
        title: '🔼🔽 Higher/Lower',
        description: `Última carta: **${cardStr(current)}**\n\n${message}`,
        won: net > 0,
        fields: [
          { name: 'Aposta', value: fmt(bet), inline: true },
          { name: net >= 0 ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
          { name: 'Saldo', value: fmt(newBalance), inline: true }
        ]
      });
      await i.update({ embeds: [embed], components: [buildRow(false, true)] });
      const { xpResult, newBadges } = await progression.afterGame(i, { game: 'Higher/Lower', bet, net, won: net > 0 });
      return progression.notify(i, xpResult, newBadges);
    };

    const embed = baseEmbed('🔼🔽 Higher/Lower', COLORS.gold)
      .setDescription(`Carta atual: **${cardStr(current)}**\n\nA próxima carta vai ser maior ou menor?`)
      .addFields({ name: 'Multiplicador', value: `x${multiplier.toFixed(2)}`, inline: true });

    const reply = await interaction.reply({ embeds: [embed], components: [buildRow(false)], fetchReply: true });

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'hl_cashout') {
        collector.stop('cashout');
        return finish(i, true, `Sacaste com multiplicador **x${multiplier.toFixed(2)}**!`);
      }

      const next = randomCard();
      const guessHigher = i.customId === 'hl_higher';
      const curIdx = rankIndex(current);
      const nextIdx = rankIndex(next);

      if (nextIdx === curIdx) {
        // empate: redesenha sem alterar o multiplicador
        current = next;
        const pushEmbed = baseEmbed('🔼🔽 Higher/Lower', COLORS.info)
          .setDescription(`Empate! Nova carta: **${cardStr(current)}** — a mesma ronda repete-se.`)
          .addFields({ name: 'Multiplicador', value: `x${multiplier.toFixed(2)}`, inline: true });
        return i.update({ embeds: [pushEmbed], components: [buildRow(rounds > 0)] });
      }

      const correct = guessHigher ? nextIdx > curIdx : nextIdx < curIdx;
      current = next;

      if (!correct) {
        collector.stop('lost');
        return finish(i, false, `Errado! A carta era **${cardStr(current)}**. Perdeste tudo.`);
      }

      rounds += 1;
      const probability = guessHigher
        ? (RANKS.length - 1 - curIdx) / (RANKS.length - 1)
        : curIdx / (RANKS.length - 1);
      const stepMult = probability > 0 ? HOUSE_EDGE / probability : 2;
      multiplier *= Math.min(stepMult, 4);

      const nextEmbed = baseEmbed('🔼🔽 Higher/Lower', COLORS.gold)
        .setDescription(`Acertaste! Carta atual: **${cardStr(current)}**\n\nContinuas ou sacas?`)
        .addFields({ name: 'Multiplicador', value: `x${multiplier.toFixed(2)}`, inline: true });

      return i.update({ embeds: [nextEmbed], components: [buildRow(true)] });
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // tempo esgotado sem decisão: perde a aposta (já foi retirada no início)
        try {
          db.recordResult(guildId, userId, false, bet);
          db.addTournamentScore(guildId, userId, -bet);
          await interaction.editReply({ components: [buildRow(false, true)] });
        } catch {}
      }
    });
  }
};
