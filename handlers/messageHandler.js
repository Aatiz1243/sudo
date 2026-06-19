// handlers/messageHandler.js
import { routeCommand, addCommand } from './commandRouter.js';
import { checkSignal, handleSignal } from './moderationHandler.js';
import { logUnknownCommand } from './unknownLogger.js';
import { recordUse, getUserRank } from './rankSystem.js';

const PREFIX   = '$sudo';
const OWNER_ID = process.env.OWNER_ID ?? null;

// ── Generic fallback for unknown commands ─────────────────────────────────────
const FALLBACKS = [
  c => `sudo: ${c}: command not found. (Logged — if enough people try it, it'll show up.)`,
  c => `permission denied. "${c}" isn't in the system yet.`,
  c => `"${c}" doesn't exist yet. Honestly? It sounds like it should.`,
  c => `sudo: ${c}: unknown command. Filing this one away.`,
  c => `${c}.sh: no such file or directory. Yet.`,
];

function fallback(commandText) {
  const short = commandText.length > 30 ? commandText.slice(0, 30) + '…' : commandText;
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)](short);
}

// ── Response picker (rank-aware) ──────────────────────────────────────────────
function pickResponse(responses, rankInfo) {
  if (!responses?.length) return 'Error: no responses configured for this command.';

  const idx  = Math.floor(Math.random() * responses.length);
  const base = responses[idx];

  // Root / God tiers get an occasional label — keeps it visible but rare
  if (rankInfo.rankIndex >= 4 && Math.random() < 0.12) return `[GOD MODE] ${base}`;
  if (rankInfo.rankIndex >= 3 && Math.random() < 0.08) return `[ROOT] ${base}`;

  return base;
}

// ── Rank display ──────────────────────────────────────────────────────────────
function rankBar(rankIndex) {
  return ['▰','▰','▰','▰','▰'].map((on, i) => i <= rankIndex ? on : '▱').join('');
}

// ── Safe reply ────────────────────────────────────────────────────────────────
async function safeReply(message, text) {
  try {
    await message.reply(text);
  } catch {
    try { await message.channel.send(text); } catch {}
  }
}

// ── Owner-only !approve command ───────────────────────────────────────────────
// Usage: !approve <command name> | response one | response two | ...
async function handleApprove(message) {
  if (!OWNER_ID || message.author.id !== OWNER_ID) return false;
  if (!message.content.trim().startsWith('!approve')) return false;

  const payload = message.content.trim().slice('!approve'.length).trim();
  if (!payload) {
    await safeReply(message, 'Usage: `!approve <name> | response 1 | response 2`');
    return true;
  }

  const parts     = payload.split('|').map(p => p.trim()).filter(Boolean);
  const name      = parts[0];
  const responses = parts.slice(1);

  if (!responses.length) {
    await safeReply(message, `Need at least one response after the pipe.\nExample: \`!approve ${name} | the bot's reply here\``);
    return true;
  }

  try {
    const key = await addCommand(name, responses);
    await safeReply(message,
      `✅ \`$sudo ${key}\` added with **${responses.length}** response(s).\nLive right now — no restart needed.`
    );
  } catch (err) {
    console.error('[approve] error:', err);
    await safeReply(message, `❌ Failed to add: ${err.message}`);
  }

  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export function registerMessageHandler(client) {
  client.on('messageCreate', async (message) => {
    try {
      if (!message || message.author?.bot) return;
      const raw = message.content?.trim();
      if (!raw) return;

      // Owner approve flow (not prefixed with $sudo)
      if (raw.startsWith('!approve')) {
        await handleApprove(message);
        return;
      }

      // Only handle $sudo prefix
      if (!raw.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

      const commandText = raw.slice(PREFIX.length).trim();

      // Empty: just the prefix
      if (!commandText) {
        await safeReply(message, 'Be specific. `$sudo <something>` — tell me what to sudo.');
        return;
      }

      // ── Built-ins ─────────────────────────────────────────────────────────
      const cmdLow = commandText.toLowerCase();

      if (cmdLow === 'rank') {
        const info = getUserRank(message.author.id);
        await safeReply(message,
          `> sudo status --user ${message.author.username}\n` +
          `Rank: **${info.rank}** ${rankBar(info.rankIndex)}\n` +
          `Commands run: **${info.uses}**`
        );
        return;
      }

      if (cmdLow === 'commands') {
        await safeReply(message,
          'Try things like `$sudo sleep`, `$sudo homework`, `$sudo crush`, `$sudo motivation`.\n' +
          'Type `$sudo rank` to see your level. Use `/help` for the full guide.'
        );
        return;
      }

      if (cmdLow === 'help') {
        await safeReply(message, 'Use `/help` for the full guide, or just try `$sudo <anything>` and see what happens.');
        return;
      }

      // ── Moderation check (before routing) ────────────────────────────────
      const signal = checkSignal(commandText);
      if (signal) {
        await handleSignal(signal, message);
        return;
      }

      // ── Route ─────────────────────────────────────────────────────────────
      const route = routeCommand(commandText);

      if (!route) {
        logUnknownCommand(commandText);
        await safeReply(message, fallback(commandText));
        return;
      }

      // Record usage + get rank info
      const rankInfo = recordUse(message.author.id, message.author.username);

      if (route.type === 'js') {
        // JS commands (e.g. hack) handle their own reply
        await route.cmd.execute(message, route.args, { rankInfo });
      } else {
        await safeReply(message, pickResponse(route.cmd.responses, rankInfo));
      }

      // Rank-up DM
      if (rankInfo.rankChanged && rankInfo.rankUpMessage) {
        try { await message.author.send(rankInfo.rankUpMessage); }
        catch { /* DMs closed — skip silently */ }
      }

    } catch (err) {
      console.error('[messageHandler] unhandled error:', err);
    }
  });

  console.log(`[messageHandler] registered — prefix="${PREFIX}"`);
}
