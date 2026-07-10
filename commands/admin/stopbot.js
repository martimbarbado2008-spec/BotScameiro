const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('parar-bot')
    .setDescription('Desliga o bot em segurança (apenas administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // o Discord obriga a responder à interação nos primeiros segundos,
    // por isso confirmamos de forma privada (só o admin vê) e apagamos logo a seguir
    await interaction.deferReply({ ephemeral: true });
    await interaction.deleteReply().catch(() => {});

    console.log(`Bot desligado manualmente por ${interaction.user.tag} (${interaction.user.id})`);

    setTimeout(() => process.exit(0), 500);
  }
};