import { createResponse } from '../../utils/response.js';
import { setTimeout as wait } from 'node:timers/promises';

export default {
    name: 'hack',
    description: 'Pretends to hack a user',
    async execute(message, args) {
        if (!args.length) {
            return message.channel.send(createResponse({
                title: 'Error',
                description: 'Please specify a user to hack!\nUsage: $sudo hack <user>',
                color: 0xff0000
            }));
        }

        // Get target user through various methods
        const targetArg = args.join(' ');
        let target;

        // Try to find user by mention, ID, or username
        target = message.mentions.users.first() || 
                 message.guild.members.cache.get(targetArg) ||
                 message.guild.members.cache.find(member => 
                    member.user.username.toLowerCase() === targetArg.toLowerCase() ||
                    member.displayName.toLowerCase() === targetArg.toLowerCase() ||
                    member.user.username.toLowerCase().includes(targetArg.toLowerCase()) ||
                    member.displayName.toLowerCase().includes(targetArg.toLowerCase())
                );

        if (!target) {
            return message.channel.send(createResponse({
                title: 'Error',
                description: 'Could not find that user. Try using their username, nickname, ID, or mention them.',
                color: 0xff0000
            }));
        }

        // If target is a GuildMember, get the user
        target = target.user || target;

        const statusMsg = await message.channel.send(createResponse({
            title: 'HACKING IN PROGRESS',
            description: `Starting hack on ${target.username}...`,
            color: 0xff0000
        }));

        const messages = [
            `Bypassing Discord security...`,
            `Accessing device information...`,
            `Downloading user data...`,
            `Found email address...`,
            `Cracking password...`,
            `Accessing social media accounts...`,
            `Downloading private photos...`,
            `Stealing cookies...`,
            `Writing malicious code...`,
            `Installing backdoor...`,
            `Found gaming history...`,
            `Checking browser history...`,
            `Hack complete on ${target.username}`
        ];

        const fakeInfo = [
            `*Email:* ${target.username.toLowerCase().replace(/\s+/g, '')}${Math.floor(Math.random() * 999)}@fakehack.net`,
            `*Password:* ${Array(12).fill('*').join('')}`,
            `*IP Address:* ${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            `*Most visited website:* DankMemes.com`,
            `*Browser history:* Cleared (too embarrassing to show)`,
            `*Discord password attempts:* ${Math.floor(Math.random() * 100)} failed logins`,
            `*Currently watching:* How to Treat a Wife? (Tab open for 3 days)`,
            `*System:* Running on Windows 95 with 256MB RAM`,
            `**Last Google Search:** "How to make sandwiches"`,
        ];

        // Send progress messages
        for (const message of messages) {
            await wait(1500);
            await statusMsg.edit(createResponse({
                title: 'HACKING IN PROGRESS',
                description: message,
                color: 0xff0000
            }));
        }

        // Final message with "findings"
        await statusMsg.edit(createResponse({
            title: 'HACK COMPLETE',
            description: `Successfully infiltrated ${target.username}'s system!\n\n**Leaked Data:**\n${fakeInfo.join('\n')}\n\n[This is just for fun! No actual hacking occurred]`,
            color: 0x00ff00
        }));
    },
};
