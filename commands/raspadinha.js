const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { afterGame, notify } = require('../utils/progression');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

const COST = 100;

const SYMBOLS_INFO = {
  '🍒': { name: 'Cereja', prize: 200 },
  '🍋': { name: 'Limão', prize: 350 },
  '🍇': { name: 'Uva', prize: 600 },
  '💎': { name: 'Diamante', prize: 1500 },
  '7️⃣': { name: 'Sete', prize: 5000 },
  '❌': { name: 'Nada', prize: 0 },
  '🍀': { name: 'Trevo', prize: 0 }
};

function generateScratchcard() {
  const winChance = 0.35; // 35% chance to win
  const isWinner = Math.random() < winChance;
  const grid = Array(9).fill(null);
  
  if (isWinner) {
    const rand = Math.random();
    let winSym = '🍒';
    if (rand < 0.02) winSym = '7️⃣';
    else if (rand < 0.08) winSym = '💎';
    else if (rand < 0.20) winSym = '🍇';
    else if (rand < 0.50) winSym = '🍋';
    else winSym = '🍒';

    let placed = 0;
    while (placed < 3) {
      const idx = Math.floor(Math.random() * 9);
      if (grid[idx] === null) {
        grid[idx] = winSym;
        placed++;
      }
    }
  }

  const pool = ['🍒', '🍋', '🍇', '💎', '7️⃣', '❌', '🍀'];
  for (let i = 0; i < 9; i++) {
    if (grid[i] !== null) continue;
    const counts = {};
    grid.forEach(s => { if (s) counts[s] = (counts[s] || 0) + 1; });
    const safePool = pool.filter(s => (counts[s] || 0) < 2);
    const sym = safePool.length > 0 ? safePool[Math.floor(Math.random() * safePool.length)] : '❌';
    grid[i] = sym;
  }
  
  return grid;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raspadinha')
    .setDescription(`Compra uma raspadinha por ${COST} moedas e raspa os botões para ganhar`),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const user = db.getUser(guildId, userId);

    if (user.balance < COST) {
      return interaction.reply({ content: `Não tens moedas suficientes! A raspadinha custa ${fmt(COST)}.`, ephemeral: true });
    }

    // Deduz o custo
    db.addBalance(guildId, userId, -COST);

    const card = generateScratchcard();
    const revealed = Array(9).fill(false);
    let clicks = 0;

    function getRows() {
      const rows = [];
      for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
          const idx = r * 3 + c;
          const btn = new ButtonBuilder()
            .setCustomId(`scratch_${idx}`)
            .setStyle(revealed[idx] ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setLabel(revealed[idx] ? card[idx] : '❓')
            .setDisabled(revealed[idx]);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      
      // Adiciona um botão "Raspar Tudo" se ainda não foi todo raspado
      if (clicks < 9) {
        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('scratch_all')
            .setStyle(ButtonStyle.Success)
            .setLabel('⚡ Raspar Tudo')
        );
        rows.push(actionRow);
      }
      return rows;
    }

    const embed = baseEmbed('🎫 Raspadinha da Sorte', COLORS.gold)
      .setDescription(`Custa **${fmt(COST)}**. Clica nos botões abaixo para raspar ou clica em **Raspar Tudo**!\nProcura **3 símbolos iguais** para ganhares prémio.`)
      .addFields({ name: 'Saldo Restante', value: fmt(user.balance), inline: true });

    const reply = await interaction.reply({
      embeds: [embed],
      components: getRows(),
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 60000
    });

    async function finishGame(i, autoScraped = false) {
      collector.stop();
      revealed.fill(true);
      
      // Conta os símbolos
      const counts = {};
      card.forEach(s => { counts[s] = (counts[s] || 0) + 1; });

      let winSymbol = null;
      let winAmount = 0;
      for (const [sym, count] of Object.entries(counts)) {
        if (count >= 3 && SYMBOLS_INFO[sym].prize > 0) {
          winSymbol = sym;
          winAmount = SYMBOLS_INFO[sym].prize;
          break;
        }
      }

      let resultText = '';
      let won = false;
      let net = -COST;

      if (winSymbol) {
        won = true;
        net = winAmount - COST;
        db.addBalance(guildId, userId, winAmount);
        resultText = `🎉 **Ganhaste!** Encontraste 3x ${winSymbol} (${SYMBOLS_INFO[winSymbol].name}) e levaste **${fmt(winAmount)}**!`;
      } else {
        resultText = `😢 **Não foi desta vez!** Não encontraste nenhum conjunto de 3. Tenta a tua sorte outra vez!`;
      }

      // Progression / XP
      const { xpResult, newBadges } = await afterGame(interaction, { game: 'Raspadinha', bet: COST, net, won });
      
      const finalEmbed = baseEmbed(won ? '🎫 Raspadinha Premiada!' : '🎫 Raspadinha Tenta de Novo', won ? COLORS.win : COLORS.lose)
        .setDescription(`${resultText}\n\n**Grelha final:**\n` + 
          `| ${card[0]} | ${card[1]} | ${card[2]} |\n` +
          `| ${card[3]} | ${card[4]} | ${card[5]} |\n` +
          `| ${card[6]} | ${card[7]} | ${card[8]} |`
        )
        .addFields(
          { name: 'Aposta', value: fmt(COST), inline: true },
          { name: 'Prémio', value: fmt(winAmount), inline: true },
          { name: 'Novo Saldo', value: fmt(db.getUser(guildId, userId).balance), inline: true }
        );

      const payload = { embeds: [finalEmbed], components: [] };
      if (autoScraped) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await i.update(payload).catch(() => {});
      }
      await notify(interaction, xpResult, newBadges);
    }

    collector.on('collect', async i => {
      if (i.customId === 'scratch_all') {
        clicks = 9;
        await finishGame(i);
      } else {
        const idx = parseInt(i.customId.replace('scratch_', ''), 10);
        if (!revealed[idx]) {
          revealed[idx] = true;
          clicks++;
        }
        if (clicks >= 9) {
          await finishGame(i);
        } else {
          await i.update({ components: getRows() }).catch(() => {});
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && clicks < 9) {
        // Auto-raspa se o tempo acabar
        await finishGame(null, true);
      }
    });
  }
};
