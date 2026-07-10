const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../utils/database');
const { baseEmbed, fmt, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino-config')
    .setDescription('Configura as regras do casino neste servidor (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc => sc.setName('ver').setDescription('Mostra a configuração atual'))
    .addSubcommand(sc => sc
      .setName('definir')
      .setDescription('Altera um valor de configuração numérico')
      .addStringOption(o => o.setName('campo').setDescription('Campo a alterar').setRequired(true)
        .addChoices(
          { name: 'minBet', value: 'minBet' },
          { name: 'maxBet', value: 'maxBet' },
          { name: 'dailyAmount', value: 'dailyAmount' },
          { name: 'startingBalance', value: 'startingBalance' },
          { name: 'houseEdgePercent', value: 'houseEdgePercent' },
          { name: 'workMin', value: 'workMin' },
          { name: 'workMax', value: 'workMax' },
          { name: 'workCooldownMs', value: 'workCooldownMs' },
          { name: 'bankInterestPercent', value: 'bankInterestPercent' },
          { name: 'bankInterestIntervalMs', value: 'bankInterestIntervalMs' },
          { name: 'robSuccessChance', value: 'robSuccessChance' },
          { name: 'robMinPercent', value: 'robMinPercent' },
          { name: 'robMaxPercent', value: 'robMaxPercent' },
          { name: 'robFailFinePercent', value: 'robFailFinePercent' },
          { name: 'robCooldownMs', value: 'robCooldownMs' },
          { name: 'loanMaxAmount', value: 'loanMaxAmount' },
          { name: 'loanInterestPercent', value: 'loanInterestPercent' },
          { name: 'lotteryTicketPrice', value: 'lotteryTicketPrice' },
          { name: 'bigWinThreshold', value: 'bigWinThreshold' }
        ))
      .addIntegerOption(o => o.setName('valor').setDescription('Novo valor').setRequired(true).setMinValue(0)))
    .addSubcommand(sc => sc
      .setName('canal-logs')
      .setDescription('Define (ou remove) o canal onde o bot regista jogadas e anuncia prémios grandes')
      .addChannelOption(o => o.setName('canal').setDescription('Canal de logs (deixa vazio para remover)').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sc => sc
      .setName('cargo-nivel')
      .setDescription('Atribui automaticamente um cargo a partir de um certo nível')
      .addIntegerOption(o => o.setName('nivel').setDescription('Nível mínimo').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('cargo').setDescription('Cargo a atribuir').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('cargo-saldo')
      .setDescription('Atribui automaticamente um cargo a partir de um saldo total (carteira + banco)')
      .addIntegerOption(o => o.setName('saldo').setDescription('Saldo mínimo').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('cargo').setDescription('Cargo a atribuir').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('torneio-automatico')
      .setDescription('Ativa ou desativa torneios semanais automáticos')
      .addBooleanOption(o => o.setName('ativar').setDescription('Ligar/desligar').setRequired(true))
      .addIntegerOption(o => o.setName('dia_semana').setDescription('0=domingo ... 6=sábado').setMinValue(0).setMaxValue(6))
      .addIntegerOption(o => o.setName('hora').setDescription('Hora de início (0-23)').setMinValue(0).setMaxValue(23))
      .addIntegerOption(o => o.setName('duracao_horas').setDescription('Duração de cada torneio automático').setMinValue(1).setMaxValue(720))),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    const cfg = db.getGuildConfig(guildId);

    if (sub === 'ver') {
      const embed = baseEmbed('⚙️ Configuração do casino', COLORS.info)
        .addFields(
          { name: 'Aposta mínima', value: fmt(cfg.minBet), inline: true },
          { name: 'Aposta máxima', value: fmt(cfg.maxBet), inline: true },
          { name: 'Bónus diário', value: fmt(cfg.dailyAmount), inline: true },
          { name: 'Saldo inicial', value: fmt(cfg.startingBalance), inline: true },
          { name: 'Vantagem da casa', value: `${cfg.houseEdgePercent}%`, inline: true },
          { name: 'Trabalho', value: `${fmt(cfg.workMin)} - ${fmt(cfg.workMax)}`, inline: true },
          { name: 'Juro do banco', value: `${cfg.bankInterestPercent}% / ${Math.round(cfg.bankInterestIntervalMs / 3600000)}h`, inline: true },
          { name: 'Roubo', value: `${cfg.robSuccessChance}% sucesso, ${cfg.robMinPercent}-${cfg.robMaxPercent}%`, inline: true },
          { name: 'Empréstimo máximo', value: fmt(cfg.loanMaxAmount), inline: true },
          { name: 'Bilhete da lotaria', value: fmt(cfg.lotteryTicketPrice), inline: true },
          { name: 'Limiar de prémio grande', value: fmt(cfg.bigWinThreshold), inline: true },
          { name: 'Canal de logs', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'não definido', inline: true },
          { name: 'Torneio automático', value: cfg.autoTournamentEnabled ? `ativo (dia ${cfg.autoTournamentDay}, ${cfg.autoTournamentHour}h, ${cfg.autoTournamentDurationHours}h)` : 'desativado', inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'definir') {
      const campo = interaction.options.getString('campo');
      const valor = interaction.options.getInteger('valor');
      db.setGuildConfig(guildId, { [campo]: valor });
      return interaction.reply({ content: `Campo **${campo}** atualizado para **${valor}**.` });
    }

    if (sub === 'canal-logs') {
      const canal = interaction.options.getChannel('canal');
      db.setGuildConfig(guildId, { logChannelId: canal ? canal.id : null });
      return interaction.reply({ content: canal ? `Canal de logs definido para ${canal}.` : 'Canal de logs removido.' });
    }

    if (sub === 'cargo-nivel') {
      const nivel = interaction.options.getInteger('nivel');
      const cargo = interaction.options.getRole('cargo');
      const levelRoles = { ...cfg.levelRoles, [nivel]: cargo.id };
      db.setGuildConfig(guildId, { levelRoles });
      return interaction.reply({ content: `A partir do nível **${nivel}**, os jogadores recebem o cargo ${cargo}.` });
    }

    if (sub === 'cargo-saldo') {
      const saldo = interaction.options.getInteger('saldo');
      const cargo = interaction.options.getRole('cargo');
      const balanceRoles = { ...cfg.balanceRoles, [saldo]: cargo.id };
      db.setGuildConfig(guildId, { balanceRoles });
      return interaction.reply({ content: `A partir de **${fmt(saldo)}** (carteira + banco), os jogadores recebem o cargo ${cargo}.` });
    }

    if (sub === 'torneio-automatico') {
      const ativar = interaction.options.getBoolean('ativar');
      const dia = interaction.options.getInteger('dia_semana');
      const hora = interaction.options.getInteger('hora');
      const duracao = interaction.options.getInteger('duracao_horas');
      const patch = { autoTournamentEnabled: ativar };
      if (dia !== null) patch.autoTournamentDay = dia;
      if (hora !== null) patch.autoTournamentHour = hora;
      if (duracao !== null) patch.autoTournamentDurationHours = duracao;
      const updated = db.setGuildConfig(guildId, patch);
      return interaction.reply({
        content: ativar
          ? `Torneios automáticos ativados: todas as semanas no dia ${updated.autoTournamentDay} às ${updated.autoTournamentHour}h, com duração de ${updated.autoTournamentDurationHours}h.`
          : 'Torneios automáticos desativados.'
      });
    }
  }
};
