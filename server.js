import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import userModel from './src/model/User.js';
import connectDb from './src/config/db.js';
import eventModel from './src/model/Event.js';
import Groq from 'groq-sdk';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_API);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getGroqChatCompletion(messages) {
    return groq.chat.completions.create({
        messages,
        model: 'llama3-8b-8192',
    });
}

try {
    await connectDb();
    console.log('DB connected successfully');
} catch (error) {
    console.error('DB connection error:', error);
    process.kill(process.pid, 'SIGTERM');
}

bot.start(async (ctx) => {
    console.log('ctx', ctx);
    const from = ctx.update.message.from;
    try {
        await userModel.findOneAndUpdate(
            { tgId: from.id },
            {
                $setOnInsert: {
                    firstName: from.first_name,
                    lastName: from.last_name,
                    isBot: from.is_bot,
                    username: from.username,
                },
            },
            { upsert: true, new: true }
        );
        await ctx.reply(`Hey! ${from.first_name}, Welcome. I will be writing highly engaging social media posts for you 🚀 Just keep feeding me with the events throughout the day. Let's shine on social media ✨`);
    } catch (error) {
        console.error('Error updating user:', error);
        await ctx.reply("Facing difficulties!");
    }
});

bot.help((ctx) => {
    ctx.reply('For support contact @harsha_085');
});

bot.command('generate', async (ctx) => {
    const from = ctx.update.message.from;

    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const events = await eventModel.find({
            tgId: from.id,
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay,
            },
        });

        if (events.length === 0) {
            await ctx.reply('No events for the day.');
            return;
        }

        console.log('events', events);

        const eventTexts = events.map((event) => event.text).join(', ');

        const chatCompletion = await getGroqChatCompletion([
            {
                role: 'system',
                content: 'Act as a senior copywriter, writing highly engaging posts for LinkedIn, Facebook, Instagram, and Twitter using provided thoughts/events throughout the day.',
            },
            {
                role: 'user',
                content: `Write like a human, for humans. Craft three engaging social media posts tailored for LinkedIn, Instagram, Facebook, and Twitter audiences. Use simple language. Use given time labels just to understand the order of the events, don't mention the time in the posts. Each post should creatively highlight the following events: ${eventTexts}. Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience, encouraging interaction, and driving interest in the events.`,
            },
        ]);

        console.log('completion:', chatCompletion);

        await userModel.findOneAndUpdate(
            {
                tgId: from.id,
            },
            {
                $inc: {
                    promptTokens: chatCompletion.usage.prompt_tokens,
                    completionTokens: chatCompletion.usage.completion_tokens,
                },
            }
        );

        await ctx.reply(chatCompletion.choices[0]?.message?.content || 'No content generated.');
    } catch (error) {
        console.error('Error generating posts:', error);
        await ctx.reply('Facing difficulties.');
    }
});

bot.on(message('text'), async (ctx) => {
    const from = ctx.update.message.from;
    const message = ctx.update.message.text;

    try {
        await eventModel.create({
            text: message,
            tgId: from.id,
        });
        ctx.reply('Noted 👍, keep texting me your thoughts. To generate the Posts, just enter the command: /generate');
    } catch (error) {
        console.log(error);
        await ctx.reply('Facing difficulties, please try again later.');
    }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
