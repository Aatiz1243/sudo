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

  // Per-command response pools
  const commandResponses = {
    sudo: {
      first: [
        `What do you want?`,
        `Hey ${username}, what do you want?`,
        `Yes, what do you want?`,
        `Yeah. What do you want, chap?`,
        `What's the matter? What u want?`
      ],
      second: [
        `You already asked. What do you want?`,
        `Still waiting, ${username}.`,
        `Yes, yes, what do you want?`,
        `Repeating won't help, chap.`,
        `Again? What do you want?`
      ],
      third: [
        `WHY ARE YOU SPAMMING ME?`,
        `Stop spamming, ${username}.`,
        `Seriously, what do you want?`,
        `Enough! What do you want?`,
        `I'm not a genie, ${username}.`
      ],
      more: [
        `I'm ignoring you now.`,
        `Spam detected.`,
        `No more responses for you.`,
        `...`,
        `Please stop.`
      ]
    }
    // Add more commands here as needed
  };

  // Default generic responses
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

  const moreResponses = [
    `WHY ARE YOU SPAMMING ME?`,
    `Stop spamming, ${username}.`,
    `No more responses for you.`,
    `...`,
    `Please stop.`
  ];

  // Determine which pool to use
  let pool;
  const cmdKey = commandText.trim().toLowerCase();
  if (commandResponses[cmdKey]) {
    if (repeatCount === 1) pool = commandResponses[cmdKey].first;
    else if (repeatCount === 2) pool = commandResponses[cmdKey].second;
    else if (repeatCount === 3) pool = commandResponses[cmdKey].third;
    else pool = commandResponses[cmdKey].more;
  } else {
    if (repeatCount === 1) pool = firstTimeResponses;
    else if (repeatCount === 2) pool = secondTimeResponses;
    else if (repeatCount === 3) pool = thirdTimeResponses;
    else pool = moreResponses;
  }

  const idx = pickIndexNoImmediateRepeat(pool.length, typeof lastIndex === 'number' ? lastIndex : -1);
  const text = idx >= 0 ? pool[idx] : pool[0] ?? '';

  return { text, index: idx };
}
