const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { resultEmbed, fmt } = require('../utils/embeds');
const progression = require('../utils/progression');

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function colorOf(n) {
  if (n === 0) return 'verde';
  return RED_NUMBERS.has(n) ? 'vermelho' : 'preto';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleta')
    .setDescription('Aposta na roleta europeia (0-36)')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de aposta').setRequired(true)
      .addChoices(
        { name: 'Vermelho (x2)', value: 'vermelho' },
        { name: 'Preto (x2)', value: 'preto' },
        { name: 'Par (x2)', value: 'par' },
        { name: 'Ímpar (x2)', value: 'impar' },
        { name: 'Número exato 0-36 (x35)', value: 'numero' }
      ))
    .addIntegerOption(o => o.setName('numero').setDescription('Número exato (só se tipo=numero)').setMinValue(0).setMaxValue(36)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const tipo = interaction.options.getString('tipo');
    const numero = interaction.options.getInteger('numero');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'roleta');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s.`, ephemeral: true });
    }
    if (tipo === 'numero' && numero === null) {
      return interaction.reply({ content: 'Indica o número exato (0 a 36).', ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'roleta', cfg.rouletteCooldownMs);

    const spin = Math.floor(Math.random() * 37); // 0-36
    const color = colorOf(spin);

    let won = false;
    let mult = 0;
    if (tipo === 'vermelho' && color === 'vermelho') { won = true; mult = 2; }
    if (tipo === 'preto' && color === 'preto') { won = true; mult = 2; }
    if (tipo === 'par' && spin !== 0 && spin % 2 === 0) { won = true; mult = 2; }
    if (tipo === 'impar' && spin % 2 !== 0) { won = true; mult = 2; }
    if (tipo === 'numero' && spin === numero) { won = true; mult = 35; }

    const winnings = won ? bet * mult : 0;
    const net = winnings - bet;
    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, won, bet);
    db.addTournamentScore(guildId, userId, net);
    const newBalance = db.getUser(guildId, userId).balance;

    const colorEmoji = { vermelho: '🔴', preto: '⚫', verde: '🟢' }[color];

    const embed = resultEmbed({
      title: '🎡 Roleta',
      description: `A bola caiu no **${spin}** ${colorEmoji}`,
      won,
      fields: [
        { name: 'Aposta', value: `${fmt(bet)} (${tipo}${tipo === 'numero' ? ` ${numero}` : ''})`, inline: true },
        { name: won ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
        { name: 'Saldo', value: fmt(newBalance), inline: true }
      ]
    });

    await interaction.reply({ embeds: [embed] });
    const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Roleta', bet, net, won });
    return progression.notify(interaction, xpResult, newBadges);
  }
};
