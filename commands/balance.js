const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Vê o teu saldo ou o de outro jogador')
    .addUserOption(o => o.setName('utilizador').setDescription('Jogador a consultar')),

  async execute(interaction) {
    const target = interaction.options.getUser('utilizador') || interaction.user;
    const user = db.getUser(interaction.guildId, target.id);

    const embed = baseEmbed(`💰 Carteira de ${target.username}`, COLORS.gold)
      .addFields(
        { name: 'Carteira', value: fmt(user.balance), inline: true },
        { name: 'Banco', value: fmt(user.bank), inline: true },
        { name: 'Total', value: fmt(user.balance + user.bank), inline: true },
        { name: 'Vitórias', value: `${user.stats.wins}`, inline: true },
        { name: 'Derrotas', value: `${user.stats.losses}`, inline: true },
        { name: 'Total apostado', value: fmt(user.stats.wagered), inline: true }
      )
      .setThumbnail(target.displayAvatarURL());

    return interaction.reply({ embeds: [embed] });
  }
};
