const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { getAchievement } = require('../utils/progression');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

function progressBar(current, total, size = 12) {
  const filled = Math.max(0, Math.min(size, Math.round((current / total) * size)));
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

const VIP_NAMES = { 0: 'Nenhum', 1: 'Bronze', 2: 'Prata', 3: 'Ouro' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra o cartão de perfil de um jogador')
    .addUserOption(o => o.setName('utilizador').setDescription('Jogador a consultar')),

  async execute(interaction) {
    const target = interaction.options.getUser('utilizador') || interaction.user;
    const guildId = interaction.guildId;
    const u = db.getUser(guildId, target.id);
    const xpNeeded = db.xpForLevel(u.level);
    const bar = progressBar(u.xp, xpNeeded);

    const badgesText = u.badges.length > 0
      ? u.badges.map(id => {
          const a = getAchievement(id);
          return a ? a.name : id;
        }).join('\n')
      : 'Ainda sem conquistas — usa `/conquistas` para veres como as desbloquear.';

    const winRate = (u.stats.wins + u.stats.losses) > 0
      ? ((u.stats.wins / (u.stats.wins + u.stats.losses)) * 100).toFixed(1)
      : '0.0';

    const embed = baseEmbed(`🎴 Perfil de ${target.username}`, COLORS.gold)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Nível', value: `${u.level}`, inline: true },
        { name: 'VIP', value: VIP_NAMES[u.vipLevel] || 'Nenhum', inline: true },
        { name: 'Taxa de vitória', value: `${winRate}%`, inline: true },
        { name: 'XP', value: `${bar}\n${u.xp}/${xpNeeded}`, inline: false },
        { name: 'Carteira', value: fmt(u.balance), inline: true },
        { name: 'Banco', value: fmt(u.bank), inline: true },
        { name: 'Total', value: fmt(u.balance + u.bank), inline: true },
        { name: 'Vitórias', value: `${u.stats.wins}`, inline: true },
        { name: 'Derrotas', value: `${u.stats.losses}`, inline: true },
        { name: 'Total apostado', value: fmt(u.stats.wagered), inline: true },
        { name: `Conquistas (${u.badges.length})`, value: badgesText, inline: false }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
