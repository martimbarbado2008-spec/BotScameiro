const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, resultEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

const GRID_SIZE = 20; // 4 linhas x 5 colunas de células + 1 linha para o botão de sacar
const HOUSE_EDGE = 0.97;

function combinations(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

// multiplicador justo para k revelações seguras entre N células com m minas, com margem da casa
function multiplierFor(revealed, mines) {
  const fair = combinations(GRID_SIZE, revealed) / combinations(GRID_SIZE - mines, revealed);
  return Math.max(1, fair * HOUSE_EDGE);
}

function buildGrid(board, revealed, exploded, reveal_all) {
  const rows = [];
  for (let r = 0; r < 4; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      const isRevealed = revealed.has(idx);
      const isMine = board[idx] === 'mine';
      let label = '❓';
      let style = ButtonStyle.Secondary;
      if (isRevealed) {
        label = isMine ? '💣' : '💎';
        style = isMine ? ButtonStyle.Danger : ButtonStyle.Success;
      } else if (reveal_all && isMine) {
        label = '💣';
        style = ButtonStyle.Danger;
      }
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines_${idx}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(isRevealed || exploded || reveal_all)
      );
    }
    rows.push(row);
  }
  return rows;
}

function cashoutRow(disabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mines_cashout').setLabel('💰 Sacar').setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('Campo minado: revela células seguras e saca antes de acertares numa mina')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1))
    .addIntegerOption(o => o.setName('minas').setDescription('Número de minas no campo (1-15)').setRequired(true).setMinValue(1).setMaxValue(15)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const mines = interaction.options.getInteger('minas');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'mines');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'mines', cfg.minesCooldownMs);
    db.addBalance(guildId, userId, -bet);

    const board = Array(GRID_SIZE).fill('safe');
    const minePositions = new Set();
    while (minePositions.size < mines) {
      minePositions.add(Math.floor(Math.random() * GRID_SIZE));
    }
    for (const idx of minePositions) board[idx] = 'mine';

    const revealed = new Set();

    const embed = baseEmbed('💣 Mines', COLORS.gold)
      .setDescription(`Campo com **${mines}** minas em ${GRID_SIZE} células.\nRevela células e saca quando quiseres.`)
      .addFields({ name: 'Multiplicador atual', value: 'x1.00', inline: true });

    const reply = await interaction.reply({
      embeds: [embed],
      components: [...buildGrid(board, revealed, false, false), cashoutRow(true)],
      fetchReply: true
    });

    const finish = async (i, won, multiplier, message) => {
      const winnings = won ? Math.round(bet * multiplier) : 0;
      const net = winnings - bet;
      if (winnings > 0) db.addBalance(guildId, userId, winnings);
      db.recordResult(guildId, userId, net > 0, bet);
      db.addTournamentScore(guildId, userId, net);
      const newBalance = db.getUser(guildId, userId).balance;

      const finalEmbed = resultEmbed({
        title: '💣 Mines',
        description: message,
        won: net > 0,
        fields: [
          { name: 'Aposta', value: fmt(bet), inline: true },
          { name: net >= 0 ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
          { name: 'Saldo', value: fmt(newBalance), inline: true }
        ]
      });

      await i.update({ embeds: [finalEmbed], components: [...buildGrid(board, revealed, !won, true), cashoutRow(true)] });
      const { xpResult, newBadges } = await progression.afterGame(i, { game: 'Mines', bet, net, won: net > 0 });
      return progression.notify(i, xpResult, newBadges);
    };

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'mines_cashout') {
        collector.stop('cashout');
        const multiplier = multiplierFor(revealed.size, mines);
        return finish(i, true, multiplier, `Sacaste com **${revealed.size}** células reveladas, multiplicador **x${multiplier.toFixed(2)}**! 💰`);
      }

      const idx = parseInt(i.customId.replace('mines_', ''), 10);
      if (revealed.has(idx)) return i.deferUpdate();

      if (board[idx] === 'mine') {
        revealed.add(idx);
        collector.stop('exploded');
        return finish(i, false, 0, `💥 Encontraste uma mina! Perdeste a aposta de ${fmt(bet)}.`);
      }

      revealed.add(idx);
      if (revealed.size === GRID_SIZE - mines) {
        // todas as células seguras reveladas: paga automaticamente o máximo
        collector.stop('cleared');
        const multiplier = multiplierFor(revealed.size, mines);
        return finish(i, true, multiplier, `Limpaste o campo todo! Multiplicador final **x${multiplier.toFixed(2)}**! 🏆`);
      }

      const multiplier = multiplierFor(revealed.size, mines);
      const nextEmbed = baseEmbed('💣 Mines', COLORS.gold)
        .setDescription(`Campo com **${mines}** minas. Célula segura! Continua ou saca.`)
        .addFields({ name: 'Multiplicador atual', value: `x${multiplier.toFixed(2)}`, inline: true });

      return i.update({ embeds: [nextEmbed], components: [...buildGrid(board, revealed, false, false), cashoutRow(false)] });
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        db.recordResult(guildId, userId, false, bet);
        db.addTournamentScore(guildId, userId, -bet);
        try {
          await interaction.editReply({ components: [...buildGrid(board, revealed, true, true), cashoutRow(true)] });
        } catch {}
      }
    });
  }
};
