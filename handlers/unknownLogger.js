// handlers/unknownLogger.js
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { surfaceTopGenerated } from './responseGenerator.js';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH     = path.join(__dirname, '../data/unknown-commands.json');
const LOG_CHANNEL  = process.env.LOG_CHANNEL_ID ?? null;

// ── I/O ───────────────────────────────────────────────────────────────────────
function load() {
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf8')); }
  catch { return { commands: {}, lastSurfacedAt: null }; }
}

function save(data) {
  try { writeFileSync(LOG_PATH, JSON.stringify(data, null, 2), 'utf8'); }
  catch (err) { console.error('[unknownLogger] save failed:', err.message); }
}

// ── Logging ───────────────────────────────────────────────────────────────────
export function logUnknownCommand(commandText) {
  const key = commandText.trim().toLowerCase().slice(0, 80);
  if (!key) return;

  const data = load();
  if (!data.commands[key]) {
    data.commands[key] = { count: 0, firstSeen: Date.now(), lastSeen: Date.now() };
  }
  data.commands[key].count   += 1;
  data.commands[key].lastSeen = Date.now();
  save(data);
}

// ── Weekly surface ────────────────────────────────────────────────────────────
export async function surfaceWeeklyUnknowns(client) {
  if (!LOG_CHANNEL) {
    console.log('[unknownLogger] LOG_CHANNEL_ID not set — skipping weekly surface');
    return;
  }

  const data = load();
  const top  = Object.entries(data.commands)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  if (!top.length) return;

  try {
    const channel = await client.channels.fetch(LOG_CHANNEL);
    if (!channel?.isTextBased()) return;

    const lines = top.map(([cmd, info], i) =>
      `**${i + 1}.** \`$sudo ${cmd}\` — tried **${info.count}x**`
    ).join('\n');

    await channel.send(
      `📋 **Weekly Unknown Commands — ${new Date().toDateString()}**\n\n` +
      `These were tried but didn't match anything. ` +
      `Use \`!approve <name> | response1 | response2\` to add any of them:\n\n${lines}`
    );

    data.lastSurfacedAt = Date.now();
    save(data);
    console.log('[unknownLogger] weekly summary posted');
  } catch (err) {
    console.error('[unknownLogger] failed to surface unknowns:', err.message);
  }
}

function isSunday()              { return new Date().getDay() === 0; }
function postedThisWeek(ts)      { return ts && (Date.now() - ts) < 7 * 24 * 60 * 60 * 1000; }

export function startWeeklyTimer(client) {
  // Check every hour; fire on Sunday if not already posted this week
  setInterval(async () => {
    if (!isSunday()) return;
    const { lastSurfacedAt } = load();
    if (postedThisWeek(lastSurfacedAt)) return;
    await surfaceWeeklyUnknowns(client);
    await surfaceTopGenerated(client, LOG_CHANNEL);
  }, 60 * 60 * 1000);

  console.log('[unknownLogger] weekly timer started');
}
