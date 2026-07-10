const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

function timeLeftStr(ms) {
  if (ms <= 0) return 'terminado';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m restantes`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('torneio')
    .setDescription('Vê o estado e a tabela classificativa do torneio ativo'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const t = db.getTournament(guildId);

    if (!t || !t.active) {
      return interaction.reply('Não há nenhum torneio ativo neste servidor de momento.');
    }

    const active = db.isTournamentActive(guildId);
    const remaining = t.endTime - Date.now();
    const top = db.getTournamentLeaderboard(guildId, 10);

    const medals = ['🥇', '🥈', '🥉'];
    let lines;
    if (top.length === 0) {
      lines = 'Ainda ninguém pontuou. Joga qualquer jogo do casino para entrares na tabela.';
    } else {
      lines = (await Promise.all(top.map(async (entry, i) => {
        let name;
        try {
          const member = await interaction.guild.members.fetch(entry.userId);
          name = member.user.username;
        } catch {
          name = `Utilizador ${entry.userId}`;
        }
        const medal = medals[i] || `${i + 1}.`;
        const sign = entry.score >= 0 ? '+' : '';
        return `${medal} **${name}** — ${sign}${fmt(entry.score)}`;
      }))).join('\n');
    }

    const embed = baseEmbed(`🏆 ${t.name}`, COLORS.gold)
      .setDescription(lines)
      .addFields(
        { name: 'Estado', value: active ? timeLeftStr(remaining) : 'terminado, a aguardar apuramento', inline: true },
        { name: 'Prémio', value: t.prize > 0 ? fmt(t.prize) : 'sem prémio definido', inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
