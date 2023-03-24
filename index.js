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

// let isDebugMode = true;
const debugPrompt = { content: "tell me a story" };

let messages;
function InitMessages() {
    messages = [{ role: "system", content: "You are a helpful assistant." }];
}

// init messages
InitMessages();

// Create Pause var
client.isPaused = true;

async function sendQueryReturnResponse(message) {
    // append user message to message history
    messages.push({ role: "user", content: `${message.content}` });

    // send a request using the open ai api
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
    });
    console.log("sending discord message..");

    // store generated text and append with bot reply
    const generatedText = response.data.choices[0].message.content;
    messages.push({ role: "assistant", content: `${generatedText}` });

    // DEBUG ECHO
    // message.reply(`You said: ${message.content}`);

    console.log(messages);
    console.log(generatedText);
    return generatedText;
}

// check for messages on discord when sent
client.on("messageCreate", async function (message) {
    try {
        // don't respond to bots (including self)
        if (message.author.bot) return;

        if (message.content == "!start") {
            client.isPaused = false;
            message.reply(`DmBot has started`);
            return;
        }

        if (message.content == "!pause") {
            client.isPaused = true;
            message.reply(`DmBot has paused`);
            return;
        }

        if (message.content == "!reset") {
            InitMessages();
            message.reply(`DmBot has reset`);
            return;
        }

        if (message.content == "!stop") {
            client.isPaused = true;
            InitMessages();
            message.reply(`DmBot has stopped`);
            return;
        }

        console.log(client.isPaused);
        if (client.isPaused) {
            message.reply(`DmBot hasn't been started yet`);
            console.log("is paused");
            return;
        }

        // Start typing indicator
        message.channel.sendTyping();

        // send query and return response
        const generatedText = await sendQueryReturnResponse(message);

        // reply with the latest message content
        console.log(generatedText);
        message.channel.send(generatedText);
    } catch (err) {
        console.error("Error:", err.message);
        if (err.response && err.response.data) {
            console.error("Response data:", err.response.data);
        }
        console.log(err);
    }
});

// log in the bot on start
client.login(process.env.DISCORD_TOKEN);
console.log("DM bot is online");

// check for debug prompt
if (typeof isDebugMode !== "undefined" && isDebugMode) {
    console.log("sending debug prompt..");
    sendQueryReturnResponse(debugPrompt);
}
