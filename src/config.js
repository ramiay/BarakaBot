require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',

    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || '',

    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

    IG_GRAPH_API_TOKEN: process.env.IG_GRAPH_API_TOKEN || '',
    IG_BUSINESS_ACCOUNT_ID: process.env.IG_BUSINESS_ACCOUNT_ID || '',

    USE_CANVA: process.env.USE_CANVA === '1'
};
