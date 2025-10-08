// index.js
import 'dotenv/config'; // dotenv auto config via import (works in Node >= 16+ with "type": "module" in package.json)
// OR: require('dotenv').config(); for CommonJS

import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // IMPORTANT: enable in dev portal too
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Sudo online as ${client.user.tag}`);
  client.user.setActivity('Type $sudo for chaos'); // status
});

client.on('messageCreate', message => {
  if (message.author.bot) return;
  if (!message.content.startsWith('$sudo')) return;

  const command = message.content.slice(5).trim();
  if (!command) return message.reply('What should I sudo? Speak up, mortal.');

  const responses = [
    `🛠 Executing "${command}"... Success! You now have admin privileges over reality.`,
    `💥 "${command}" failed — permission denied. You’re not root (yet).`,
    `🤖 "${command}" acknowledged. Booting the universe...`,
    `✅ "${command}" executed. Results: chaos level 9000.`
  ];

  const reply = responses[Math.floor(Math.random() * responses.length)];
  message.channel.send(reply);
});

client.login(process.env.BOT_TOKEN);
