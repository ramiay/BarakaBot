const axios = require('axios');
const { IG_GRAPH_API_TOKEN, IG_BUSINESS_ACCOUNT_ID } = require('../config');

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

    return publishRes.data;
}

module.exports = { publishToInstagram };
