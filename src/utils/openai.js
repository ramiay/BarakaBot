const { OpenAI } = require('openai');
const { OPENAI_API_KEY } = require('../config');

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function generateCaption({ profile, itemNote }) {
    const system = `You are a social media copywriter. Write short Instagram captions.`;
    const user = `Business profile: ${profile}\nItem: ${itemNote}`;

    const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ],
        temperature: 0.8
    });

    return resp.choices?.[0]?.message?.content?.trim();
}

module.exports = { generateCaption };
