// handlers/commandRouter.js
import { readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fsPromises from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_PATH = path.join(__dirname, '../data/commands.json');

let commandPool = {};
let lookup = new Map(); // normalized string → canonical command name
const jsCommands = new Map(); // name → module with execute()

// ── Normalization ─────────────────────────────────────────────────────────────
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Levenshtein distance ──────────────────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Threshold scales with input length; short inputs get no fuzzy tolerance
function fuzzyThreshold(len) {
  if (len < 5) return 0;
  return Math.min(3, Math.floor(len * 0.2));
}

// ── Command pool ──────────────────────────────────────────────────────────────
export function loadCommandPool() {
  try {
    const raw = readFileSync(COMMANDS_PATH, 'utf8');
    const data = JSON.parse(raw);
    commandPool = data.commands ?? {};
    rebuildLookup();
    return true;
  } catch (err) {
    console.error('[router] failed to load command pool:', err.message);
    return false;
  }
}

function rebuildLookup() {
  lookup = new Map();
  for (const [name, cmd] of Object.entries(commandPool)) {
    lookup.set(normalize(name), name);
    for (const alias of (cmd.aliases ?? [])) {
      lookup.set(normalize(alias), name);
    }
  }
}

// ── JS command loader (e.g. hack) ─────────────────────────────────────────────
async function loadJSCommands() {
  const commandsDir = path.join(__dirname, '../commands');

  async function walk(dir) {
    let entries;
    try { entries = await fsPromises.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      // Skip legacy loader and bare re-export files
      if (entry.name === 'commands.js' || entry.name === 'index.js') continue;

      try {
        const mod = await import(pathToFileURL(full).href);
        const cmd = mod.default ?? mod;
        if (cmd?.name && typeof cmd.execute === 'function') {
          jsCommands.set(cmd.name.toLowerCase(), cmd);
          console.log(`[router] JS command: ${cmd.name}`);
        }
      } catch (err) {
        console.error(`[router] failed to load ${full}:`, err.message);
      }
    }
  }

  await walk(commandsDir);
}

// ── Public init ───────────────────────────────────────────────────────────────
export async function initRouter() {
  loadCommandPool();
  await loadJSCommands();
  console.log(`[router] ready — ${Object.keys(commandPool).length} JSON cmds, ${jsCommands.size} JS cmds`);
}

// ── Routing ───────────────────────────────────────────────────────────────────
/**
 * @param {string} commandText  raw text after $sudo prefix (trimmed)
 * @returns {
 *   { type: 'js',   cmd: object, args: string[] } |
 *   { type: 'json', cmd: object, cmdName: string, fuzzy?: boolean } |
 *   null
 * }
 */
export function routeCommand(commandText) {
  const tokens = commandText.trim().split(/\s+/);
  const firstName = tokens[0]?.toLowerCase() ?? '';
  const args = tokens.slice(1);

  // 1. JS command matched by first token (e.g. "hack @user")
  if (jsCommands.has(firstName)) {
    return { type: 'js', cmd: jsCommands.get(firstName), args };
  }

  // 2. Exact match on full normalized text (e.g. "domyhomework" → homework)
  const normFull = normalize(commandText);
  if (lookup.has(normFull)) {
    const name = lookup.get(normFull);
    return { type: 'json', cmd: commandPool[name], cmdName: name };
  }

  // 3. Exact match on first token only (e.g. "sleep now" → sleep)
  const normFirst = normalize(firstName);
  if (lookup.has(normFirst)) {
    const name = lookup.get(normFirst);
    return { type: 'json', cmd: commandPool[name], cmdName: name };
  }

  // 4. Fuzzy match on full text (typos, slight variations)
  const threshold = fuzzyThreshold(normFull.length);
  if (threshold > 0) {
    let bestName = null;
    let bestDist = Infinity;
    for (const [key, name] of lookup.entries()) {
      const d = levenshtein(normFull, key);
      if (d < bestDist) { bestDist = d; bestName = name; }
    }
    if (bestDist <= threshold && bestName) {
      return { type: 'json', cmd: commandPool[bestName], cmdName: bestName, fuzzy: true };
    }
  }

  return null;
}

// ── Approve flow: add command to JSON pool without restart ────────────────────
export async function addCommand(canonicalName, responses, aliases = []) {
  const key = normalize(canonicalName);
  commandPool[key] = { aliases: aliases.map(normalize), responses };
  rebuildLookup();

  const raw = readFileSync(COMMANDS_PATH, 'utf8');
  const data = JSON.parse(raw);
  data.commands[key] = { aliases: aliases.map(normalize), responses };
  await writeFile(COMMANDS_PATH, JSON.stringify(data, null, 2), 'utf8');
  return key;
}

export const getCommandPool = () => commandPool;
export const getJSCommands  = () => jsCommands;
