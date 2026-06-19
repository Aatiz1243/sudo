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

        const targetArg = args.join(' ').trim();
        const targetArgLower = targetArg.toLowerCase();
        // Strip @ and any non-mention noise so "hack @Name" and "hack Name" behave the same
        const cleanArg = targetArgLower.replace(/^@/, '');

        let target = null;

        // 1. Direct mention
        target = message.mentions.users.first();

        // 2. Raw numeric ID
        if (!target && /^\d{15,21}$/.test(targetArg)) {
            target = await message.client.users.fetch(targetArg).catch(() => null);
        }

        // 3. Cache lookup by username / nickname / displayName (fast path)
        if (!target && message.guild) {
            const cached = message.guild.members.cache.find(m =>
                m.user.username.toLowerCase() === cleanArg ||
                m.displayName.toLowerCase() === cleanArg ||
                m.user.username.toLowerCase().includes(cleanArg) ||
                m.displayName.toLowerCase().includes(cleanArg)
            );
            if (cached) target = cached.user;
        }

        // 4. Guild member search via Discord API (catches users not in cache)
        if (!target && message.guild) {
            try {
                const results = await message.guild.members.search({ query: cleanArg, limit: 5 });
                const exact = results.find(m =>
                    m.user.username.toLowerCase() === cleanArg ||
                    m.displayName.toLowerCase() === cleanArg
                );
                target = (exact ?? results.first())?.user ?? null;
            } catch {
                // search API can fail on small/odd guild configs — fall through
            }
        }

        // 5. Last resort: fetch full member list and do a manual scan (slow path, small guilds only)
        if (!target && message.guild && message.guild.memberCount <= 1000) {
            try {
                const allMembers = await message.guild.members.fetch();
                const found = allMembers.find(m =>
                    m.user.username.toLowerCase().includes(cleanArg) ||
                    m.displayName.toLowerCase().includes(cleanArg)
                );
                if (found) target = found.user;
            } catch {
                // ignore — fetch can be rate-limited on large guilds
            }
        }

        if (!target) {
            return message.channel.send(createResponse({
                title: 'Error',
                description: `Could not find **${targetArg}**. Try their exact username, nickname, ID, or @mention them.`,
                color: 0xff0000
            }));
        }

        const statusMsg = await message.channel.send(createResponse({
            title: 'HACKING IN PROGRESS',
            description: `Starting hack on ${target.username}...`,
            color: 0xff0000
        }));

        const progressMessages = [
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

        for (const line of progressMessages) {
            await wait(1500);
            await statusMsg.edit(createResponse({
                title: 'HACKING IN PROGRESS',
                description: line,
                color: 0xff0000
            }));
        }

        await statusMsg.edit(createResponse({
            title: 'HACK COMPLETE',
            description: `Successfully infiltrated ${target.username}'s system!\n\n**Leaked Data:**\n${fakeInfo.join('\n')}\n\n[This is just for fun! No actual hacking occurred]`,
            color: 0x00ff00
        }));
    },
};
