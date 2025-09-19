const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const { PORT } = require('./config');
const { ensureUser } = require('./state');
const { twimlMessage, downloadTwilioMedia } = require('./utils/twilio');
const { generateCaption } = require('./utils/openai');
const { createSocialGraphic } = require('./utils/canvasGen');
const { publishToInstagram } = require('./utils/instagram');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, '../public')));

// WhatsApp webhook
app.post('/whatsapp/webhook', async (req, res) => {
    const from = req.body.From;
    const body = (req.body.Body || '').trim();
    const numMedia = parseInt(req.body.NumMedia || '0', 10);
    const state = ensureUser(from);

    try {
        if (/^profile:/i.test(body)) {
            state.profile = body.replace(/^profile:/i, '').trim();
            return res.type('text/xml').send(twimlMessage([{ body: 'Profile saved. Send me a product photo!' }]));
        }

        if (/^approve$/i.test(body)) {
            if (!state.lastPreview) {
                return res.type('text/xml').send(twimlMessage([{ body: 'No preview available yet.' }]));
            }
            await publishToInstagram(state.lastPreview);
            return res.type('text/xml').send(twimlMessage([{ body: '✅ Published to Instagram!' }]));
        }

        if (numMedia > 0 && /^image\//.test(req.body.MediaContentType0)) {
            const bin = await downloadTwilioMedia(req.body.MediaUrl0);
            const { absPath, publicUrl } = await createSocialGraphic({
                userImagePath: path.join(__dirname, '../public/outputs', 'temp.jpg'),
                brand: state.profile || 'My Business',
                headline: body || 'New Arrival',
                style: state.style
            });

            const caption = await generateCaption({
                profile: state.profile,
                itemNote: body
            });

            state.lastPreview = { imageUrl: publicUrl, caption };

            return res.type('text/xml').send(twimlMessage([
                { body: `Preview:\n${caption}\n\nReply "approve" to publish.` },
                { mediaUrl: publicUrl }
            ]));
        }

        res.type('text/xml').send(twimlMessage([{ body: 'Send "profile: ..." and then a product photo!' }]));
    } catch (err) {
        console.error(err);
        res.type('text/xml').send(twimlMessage([{ body: `Error: ${err.message}` }]));
    }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
