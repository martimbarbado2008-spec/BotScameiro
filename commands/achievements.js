const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { ACHIEVEMENTS } = require('../utils/progression');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('conquistas')
    .setDescription('Vê a lista de conquistas e quais já desbloqueaste')
    .addUserOption(o => o.setName('utilizador').setDescription('Jogador a consultar')),

  async execute(interaction) {
    const target = interaction.options.getUser('utilizador') || interaction.user;
    const u = db.getUser(interaction.guildId, target.id);

    const lines = ACHIEVEMENTS.map(a => {
      const unlocked = u.badges.includes(a.id);
      return `${unlocked ? '✅' : '⬜'} **${a.name}** — ${a.desc}`;
    });

    const embed = baseEmbed(`🏅 Conquistas de ${target.username}`, COLORS.gold)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${u.badges.length}/${ACHIEVEMENTS.length} desbloqueadas` });

    return interaction.reply({ embeds: [embed] });
  }
};
