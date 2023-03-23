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

// check for messages on discord when sent
client.on("messageCreate", async function (message) {
    try {
        // don't respond to bots (including self)
        if (message.author.bot) return;

        // send a request using the open ai api
        const gptResponse = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: `You are are friendly chatbot.\n\
                        ${message.author.username}: ${message.content}`,
                },
            ],
        });

        // console.log(gptResponse.data.choices[0].message.content);
        // message.reply(`You said: ${message.content}`);

        // reply with the latest message content
        message.reply(`${gptResponse.data.choices[0].message.content}`);
        return;
    } catch (err) {
        console.log(err);
    }
});

// log in the bot on start
client.login(process.env.DISCORD_TOKEN);
console.log("DM bot is online");
