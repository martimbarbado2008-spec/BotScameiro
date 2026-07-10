const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../utils/database');
const { baseEmbed, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-saldo')
    .setDescription('Reseta o saldo de um jogador ou de todo o servidor (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sc => sc
      .setName('jogador')
      .setDescription('Reseta o saldo de um jogador específico')
      .addUserOption(o => o.setName('utilizador').setDescription('Jogador a resetar').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('todos')
      .setDescription('Reseta o saldo de TODOS os jogadores do servidor')
      .addBooleanOption(o => o.setName('confirmar').setDescription('Confirma que queres resetar tudo').setRequired(true))),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === 'jogador') {
      const target = interaction.options.getUser('utilizador');
      db.resetUser(guildId, target.id);
      const embed = baseEmbed('🔄 Saldo resetado', COLORS.neutral)
        .setDescription(`O saldo de ${target} foi resetado para o valor inicial.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'todos') {
      const confirmar = interaction.options.getBoolean('confirmar');
      if (!confirmar) {
        return interaction.reply({ content: 'Tens de confirmar com `confirmar: true` para resetar todos os saldos.', ephemeral: true });
      }
      const count = db.resetAllUsers(guildId);
      const embed = baseEmbed('🔄 Todos os saldos resetados', COLORS.neutral)
        .setDescription(`${count} jogador(es) tiveram o saldo resetado para o valor inicial.`);
      return interaction.reply({ embeds: [embed] });
    }
  }
};
