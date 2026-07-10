const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { baseEmbed, fmt, COLORS } = require('../utils/embeds');

function timeLeftStr(ms) {
  if (ms <= 0) return 'em atraso';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m restantes`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emprestimo')
    .setDescription('Pede dinheiro emprestado ao banco do casino (com juros)')
    .addSubcommand(sc => sc
      .setName('pedir')
      .setDescription('Pede um novo empréstimo')
      .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade a pedir').setRequired(true).setMinValue(1)))
    .addSubcommand(sc => sc
      .setName('pagar')
      .setDescription('Paga parte ou a totalidade do empréstimo ativo')
      .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade a pagar').setRequired(true).setMinValue(1)))
    .addSubcommand(sc => sc.setName('estado').setDescription('Vê o estado do teu empréstimo atual')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const cfg = db.getGuildConfig(guildId);

    if (sub === 'pedir') {
      const quantidade = interaction.options.getInteger('quantidade');
      const existing = db.getLoan(guildId, userId);
      if (existing) {
        return interaction.reply({ content: `Já tens um empréstimo ativo. Usa \`/emprestimo estado\` para veres os detalhes.`, ephemeral: true });
      }
      if (quantidade > cfg.loanMaxAmount) {
        return interaction.reply({ content: `O empréstimo máximo permitido é ${fmt(cfg.loanMaxAmount)}.`, ephemeral: true });
      }

      const loan = db.createLoan(guildId, userId, quantidade, cfg.loanInterestPercent, cfg.loanDurationMs);
      const embed = baseEmbed('🏦 Empréstimo aprovado', COLORS.win)
        .setDescription(`Recebeste **${fmt(quantidade)}** na tua carteira.`)
        .addFields(
          { name: 'A pagar', value: fmt(loan.owed), inline: true },
          { name: 'Juro', value: `${cfg.loanInterestPercent}%`, inline: true },
          { name: 'Prazo', value: timeLeftStr(loan.dueAt - Date.now()), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'pagar') {
      const quantidade = interaction.options.getInteger('quantidade');
      const loan = db.getLoan(guildId, userId);
      if (!loan) {
        return interaction.reply({ content: 'Não tens nenhum empréstimo ativo.', ephemeral: true });
      }
      const user = db.getUser(guildId, userId);
      if (user.balance < quantidade) {
        return interaction.reply({ content: 'Não tens saldo suficiente na carteira para esse pagamento.', ephemeral: true });
      }

      const updated = db.repayLoan(guildId, userId, quantidade);
      if (!updated) {
        const embed = baseEmbed('✅ Empréstimo liquidado', COLORS.win).setDescription('Pagaste o empréstimo na totalidade!');
        return interaction.reply({ embeds: [embed] });
      }

      const embed = baseEmbed('🏦 Pagamento efetuado', COLORS.info)
        .addFields(
          { name: 'Ainda deves', value: fmt(updated.owed), inline: true },
          { name: 'Prazo', value: timeLeftStr(updated.dueAt - Date.now()), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'estado') {
      const loan = db.getLoan(guildId, userId);
      if (!loan) {
        return interaction.reply({ content: 'Não tens nenhum empréstimo ativo. Usa `/emprestimo pedir` para pedires um.', ephemeral: true });
      }
      const remaining = loan.dueAt - Date.now();
      const embed = baseEmbed('🏦 O teu empréstimo', COLORS.info)
        .addFields(
          { name: 'Valor pedido', value: fmt(loan.principal), inline: true },
          { name: 'Ainda deves', value: fmt(loan.owed), inline: true },
          { name: 'Prazo', value: timeLeftStr(remaining), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
