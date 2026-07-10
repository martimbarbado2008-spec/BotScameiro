const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lotaria')
    .setDescription('Lotaria semanal com jackpot acumulado')
    .addSubcommand(sc => sc
      .setName('comprar')
      .setDescription('Compra bilhetes da lotaria')
      .addIntegerOption(o => o.setName('quantidade').setDescription('Número de bilhetes a comprar').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(sc => sc.setName('info').setDescription('Vê o jackpot atual e quantos bilhetes tens')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const cfg = db.getGuildConfig(guildId);

    if (sub === 'comprar') {
      const quantidade = interaction.options.getInteger('quantidade');
      const result = db.buyLotteryTickets(guildId, userId, quantidade, cfg.lotteryTicketPrice);
      if (!result) {
        return interaction.reply({ content: `Não tens saldo suficiente. Cada bilhete custa ${fmt(cfg.lotteryTicketPrice)}.`, ephemeral: true });
      }
      const embed = baseEmbed('🎟️ Bilhetes comprados', COLORS.win)
        .setDescription(`Compraste **${quantidade}** bilhete(s) por ${fmt(result.cost)}.`)
        .addFields(
          { name: 'Os teus bilhetes', value: `${result.totalTickets}`, inline: true },
          { name: 'Jackpot atual', value: fmt(result.jackpot), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const l = db.getLottery(guildId);
      const meusBilhetes = l.tickets[userId] || 0;
      const totalBilhetes = Object.values(l.tickets).reduce((a, b) => a + b, 0);
      const chance = totalBilhetes > 0 ? ((meusBilhetes / totalBilhetes) * 100).toFixed(1) : '0.0';

      const embed = baseEmbed('🎟️ Lotaria do casino', COLORS.gold)
        .addFields(
          { name: 'Jackpot atual', value: fmt(l.jackpot), inline: true },
          { name: 'Preço do bilhete', value: fmt(cfg.lotteryTicketPrice), inline: true },
          { name: 'Total de bilhetes vendidos', value: `${totalBilhetes}`, inline: true },
          { name: 'Os teus bilhetes', value: `${meusBilhetes}`, inline: true },
          { name: 'A tua chance de ganhar', value: `${chance}%`, inline: true },
          { name: 'Sorteio', value: `Todos os domingos às ${cfg.lotteryDrawHour}h`, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
