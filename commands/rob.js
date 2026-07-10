const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roubar')
    .setDescription('Tenta roubar dinheiro da carteira de outro jogador (o banco está sempre protegido)')
    .addUserOption(o => o.setName('utilizador').setDescription('Quem tentas roubar').setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const target = interaction.options.getUser('utilizador');
    const cfg = db.getGuildConfig(guildId);

    if (target.id === userId) {
      return interaction.reply({ content: 'Não podes roubar-te a ti mesmo.', ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ content: 'Não podes roubar um bot.', ephemeral: true });
    }

    const cooldown = db.getCooldown(guildId, userId, 'roubar');
    if (cooldown > 0) {
      const mins = Math.ceil(cooldown / 60000);
      return interaction.reply({ content: `Estás demasiado conhecido pela polícia. Espera ${mins}min.`, ephemeral: true });
    }

    const robber = db.getUser(guildId, userId);
    const victim = db.getUser(guildId, target.id);

    if (victim.balance < 50) {
      return interaction.reply({ content: `${target.username} não tem dinheiro suficiente na carteira para valer a pena roubar.`, ephemeral: true });
    }

    db.setCooldown(guildId, userId, 'roubar', cfg.robCooldownMs);

    const success = Math.random() * 100 < cfg.robSuccessChance;

    if (success) {
      const percent = cfg.robMinPercent + Math.random() * (cfg.robMaxPercent - cfg.robMinPercent);
      const amount = Math.round(victim.balance * (percent / 100));
      db.addBalance(guildId, target.id, -amount);
      db.addBalance(guildId, userId, amount);
      db.setRobbedNow(guildId, target.id);

      const embed = baseEmbed('🕵️ Roubo bem-sucedido', COLORS.win)
        .setDescription(`Roubaste **${fmt(amount)}** a ${target}!`);
      return interaction.reply({ embeds: [embed] });
    }

    const fine = Math.round(robber.balance * (cfg.robFailFinePercent / 100));
    db.addBalance(guildId, userId, -fine);
    db.addBalance(guildId, target.id, fine);

    const embed = baseEmbed('🚨 Roubo falhado', COLORS.lose)
      .setDescription(`Foste apanhado a tentar roubar ${target} e pagaste uma multa de **${fmt(fine)}**, entregue à vítima.`);
    return interaction.reply({ embeds: [embed] });
  }
};
