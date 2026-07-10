const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { resultEmbed, fmt } = require('../utils/embeds');
const progression = require('../utils/progression');

const SYMBOLS = [
  { emoji: '🍒', weight: 30, mult: 2 },
  { emoji: '🍋', weight: 25, mult: 3 },
  { emoji: '🍇', weight: 20, mult: 4 },
  { emoji: '🔔', weight: 12, mult: 8 },
  { emoji: '💎', weight: 8, mult: 15 },
  { emoji: '7️⃣', weight: 5, mult: 40 }
];

function spin() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  const roll = () => {
    let r = Math.random() * total;
    for (const s of SYMBOLS) {
      if (r < s.weight) return s;
      r -= s.weight;
    }
    return SYMBOLS[0];
  };
  return [roll(), roll(), roll()];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Joga na slot machine')
    .addIntegerOption(o => o.setName('aposta').setDescription('Quantidade a apostar').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const bet = interaction.options.getInteger('aposta');
    const user = db.getUser(guildId, userId);

    const cooldown = db.getCooldown(guildId, userId, 'slots');
    if (cooldown > 0) {
      return interaction.reply({ content: `Espera mais ${(cooldown / 1000).toFixed(1)}s antes de jogar de novo.`, ephemeral: true });
    }
    if (bet < cfg.minBet || bet > cfg.maxBet) {
      return interaction.reply({ content: `A aposta tem de estar entre ${fmt(cfg.minBet)} e ${fmt(cfg.maxBet)}.`, ephemeral: true });
    }
    if (user.balance < bet) {
      return interaction.reply({ content: 'Não tens saldo suficiente para essa aposta.', ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'slots', cfg.slotsCooldownMs);

    const result = spin();
    const [a, b, c] = result;
    let winnings = 0;
    let description;

    if (a.emoji === b.emoji && b.emoji === c.emoji) {
      winnings = bet * a.mult;
      description = 'Combinação perfeita!';
    } else if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
      winnings = Math.round(bet * 1.5);
      description = 'Par de símbolos, pequeno prémio.';
    } else {
      winnings = 0;
      description = 'Nada desta vez. Boa sorte na próxima.';
    }

    const net = winnings - bet;
    db.addBalance(guildId, userId, net);
    db.recordResult(guildId, userId, net > 0, bet);
    db.addTournamentScore(guildId, userId, net);
    const newBalance = db.getUser(guildId, userId).balance;
    const isJackpot = a.emoji === b.emoji && b.emoji === c.emoji;
    progression.recordJackpot(guildId, userId, isJackpot);

    const embed = resultEmbed({
      title: '🎰 Slot machine',
      description: `${a.emoji} ${b.emoji} ${c.emoji}\n\n${description}`,
      won: net > 0,
      fields: [
        { name: 'Aposta', value: fmt(bet), inline: true },
        { name: net >= 0 ? 'Ganhaste' : 'Perdeste', value: fmt(Math.abs(net)), inline: true },
        { name: 'Saldo', value: fmt(newBalance), inline: true }
      ]
    });

    await interaction.reply({ embeds: [embed] });
    const { xpResult, newBadges } = await progression.afterGame(interaction, { game: 'Slots', bet, net, won: net > 0 });
    return progression.notify(interaction, xpResult, newBadges);
  }
};
