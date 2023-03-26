// get prompt
const input = require("./prompt_gameplay.js");
const gameplay = require("./rules_gameplay.js");
const party = require("./party_flynn.js");
const story = require("./story_warlock.js");
const go = require("./run_dm_bot_flynn_tavern.js");

function formatInputChunk(name, input) {
    return `\n${name}: ###\n${input}\n###`;
}

const rule_gameplay = formatInputChunk("Gameplay", gameplay);
const rule_party = formatInputChunk("Player Characters", party);
const rule_story = formatInputChunk("Story", story);
const prompt = input.concat("\n", rule_gameplay, rule_party, rule_story);

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

let messages;
function InitMessages() {
    messages = [{ role: "system", content: prompt }];
}

// init messages
InitMessages();

// Create Pause var
client.isPaused = false;

function isNumeric(str) {
    return !isNaN(str) && !isNaN(parseFloat(str));
}

async function SendMessage(message) {
    console.log("BBB");

    // Start typing indicator
    message.channel.sendTyping();
    console.log("##### REQUEST:\n" + message.content);

    // send query and return response
    const generatedText = await sendQueryReturnResponse(message);
    console.log("##### RESPONSE:\n" + generatedText);

    // reply with the latest message content
    message.channel.send(generatedText);
}

async function SendCustomMessage(message, inputString) {
    // Replace the message content with the input string
    message.content = inputString;

    console.log("AAA");

    // Call the original SendMessage function with the modified message
    await SendMessage(message);
}

async function sendQueryReturnResponse(message) {
    // send a request using the open ai api
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
    });

    // append user message to message history
    messages.push({ role: "user", content: `${message.content}` });

    // store generated text and append with bot reply
    const generatedText = response.data.choices[0].message.content;
    messages.push({ role: "assistant", content: `${generatedText}` });

    // DEBUG ECHO
    // message.reply(`You said: ${message.content}`);

    // console.log(messages);
    // console.log(generatedText);
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

        if (message.content == "!run") {
            client.isPaused = false;
            message.reply(`DmBot has started with [run]`);
            SendCustomMessage(message, go);
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

        if (client.isPaused) {
            message.reply(`DmBot hasn't been started yet`);
            console.log("is paused");
            return;
        }

        // continue the story under these conditions
        // the message ends with "!"
        const doesMessageExclaim = message.content.endsWith("!");
        if (doesMessageExclaim) {
            console.log("The message ends with an exclamation mark!");
            message.content = message.content.slice(0, -1);
        }

        // the message ends with "?"
        const isMessageQuestion = message.content.endsWith("?");
        if (isMessageQuestion) {
            console.log("The message ends with an question mark?");
        }

        const isMessageNumber = isNumeric(message.content);
        const isDmCommand = message.content == "!dm";
        if (
            isDmCommand ||
            doesMessageExclaim ||
            isMessageQuestion ||
            isMessageNumber
        ) {
            SendMessage(message);
            return;
        }
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
