const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, resultEmbed, fmt, COLORS } = require('../utils/embeds');
const progression = require('../utils/progression');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apostar')
    .setDescription('Desafia outro jogador para uma aposta ao melhor de 1 (coin flip)')
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

    const embed = baseEmbed('🤝 Desafio de aposta', COLORS.info)
      .setDescription(`${challenger} desafiou ${opponent} para uma aposta de **${fmt(amount)}**.\n${opponent}, aceitas?`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bet_accept').setLabel('Aceitar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('bet_decline').setLabel('Recusar').setStyle(ButtonStyle.Danger)
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = reply.createMessageComponentCollector({ filter: i => i.user.id === opponent.id, time: 60000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'bet_decline') {
        return i.update({ embeds: [baseEmbed('🤝 Desafio recusado', COLORS.neutral).setDescription(`${opponent.username} recusou o desafio.`)], components: [] });
      }

      const winner = Math.random() < 0.5 ? challenger : opponent;
      const loser = winner.id === challenger.id ? opponent : challenger;

      db.addBalance(guildId, winner.id, amount);
      db.addBalance(guildId, loser.id, -amount);
      db.recordResult(guildId, winner.id, true, amount);
      db.recordResult(guildId, loser.id, false, amount);
      db.addTournamentScore(guildId, winner.id, amount);
      db.addTournamentScore(guildId, loser.id, -amount);

      const resultEmb = resultEmbed({
        title: '🤝 Resultado da aposta',
        description: `Moeda ao ar... **${winner.username}** venceu!`,
        won: true,
        fields: [
          { name: 'Ganhou', value: `${winner.username} (+${fmt(amount)})`, inline: true },
          { name: 'Perdeu', value: `${loser.username} (-${fmt(amount)})`, inline: true }
        ]
      });

      await i.update({ embeds: [resultEmb], components: [] });
      const winnerMember = winner.id === challenger.id ? interaction.member : i.member;
      const loserMember = loser.id === challenger.id ? interaction.member : i.member;
      await progression.afterGameForMember(interaction, winnerMember, { game: 'Apostar', bet: amount, net: amount, won: true }).catch(() => {});
      await progression.afterGameForMember(interaction, loserMember, { game: 'Apostar', bet: amount, net: -amount, won: false }).catch(() => {});
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        try { await interaction.editReply({ embeds: [baseEmbed('🤝 Desafio expirado', COLORS.neutral).setDescription('Ninguém respondeu a tempo.')], components: [] }); } catch {}
      }
    });
  }
};
