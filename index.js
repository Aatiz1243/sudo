// index.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits, Partials, Events, Collection } from 'discord.js';
import { getResponse } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in environment. Create a .env file from .env.example and add BOT_TOKEN.');
  process.exit(1);
}

/**
 * Memory structures (sudo message handling)
 */
const sudoMemory = new Map();
const cleanupTimers = new Map();
const REPEAT_WINDOW_MS = 30_000; // 30 seconds window to consider repeats

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// --- Load slash command files from utils/commands ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'utils', 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    // import dynamically
    const filePath = path.join(commandsPath, file);
    const commandModule = await import(`file://${filePath}`);
    // Expect default export object { data, execute }
    const cmd = commandModule.default ?? commandModule;
    if (cmd?.data && typeof cmd.execute === 'function') {
      client.commands.set(cmd.data.name, cmd);
      console.log(`Loaded command: ${cmd.data.name}`);
    } else {
      console.warn(`Skipping invalid command file: ${file}`);
    }
  }
} else {
  console.warn('No utils/commands folder found — slash commands will not be loaded.');
}

// Ready
client.once(Events.ClientReady, () => {
  console.log(`Sudo online as ${client.user.tag}`);
  client.user.setActivity('Type $sudo for chaos');
});

// Interaction (slash command) handler
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

// Existing $sudo message handler (unchanged behavior)
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

    if (cleanupTimers.has(memoryKey)) {
      clearTimeout(cleanupTimers.get(memoryKey));
    }
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
