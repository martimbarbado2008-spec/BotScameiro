const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banco')
    .setDescription('Deposita ou levanta dinheiro do banco (protegido de roubos)')
    .addSubcommand(sc => sc
      .setName('depositar')
      .setDescription('Move dinheiro da carteira para o banco')
      .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade a depositar').setRequired(true).setMinValue(1)))
    .addSubcommand(sc => sc
      .setName('levantar')
      .setDescription('Move dinheiro do banco para a carteira')
      .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade a levantar').setRequired(true).setMinValue(1))),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const quantidade = interaction.options.getInteger('quantidade');
    const user = db.getUser(guildId, userId);

    if (sub === 'depositar') {
      if (user.balance < quantidade) {
        return interaction.reply({ content: `Não tens ${fmt(quantidade)} na carteira para depositar.`, ephemeral: true });
      }
      db.addBalance(guildId, userId, -quantidade);
      db.addBank(guildId, userId, quantidade);
      const updated = db.getUser(guildId, userId);
      const embed = baseEmbed('🏦 Depósito efetuado', COLORS.win)
        .setDescription(`Depositaste ${fmt(quantidade)} no banco.`)
        .addFields(
          { name: 'Carteira', value: fmt(updated.balance), inline: true },
          { name: 'Banco', value: fmt(updated.bank), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'levantar') {
      if (user.bank < quantidade) {
        return interaction.reply({ content: `Não tens ${fmt(quantidade)} no banco para levantar.`, ephemeral: true });
      }
      db.addBank(guildId, userId, -quantidade);
      db.addBalance(guildId, userId, quantidade);
      const updated = db.getUser(guildId, userId);
      const embed = baseEmbed('🏦 Levantamento efetuado', COLORS.win)
        .setDescription(`Levantaste ${fmt(quantidade)} do banco.`)
        .addFields(
          { name: 'Carteira', value: fmt(updated.balance), inline: true },
          { name: 'Banco', value: fmt(updated.bank), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
