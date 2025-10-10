// utils/commands/help.js
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and usage for Sudo bot'),

  /**
   * interaction: ChatInputCommandInteraction
   */
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Sudo — Help')
      .setDescription('Short guide to using **Sudo**. Use `/help` anytime for this message — visible only to you.')
      .addFields(
        { name: 'Prefix command', value: '`$sudo <anything>` — Ask Sudo to (playfully) execute something.\nExample: `$sudo make coffee`', inline: false },
        { name: 'Slash commands', value: '`/help` — This help message.\n(We will add more slash commands soon.)', inline: false },
        { name: 'Repeats behaviour', value: 'If you send the **same** `$sudo <command>` multiple times quickly:\n• 1st = a random playful reply\n• 2nd = a short `"what?"` style reply\n• 3rd+ = escalation like `"tell me what you want?"`', inline: false },
        { name: 'Tips', value: 'Be specific for best results. Try `$sudo dance` for a meme reaction (coming soon: GIF support!).', inline: false }
      )
      .setFooter({ text: 'Sudo • playful system emulator' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Sudo')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${interaction.client.user.id}&scope=bot%20applications.commands&permissions=3072`),
      new ButtonBuilder()
        .setLabel('Support / Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/') // replace with your support server invite
    );

    // Reply ephemeral (visible only to the user who requested)
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
