// src/server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const {
    PORT,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER,
    PUBLIC_BASE_URL
} = require('./config');

const { ensureUser } = require('./state');
const { twimlMessage, downloadTwilioMedia } = require('./utils/twilio');
const { generateCaption } = require('./utils/openai');
const { createSocialGraphic, createStory } = require('./utils/canvasGen');
const { publishToInstagram } = require('./utils/instagram');
const { enhanceImage } = require('./utils/imageEnhance');

// Twilio REST client (for outbound media after webhook response)
let twilioClient = null;
try {
    twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} catch (e) {
    console.warn('Twilio SDK not installed. Run: npm i twilio');
}

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, '../public')));

/** temp upload helpers **/
const UPLOAD_DIR = path.join(__dirname, '../tmp/uploads');
function ensureTempDir() { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); }
function nowSlug() { return new Date().toISOString().replace(/[:.]/g, '-'); }
async function saveBufferToTemp(buffer, ext = 'jpg') {
    ensureTempDir();
    const filename = `${nowSlug()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const absPath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(absPath, buffer);
    return absPath;
}

// --- helpers to make media sending robust ---
function isHttps(url) {
    return /^https:\/\//i.test(url || '');
}

async function urlReachable(url) {
    try {
        const r = await axios.head(url, { timeout: 8000, maxRedirects: 3 });
        return (r.status >= 200 && r.status < 400);
    } catch {
        try {
            // Some hosts block HEAD; try GET with small range
            const r2 = await axios.get(url, { timeout: 10000, maxRedirects: 3, responseType: 'arraybuffer' });
            return (r2.status >= 200 && r2.status < 400);
        } catch (e2) {
            console.error('[media check] URL not reachable:', url, e2?.response?.status || e2?.message);
            return false;
        }
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function sendWhatsAppMedia({ to, body, mediaUrl }) {
    if (!twilioClient) throw new Error('Twilio client not initialized');
    if (!TWILIO_WHATSAPP_NUMBER) throw new Error('TWILIO_WHATSAPP_NUMBER not set');
    if (!isHttps(mediaUrl)) throw new Error(`Media URL must be HTTPS: ${mediaUrl}`);

    const ok = await urlReachable(mediaUrl);
    if (!ok) throw new Error(`Media URL not reachable by Twilio: ${mediaUrl}`);

    const resp = await twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to,
        body,
        mediaUrl: [mediaUrl]
    });

    console.log('[twilio media sent]', resp.sid, body);
    return resp;
}

// WhatsApp webhook
app.post('/whatsapp/webhook', async (req, res) => {
    const from = req.body.From; // e.g., 'whatsapp:+123456789'
    const body = (req.body.Body || '').trim();
    const numMedia = parseInt(req.body.NumMedia || '0', 10);
    const state = ensureUser(from);

    try {
        // Quick sanity: PUBLIC_BASE_URL must be HTTPS for Twilio/IG
        if (!isHttps(PUBLIC_BASE_URL)) {
            console.warn('PUBLIC_BASE_URL is not HTTPS. Twilio won’t fetch media from non-HTTPS URLs:', PUBLIC_BASE_URL);
        }

        // Save profile
        if (/^profile\s*:/i.test(body)) {
            state.profile = body.replace(/^profile\s*:/i, '').trim();
            return res.type('text/xml').send(twimlMessage([{ body: 'Profile saved. Send me a product photo!' }]));
        }

        // Approve & publish Feed post
        if (/^approve(?:\s+post)?$/i.test(body)) {
            if (!state.lastPreview || !state.lastPreview.feedPostUrl) {
                return res.type('text/xml').send(twimlMessage([{ body: 'No preview available yet.' }]));
            }
            await publishToInstagram({
                imageUrl: state.lastPreview.feedPostUrl,
                caption: state.lastPreview.caption
            });
            return res.type('text/xml').send(twimlMessage([{ body: '✅ Published the Feed post to Instagram!' }]));
        }

        // (Optional placeholder) Approve story
        if (/^approve\s+story$/i.test(body)) {
            return res
                .type('text/xml')
                .send(twimlMessage([{ body: 'Story publishing not wired in this demo. Use "approve" to publish the Feed post.' }]));
        }

        // Edits
        if (/^edit caption\s*:/i.test(body)) {
            const newCaption = body.replace(/^edit caption\s*:/i, '').trim();
            if (!state.lastPreview) {
                return res.type('text/xml').send(twimlMessage([{ body: `No preview yet. Send a product photo first.` }]));
            }
            state.lastPreview.caption = newCaption;

            // Respond with captions only; send images via REST afterward
            (async () => {
                try {
                    if (state.lastPreview.feedPostUrl) {
                        await sendWhatsAppMedia({ to: from, body: 'Feed Post (4:5)', mediaUrl: state.lastPreview.feedPostUrl });
                        await sleep(500);
                    }
                    if (state.lastPreview.storyUrl) {
                        await sendWhatsAppMedia({ to: from, body: 'Story (9:16)', mediaUrl: state.lastPreview.storyUrl });
                    }
                } catch (e) {
                    console.error('[send images after edit] failed:', e.message);
                    // Fallback: send links as text so user can at least see them
                    if (twilioClient) {
                        await twilioClient.messages.create({
                            from: TWILIO_WHATSAPP_NUMBER,
                            to: from,
                            body: `Could not attach images automatically. You can view them here:\nFeed: ${state.lastPreview.feedPostUrl}\nStory: ${state.lastPreview.storyUrl || '(none)'}`
                        });
                    }
                }
            })();

            return res.type('text/xml').send(twimlMessage([{ body: `Updated caption:\n\n${newCaption}` }]));
        }

        if (/^style\s*:/i.test(body)) {
            const style = body.replace(/^style\s*:/i, '').trim().toLowerCase();
            if (!['minimal', 'bold', 'pastel'].includes(style)) {
                return res.type('text/xml').send(twimlMessage([{ body: `Unknown style. Use one of: minimal | bold | pastel` }]));
            }
            state.style = style;
            return res.type('text/xml').send(twimlMessage([{ body: `Style set to: ${style}. Send an item photo to generate a new preview.` }]));
        }

        // Handle incoming image
        if (numMedia > 0 && /^image\//.test(req.body.MediaContentType0 || '')) {
            // 1) Download media
            const mediaBin = await downloadTwilioMedia(req.body.MediaUrl0);

            // 2) Save original to temp
            const originalPath = await saveBufferToTemp(Buffer.from(mediaBin), 'jpg');

            // 3) Enhance with AI (OpenAI Images edit), fallback to local sharp if needed
            const enhancedPath = await enhanceImage(originalPath, {
                prompt: 'Clean, brighten, sharpen, gently boost saturation; keep realistic; emphasize product; remove small blemishes.'
            });

            const brand = state.profile || 'My Business';
            const headline = body || 'New Arrival';

            // 4) Generate BOTH visuals from the enhanced image
            const [feedGraphic, storyGraphic] = await Promise.all([
                createSocialGraphic({ userImagePath: enhancedPath, brand, headline, style: state.style || 'minimal' }),
                createStory({ userImagePath: enhancedPath, brand, headline, style: state.style || 'minimal' })
            ]);

            // 5) Generate caption text
            const caption = await generateCaption({
                profile: state.profile || 'Small business',
                itemNote: body
            });

            // 6) Save preview for approve/publish
            state.lastPreview = {
                caption,
                feedPostUrl: feedGraphic.publicUrl,
                storyUrl: storyGraphic.publicUrl
            };

            // 7) Send captions as webhook reply (Message #1)
            const captionsMessage =
                `Here are your caption options:

${caption}

Reply "approve" to publish the Feed post.
You can also:
- "edit caption: <text>"
- "style: minimal|bold|pastel"`;

            res.type('text/xml').send(twimlMessage([{ body: captionsMessage }]));

            // 8) Send images out-of-band via Twilio REST (Messages #2 and #3)
            (async () => {
                try {
                    await sendWhatsAppMedia({ to: from, body: 'Feed Post (4:5)', mediaUrl: feedGraphic.publicUrl });
                    await sleep(600);
                    await sendWhatsAppMedia({ to: from, body: 'Story (9:16)', mediaUrl: storyGraphic.publicUrl });
                } catch (e) {
                    console.error('[send images after captions] failed:', e.message);
                    // Fallback: send links as plain text
                    if (twilioClient) {
                        await twilioClient.messages.create({
                            from: TWILIO_WHATSAPP_NUMBER,
                            to: from,
                            body:
                                `I couldn't attach images automatically. You can view them here:
Feed: ${feedGraphic.publicUrl}
Story: ${storyGraphic.publicUrl}`
                        });
                    }
                }
            })();

            return; // we already sent the TwiML response
        }

        // Fallback
        return res.type('text/xml').send(twimlMessage([{ body: 'Send "profile: ..." and then a product photo!' }]));
    } catch (err) {
        console.error(err);
        return res.type('text/xml').send(twimlMessage([{ body: `Error: ${err.message}` }]));
    }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
