const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transferir')
    .setDescription('Transfere moedas para outro utilizador')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('O utilizador que vai receber as moedas')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('quantia')
        .setDescription('A quantidade de moedas a transferir')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const senderId = interaction.user.id;
    const receiver = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('quantia');

    if (receiver.id === senderId) {
      return interaction.reply({ content: 'Não podes transferir moedas para ti próprio!', ephemeral: true });
    }

    if (receiver.bot) {
      return interaction.reply({ content: 'Não podes transferir moedas para bots!', ephemeral: true });
    }

    const sender = db.getUser(guildId, senderId);
    if (sender.balance < amount) {
      return interaction.reply({ content: `Não tens moedas suficientes! Saldo atual: ${fmt(sender.balance)}`, ephemeral: true });
    }

    const receiverUser = db.getUser(guildId, receiver.id);

    // Efetua a transferência
    sender.balance -= amount;
    receiverUser.balance += amount;

    // Histórico
    db.pushHistory(guildId, senderId, { game: 'Transferência (Enviado)', bet: amount, net: -amount });
    db.pushHistory(guildId, receiver.id, { game: 'Transferência (Recebido)', bet: amount, net: amount });

    db.saveUser(guildId, senderId, sender);
    db.saveUser(guildId, receiver.id, receiverUser);

    const embed = baseEmbed('💸 Transferência efetuada', COLORS.win)
      .setDescription(`Transferiste **${fmt(amount)}** para ${receiver} com sucesso!`)
      .addFields(
        { name: 'O teu novo saldo', value: fmt(sender.balance), inline: true },
        { name: 'Saldo de quem recebeu', value: fmt(receiverUser.balance), inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
