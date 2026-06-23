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
- `OWNER_ID` — optional. Your Discord user ID. Unlocks `!approve` (see below).
- `LOG_CHANNEL_ID` — optional. A channel where the bot posts the top unmatched commands every Sunday.

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
- `handlers/rankSystem.js` — tracks usage and rank per user
- `handlers/moderationHandler.js` — quietly redirects messages that signal real distress toward actual support resources, instead of joking
- `handlers/unknownLogger.js` — logs anything unmatched so popular requests can be added later
- `data/commands.json` — the command pool (community-editable)
- `data/harm-signals.json` — patterns the moderation handler watches for, and the support message it sends

## License

[AGPL-3.0](./LICENSE). You're free to fork, modify, self-host, and contribute back. The one real obligation: if you run a modified version of Sudo as a public-facing bot, you must make your source changes available to its users — you can't take this, change it, and run a closed public version. Private/personal use has no such requirement.
