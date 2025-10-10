// remove-old-commands.js
// Node.js script to remove old global application commands
// Usage:
//   1) npm install @discordjs/rest discord-api-types dotenv
//   2) create a .env file with BOT_TOKEN and CLIENT_ID
//   3) node remove-old-commands.js
//
// By default this script runs in DRY_RUN mode (safe): set DRY_RUN=false in .env to actually delete.

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const DRY_RUN = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

if (!token || !clientId) {
  console.error('Missing BOT_TOKEN or CLIENT_ID in environment. Create a .env with BOT_TOKEN=... and CLIENT_ID=...');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

// Targets the user asked to remove (as written). We'll treat them as:
// - possible parent commands "firewall", "toggle"
// - possible literal command names (with underscores/hyphens variants)
// - subcommands named "on","off","disable","enable","list"
const rawTargets = [
  'help' // Added to target /help command
];

const unwantedParentNames = new Set(['firewall', 'toggle']);

// build literal name variants (spaces → underscore / dash)
const literalNameVariants = new Set();
for (const t of rawTargets) {
  literalNameVariants.add(t); // unlikely (spaces), kept for completeness
  literalNameVariants.add(t.replace(/\s+/g, '_'));
  literalNameVariants.add(t.replace(/\s+/g, '-'));
  literalNameVariants.add(t.replace(/\s+/g, '')); // concat
}

(async () => {
  try {
    console.log('Fetching global application commands for application id:', clientId);
    const commands = await rest.get(Routes.applicationCommands(clientId));
    if (!Array.isArray(commands)) {
      console.error('Unexpected response getting commands:', commands);
      return;
    }

    console.log(`Found ${commands.length} global commands. Scanning for matches...`);
    const toDelete = [];

    for (const cmd of commands) {
      const name = cmd.name; // command name (string)
      let match = false;
      let reason = '';

      // 1) literal name matches (including underscore/hyphen/concat variants)
      if (literalNameVariants.has(name)) {
        match = true;
        reason = `literal name match (${name})`;
      }

      // 2) parent name matches (e.g., a 'firewall' or 'toggle' command that probably has subcommands)
      if (!match && unwantedParentNames.has(name)) {
        match = true;
        reason = `parent command name match (${name})`;
      }

      // 3) any subcommand in options matches the unwanted subcommands
      if (!match && Array.isArray(cmd.options)) {
        for (const opt of cmd.options) {
          // Discord API: option.type === 1 means SUB_COMMAND
          // opt.name is the subcommand name (string)
          if (opt.type === 1 && unwantedSubcommands.has(opt.name)) {
            match = true;
            reason = `contains unwanted subcommand "${opt.name}"`;
            break;
          }
          // Also check deeper (subcommand groups)
          if (opt.type === 2 && Array.isArray(opt.options)) {
            for (const inner of opt.options) {
              if (inner.type === 1 && unwantedSubcommands.has(inner.name)) {
                match = true;
                reason = `contains unwanted subcommand (group) "${inner.name}"`;
                break;
              }
            }
            if (match) break;
          }
        }
      }

      if (match) toDelete.push({ id: cmd.id, name, reason });
    }

    if (toDelete.length === 0) {
      console.log('No matching commands found. Nothing to delete.');
      return;
    }

    console.log('Commands flagged for deletion:');
    for (const d of toDelete) {
      console.log(` - ${d.name} (id: ${d.id}) — ${d.reason}`);
    }

    if (DRY_RUN) {
      console.log('\nDRY_RUN is ON. No commands were deleted. To actually delete, set DRY_RUN=false in your .env and re-run the script.');
      return;
    }

    // Perform deletions
    console.log('\nDeleting flagged commands...');
    for (const d of toDelete) {
      try {
        await rest.delete(Routes.applicationCommand(clientId, d.id));
        console.log(`Deleted ${d.name} (${d.id}) — ${d.reason}`);
      } catch (err) {
        console.error(`Failed to delete ${d.name} (${d.id}):`, err);
      }
    }

    console.log('Done.');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
