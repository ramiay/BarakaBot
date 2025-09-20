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
const { enhanceImage } = require('./utils/imageEnhance');
const { makeEcomSaleGraphic, makeEcomSaleStory } = require('./utils/canva');
const { publishToInstagram, publishToInstagramStory } = require('./utils/instagram'); // ✅ import story publisher

// Twilio REST client (to send images after replying with captions)
let twilioClient = null;
try { twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN); }
catch { console.warn('Twilio SDK not installed. Run: npm i twilio'); }

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, '../public')));

// temp uploads
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

// helpers to send media robustly
function isHttps(url) { return /^https:\/\//i.test(url || ''); }
async function urlReachable(url) {
    try { const r = await axios.head(url, { timeout: 8000 }); return r.status >= 200 && r.status < 400; }
    catch {
        try {
            const r2 = await axios.get(url, { timeout: 10000, responseType: 'arraybuffer' });
            return r2.status >= 200 && r2.status < 400;
        } catch {
            return false;
        }
    }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function sendWhatsAppMedia({ to, body, mediaUrl }) {
    if (!twilioClient) throw new Error('Twilio client not initialized');
    if (!TWILIO_WHATSAPP_NUMBER) throw new Error('TWILIO_WHATSAPP_NUMBER not set');
    if (!isHttps(mediaUrl) || !(await urlReachable(mediaUrl))) throw new Error(`Media URL not reachable: ${mediaUrl}`);
    return twilioClient.messages.create({ from: TWILIO_WHATSAPP_NUMBER, to, body, mediaUrl: [mediaUrl] });
}

/** Parse a numbered caption list like:
 *  "1. text\n2. text\n..."
 *  Returns an array of strings (without leading numbers/quotes).
 */
function parseCaptionOptions(captionText) {
    const lines = captionText.split('\n');
    const options = [];
    for (const line of lines) {
        const m = line.match(/^\s*\d+\.\s*["“]?(.+?)["”]?\s*$/);
        if (m && m[1]) options.push(m[1].trim());
    }
    // Fallback: if nothing matched, treat entire text as a single option
    if (options.length === 0 && captionText.trim()) {
        options.push(captionText.trim());
    }
    return options.slice(0, 20); // cap to a sane number
}

// Webhook
app.post('/whatsapp/webhook', async (req, res) => {
    const from = req.body.From;
    const body = (req.body.Body || '').trim();
    const numMedia = parseInt(req.body.NumMedia || '0', 10);
    const state = ensureUser(from);

    try {
        if (!isHttps(PUBLIC_BASE_URL)) console.warn('PUBLIC_BASE_URL is not HTTPS:', PUBLIC_BASE_URL);

        // 1) Profile
        if (/^profile\s*:/i.test(body)) {
            state.profile = body.replace(/^profile\s*:/i, '').trim();
            // clear any previous choices
            state.captionOptions = null;
            state.selectedCaptionIndex = null;
            return res.type('text/xml').send(twimlMessage([{ body: 'Profile saved. Send me a product photo!' }]));
        }

        // 2) Number choice -> publish selected caption (feed)
        const numberMatch = body.match(/(^|\s)(?:option|caption)?\s*(\d{1,2})(\s|$)/i);
        if (numberMatch && state.lastPreview && state.captionOptions && state.captionOptions.length > 0) {
            const idx = parseInt(numberMatch[2], 10);
            if (idx >= 1 && idx <= state.captionOptions.length) {
                const chosen = state.captionOptions[idx - 1];
                if (!state.lastPreview.feedUrl) {
                    return res.type('text/xml').send(twimlMessage([{ body: 'No feed image available to publish yet.' }]));
                }
                await publishToInstagram({ imageUrl: state.lastPreview.feedUrl, caption: chosen });
                state.selectedCaptionIndex = idx;
                state.lastPreview.caption = chosen;
                return res.type('text/xml').send(twimlMessage([{ body: `✅ Published feed with caption #${idx}:\n\n${chosen}` }]));
            } else {
                return res.type('text/xml').send(twimlMessage([{ body: `Please reply with a number between 1 and ${state.captionOptions.length}.` }]));
            }
        }

        // 3) Manual approve (feed) — uses last selected or option 1
        if (/^approve(?:\s+post)?$/i.test(body)) {
            if (!state.lastPreview || !state.lastPreview.feedUrl) {
                return res.type('text/xml').send(twimlMessage([{ body: 'No preview available yet.' }]));
            }
            let captionToUse = state?.lastPreview?.caption;
            if ((!captionToUse || captionToUse.trim() === '') && state.captionOptions?.length) {
                captionToUse = state.captionOptions[0];
            }
            await publishToInstagram({ imageUrl: state.lastPreview.feedUrl, caption: captionToUse || '' });
            return res.type('text/xml').send(twimlMessage([{ body: '✅ Published the Feed post to Instagram!' }]));
        }

        // 3b) ✅ Manual approve STORY (properly inside async handler)
        if (/^approve\s+story$/i.test(body)) {
            if (!state.lastPreview || !state.lastPreview.storyUrl) {
                return res.type('text/xml').send(twimlMessage([{ body: 'No story preview available yet. Send a product photo first.' }]));
            }
            try {
                await publishToInstagramStory({ imageUrl: state.lastPreview.storyUrl });
                return res.type('text/xml').send(twimlMessage([{ body: '✅ Published the Story to Instagram!' }]));
            } catch (e) {
                console.error('[IG story publish] failed:', e?.response?.data || e.message);
                return res.type('text/xml').send(
                    twimlMessage([{
                        body:
                            `Story publish failed: ${e?.response?.data?.error?.message || e.message}

Tips:
• Your IG account must be a Business account.
• Token needs 'instagram_content_publish' permission.
• Story image must be HTTPS and publicly reachable.
• Try a standard JPG/PNG around 1080x1920.`
                    }])
                );
            }
        }

        // 4) Edit caption
        if (/^edit caption\s*:/i.test(body)) {
            const newCaption = body.replace(/^edit caption\s*:/i, '').trim();
            if (!state.lastPreview) return res.type('text/xml').send(twimlMessage([{ body: `No preview yet. Send a product photo first.` }]));
            state.lastPreview.caption = newCaption;
            state.selectedCaptionIndex = null;
            return res.type('text/xml').send(twimlMessage([{ body: `Updated caption:\n\n${newCaption}\n\nReply with a number to publish this feed.` }]));
        }

        // 5) Style
        if (/^style\s*:/i.test(body)) {
            const style = body.replace(/^style\s*:/i, '').trim().toLowerCase();
            if (!['minimal', 'bold', 'pastel'].includes(style)) {
                return res.type('text/xml').send(twimlMessage([{ body: `Unknown style. Use one of: minimal | bold | pastel` }]));
            }
            state.style = style;
            return res.type('text/xml').send(twimlMessage([{ body: `Style set to: ${style}. Send an item photo to generate a new preview.` }]));
        }

        // 6) Image received → build visuals, generate captions, ask for a number
        if (numMedia > 0 && /^image\//.test(req.body.MediaContentType0 || '')) {
            // a) ingest
            const mediaBin = await downloadTwilioMedia(req.body.MediaUrl0);
            const originalPath = await saveBufferToTemp(Buffer.from(mediaBin), 'jpg');

            // b) enhance
            const enhancedPath = await enhanceImage(originalPath, {
                prompt: 'Clean, brighten, sharpen, gentle saturation; keep realistic; emphasize product.'
            });

            const headline = state.profile || 'Handmade • Limited Time';
            const subline = body || '';

            // c) build visuals
            const [feedResult, storyResult] = await Promise.all([
                makeEcomSaleGraphic({ userImagePath: enhancedPath, headline, subline }),
                makeEcomSaleStory({ userImagePath: enhancedPath, headline, subline })
            ]);

            // d) captions
            const captionText = await generateCaption({
                profile: state.profile || 'Small business',
                itemNote: body
            });
            const options = parseCaptionOptions(captionText);

            // e) state
            state.lastPreview = {
                caption: options[0] || captionText || '',
                feedUrl: feedResult.publicUrl,
                storyUrl: storyResult.publicUrl
            };
            state.captionOptions = options;
            state.selectedCaptionIndex = null;

            // f) send captions (reply)
            const numberedList = options.length
                ? options.map((t, i) => `${i + 1}. ${t}`).join('\n')
                : captionText;

            const captionsMessage =
                `Here are your caption options:

${numberedList}

Reply with a number (e.g., 1) to publish the Feed post using that caption.
You can also:
- "edit caption: <custom caption>"
- "style: minimal|bold|pastel"
- "approve story" to publish the Story`;
            res.type('text/xml').send(twimlMessage([{ body: captionsMessage }]));

            // g) send media out-of-band
            (async () => {
                try {
                    await sendWhatsAppMedia({ to: from, body: 'Feed Post (4:5)', mediaUrl: feedResult.publicUrl });
                    await sleep(600);
                    await sendWhatsAppMedia({ to: from, body: 'Story (9:16)', mediaUrl: storyResult.publicUrl });
                } catch (e) {
                    console.error('[send images after captions] failed:', e.message);
                }
            })();

            return; // already responded
        }

        // 7) fallback
        return res.type('text/xml').send(twimlMessage([{ body: 'Send "profile: ..." and then a product photo!' }]));
    } catch (err) {
        console.error(err);
        return res.type('text/xml').send(twimlMessage([{ body: `Error: ${err.message}` }]));
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
