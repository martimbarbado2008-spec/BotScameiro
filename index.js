require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { startTournamentWatcher } = require('./utils/tournamentEngine');
const { startEconomyWatcher } = require('./utils/economyEngine');
const { startServer } = require('./utils/webServer');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command?.data?.name) {
        client.commands.set(command.data.name, command);
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

client.once('ready', async () => {
  console.log(`Bot ligado como ${client.user.tag}`);

  // ====================================================
  // 🚀 NOVO: SINCRONIZAÇÃO AUTOMÁTICA DE COMANDOS
  // ====================================================
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commandsJSON = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

    console.log(`🔄 A sincronizar ${commandsJSON.length} comandos com a API do Discord...`);
    
    // Regista os comandos globalmente na aplicação do teu bot
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsJSON }
    );
    
    console.log('✅ Todos os comandos de barra foram injetados e forçados com sucesso!');
  } catch (err) {
    console.error('❌ Falha ao registar os comandos na API do Discord:', err);
  }
  // ====================================================

  startTournamentWatcher(client);
  startEconomyWatcher(client);

  const port = process.env.PORT || 3000;
  startServer(port, client);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'open_portal') {
      const baseUrl = process.env.WEB_BASE_URL;
      if (!baseUrl) {
        return interaction.reply({ content: 'O servidor web do casino ainda não está configurado. Avisa o dono do bot.', ephemeral: true });
      }
      
      const token = require('./utils/webTokens').createToken(interaction.guildId, interaction.user.id);
      const link = `${baseUrl.replace(/\/$/, '')}/login.html?token=${token}&redirect=${encodeURIComponent('/dashboard.html')}`;

      const { baseEmbed, COLORS } = require('./utils/embeds');
      const embed = baseEmbed('🔑 Acesso Pessoal e Seguro', COLORS.gold)
        .setDescription('Clica no botão abaixo para entrares no Casino Arena. Este link é pessoal e não deve ser partilhado!');

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Entrar no Casino 🚀')
          .setStyle(ButtonStyle.Link)
          .setURL(link)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Erro no comando ${interaction.commandName}:`, err);
    const payload = { content: 'Ocorreu um erro ao executar este comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guildId) return;
  try {
    const db = require('./utils/database');
    const cfg = db.getGuildConfig(message.guildId);
    
    if (cfg && cfg.chatBridgeChannelId && message.channelId === cfg.chatBridgeChannelId) {
      const webServer = require('./utils/webServer');
      if (webServer.broadcastChatToWeb) {
        const uData = db.getUser(message.guildId, message.author.id);
        const frameClass = uData?.equippedFrame ? uData.equippedFrame.replace('frame_', 'frame-') : 'frame-none';
        
        webServer.broadcastChatToWeb(message.guildId, {
          username: message.member?.displayName || message.author.username,
          userId: message.author.id,
          content: message.content,
          equippedFrame: frameClass,
          timestamp: Date.now()
        });
      }
    }
  } catch (err) {
    console.error("Erro na ponte de chat no messageCreate:", err);
  }
});

client.login(process.env.TOKEN); 
