// utils/commands/help.js
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and usage for Sudo bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Sudo — Help')
      .setDescription('Short guide to using **Sudo**. Use `/help` anytime for this message — visible only to you.')
      .addFields(
        { name: 'Basic usage', value: '`$sudo <anything>` — type pretty much any everyday situation and Sudo responds in character.\nExample: `$sudo i cant sleep`, `$sudo homework`, `$sudo make my parents proud`', inline: false },
        { name: 'Check your rank', value: '`$sudo rank` — see your current rank and how many commands you\'ve run.\nRanks: Nobody → User → Sudoer → Root → God, based on usage.', inline: false },
        { name: 'See examples', value: '`$sudo commands` — a few example commands to try if you\'re stuck.', inline: false },
        { name: 'Special command', value: '`$sudo hack <name or @mention>` — runs a fake "hacking" sequence on someone, just for laughs. No real data is touched.', inline: false },
        { name: 'Unknown commands', value: 'If Sudo doesn\'t recognize what you typed, it\'s logged. Enough people trying the same thing can get it added for real.', inline: false }
      )
      .setFooter({ text: 'Sudo • playful system emulator' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Sudo')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${interaction.client.user.id}&scope=bot%20applications.commands&permissions=3072`),
      new ButtonBuilder()
        .setLabel('GitHub')
        .setStyle(ButtonStyle.Link)
        .setURL('https://github.com/Aatiz1243/sudo')
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
