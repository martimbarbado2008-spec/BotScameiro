const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, resultEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

const TICK_MS = 700;
const GROWTH = 1.06;

function generateCrashPoint() {
  // ~5% de chance de rebentar logo em x1.00 (vantagem da casa)
  if (Math.random() < 0.05) return 1.00;
  const r = Math.random();
  const point = Math.min(20, (1 / (1 - r)) * 0.97);
  return Math.max(1.02, Math.round(point * 100) / 100);
}

function buildRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('crash_cashout').setLabel('💰 Sacar').setStyle(ButtonStyle.Success).setDisabled(disabled)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crash')
    .setDescription('O multiplicador sobe em tempo real. Saca antes que rebente!')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'crash');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'crash', cfg.crashCooldownMs);
    db.addBalance(guildId, userId, -bet);

    const crashPoint = generateCrashPoint();
    let multiplier = 1.0;
    let cashedOut = false;
    let crashed = false;

    const embed = baseEmbed('🚀 Crash', COLORS.gold)
      .setDescription(`Multiplicador: **x${multiplier.toFixed(2)}**\n\nSaca antes que rebente!`);

    const reply = await interaction.reply({ embeds: [embed], components: [buildRow()], fetchReply: true });

    const finish = async (i, won, finalMultiplier, message) => {
      const winnings = won ? Math.round(bet * finalMultiplier) : 0;
      const net = winnings - bet;
      if (winnings > 0) db.addBalance(guildId, userId, winnings);
      db.recordResult(guildId, userId, net > 0, bet);
      db.addTournamentScore(guildId, userId, net);
      const newBalance = db.getUser(guildId, userId).balance;

      const finalEmbed = resultEmbed({
        title: '🚀 Crash',
        description: message,
        won: net > 0,
        fields: [
          { name: 'Aposta', value: fmt(bet), inline: true },
          { name: net >= 0 ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
          { name: 'Saldo', value: fmt(newBalance), inline: true }
        ]
      });

      if (i) {
        await i.update({ embeds: [finalEmbed], components: [buildRow(true)] });
      } else {
        await interaction.editReply({ embeds: [finalEmbed], components: [buildRow(true)] }).catch(() => {});
      }
      const ctx = i || interaction;
      const { xpResult, newBadges } = await progression.afterGame(ctx, { game: 'Crash', bet, net, won: net > 0 });
      return progression.notify(ctx, xpResult, newBadges);
    };

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 30000 });
    let cashoutInteraction = null;

    collector.on('collect', async i => {
      if (crashed || cashedOut) return;
      cashedOut = true;
      cashoutInteraction = i;
      collector.stop('cashout');
    });

    const interval = setInterval(async () => {
      if (cashedOut || crashed) { clearInterval(interval); return; }
      multiplier = Math.round(multiplier * GROWTH * 100) / 100;

      if (multiplier >= crashPoint) {
        crashed = true;
        clearInterval(interval);
        collector.stop('crashed');
        await finish(null, false, 0, `💥 Rebentou em **x${crashPoint.toFixed(2)}**! Perdeste a aposta.`);
        return;
      }

      try {
        await interaction.editReply({
          embeds: [baseEmbed('🚀 Crash', COLORS.gold).setDescription(`Multiplicador: **x${multiplier.toFixed(2)}**\n\nSaca antes que rebente!`)],
          components: [buildRow()]
        });
      } catch {
        clearInterval(interval);
      }
    }, TICK_MS);

    collector.on('end', async (collected, reason) => {
      clearInterval(interval);
      if (reason === 'cashout' && cashoutInteraction) {
        await finish(cashoutInteraction, true, multiplier, `Sacaste a **x${multiplier.toFixed(2)}**! 💰`);
      } else if (reason === 'time' && !crashed && !cashedOut) {
        crashed = true;
        await finish(null, false, 0, `⏱️ Tempo esgotado, o multiplicador ficou em **x${multiplier.toFixed(2)}** e rebentou. Perdeste a aposta.`);
      }
    });
  }
};
