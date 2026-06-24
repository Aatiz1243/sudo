// handlers/responseGenerator.js
//
// Produces a response for a matched command: either a curated "anchor" line
// (the original hand-written responses array) or a freshly assembled combo
// from {fragments} + templates. No AI/API involved — every word in the
// output is something a human wrote into data/commands.json; this just
// multiplies a small set of fragments into a much larger set of outputs.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH  = path.join(__dirname, '../data/generated-log.json');

const SLOT_RE        = /\{(\w+)\}/g;
const GENERATE_CHANCE = 0.55; // when a command has templates, odds of generating fresh vs. picking an anchor
const REPEAT_WINDOW   = 3;    // recent responses to avoid repeating, per user+command
const MAX_RETRIES     = 8;

// userId:cmdName -> array of recently served strings (in-memory, resets on restart — fine, it's just anti-spam)
const recentCache = new Map();

function recentKey(userId, cmdName) {
  return `${userId}:${cmdName}`;
}

function wasRecentlyServed(userId, cmdName, text) {
  return (recentCache.get(recentKey(userId, cmdName)) ?? []).includes(text);
}

function markServed(userId, cmdName, text) {
  const key    = recentKey(userId, cmdName);
  const recent = recentCache.get(key) ?? [];
  recent.push(text);
  if (recent.length > REPEAT_WINDOW) recent.shift();
  recentCache.set(key, recent);
}

// ── Fragment/template expansion ────────────────────────────────────────────
function fillTemplate(template, fragments) {
  return template.replace(SLOT_RE, (_, slotName) => {
    const options = fragments?.[slotName];
    if (!options?.length) return `{${slotName}}`; // missing slot surfaces as visible gap, not a crash
    return options[Math.floor(Math.random() * options.length)];
  });
}

function hasUnfilledSlot(text) {
  return SLOT_RE.test(text);
}

// ── Promotion-loop logging ───────────────────────────────────────────────────
function load() {
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf8')); }
  catch { return { combos: {}, lastSurfacedAt: null }; }
}

function save(data) {
  try { writeFileSync(LOG_PATH, JSON.stringify(data, null, 2), 'utf8'); }
  catch (err) { console.error('[responseGenerator] log save failed:', err.message); }
}

function logGenerated(cmdName, text) {
  const data = load();
  const key  = `${cmdName}::${text}`;
  if (!data.combos[key]) {
    data.combos[key] = { cmdName, text, count: 0, firstSeen: Date.now(), lastSeen: Date.now() };
  }
  data.combos[key].count   += 1;
  data.combos[key].lastSeen = Date.now();
  save(data);
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * @param {object} cmd      command pool entry: { responses, fragments?, templates? }
 * @param {string} cmdName  canonical command name (for logging + repeat-avoidance keying)
 * @param {string} userId   Discord user id
 */
export function generateResponse(cmd, cmdName, userId) {
  const anchors      = cmd.responses ?? [];
  const templates     = cmd.templates ?? [];
  const canGenerate   = templates.length > 0 && cmd.fragments && Object.keys(cmd.fragments).length > 0;

  let candidate   = null;
  let isGenerated = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    isGenerated = canGenerate && Math.random() < GENERATE_CHANCE;

    if (isGenerated) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const filled   = fillTemplate(template, cmd.fragments);
      if (hasUnfilledSlot(filled)) {
        console.warn(`[responseGenerator] unfilled slot in "${cmdName}" template: ${template}`);
        isGenerated = false; // authoring gap — fall through to an anchor this round
      } else {
        candidate = filled;
      }
    }

    if (!candidate) {
      if (!anchors.length) break;
      candidate   = anchors[Math.floor(Math.random() * anchors.length)];
      isGenerated = false;
    }

    if (!wasRecentlyServed(userId, cmdName, candidate)) break;
    candidate = null; // collided with recent history — retry
  }

  if (!candidate) candidate = anchors[0] ?? 'Error: no responses configured for this command.';

  markServed(userId, cmdName, candidate);
  if (isGenerated) logGenerated(cmdName, candidate);

  return candidate;
}

// ── Weekly promotion digest — call alongside unknownLogger's weekly post ────
export async function surfaceTopGenerated(client, channelId) {
  if (!channelId) return;

  const data = load();
  const top  = Object.values(data.combos)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (!top.length) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;

    const lines = top.map((c, i) =>
      `**${i + 1}.** \`${c.cmdName}\` \u2014 "${c.text}" \u2014 served **${c.count}x**`
    ).join('\n');

    await channel.send(
      `\uD83C\uDFB2 **Top Generated Combos \u2014 ${new Date().toDateString()}**\n\n` +
      `These came from fragments/templates, not hand-written anchors. Promote any with:\n` +
      `\`!approve <name> | <the combo text>\`\n\n${lines}`
    );

    data.lastSurfacedAt = Date.now();
    save(data);
  } catch (err) {
    console.error('[responseGenerator] failed to surface generated combos:', err.message);
  }
}
