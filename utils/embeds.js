const { EmbedBuilder } = require('discord.js');

const COLORS = {
  gold: 0xFACA2B,
  win: 0x57F287,
  lose: 0xED4245,
  info: 0x5865F2,
  neutral: 0x2B2D31
};

function fmt(n) {
  return Math.round(n).toLocaleString('pt-PT') + ' 🪙';
}

function baseEmbed(title, color = COLORS.neutral) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();
}

function resultEmbed({ title, description, won, fields = [], footer }) {
  const embed = baseEmbed(title, won ? COLORS.win : COLORS.lose)
    .setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

module.exports = { COLORS, fmt, baseEmbed, resultEmbed };
