// commands/hack/hack.js
// ./commands/hack/hack.js
export default {
  name: 'hack',
  description: 'Pretend to hack a user. Usage: $sudo hack <user>',
  aliases: ['haxx', 'hackme'],

  /**
   * execute(message, args, context)
   *
   * This simulates a "realistic" hack sequence by editing a single message.
   * It is purely cosmetic / fictional and does not perform any real hacking operations.
   */
  async execute(message, args = [], context = {}) {
    // small helper functions
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randHex = (len = 32) =>
      Array.from({ length: len }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    const randBase64 = (bytes = 12) => Buffer.from(randHex(bytes)).toString('base64').slice(0, Math.max(8, bytes));
    const randIP = () => `${randInt(11, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
    const randPort = () => randInt(1024, 65535);

    // Validate input
    if (!args || args.length === 0) {
      return message.reply('Usage: `$sudo hack <user|id|mention|nickname|username#discrim>` — tell me who to "hack".');
    }

    const rawArg = args.join(' ').trim();

    // RESOLVE target: attempt mention -> id -> username#discrim -> exact display/username -> partial matches -> fallback raw text
    async function resolveTarget(raw) {
      const res = {
        foundMember: null, // GuildMember if found
        foundUser: null,   // User if found
        mention: null,     // mention string for output (e.g., <@id>)
        display: raw       // human readable display fallback
      };

      // 1) mention pattern
      const mentionMatch = raw.match(/^<@!?(?<id>\d+)>$/);
      if (mentionMatch) {
        const id = mentionMatch.groups.id;
        res.mention = `<@${id}>`;
        try {
          if (message.guild) {
            // try fetch member in guild
            const m = await message.guild.members.fetch(id).catch(() => null);
            if (m) {
              res.foundMember = m;
              res.foundUser = m.user;
              res.display = `<@${m.id}>`;
              return res;
            }
          }
          // fallback: fetch user globally by id
          const u = await message.client.users.fetch(id).catch(() => null);
          if (u) {
            res.foundUser = u;
            res.display = `<@${u.id}>`;
            return res;
          }
        } catch {}
        // if id doesn't resolve, continue: leave display as raw mention
        return res;
      }

      // 2) pure numeric ID (Discord snowflake)
      const idMatch = raw.match(/^(\d{17,20})$/);
      if (idMatch) {
        const id = idMatch[1];
        try {
          if (message.guild) {
            const m = await message.guild.members.fetch(id).catch(() => null);
            if (m) {
              res.foundMember = m;
              res.foundUser = m.user;
              res.display = `<@${m.id}>`;
              return res;
            }
          }
          const u = await message.client.users.fetch(id).catch(() => null);
          if (u) {
            res.foundUser = u;
            res.display = `<@${u.id}>`;
            return res;
          }
        } catch {}
        return res;
      }

      // 3) username#discriminator pattern (exact)
      const discrim = raw.match(/^(.+)#(\d{4})$/);
      if (discrim) {
        const namePart = discrim[1];
        const disc = discrim[2];
        // search guild first
        if (message.guild) {
          // try cached exact match
          const mExact = message.guild.members.cache.find((m) =>
            (m.user.tag && m.user.tag.toLowerCase() === `${namePart.toLowerCase()}#${disc}`)
          );
          if (mExact) {
            res.foundMember = mExact;
            res.foundUser = mExact.user;
            res.display = `<@${mExact.id}>`;
            return res;
          }
          // try fetch by query (if available)
          try {
            const fetched = await message.guild.members.fetch({ query: namePart, limit: 10 }).catch(() => null);
            if (fetched && fetched.size) {
              const hit = fetched.find(m => m.user.discriminator === disc);
              if (hit) {
                res.foundMember = hit;
                res.foundUser = hit.user;
                res.display = `<@${hit.id}>`;
                return res;
              }
            }
          } catch {}
        }
        // fallback global cache lookup (best-effort)
        const u = message.client.users.cache.find((u) => u.username.toLowerCase() === namePart.toLowerCase() && u.discriminator === disc);
        if (u) {
          res.foundUser = u;
          res.display = `<@${u.id}>`;
          return res;
        }
      }

      // helper search functions for partial / exact matching
      const tryGuildSearch = async (query) => {
        // try exact displayName or username
        const cache = message.guild?.members?.cache;
        if (cache && cache.size) {
          // exact displayName
          const exact = cache.find(m => (m.displayName || '').toLowerCase() === query.toLowerCase());
          if (exact) return exact;
          // exact username
          const exactUser = cache.find(m => (m.user?.username || '').toLowerCase() === query.toLowerCase());
          if (exactUser) return exactUser;
          // startsWith
          const starts = cache.find(m => (m.displayName || '').toLowerCase().startsWith(query.toLowerCase()) || (m.user?.username || '').toLowerCase().startsWith(query.toLowerCase()));
          if (starts) return starts;
          // includes
          const incl = cache.find(m => (m.displayName || '').toLowerCase().includes(query.toLowerCase()) || (m.user?.username || '').toLowerCase().includes(query.toLowerCase()));
          if (incl) return incl;
        }

        // attempt fetch by query (GuildMemberManager.fetch with query) - may be rate-limited or require intents, but we try
        try {
          const fetched = await message.guild.members.fetch({ query: query, limit: 10 }).catch(() => null);
          if (fetched && fetched.size) {
            // prefer exact username/displayName
            const exact = fetched.find(m => (m.user?.username || '').toLowerCase() === query.toLowerCase() || (m.displayName || '').toLowerCase() === query.toLowerCase());
            if (exact) return exact;
            // fallback first result
            return fetched.first();
          }
        } catch {}
        return null;
      };

      // 4) try guild-based searches for exact/partial names (if in a guild)
      if (message.guild) {
        try {
          const found = await tryGuildSearch(raw);
          if (found) {
            res.foundMember = found;
            res.foundUser = found.user;
            res.display = `<@${found.id}>`;
            return res;
          }
        } catch {}
      }

      // 5) try global user cache search (username exact, startsWith, includes)
      const uExact = message.client.users.cache.find(u => u.username.toLowerCase() === raw.toLowerCase());
      if (uExact) {
        res.foundUser = uExact;
        res.display = `<@${uExact.id}>`;
        return res;
      }
      const uStart = message.client.users.cache.find(u => u.username.toLowerCase().startsWith(raw.toLowerCase()));
      if (uStart) {
        res.foundUser = uStart;
        res.display = `<@${uStart.id}>`;
        return res;
      }
      const uIncl = message.client.users.cache.find(u => u.username.toLowerCase().includes(raw.toLowerCase()));
      if (uIncl) {
        res.foundUser = uIncl;
        res.display = `<@${uIncl.id}>`;
        return res;
      }

      // 6) if nothing found, fallback to raw text (display the name)
      res.display = raw;
      return res;
    } // end resolveTarget

    // resolve target
    let targetInfo;
    try {
      targetInfo = await resolveTarget(rawArg);
    } catch (err) {
      console.error('Error resolving target:', err);
      targetInfo = { display: rawArg };
    }

    const displayTarget = targetInfo.display || rawArg;

    // STAGES & PROGRESS (same cosmetic edit pattern)
    const stages = [
      { label: `Initializing hack engine for ${displayTarget}`, delay: 700 },
      { label: `Resolving host`, extra: `IP: ${randIP()}`, delay: 700 },
      { label: `Enumerating services`, extra: `ports: ${randPort()}, ${randPort()}, ${randPort()}`, delay: 800 },
      { label: `Bypassing perimeter controls`, delay: 900 },
      { label: `Exfiltrating credentials (simulated)`, extra: `token: ${randHex(24)}`, delay: 900 },
      { label: `Cracking caches`, delay: 850 },
      { label: `Deploying stealth payload`, extra: `sha256: ${randHex(32)}`, delay: 800 },
      { label: `Erasing footprints`, delay: 700 }
    ];
    const percentSteps = [2, 10, 23, 37, 54, 72, 88, 96, 100];

    // create initial message (reply preferred)
    let progressMsg;
    try {
      progressMsg = await message.reply(`🔍 Initiating simulation on ${displayTarget}...`);
    } catch {
      try {
        progressMsg = await message.channel.send(`🔍 Initiating simulation on ${displayTarget}...`);
      } catch (err) {
        console.error('Cannot create message to edit for hack simulation:', err);
        return;
      }
    }

    // Run the stage edits
    try {
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        const pct = percentSteps[Math.min(i, percentSteps.length - 1)];
        let text = `\`\`\`txt\n[${String(pct).padStart(3)}%] ${s.label}\n\`\`\``;
        if (s.extra) text += `\n${s.extra}`;
        text += `\n• ${randBase64(10)} · ${randHex(8)}`;
        await sleep(s.delay);
        await progressMsg.edit(text).catch(() => {});
      }

      // final ramp
      for (const p of percentSteps.slice(-3)) {
        await sleep(220);
        const finalText = `\`\`\`txt\n[ ${String(p).padStart(3)}% ] Finalizing...\n\`\`\``;
        await progressMsg.edit(finalText).catch(() => {});
      }

      await sleep(600);

      // Choose final message (prefer this.responses if provided by loader)
      const finalPool = (Array.isArray(this.responses) && this.responses.length) ? this.responses : [
        `Hack complete — {user} compromised. (simulation)`,
        `Completed: remote shells (simulated) for {user}.`,
        `Done. {user} now has elevated privileges (fictional).`,
        `Success: access granted to {user}. Files exfiltrated: 12 items (simulated).`,
        `Complete — {user} has been pwned. (just pretend)`
      ];

      // pick index using loader-provided helper if available
      let finalIdx = Math.floor(Math.random() * finalPool.length);
      if (context && typeof context.pickIndexNoRepeat === 'function') {
        try {
          finalIdx = context.pickIndexNoRepeat(finalPool.length);
        } catch {
          finalIdx = Math.floor(Math.random() * finalPool.length);
        }
      }

      const finalRaw = finalPool[finalIdx] ?? finalPool[0];
      const finalReplaced = finalRaw.replace(/\{user\}/gi, displayTarget);

      // Save last index via context if supported (prevents immediate repeats)
      if (context && typeof context.saveLastIndex === 'function') {
        try { context.saveLastIndex(finalIdx); } catch {}
      }

      // final edited message + short summary
      const completeMsg = [
        `✅ **COMPLETED**`,
        `**Target:** ${displayTarget}`,
        `**Session ID:** ${randHex(20)}`,
        `**Artifact:** ${randHex(12)}.bin`,
        `**Result:** ${finalReplaced}`
      ].join('\n');

      await progressMsg.edit(completeMsg).catch(() => {});
      // try a follow-up summary line that doesn't edit (safer for rate limits)
      await sleep(200);
      try {
        await message.channel.send(`\`[SUMMARY]\` ${displayTarget} — session ${randHex(8)} — status: COMPLETE`);
      } catch {}
    } catch (err) {
      console.error('Error in hack simulation flow:', err);
      try {
        await progressMsg.edit('⚠️ Simulation interrupted due to an error.').catch(() => {});
      } catch {}
    }
  }
};
