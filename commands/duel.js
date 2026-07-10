const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, resultEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

const CHOICES = { pedra: '🪨 Pedra', papel: '📄 Papel', tesoura: '✂️ Tesoura' };

function beats(a, b) {
  return (a === 'pedra' && b === 'tesoura') ||
         (a === 'papel' && b === 'pedra') ||
         (a === 'tesoura' && b === 'papel');
}

function buildRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('duel_pedra').setLabel('🪨 Pedra').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('duel_papel').setLabel('📄 Papel').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('duel_tesoura').setLabel('✂️ Tesoura').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duelo')
    .setDescription('Desafia outro jogador para pedra-papel-tesoura ao melhor de 3, com aposta')
    .addUserOption(o => o.setName('oponente').setDescription('Quem desafias').setRequired(true))
    .addIntegerOption(o => o.setName('valor').setDescription('Quantidade apostada por cada jogador').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('oponente');
    const amount = interaction.options.getInteger('valor');

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
      return interaction.reply({ content: `${opponent.username} não tem saldo suficiente para aceitar essa aposta.`, ephemeral: true });
    }

    const startEmbed = baseEmbed('⚔️ Duelo — Pedra, Papel, Tesoura', COLORS.info)
      .setDescription(`${challenger} desafiou ${opponent} para um duelo ao melhor de 3, valendo **${fmt(amount)}**.\n\nAmbos escolham em segredo (só tu vês a confirmação). Ronda 1!`);

    const reply = await interaction.reply({ embeds: [startEmbed], components: [buildRow()], fetchReply: true });

    let scoreChallenger = 0;
    let scoreOpponent = 0;
    let round = 1;
    const choices = {};

    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === challenger.id || i.user.id === opponent.id,
      time: 120000
    });

    const finishDuel = async (i) => {
      const winner = scoreChallenger > scoreOpponent ? challenger : opponent;
      const loser = winner.id === challenger.id ? opponent : challenger;

      db.addBalance(guildId, winner.id, amount);
      db.addBalance(guildId, loser.id, -amount);
      db.recordResult(guildId, winner.id, true, amount);
      db.recordResult(guildId, loser.id, false, amount);
      db.addTournamentScore(guildId, winner.id, amount);
      db.addTournamentScore(guildId, loser.id, -amount);

      const finalEmbed = resultEmbed({
        title: '⚔️ Duelo — resultado final',
        description: `**${winner.username}** venceu o duelo por ${Math.max(scoreChallenger, scoreOpponent)}-${Math.min(scoreChallenger, scoreOpponent)}!`,
        won: true,
        fields: [
          { name: 'Ganhou', value: `${winner.username} (+${fmt(amount)})`, inline: true },
          { name: 'Perdeu', value: `${loser.username} (-${fmt(amount)})`, inline: true }
        ]
      });

      collector.stop('done');
      await i.update({ embeds: [finalEmbed], components: [buildRow(true)] });

      const guild = interaction.guild;
      const winnerMember = await guild.members.fetch(winner.id).catch(() => null);
      const loserMember = await guild.members.fetch(loser.id).catch(() => null);
      if (winnerMember) await progression.afterGameForMember(interaction, winnerMember, { game: 'Duelo', bet: amount, net: amount, won: true }).catch(() => {});
      if (loserMember) await progression.afterGameForMember(interaction, loserMember, { game: 'Duelo', bet: amount, net: -amount, won: false }).catch(() => {});
    };

    collector.on('collect', async i => {
      const isChallenger = i.user.id === challenger.id;
      const playerKey = isChallenger ? 'challenger' : 'opponent';
      
      if (choices[playerKey]) {
        return i.deferUpdate().catch(() => {});
      }

      const pick = i.customId.replace('duel_', '');
      choices[playerKey] = pick;

      if (!choices.challenger || !choices.opponent) {
        const statusEmbed = baseEmbed('⚔️ Duelo — Pedra, Papel, Tesoura', COLORS.info)
          .setDescription(`Duelo entre ${challenger} e ${opponent} valendo **${fmt(amount)}**.\n\n` +
                          `Placar: **${challenger.username} ${scoreChallenger} — ${scoreOpponent} ${opponent.username}**\n\n` +
                          `Ronda ${round}:\n` +
                          `👤 ${challenger.username}: ${choices.challenger ? '✅ Pronto!' : '⏳ A escolher...'}\n` +
                          `👤 ${opponent.username}: ${choices.opponent ? '✅ Pronto!' : '⏳ A escolher...'}`);
        
        await i.update({ embeds: [statusEmbed] }).catch(() => {});
        return;
      }

      const c = choices.challenger;
      const o = choices.opponent;
      let roundMsg;
      if (c === o) {
        roundMsg = `Ronda ${round}: ambos escolheram ${CHOICES[c]} — empate, repete-se!`;
      } else if (beats(c, o)) {
        scoreChallenger += 1;
        roundMsg = `Ronda ${round}: ${challenger.username} (${CHOICES[c]}) venceu ${opponent.username} (${CHOICES[o]})!`;
        round += 1;
      } else {
        scoreOpponent += 1;
        roundMsg = `Ronda ${round}: ${opponent.username} (${CHOICES[o]}) venceu ${challenger.username} (${CHOICES[c]})!`;
        round += 1;
      }

      choices.challenger = null;
      choices.opponent = null;

      if (scoreChallenger === 2 || scoreOpponent === 2) {
        return finishDuel(i);
      }

      const progressEmbed = baseEmbed('⚔️ Duelo — Pedra, Papel, Tesoura', COLORS.info)
        .setDescription(`${roundMsg}\n\n` +
                        `Placar: **${challenger.username} ${scoreChallenger} — ${scoreOpponent} ${opponent.username}**\n\n` +
                        `Ronda ${round}:\n` +
                        `👤 ${challenger.username}: ⏳ A escolher...\n` +
                        `👤 ${opponent.username}: ⏳ A escolher...`);

      await i.update({ embeds: [progressEmbed], components: [buildRow()] }).catch(() => {});
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && scoreChallenger < 2 && scoreOpponent < 2) {
        try {
          await interaction.editReply({
            embeds: [baseEmbed('⚔️ Duelo expirado', COLORS.neutral).setDescription('O duelo não terminou a tempo. Nenhuma aposta foi cobrada.')],
            components: [buildRow(true)]
          });
        } catch {}
      }
    });
  }
};
