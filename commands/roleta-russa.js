const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { afterGame, notify } = require('../utils/progression');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

const MULTIPLIERS = [1.2, 1.5, 2.0, 3.0, 5.0];
const DEATH_CHANCES = ['16.6%', '20%', '25%', '33%', '50%'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleta-russa')
    .setDescription('Jogo de sobrevivência solo: aposta moedas e puxa o gatilho. Quanto mais arriscas, mais ganhas!')
    .addIntegerOption(option =>
      option.setName('aposta')
        .setDescription('Quantia de moedas a apostar')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('aposta');

    const cfg = db.getGuildConfig(guildId);
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `Aposta inválida. O limite deste servidor é entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }

    const user = db.getUser(guildId, userId);
    if (user.balance < bet) {
      return interaction.reply({ content: `Não tens saldo suficiente! Saldo atual: ${fmt(user.balance)}`, ephemeral: true });
    }

    // Deduz a aposta inicial
    db.addBalance(guildId, userId, -bet);

    // Inicializa o tambor do revólver (6 câmaras, 1 bala aleatória)
    const bulletPosition = Math.floor(Math.random() * 6);
    let currentChamber = 0;
    let round = 1; // Ronda 1 a 5

    function getRows() {
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('russa_trigger')
            .setStyle(ButtonStyle.Danger)
            .setLabel('💥 Premir Gatilho'),
          new ButtonBuilder()
            .setCustomId('russa_cashout')
            .setStyle(ButtonStyle.Success)
            .setLabel(`💰 Levantar ${fmt(bet * MULTIPLIERS[round - 1])}`)
        )
      ];
    }

    function getGameEmbed() {
      const mult = MULTIPLIERS[round - 1];
      const nextMult = MULTIPLIERS[round] || 'Máximo atingido';
      const deathChance = DEATH_CHANCES[round - 1];
      
      return baseEmbed('🔫 Roleta Russa', COLORS.gold)
        .setDescription(`Meteste **${fmt(bet)}** no tambor. O revólver tem 6 câmaras e 1 bala.\nEstás na **Ronda ${round}/5**.\n\n` + 
          `• Multiplicador Atual: **${mult}x**\n` +
          `• Se levantares agora: **${fmt(bet * mult)}**\n` +
          `• Risco de disparo nesta ronda: **${deathChance}**\n` +
          `• Próxima ronda: **${nextMult}x**`)
        .addFields(
          { name: 'Câmara atual', value: `👉 [ ${currentChamber + 1} / 6 ]`, inline: true },
          { name: 'Saldo Restante', value: fmt(db.getUser(guildId, userId).balance), inline: true }
        );
    }

    const reply = await interaction.reply({
      embeds: [getGameEmbed()],
      components: getRows(),
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 45000
    });

    async function finishGame(i, type, auto = false) {
      collector.stop();
      const finalUser = db.getUser(guildId, userId);

      if (type === 'dead') {
        const net = -bet;
        const { xpResult, newBadges } = await afterGame(interaction, { game: 'Roleta Russa', bet, net, won: false });

        const embed = baseEmbed('💥 *BOOM!* Disparou!', COLORS.lose)
          .setDescription(`A bala estava na câmara ${bulletPosition + 1}.\nPremiste o gatilho na câmara ${currentChamber + 1} e a arma disparou! Perdeste tudo.`)
          .addFields(
            { name: 'Aposta Perdida', value: fmt(bet), inline: true },
            { name: 'Novo Saldo', value: fmt(finalUser.balance), inline: true }
          );

        const payload = { embeds: [embed], components: [] };
        if (auto) {
          await interaction.editReply(payload).catch(() => {});
        } else {
          await i.update(payload).catch(() => {});
        }
        await notify(interaction, xpResult, newBadges);
      } else if (type === 'cashout') {
        const mult = MULTIPLIERS[round - 1];
        const prize = Math.round(bet * mult);
        const net = prize - bet;

        db.addBalance(guildId, userId, prize);

        const { xpResult, newBadges } = await afterGame(interaction, { game: 'Roleta Russa', bet, net, won: true });

        const embed = baseEmbed('💰 Retirada segura!', COLORS.win)
          .setDescription(`Decidiste não arriscar mais e retiraste-te na ronda ${round}.\nGanhaste **${fmt(prize)}** (${mult}x aposta).`)
          .addFields(
            { name: 'Aposta', value: fmt(bet), inline: true },
            { name: 'Prémio total', value: fmt(prize), inline: true },
            { name: 'Novo Saldo', value: fmt(db.getUser(guildId, userId).balance), inline: true }
          );

        const payload = { embeds: [embed], components: [] };
        if (auto) {
          await interaction.editReply(payload).catch(() => {});
        } else {
          await i.update(payload).catch(() => {});
        }
        await notify(interaction, xpResult, newBadges);
      }
    }

    collector.on('collect', async i => {
      if (i.customId === 'russa_cashout') {
        await finishGame(i, 'cashout');
      } else if (i.customId === 'russa_trigger') {
        // Verifica se a bala está nesta câmara
        if (currentChamber === bulletPosition) {
          await finishGame(i, 'dead');
        } else {
          // Sobreviveu!
          if (round === 5) {
            // Completou a última ronda com sucesso, cashout automático
            round = 5;
            await finishGame(i, 'cashout');
          } else {
            currentChamber++;
            round++;
            await i.update({
              embeds: [getGameEmbed()],
              components: getRows()
            }).catch(() => {});
          }
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Se der timeout, faz cashout automático do multiplicador atual
        await finishGame(null, 'cashout', true);
      }
    });
  }
};
