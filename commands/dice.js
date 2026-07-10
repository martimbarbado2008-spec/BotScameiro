const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { resultEmbed, fmt } = require('../utils/embeds');
const progression = require('../utils/progression');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dados')
    .setDescription('Aposta em par, ímpar ou num total exato de dois dados')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de aposta').setRequired(true)
      .addChoices(
        { name: 'Par (multiplica x1.9)', value: 'par' },
        { name: 'Ímpar (multiplica x1.9)', value: 'impar' },
        { name: 'Total exato 2-12 (multiplica x6)', value: 'exato' }
      ))
    .addIntegerOption(o => o.setName('numero').setDescription('Número exato (só se tipo=exato)').setMinValue(2).setMaxValue(12)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const tipo = interaction.options.getString('tipo');
    const numero = interaction.options.getInteger('numero');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'dados');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (tipo === 'exato' && !numero) {
      return interaction.reply({ content: 'Indica o número exato que estás a apostar (2 a 12).', ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'dados', cfg.diceCooldownMs);

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;

    let won = false;
    let mult = 0;
    if (tipo === 'par' && total % 2 === 0) { won = true; mult = 1.9; }
    if (tipo === 'impar' && total % 2 !== 0) { won = true; mult = 1.9; }
    if (tipo === 'exato' && total === numero) { won = true; mult = 6; }

    const winnings = won ? Math.round(bet * mult) : 0;
    const net = winnings - bet;
    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, won, bet);
    db.addTournamentScore(guildId, userId, net);
    const newBalance = db.getUser(guildId, userId).balance;

    const embed = resultEmbed({
      title: '🎲 Dados',
      description: `🎲 ${d1}  🎲 ${d2}  →  total **${total}**`,
      won,
      fields: [
        { name: 'Aposta', value: `${fmt(bet)} (${tipo}${tipo === 'exato' ? ` ${numero}` : ''})`, inline: true },
        { name: won ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
        { name: 'Saldo', value: fmt(newBalance), inline: true }
      ]
    });

    await interaction.reply({ embeds: [embed] });
    const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Dados', bet, net, won });
    return progression.notify(interaction, xpResult, newBadges);
  }
};
