require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

function loadCommandData(dir) {
  const commands = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      commands.push(...loadCommandData(fullPath));
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command?.data) commands.push(command.data.toJSON());
    }
  }
  return commands;
}

const commands = loadCommandData(path.join(__dirname, 'commands'));

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`A registar ${commands.length} comandos...`);

    // Regista por servidor (instantâneo) se GUILD_ID estiver definido, caso contrário globalmente (até 1h a propagar)
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log('Comandos registados com sucesso.');
  } catch (error) {
    console.error(error);
  }
})();
