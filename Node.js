// config.js (Node.js version)
require('dotenv').config();

const CONFIG = {
    API: {
        BASE_URL: process.env.API_BASE_URL,
    },
    SUPABASE: {
        ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    ADMIN: {
        EMAIL: process.env.ADMIN_EMAIL,
        PASSWORD: process.env.ADMIN_PASSWORD
    },
    APP: {
        NAME: process.env.APP_NAME,
        VERSION: process.env.APP_VERSION
    }
};

module.exports = CONFIG;