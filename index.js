// index.js
import 'dotenv/config';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Partials, Events, Collection } from 'discord.js';
import fsPromises from 'fs/promises';

import { initRouter }             from './handlers/commandRouter.js';
import { loadSignals }            from './handlers/moderationHandler.js';
import { startWeeklyTimer }       from './handlers/unknownLogger.js';
import { registerMessageHandler } from './handlers/messageHandler.js';
import { startStatusRotation }    from './utils/status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Env guard ─────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌  Missing BOT_TOKEN. Copy .env.example → .env and fill it in.');
  process.exit(1);
}

// ── Client ────────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// ── Slash command loader ──────────────────────────────────────────────────────
async function loadSlashCommands() {
  const dir = path.join(__dirname, 'utils', 'commands');
  let files;
  try { files = await fsPromises.readdir(dir); }
  catch { return; }

  for (const file of files.filter(f => f.endsWith('.js'))) {
    try {
      const mod = await import(pathToFileURL(path.join(dir, file)).href);
      const cmd = mod.default ?? mod;
      if (cmd?.data && typeof cmd.execute === 'function') {
        client.commands.set(cmd.data.name, cmd);
        console.log(`[slash] loaded /${cmd.data.name}`);
      }
    } catch (err) {
      console.error(`[slash] failed to load ${file}:`, err.message);
    }
  }
}

// ── Slash command dispatch ────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) {
    await interaction.reply({ content: 'Command not found.', ephemeral: true });
    return;
  }
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`[slash] error in /${interaction.commandName}:`, err);
    const msg = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`✅  Sudo online as ${client.user.tag}`);
  startStatusRotation(client);
  startWeeklyTimer(client);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
(async function main() {
  console.log('🚀  Starting Sudo...');

  loadSignals();           // load harm/hate detection patterns
  await loadSlashCommands();
  await initRouter();      // load JSON commands + JS commands (hack, etc.)
  registerMessageHandler(client); // single $sudo message handler

  await client.login(BOT_TOKEN);
})();
