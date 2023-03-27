// get prompt
const input = require("./system_dmbot_lando.js");
const gameplay = require("./rules_gameplay_lando.js");
const party = require("./party_lando.js");
const story = require("./story_lando_01.js");
const go = require("./run_dm_bot_flynn_tavern.js");

function formatInputChunk(name, input) {
    return `\n${name}: ###\n${input}\n###`;
}

const rule_gameplay = formatInputChunk("Gameplay", gameplay);
const rule_party = formatInputChunk("Player Characters", party);
const rule_story = formatInputChunk("Story", story);
const prompt = input.concat(rule_gameplay, rule_party, rule_story);

const maxQualityResponses = 3;
let currentQualityResponses = maxQualityResponses;

// DEBUG
console.log("##### PROMPT");
console.log(prompt);
console.log("##### END PROMPT");

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
    messages = [{ role: "system", content: prompt }];
}

// init messages
InitMessages();

// Create Pause var
client.isPaused = false;

// check quality tokens
function hasQualityResponsesLeft() {
    return currentQualityResponses > 0;
}

// check if input is number
function isNumeric(str) {
    return !isNaN(str) && !isNaN(parseFloat(str));
}

function stripExclamationMark(input) {
    if (input.endsWith("!")) {
        return input.slice(0, -1);
    }
    return input;
}

// Split message function
function splitMessage(resp, charLim) {
    const responseNum = Math.ceil(resp.length / charLim);
    const responses = new Array(responseNum);
    // For the number of split responses, if its the last response, make the size the character limit, else make the size the last index of a space that is under 2000 characters
    for (
        let i = 0, c = 0, chunkSize = null;
        i < responseNum;
        i++, c += chunkSize
    ) {
        if (i + 1 >= responseNum) {
            chunkSize = charLim;
        } else {
            chunkSize = resp.substr(c, charLim).lastIndexOf(" ");
        }
        responses[i] = resp.substr(c, chunkSize);
    }
    return responses;
}

// Implement a command handler
const commands = {
    "!start": startCommand,
    "!pause": pauseCommand,
    "!reset": resetCommand,
    "!stop": stopCommand,
};

async function handleCommand(command, message) {
    if (commands[command]) {
        await commands[command](message);
    } else {
        message.reply(`Unknown command: ${command}`);
    }
}

async function startCommand(message) {
    client.isPaused = false;
    message.reply(`DmBot has started`);
    SendCustomMessage(message, go);
}

async function pauseCommand(message) {
    client.isPaused = true;
    message.reply(`DmBot has paused`);
}

async function resetCommand(message) {
    InitMessages();
    message.reply(`DmBot has reset`);
}

async function stopCommand(message) {
    InitMessages();
    client.isPaused = true;
    message.reply(`DmBot has stopped`);
}

async function SendMessage(message) {
    // Start typing indicator
    message.channel.sendTyping();

    // send query and return response
    const generatedText = await sendQueryReturnResponse();

    // DEBUG
    console.log("##### RESPONSE");
    console.log(generatedText);
    console.log("##### END RESPONSE");

    // Split response if it exceeds the Discord 2000 character limit
    const responseChunks = splitMessage(generatedText, 2000);

    // Send the split API response
    for (let i = 0; i < responseChunks.length; i++) {
        message.channel.send(responseChunks[i]);
    }
}

async function SendCustomMessage(message, input) {
    message.content = input;
    messages.push({ role: "user", content: `${message.content}` });
    await SendMessage(message);
}

async function sendQueryReturnResponse() {
    const modelFast = "gpt-3.5-turbo";
    const modelQuality = "gpt-4";

    // check for quality tokens
    let model = modelFast;
    if (currentQualityResponses > 0) {
        model = modelQuality;
        currentQualityResponses -= 1;
        console.log(
            "quality tokens: " +
                `${currentQualityResponses}` +
                "/" +
                `${maxQualityResponses}`
        );
    }

    // DEBUG
    console.log("##### REQUEST (" + `${model}` + ")");
    console.log(messages);
    console.log("##### END REQUEST");
    // message.reply(`You said: ${message.content}`);

    // send a request using the open ai api
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
    });

    // store generated text and append with bot reply
    const generatedText = response.data.choices[0].message.content;
    messages.push({ role: "assistant", content: `${generatedText}` });
    return generatedText;
}

function shouldSendMessage(message) {
    // Check if the message ends with "!" or "?", or if the message is a number or a "!dm" command
    const doesMessageExclaim = message.content.endsWith("!");
    const isMessageQuestion = message.content.endsWith("?");
    const isMessageNumber = isNumeric(message.content);
    const isDmCommand = message.content == "!dm";

    return (
        isDmCommand ||
        doesMessageExclaim ||
        isMessageQuestion ||
        isMessageNumber
    );
}

function handleError(err) {
    console.error("Error:", err.message);
    if (err.response && err.response.data) {
        console.error("Response data:", err.response.data);
    }
    console.log(err);
}

// check for messages on discord when sent
client.on("messageCreate", async function (message) {
    try {
        // don't respond to bots (including self)
        if (message.author.bot) return;

        // check for commands
        const command = message.content.split(" ")[0];
        if (commands.hasOwnProperty(command)) {
            await handleCommand(command, message);
            return;
        }

        //check if bot is paused
        if (client.isPaused) {
            console.log("DmBot is paused");
            return;
        }

        // Check if the message content is not "!dm" before appending it to the message history
        if (message.content !== "!dm") {
            // strip exclamation mark from ending
            const user_input = stripExclamationMark(message.content);

            // push new message to chat history
            messages.push({ role: "user", content: `${user_input}` });
        }

        //check to send message
        if (shouldSendMessage(message)) {
            await SendMessage(message);
            return;
        }
    } catch (err) {
        handleError(err);
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
