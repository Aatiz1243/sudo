import 'dotenv/config';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Partials, Events, Collection } from 'discord.js';
import { initTextCommands } from './commands/commands.js';
import { getResponse } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in environment. Create a .env file from .env.example and add BOT_TOKEN.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.commands = new Collection();

async function loadSlashCommands(dir) {
  const commandsPath = path.join(dir, 'utils', 'commands');
  const exists = fs.existsSync(commandsPath);
  if (!exists) return;
  const files = await fsPromises.readdir(commandsPath);
  for (const file of files.filter(f => f.endsWith('.js'))) {
    try {
      const full = path.join(commandsPath, file);
      const mod = await import(pathToFileURL(full).href);
      const cmd = mod.default ?? mod;
      if (cmd?.data && typeof cmd.execute === 'function') {
        client.commands.set(cmd.data.name, cmd);
      }
    } catch (err) {
      console.error('Failed to load slash command', file, err);
    }
  }
}

client.once(Events.ClientReady, () => {
  console.log(`Sudo online as ${client.user.tag}`);
  try {
    client.user.setActivity('Type $sudo for chaos');
  } catch {}
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) {
    await interaction.reply({ content: 'Command not found (maybe not loaded).', ephemeral: true });
    return;
  }
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error('Error running command', interaction.commandName, err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
    }
  }
});

(async function main() {
  await loadSlashCommands(__dirname);
  await initTextCommands(client, { commandsDir: path.join(__dirname, 'commands'), prefix: '$sudo' });
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message || message.author?.bot) return;
      const raw = message.content;
      if (!raw) return;
      const prefix = '$sudo';
      if (!raw.toLowerCase().startsWith(prefix)) return;
      const commandText = raw.slice(prefix.length).trim();
      if (!commandText) {
        try {
          await message.reply('Be specific. `$sudo <something>` — tell me what to sudo.');
        } catch {
          await message.channel.send('Be specific. `$sudo <something>` — tell me what to sudo.');
        }
        return;
      }
      const userId = message.author.id;
      const guildId = message.guild?.id ?? 'DM';
      const memoryKey = `${userId}::${guildId}::${commandText}`;
      if (!globalThis.__sudoMemory) globalThis.__sudoMemory = new Map();
      if (!globalThis.__cleanupTimers) globalThis.__cleanupTimers = new Map();
      const sudoMemory = globalThis.__sudoMemory;
      const cleanupTimers = globalThis.__cleanupTimers;
      const REPEAT_WINDOW_MS = 30_000;
      const now = Date.now();
      const prev = sudoMemory.get(memoryKey);
      let count = 1;
      let lastResponseIndex = null;
      if (prev && (now - prev.lastAt) <= REPEAT_WINDOW_MS) {
        count = prev.count + 1;
        lastResponseIndex = prev.lastResponseIndex ?? null;
      }
      const { text: replyText, index: usedIndex } = getResponse(commandText, count, message.author, lastResponseIndex);
      sudoMemory.set(memoryKey, { lastAt: now, count, lastResponseIndex: usedIndex });
      if (cleanupTimers.has(memoryKey)) clearTimeout(cleanupTimers.get(memoryKey));
      const t = setTimeout(() => {
        sudoMemory.delete(memoryKey);
        cleanupTimers.delete(memoryKey);
      }, REPEAT_WINDOW_MS + 1000);
      cleanupTimers.set(memoryKey, t);
      try {
        await message.reply(replyText);
      } catch (err) {
        try {
          await message.channel.send(replyText);
        } catch (err2) {
          console.error('Failed to send reply:', err2);
        }
      }
      if (count >= 4) {
        sudoMemory.set(memoryKey, { lastAt: now, count: 1, lastResponseIndex: null });
      }
    } catch (err) {
      console.error('Unhandled error in message handler:', err);
    }
  });
  client.login(BOT_TOKEN);
})();
