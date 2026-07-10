const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { resultEmbed, fmt } = require('../utils/embeds');
const progression = require('../utils/progression');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Aposta contra a casa numa moeda ao ar, cara ou coroa')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('escolha').setDescription('Cara ou coroa').setRequired(true)
      .addChoices(
        { name: 'Cara', value: 'cara' },
        { name: 'Coroa', value: 'coroa' }
      )),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const escolha = interaction.options.getString('escolha');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'coinflip');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'coinflip', cfg.coinflipCooldownMs);

    const resultado = Math.random() < 0.5 ? 'cara' : 'coroa';
    const won = resultado === escolha;
    const winnings = won ? Math.round(bet * 1.9) : 0;
    const net = winnings - bet;
    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, won, bet);
    db.addTournamentScore(guildId, userId, net);
    const newBalance = db.getUser(guildId, userId).balance;

    const emoji = resultado === 'cara' ? '🙂' : '🪙';
    const embed = resultEmbed({
      title: '🪙 Coinflip',
      description: `A moeda caiu em **${resultado}** ${emoji}`,
      won,
      fields: [
        { name: 'Aposta', value: `${fmt(bet)} (${escolha})`, inline: true },
        { name: won ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
        { name: 'Saldo', value: fmt(newBalance), inline: true }
      ]
    });

    await interaction.reply({ embeds: [embed] });
    const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Coinflip', bet, net, won });
    return progression.notify(interaction, xpResult, newBadges);
  }
};
