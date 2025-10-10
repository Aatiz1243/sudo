// utils/status.js
import { EmbedBuilder, ActivityType } from 'discord.js';
import os from 'os';

/**
 * startStatusRotation(client, options)
 * - client: Discord client instance
 * - options:
 *    - activities: array of strings OR array of { text, type? } objects. Default examples included.
 *    - interval: ms between rotates (default 20_000)
 *    - status: 'online'|'idle'|'dnd'|'invisible' (default 'online')
 */
export function startStatusRotation(client, options = {}) {
  const defaultActivities = [
    'Type $sudo for chaos',
    'Watching your commands...',
    'Simulating root access — jokingly',
    'Use /help for slash commands'
  ];

  const {
    activities = defaultActivities,
    interval = 20_000,
    status = 'online'
  } = options;

  // Normalize to array of { text, type }
  const pool = activities.map(a => {
    if (typeof a === 'string') return { text: a, type: ActivityType.Playing };
    if (typeof a === 'object' && a !== null) {
      const t = (a.type && typeof a.type === 'string') ? ActivityType[a.type] ?? ActivityType.Playing : ActivityType.Playing;
      return { text: a.text || '', type: t };
    }
    return { text: String(a), type: ActivityType.Playing };
  });

  function pickIndex(lastIndex) {
    if (!pool.length) return 0;
    if (pool.length === 1) return 0;
    let idx = Math.floor(Math.random() * pool.length);
    if (typeof lastIndex === 'number' && pool.length > 1 && idx === lastIndex) {
      idx = (idx + 1) % pool.length;
    }
    return idx;
  }

  let lastIndex = -1;
  if (client._statusRotationInterval) {
    clearInterval(client._statusRotationInterval);
    client._statusRotationInterval = null;
  }

  const applyStatus = () => {
    if (!client.user) return;
    try {
      const raw = pool[pickIndex(lastIndex)];
      lastIndex = pool.indexOf(raw);
      let text = raw.text.replace(/%guilds%/g, String(client.guilds.cache.size || 0))
                         .replace(/%users%/g, String(client.users.cache?.size || 0))
                         .replace(/%uptime%/g, prettyUptime(client.uptime || 0));
      client.user.setPresence({
        activities: [{ name: text, type: raw.type }],
        status
      }).catch(() => {});
    } catch (err) {
      // ignore presence errors
    }
  };

  setTimeout(applyStatus, 500);
  client._statusRotationInterval = setInterval(applyStatus, interval);
  return client._statusRotationInterval;
}

function prettyUptime(ms) {
  if (!ms || ms <= 0) return '0s';
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hrs = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hrs) parts.push(`${hrs}h`);
  if (mins) parts.push(`${mins}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ');
}

export function getStatusEmbed(client) {
  const mem = process.memoryUsage();
  const rssMB = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
  const heapMB = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const guilds = client.guilds.cache.size ?? 0;
  const users = client.users.cache?.size ?? 0;
  const activity = client.user?.presence?.activities?.[0];
  const activityText = activity ? `${activity.name} (${activity.type})` : '—';

  const embed = new EmbedBuilder()
    .setTitle('Sudo — Status')
    .setDescription('Live status information about the Sudo bot')
    .addFields(
      { name: 'Uptime', value: prettyUptime(client.uptime ?? 0), inline: true },
      { name: 'Guilds', value: String(guilds), inline: true },
      { name: 'Cached Users', value: String(users), inline: true },
      { name: 'Activity', value: activityText, inline: false },
      { name: 'Memory (RSS / Heap)', value: `${rssMB} MB / ${heapMB} MB`, inline: true },
      { name: 'Node', value: process.version, inline: true },
      { name: 'Host', value: os.platform() + ' • ' + os.arch(), inline: true }
    )
    .setFooter({ text: 'Sudo • status' })
    .setTimestamp();

  return embed;
}
