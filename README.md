# Sudo

Sudo is a playful, open-source Discord bot. Type `$sudo <anything>` and it responds as if it just ran your request as a root terminal command — for laughs, not for real.

```
$sudo i cant sleep
> Permission denied. Your brain doesn't have sudo access to itself.
```

No monetization, no data collection beyond what's needed to track rank. Free to self-host or contribute to.

## Running it

```bash
git clone https://github.com/Aatiz1243/sudo.git
cd sudo
npm install
cp .env.example .env
```

Fill in `.env`:
- `BOT_TOKEN` — required. From the [Discord Developer Portal](https://discord.com/developers/applications).
- `CLIENT_ID` — required once, to register slash commands. Same Developer Portal page, "Application ID".
- `GUILD_ID` — optional. Set it to deploy slash commands to one test server instantly instead of waiting up to an hour for a global deploy.
- `OWNER_ID` — optional. Your Discord user ID. Unlocks `!approve` (see below).
- `LOG_CHANNEL_ID` — optional. A channel where the bot posts the top unmatched commands every Sunday.

Register the slash commands (only needed once, or whenever a slash command changes):
```bash
npm run deploy
```

Then:
```bash
node index.js
```

## Using it

| Command | What it does |
|---|---|
| `$sudo <anything>` | Main command. Try everyday situations: `$sudo homework`, `$sudo i need a gf`, `$sudo cant focus` |
| `$sudo rank` | Shows your rank and usage count |
| `$sudo commands` | A few example prompts |
| `$sudo hack <name or @mention>` | Fake hacking sequence on someone, for laughs |
| `/help` | Slash command version of the guide above |

Ranks (Nobody → User → Sudoer → Root → God) increase with use and unlock occasional flavor text. No real permissions are ever granted.

## Contributing a command

Commands live in [`data/commands.json`](./data/commands.json). Each entry looks like:

```json
"homework": {
  "aliases": ["domyhomework", "finishhomework", "myhomework"],
  "responses": [
    "Homework detected. Initiating procrastination protocol instead.",
    "sudo: homework: operation requires root access to your work ethic."
  ]
}
```

- **Key** (`homework`) is the canonical command name.
- **`aliases`** are alternate phrasings that route to the same command. Spaces and punctuation are stripped automatically when matching, so `"i need a gf"` and `"ineedagf"` are equivalent — you only need to list one form.
- **`responses`** are the possible replies; one is picked at random each time.

Commands can optionally generate fresh combinations instead of always using a fixed line, via `fragments` + `templates`:

```json
"sleep": {
  "aliases": ["..."],
  "responses": ["...3-5 hand-written lines, used as a baseline..."],
  "fragments": {
    "prefix":  ["sudo sleep:", "executing sleep.sh:"],
    "blocker": ["doom-scrolling", "one more episode"],
    "outcome": ["denied — insufficient willpower", "rescheduled for 4am"]
  },
  "templates": [
    "{prefix} blocked by {blocker} — {outcome}.",
    "{prefix} {outcome}. Blocker: {blocker}."
  ]
}
```

Every `{slotName}` in a template gets filled with a random pick from `fragments.slotName`. This isn't AI — every word is something a contributor wrote; templates just multiply a small set of fragments into a much larger set of possible lines. `fragments`/`templates` are optional — commands without them just use `responses` like always. The best auto-generated lines get surfaced weekly for review, and can be promoted into permanent `responses` via `!approve`.

To add or change a command, open a PR editing `data/commands.json`. Guidelines:
- Keep it relatable to everyday, non-technical situations (homework, sleep, social stuff) — not Linux jargon.
- Funny over edgy. Light roasting is fine; nothing targeted or mean-spirited.
- 3–5 response variants per command, so it doesn't repeat too fast.

If you maintain a running instance with `OWNER_ID` set, you can also add commands live without restarting:
```
!approve <name> | response one | response two
```

## How it works

- `handlers/commandRouter.js` — matches what you typed against command names/aliases, with fuzzy matching for typos
- `handlers/responseGenerator.js` — picks a hand-written response, or assembles a fresh one from a command's fragments/templates if it has them (see "Contributing a command" above)
- `handlers/rankSystem.js` — tracks usage and rank per user
- `handlers/moderationHandler.js` — quietly redirects messages that signal real distress toward actual support resources, instead of joking
- `handlers/unknownLogger.js` — logs anything unmatched so popular requests can be added later, and surfaces the best auto-generated combos for promotion into permanent responses
- `data/commands.json` — the command pool (community-editable)
- `data/harm-signals.json` — self-harm patterns the moderation handler watches for, and the support message it sends

## Moderation

Messages that signal real distress (not jokes — actual self-harm language) get a quiet DM with crisis resources instead of a joke reply. Those patterns live in `data/harm-signals.json` and are committed — they're just trigger phrases pointing toward help, nothing sensitive.

Hate speech is handled at a different layer, on purpose: **Discord's own AutoMod** (Server Settings → Safety Setup → AutoMod) is the right tool for this — it's maintained by Discord, has ready-made presets, and can act independently of the bot. This repo deliberately does not ship a hardcoded slur/hate-speech list, and won't: publishing one in a public repo is a bad idea regardless of intent, and substring-matching against slurs is notoriously easy to evade and prone to false positives either way.

If you self-host and want the bot itself to also react to a custom list (for logging, or a different response), create `data/hate-patterns.local.json` yourself — it's gitignored and never committed:
```json
{ "hatePatterns": ["whatever-you-want-to-add"] }
```

## License

[AGPL-3.0](./LICENSE). You're free to fork, modify, self-host, and contribute back. The one real obligation: if you run a modified version of Sudo as a public-facing bot, you must make your source changes available to its users — you can't take this, change it, and run a closed public version. Private/personal use has no such requirement.
