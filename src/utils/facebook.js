/*
// src/utils/facebook.js
const axios = require('axios');
const { FB_PAGE_ID = '', FB_PAGE_ACCESS_TOKEN = '' } = process.env;

// Simple Page photo post
async function publishPagePhoto({ imageUrl, caption }) {
    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        throw new Error('Missing FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN');
    }
    const res = await axios.post(
        `https://graph.facebook.com/v23.0/${FB_PAGE_ID}/photos`,
        null,
        { params: { url: imageUrl, caption, access_token: FB_PAGE_ACCESS_TOKEN } }
    );
    return res.data; // { id: <photo_id>, post_id: <post_id> }
}

module.exports = { publishPagePhoto };
*/
