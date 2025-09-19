const axios = require('axios');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = require('../config');

function twimlMessage(parts) {
    const msgs = parts.map(p => {
        const bodyXML = p.body ? `<Body>${escapeXml(p.body)}</Body>` : '';
        const mediaXML = p.mediaUrl ? `<Media>${escapeXml(p.mediaUrl)}</Media>` : '';
        return `<Message>${bodyXML}${mediaXML}</Message>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${msgs}</Response>`;
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function downloadTwilioMedia(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN }
    });
    return res.data;
}

module.exports = { twimlMessage, downloadTwilioMedia };
