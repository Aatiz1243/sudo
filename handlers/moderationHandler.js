// handlers/moderationHandler.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIGNALS_PATH = path.join(__dirname, '../data/harm-signals.json');

let harmPatterns = [];
let hatePatterns = [];
let dmMessage    = '';

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function loadSignals() {
  try {
    const data   = JSON.parse(readFileSync(SIGNALS_PATH, 'utf8'));
    harmPatterns = (data.patterns     ?? []).map(normalize);
    hatePatterns = (data.hatePatterns ?? []).map(normalize);
    dmMessage    = data.dmMessage ?? '';
    console.log(`[moderation] loaded ${harmPatterns.length} harm patterns, ${hatePatterns.length} hate patterns`);
  } catch (err) {
    console.error('[moderation] failed to load signals:', err.message);
  }
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
