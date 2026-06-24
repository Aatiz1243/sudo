// handlers/moderationHandler.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname          = path.dirname(fileURLToPath(import.meta.url));
const SIGNALS_PATH       = path.join(__dirname, '../data/harm-signals.json');
const HATE_PATTERNS_PATH = path.join(__dirname, '../data/hate-patterns.local.json');

let harmPatterns = [];
let hatePatterns = [];
let dmMessage    = '';

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function loadSignals() {
  try {
    const data   = JSON.parse(readFileSync(SIGNALS_PATH, 'utf8'));
    harmPatterns = (data.patterns ?? []).map(normalize);
    dmMessage    = data.dmMessage ?? '';
  } catch (err) {
    console.error('[moderation] failed to load harm-signals.json:', err.message);
  }

  // Hate-pattern matching is intentionally NOT shipped with a built-in word
  // list, and that list is never committed to this public repo. See the
  // README "Moderation" section for why, and for the recommended primary
  // tool (Discord's own AutoMod). This file is local-only and optional.
  try {
    const hateData = JSON.parse(readFileSync(HATE_PATTERNS_PATH, 'utf8'));
    hatePatterns   = (hateData.hatePatterns ?? []).map(normalize);
  } catch {
    hatePatterns = []; // expected for anyone who hasn't created this file locally
  }

  console.log(`[moderation] loaded ${harmPatterns.length} harm pattern(s), ${hatePatterns.length} hate pattern(s)`);
}

/**
 * @returns {'harm' | 'hate' | null}
 */
export function checkSignal(commandText) {
  const norm = normalize(commandText);

  for (const p of hatePatterns) {
    if (p && norm.includes(p)) return 'hate';
  }
  for (const p of harmPatterns) {
    if (p && norm.includes(p)) return 'harm';
  }

  return null;
}

/**
 * Act on a flagged signal.
 * - hate → silent ignore + log, no public reply
 * - harm → quiet DM with support resources, no public reply
 * @returns {Promise<boolean>} true = caller should stop processing
 */
export async function handleSignal(signal, message) {
  if (signal === 'hate') {
    console.log(`[moderation] hate signal — user=${message.author.id} guild=${message.guild?.id ?? 'DM'} — silently ignored`);
    return true;
  }

  if (signal === 'harm') {
    console.log(`[moderation] harm signal — user=${message.author.id} guild=${message.guild?.id ?? 'DM'} — sending DM`);
    try {
      await message.author.send(dmMessage);
    } catch {
      // DMs disabled — nothing we can do, don't reply publicly either
    }
    return true;
  }

  return false;
}
