// create discord bot using open AI apis
require("dotenv").config();

// prepare to connect to discord API
const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);

const conversationHistory = {};

// check for messages on discord when sent
client.on("messageCreate", async function (message) {
    try {
        // don't respond to bots (including self)
        if (message.author.bot) return;

        const userId = message.author.id;
        const userMessage = message.content;
        const previousMessages = conversationHistory[userId] || [];
        const inputMessages = [
            ...previousMessages.map((message) => ({
                role: "user",
                text: message,
            })),
            { role: "user", text: userMessage },
        ];

        // send a request using the open ai api
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: `You are are friendly chatbot.\n\
                        ${inputMessages}`,
                },
            ],
        });

        const generatedText = response.data.choices[0].message.content;

        conversationHistory[userId] = [
            ...previousMessages,
            userMessage,
            generatedText,
        ];

        // DEBUG
        console.log(inputMessages);
        console.log(generatedText);
        // message.reply(`You said: ${message.content}`);

        // reply with the latest message content
        message.reply(generatedText);
        return;
    } catch (err) {
        console.error(err);
        console.log(err);
    }
});

// log in the bot on start
client.login(process.env.DISCORD_TOKEN);

console.log("DM bot is online");
