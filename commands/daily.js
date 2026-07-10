const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diario')
    .setDescription('Recolhe o teu bónus diário'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getGuildConfig(guildId);
    const user = db.getUser(guildId, userId);

    const now = Date.now();
    const sinceLast = now - user.lastDaily;

    if (sinceLast < DAY_MS) {
      const remaining = DAY_MS - sinceLast;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      return interaction.reply({ content: `Já recolheste hoje. Podes voltar daqui a ${hours}h ${mins}m.`, ephemeral: true });
    }

    // mantém o streak se recolhido dentro de 48h, caso contrário reinicia
    if (sinceLast <= 2 * DAY_MS) {
      user.dailyStreak += 1;
    } else {
      user.dailyStreak = 1;
    }
    user.lastDaily = now;

    const streakBonus = Math.min(user.dailyStreak * 20, 500);
    const total = cfg.dailyAmount + streakBonus;
    user.balance += total;
    db.saveUser(guildId, userId, user);

    const embed = baseEmbed('🎁 Bónus diário', COLORS.win)
      .setDescription(`Recebeste ${fmt(total)}`)
      .addFields(
        { name: 'Base', value: fmt(cfg.dailyAmount), inline: true },
        { name: 'Bónus de streak', value: fmt(streakBonus), inline: true },
        { name: 'Streak atual', value: `${user.dailyStreak} dias`, inline: true },
        { name: 'Novo saldo', value: fmt(user.balance), inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
