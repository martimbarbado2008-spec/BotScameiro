const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { afterGame, notify } = require('../utils/progression');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Comete um crime de alto risco para ganhares ou perderes moedas'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const cooldown = db.getCooldown(guildId, userId, 'crime');
    if (cooldown > 0) {
      const mins = Math.ceil(cooldown / 60000);
      return interaction.reply({ content: `Estás sob vigilância policial! Volta a tentar daqui a ${mins}min.`, ephemeral: true });
    }

    const success = Math.random() < 0.50; // 50% de sucesso
    const user = db.getUser(guildId, userId);

    if (success) {
      // Ganha moedas
      const reward = Math.round(200 + Math.random() * 600);
      db.addBalance(guildId, userId, reward);
      db.setCooldown(guildId, userId, 'crime', 30 * 60 * 1000); // 30 mins cooldown

      const { xpResult, newBadges } = await afterGame(interaction, { game: 'Crime', bet: 0, net: reward, won: true });

      const embed = baseEmbed('🥷 Crime bem sucedido!', COLORS.win)
        .setDescription(`Planeaste um assalto com sucesso e conseguiste fugir com **${fmt(reward)}**!`)
        .addFields(
          { name: 'Recompensa', value: `+${fmt(reward)}`, inline: true },
          { name: 'Novo saldo', value: fmt(user.balance), inline: true }
        );

      await interaction.reply({ embeds: [embed] });
      await notify(interaction, xpResult, newBadges);
    } else {
      // Perde moedas (multa)
      const finePercent = 10 + Math.floor(Math.random() * 6); // 10% a 15%
      const fine = Math.round(user.balance * (finePercent / 100)) || 50; // Pelo menos 50 moedas de multa

      db.addBalance(guildId, userId, -fine);
      db.setCooldown(guildId, userId, 'crime', 30 * 60 * 1000); // 30 mins cooldown

      const { xpResult, newBadges } = await afterGame(interaction, { game: 'Crime', bet: 0, net: -fine, won: false });

      const embed = baseEmbed('🚨 Apanhado pela polícia!', COLORS.lose)
        .setDescription(`Foste apanhado a tentar roubar uma loja de conveniência e tiveste de pagar uma multa de **${fmt(fine)}** (${finePercent}% do teu saldo).`)
        .addFields(
          { name: 'Multa paga', value: `-${fmt(fine)}`, inline: true },
          { name: 'Novo saldo', value: fmt(user.balance), inline: true }
        );

      await interaction.reply({ embeds: [embed] });
      await notify(interaction, xpResult, newBadges);
    }
  }
};
