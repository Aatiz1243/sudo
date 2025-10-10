// utils/response.js
/**
 * getResponse(commandText, repeatCount, user, lastIndex)
 * returns: { text: string, index: number }
 *
 * - Ensures randomly chosen response every time.
 * - Avoids returning the same index as lastIndex (when possible).
 */

function pickIndexNoImmediateRepeat(arrLength, lastIndex) {
  if (arrLength <= 0) return -1;
  if (arrLength === 1) return 0;
  // try random picks, fallback to deterministic shift if unlucky
  let tries = 0;
  while (tries < 6) {
    const idx = Math.floor(Math.random() * arrLength);
    if (idx !== lastIndex) return idx;
    tries++;
  }
  // fallback: return next index (wrap)
  return (lastIndex + 1) % arrLength;
}

export function getResponse(commandText, repeatCount, user, lastIndex = null) {
  const username = user?.username ?? 'there';

  const firstTimeResponses = [
    `🛠 Executing "${commandText}"... Success! ${username}, you now have admin privileges over reality.`,
    `💥 "${commandText}" failed — permission denied. You’re not root (yet), ${username}.`,
    `🤖 "${commandText}" acknowledged. Booting the universe for ${username}...`,
    `✅ "${commandText}" executed. Results: chaos level 9000. Handle with care, ${username}.`,
    `🔮 ${username}, I performed "${commandText}". Side effects may include spontaneous dancing.`,
    `🌀 ${username}, "${commandText}" completed. Expect slightly altered timelines.`,
    `⚙️ "${commandText}" — done. Logs: [redacted].`,
    `✨ "${commandText}" — finished. If the world feels weird, that's on me.`
  ];

  const secondTimeResponses = [
    `what?`,
    `what do you mean by "${commandText}"?`,
    `i heard you the first time. what?`,
    `again? say it clearly.`,
    `do you want me to actually do "${commandText}" or just scream into the void?`,
    `hmm? you repeated "${commandText}". clarify.`
  ];

  const thirdTimeResponses = [
    `tell me what you want?`,
    `speak plainly, ${username}. I can't read your mind (yet).`,
    `again? be explicit or be silent.`,
    `third time's the charm — or the apocalypse. be specific.`,
    `i'm listening. give me a proper command.`,
    `this is getting repetitive. use words.`
  ];

  let pool;
  if (repeatCount === 1) pool = firstTimeResponses;
  else if (repeatCount === 2) pool = secondTimeResponses;
  else pool = thirdTimeResponses;

  const idx = pickIndexNoImmediateRepeat(pool.length, typeof lastIndex === 'number' ? lastIndex : -1);
  const text = idx >= 0 ? pool[idx] : pool[0] ?? '';

  return { text, index: idx };
}
