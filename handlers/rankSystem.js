// handlers/rankSystem.js
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/user-data.json');

const RANKS = [
  { name: 'Nobody',  threshold: 0   },
  { name: 'User',    threshold: 10  },
  { name: 'Sudoer',  threshold: 50  },
  { name: 'Root',    threshold: 150 },
  { name: 'God',     threshold: 500 },
];

const RANK_UP_MESSAGES = {
  User:   `\`\`\`\n> sudo grant-access --rank=User\nAccess level updated.\nYou've used Sudo 10 times.\nYou are now a User. The bar was low. You cleared it.\n\`\`\``,
  Sudoer: `\`\`\`\n> sudo grant-access --rank=Sudoer\n50 commands executed.\nYou are a Sudoer now.\nThe bot sees you slightly differently. Not much. But slightly.\n\`\`\``,
  Root:   `\`\`\`\n> sudo grant-access --rank=Root\n150 commands.\nRoot access unlocked.\nOccasional responses may feel different. Don't read into it too much.\n\`\`\``,
  God:    `\`\`\`\n> sudo grant-access --rank=God\n500 commands.\nYou are a God.\n\nSeriously though — go outside.\n\`\`\``,
};

// ── I/O ───────────────────────────────────────────────────────────────────────
function load() {
  try { return JSON.parse(readFileSync(DATA_PATH, 'utf8')); }
  catch { return {}; }
}

function save(data) {
  try { writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8'); }
  catch (err) { console.error('[ranks] save failed:', err.message); }
}

// ── Rank logic ────────────────────────────────────────────────────────────────
function rankIndexFor(uses) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (uses >= RANKS[i].threshold) idx = i;
  }
  return idx;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Increment a user's use count and return their rank info.
 * @returns {{ uses, rank, rankIndex, rankChanged, rankUpMessage }}
 */
export function recordUse(userId, username) {
  const data = load();
  const now  = Date.now();

  if (!data[userId]) {
    data[userId] = { uses: 0, rankIndex: 0, firstSeen: now, lastSeen: now, username };
  }

  data[userId].uses    += 1;
  data[userId].lastSeen = now;
  if (username) data[userId].username = username;

  const oldIdx = data[userId].rankIndex;
  const newIdx = rankIndexFor(data[userId].uses);
  const rankChanged = newIdx > oldIdx;
  if (rankChanged) data[userId].rankIndex = newIdx;

  save(data);

  return {
    uses:          data[userId].uses,
    rank:          RANKS[newIdx].name,
    rankIndex:     newIdx,
    rankChanged,
    rankUpMessage: rankChanged ? (RANK_UP_MESSAGES[RANKS[newIdx].name] ?? null) : null,
  };
}

/**
 * Read rank info without recording a use.
 */
export function getUserRank(userId) {
  const data = load();
  if (!data[userId]) return { uses: 0, rank: 'Nobody', rankIndex: 0 };
  const idx = rankIndexFor(data[userId].uses);
  return { uses: data[userId].uses, rank: RANKS[idx].name, rankIndex: idx };
}

export const RANK_NAMES = RANKS.map(r => r.name);
