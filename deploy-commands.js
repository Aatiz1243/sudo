// deploy-commands.js
//
// Registers slash commands (utils/commands/*.js) with Discord's API.
// This is a separate, one-time(ish) step from running the bot — index.js
// only *dispatches* slash commands once Discord knows they exist; this
// script is what makes Discord know they exist in the first place.
//
// Run it again any time you add/change a slash command's name, description,
// or options. Usage: `npm run deploy`

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fsPromises from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID  = process.env.GUILD_ID ?? null; // optional — set for instant per-server deploy while developing

if (!BOT_TOKEN || !CLIENT_ID) {
  console.error('❌  Missing BOT_TOKEN and/or CLIENT_ID in .env.');
  console.error('    CLIENT_ID is your application ID from the Discord Developer Portal');
  console.error('    (General Information tab — NOT the bot token).');
  process.exit(1);
}

async function loadCommands() {
  const dir   = path.join(__dirname, 'utils', 'commands');
  const files = await fsPromises.readdir(dir);
  const commands = [];

  for (const file of files.filter(f => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const cmd = mod.default ?? mod;
    if (cmd?.data?.toJSON) {
      commands.push(cmd.data.toJSON());
      console.log(`[deploy] queued /${cmd.data.name}`);
    }
  }

  return commands;
}

(async function main() {
  const commands = await loadCommands();

  if (!commands.length) {
    console.warn('[deploy] no slash commands found in utils/commands/ — nothing to deploy.');
    return;
  }

  const rest = new REST().setToken(BOT_TOKEN);

  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`✅  Deployed ${commands.length} command(s) to guild ${GUILD_ID} — should appear instantly.`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log(`✅  Deployed ${commands.length} command(s) globally — can take up to an hour to appear everywhere.`);
    }
  } catch (err) {
    console.error('❌  Deploy failed:', err);
    process.exit(1);
  }
})();
