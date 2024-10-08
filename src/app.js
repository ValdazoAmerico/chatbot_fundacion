// import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

const PORT = process.env.PORT ?? 3008

// const discordFlow = addKeyword('doc').addAnswer(
//     ['You can see the documentation here', '📄 https://builderbot.app/docs \n', 'Do you want to continue? *yes*'].join(
//         '\n'
//     ),
//     { capture: true },
//     async (ctx, { gotoFlow, flowDynamic }) => {
//         if (ctx.body.toLocaleLowerCase().includes('yes')) {
//             return gotoFlow(registerFlow)
//         }
//         await flowDynamic('Thanks!')
//         return
//     }
// )


// Example: Match at least one non-whitespace character
const REGEX_ANY_CHARACTER = /.+/;  // Matches one or more characters

// Function to make an HTTP request
async function sendQuestionToChatbot(conversationId, question) {
    const url = 'https://dev.apis.umasalud.com/ai/chatbot_uma';

    // Prepare the request payload
    const payload = {
        conversation_id: conversationId,
        data: { text: question },
        step: 'first'
    };

    try {
        // Make the HTTP POST request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Specify the content type
            },
            body: JSON.stringify(payload) // Convert payload to JSON string
        });

        // Check if the response is OK (status in the range 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the JSON response
        const data = await response.json();
        return data; // Return the response data
    } catch (error) {
        console.error('Error sending question:', error);
        throw error; // Rethrow the error for further handling if needed
    }
}

// Assuming addKeyword and flowDynamic are defined elsewhere in your code
const flow = addKeyword([REGEX_ANY_CHARACTER], { regex: true }) // Wrap the regex in an array
    .addAction(async (ctx, { flowDynamic }) => {
        const question = ctx.body; // Get the user's input directly from ctx.body
        const conversationId = "1231df23"; // Example conversation ID

        // Send the question to the chatbot API
        try {
            const response = await sendQuestionToChatbot(conversationId, question);
            const outputMessage = response.output; // Access the 'output' key from the response
            
            // Check if outputMessage is defined before trying to use it
            if (outputMessage) {
                await flowDynamic(`${JSON.stringify(outputMessage).replace(/\"/g, '').replace(/\n/g, ' ')}`);
            } else {
                await flowDynamic('No response received from the chatbot.');
            }
        } catch (error) {
            console.error('Error in flow action:', error); // Log the error
            await flowDynamic('There was an error sending your question. Please try again.');
        }
    });
// const welcomeFlow = addKeyword(REGEX_GMAIL_EMAIL, 
//     { regex: true })
//     .addAnswer(`🙌 Hello welcome to this *Chatbot*`)
//     .addAnswer(
//         [
//             'I share with you the following links of interest about the project',
//             '👉 *doc* to view the documentation',
//         ].join('\n'),
//         { delay: 800, capture: true },
//         async (ctx, { fallBack }) => {
//             if (!ctx.body.toLocaleLowerCase().includes('doc')) {
//                 return fallBack('You should type *doc*')
//             }
//             return
//         },
//         [discordFlow]
//     )

// const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW'))
//     .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
//         await state.update({ name: ctx.body })
//     })
//     .addAnswer('What is your age?', { capture: true }, async (ctx, { state }) => {
//         await state.update({ age: ctx.body })
//     })
//     .addAction(async (_, { flowDynamic, state }) => {
//         await flowDynamic(`${state.get('name')}, thanks for your information!: Your age: ${state.get('age')}`)
//     })

// const fullSamplesFlow = addKeyword(['samples', utils.setEvent('SAMPLES')])
//     .addAnswer(`💪 I'll send you a lot files...`)
//     .addAnswer(`Send image from Local`, { media: join(process.cwd(), 'assets', 'sample.png') })
//     .addAnswer(`Send video from URL`, {
//         media: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4',
//     })
//     .addAnswer(`Send audio from URL`, { media: 'https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3' })
//     .addAnswer(`Send file from URL`, {
//         media: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
//     })

const main = async () => {
    const adapterFlow = createFlow([flow])
    
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
