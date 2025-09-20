// src/utils/instagram.js
const axios = require('axios');
const { IG_GRAPH_API_TOKEN, IG_BUSINESS_ACCOUNT_ID } = require('../config');

/**
 * Feed photo publish (unchanged)
 */
async function publishToInstagram({ imageUrl, caption }) {
    const mediaRes = await axios.post(
        `https://graph.facebook.com/v20.0/${IG_BUSINESS_ACCOUNT_ID}/media`,
        null,
        { params: { image_url: imageUrl, caption, access_token: IG_GRAPH_API_TOKEN } }
    );
    const creationId = mediaRes.data.id;

    const publishRes = await axios.post(
        `https://graph.facebook.com/v20.0/${IG_BUSINESS_ACCOUNT_ID}/media_publish`,
        null,
        { params: { creation_id: creationId, access_token: IG_GRAPH_API_TOKEN } }
    );

    return publishRes.data; // { id: media_id }
}

/**
 * Story photo publish
 * Notes:
 * - Use media_type=STORIES and image_url (or video_url for video stories).
 * - Stories generally ignore 'caption' — put text on the image itself.
 * - Make sure the URL is public HTTPS, and the image meets IG specs.
 */
async function publishToInstagramStory({ imageUrl }) {
    // 1) Create a STORIES container
    const mediaRes = await axios.post(
        `https://graph.facebook.com/v20.0/${IG_BUSINESS_ACCOUNT_ID}/media`,
        null,
        {
            params: {
                media_type: 'STORIES',
                image_url: imageUrl,
                access_token: IG_GRAPH_API_TOKEN,
            },
        }
    );
    const creationId = mediaRes.data.id;

    // 2) Publish the container
    const publishRes = await axios.post(
        `https://graph.facebook.com/v20.0/${IG_BUSINESS_ACCOUNT_ID}/media_publish`,
        null,
        { params: { creation_id: creationId, access_token: IG_GRAPH_API_TOKEN } }
    );

    return publishRes.data; // { id: media_id }
}

module.exports = {
    publishToInstagram,
    publishToInstagramStory,
};
