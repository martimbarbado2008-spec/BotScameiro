const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../utils/database');
const { concludeTournament } = require('../../utils/tournamentEngine');
const { baseEmbed, fmt, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('torneio-admin')
    .setDescription('Cria ou termina torneios do casino (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc => sc
      .setName('criar')
      .setDescription('Inicia um novo torneio')
      .addIntegerOption(o => o.setName('duracao_horas').setDescription('Duração do torneio em horas').setRequired(true).setMinValue(1).setMaxValue(720))
      .addStringOption(o => o.setName('nome').setDescription('Nome do torneio').setMaxLength(80))
      .addIntegerOption(o => o.setName('premio').setDescription('Prémio a atribuir ao vencedor').setMinValue(0))
      .addChannelOption(o => o.setName('canal').setDescription('Canal onde anunciar o resultado').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sc => sc.setName('terminar').setDescription('Termina já o torneio ativo e anuncia o vencedor')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      const existing = db.getTournament(guildId);
      if (existing && existing.active) {
        return interaction.reply({ content: 'Já existe um torneio ativo. Termina-o primeiro com `/torneio-admin terminar`.', ephemeral: true });
      }

      const horas = interaction.options.getInteger('duracao_horas');
      const nome = interaction.options.getString('nome') || 'Torneio do casino';
      const premio = interaction.options.getInteger('premio') || 0;
      const canal = interaction.options.getChannel('canal') || interaction.channel;

      db.startTournament(guildId, {
        durationMs: horas * 60 * 60 * 1000,
        name: nome,
        prize: premio,
        channelId: canal.id,
        startedBy: interaction.user.id
      });

      const embed = baseEmbed(`🏆 ${nome} — começou!`, COLORS.gold)
        .setDescription(`Quem ganhar mais moedas líquidas em qualquer jogo do casino nas próximas **${horas}h** vence.\nUsa \`/torneio\` para veres a tabela classificativa a qualquer momento.`)
        .addFields(
          { name: 'Duração', value: `${horas}h`, inline: true },
          { name: 'Prémio', value: premio > 0 ? fmt(premio) : 'sem prémio definido', inline: true },
          { name: 'Anúncio final em', value: `${canal}`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'terminar') {
      const existing = db.getTournament(guildId);
      if (!existing || !existing.active) {
        return interaction.reply({ content: 'Não há nenhum torneio ativo neste servidor.', ephemeral: true });
      }
      await interaction.reply('A terminar o torneio e a apurar o vencedor...');
      await concludeTournament(interaction.client, guildId);
    }
  }
};
