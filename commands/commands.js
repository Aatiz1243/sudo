// commands/commands.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToFilePath(import.meta.url);
function fileURLToFilePath(url) {
  // small helper because Node's fileURLToPath isn't allowed in some older environments in examples
  // but we can use fileURLToPath from 'url' normally; to keep self-contained:
  try {
    // prefer built-in
    // eslint-disable-next-line node/no-extraneous-require
    return require('url').fileURLToPath(url);
  } catch {
    // fallback
    return url;
  }
}

/**
 * initTextCommands(client, options)
 *
 * - commandsDir: directory where command files are stored. Default: same directory as this file (./commands).
 * - prefix: string prefix that triggers commands (default '$sudo')
 * - repeatWindowMs: how long to keep last-index memory to avoid repeats (default 30000)
 *
 * Behavior:
 * - Recursively loads all .js files under commandsDir (expects default export with { name, description?, aliases?, execute? })
 * - If a sibling .txt file exists (same base name), it will be read and its non-empty lines attached as `module.responses`
 * - Exposes client.textCommands (Map) and registers a single messageCreate listener that dispatches commands invoked as:
 *     <prefix> <commandName> [args...]
 */
export async function initTextCommands(client, options = {}) {
  const callerDir = path.dirname(fileURLToPath(import.meta.url));
  const {
    commandsDir = callerDir,
    prefix = '$sudo',
    repeatWindowMs = 30_000
  } = options;

  // Hold loaded command modules
  const commands = new Map();

  // Memory for avoiding immediate repeat responses per user+command
  const lastRespIndex = new Map(); // key => { idx, at }
  const cleanupTimers = new Map();

  async function walkAndLoad(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      // directory doesn't exist — nothing to load
      console.warn(`[commands] commandsDir not found: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAndLoad(full);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.js')) continue;

      try {
        // dynamic import
        const moduleUrl = pathToFileURL(full).href;
        const mod = await import(moduleUrl);
        const cmd = (mod.default ?? mod);

        if (!cmd || typeof cmd.name !== 'string') {
          console.warn(`[commands] skipping invalid module (missing name): ${full}`);
          continue;
        }

        // Attach responses from .txt (same name) if available
        const base = entry.name.slice(0, -3); // remove .js
        const txtPath = path.join(dir, `${base}.txt`);
        try {
          const stat = await fs.stat(txtPath).catch(() => null);
          if (stat && stat.isFile()) {
            const raw = await fs.readFile(txtPath, 'utf8');
            const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length) cmd.responses = lines;
          }
        } catch (err) {
          // ignore missing txt
        }

        commands.set(cmd.name.toLowerCase(), cmd);
        // also register aliases lowercased in the map for lookup convenience
        if (Array.isArray(cmd.aliases)) {
          for (const a of cmd.aliases) {
            if (typeof a === 'string') commands.set(a.toLowerCase(), cmd);
          }
        }

        console.log(`[commands] loaded command "${cmd.name}" from ${full}`);
      } catch (err) {
        console.error(`[commands] failed to import ${full}:`, err);
      }
    }
  }

  // helper: pick index avoiding lastIndex
  function pickIndexNoRepeat(arrLen, lastIdx) {
    if (arrLen <= 0) return -1;
    if (arrLen === 1) return 0;

    // random tries
    for (let i = 0; i < 7; i++) {
      const idx = Math.floor(Math.random() * arrLen);
      if (idx !== lastIdx) return idx;
    }
    // fallback: deterministic next
    return ((lastIdx ?? -1) + 1) % arrLen;
  }

  // walk and load commands
  await walkAndLoad(commandsDir);

  // Expose map for other modules
  client.textCommands = commands;

  // Message handler for prefix commands
  client.on('messageCreate', async (message) => {
    try {
      if (!message || message.author?.bot) return;
      const raw = message.content;
      if (!raw) return;

      // case-insensitive prefix check
      if (!raw.toLowerCase().startsWith(prefix.toLowerCase())) return;

      const withoutPrefix = raw.slice(prefix.length).trim(); // content after prefix
      if (!withoutPrefix) return; // user only typed prefix

      const tokens = withoutPrefix.split(/\s+/);
      const cmdName = tokens[0].toLowerCase();
      const args = tokens.slice(1);

      const cmd = commands.get(cmdName);
      if (!cmd) return; // not a loaded command

      // create memory key per user+guild+command to avoid immediate repeat
      const guildId = message.guild?.id ?? 'DM';
      const memoryKey = `${message.author.id}::${guildId}::${cmd.name.toLowerCase()}`;

      const prev = lastRespIndex.get(memoryKey);
      const prevIdx = prev?.idx ?? null;

      // Simple auto-handling: if command module has responses array AND no execute function,
      // the loader will reply with a random line from responses.
      if (Array.isArray(cmd.responses) && typeof cmd.execute !== 'function') {
        const arr = cmd.responses;
        const idx = pickIndexNoRepeat(arr.length, prevIdx);
        const text = arr[idx] ?? arr[0] ?? '';

        // save last index & set cleanup timer
        lastRespIndex.set(memoryKey, { idx, at: Date.now() });
        if (cleanupTimers.has(memoryKey)) clearTimeout(cleanupTimers.get(memoryKey));
        cleanupTimers.set(memoryKey, setTimeout(() => {
          lastRespIndex.delete(memoryKey);
          cleanupTimers.delete(memoryKey);
        }, repeatWindowMs + 1000));

        // reply safely
        try {
          await message.reply(text);
        } catch {
          await message.channel.send(text).catch(() => {});
        }
        return;
      }

      // If module provides execute, call it and pass a context
      if (typeof cmd.execute === 'function') {
        const context = {
          prefix,
          args,
          tokens,
          lastIndex: prevIdx,
          pickIndexNoRepeat: (len) => pickIndexNoRepeat(len, prevIdx),
          saveLastIndex: (idx) => {
            lastRespIndex.set(memoryKey, { idx, at: Date.now() });
            if (cleanupTimers.has(memoryKey)) clearTimeout(cleanupTimers.get(memoryKey));
            cleanupTimers.set(memoryKey, setTimeout(() => {
              lastRespIndex.delete(memoryKey);
              cleanupTimers.delete(memoryKey);
            }, repeatWindowMs + 1000));
          },
          message
        };

        try {
          await cmd.execute(message, args, context);
        } catch (err) {
          console.error(`[commands] error executing ${cmd.name}:`, err);
          try { await message.reply('There was an error executing that command.'); } catch {}
        }
      }
    } catch (err) {
      console.error('[commands] message handler error:', err);
    }
  });

  console.log(`[commands] ready — prefix="${prefix}", loaded ${commands.size} commands.`);
  return commands;
}
