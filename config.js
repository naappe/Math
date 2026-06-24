// ========================================
// CONFIGURATION FILE
// ========================================

const CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'https://espezmdpkoixnfchomqb.supabase.co',
        ENDPOINTS: {
            MEMBERS: '/rest/v1/members',
            PARTIES: '/rest/v1/parties',
            USERS: '/rest/v1/users'
        }
    },
    
    // Supabase Keys
    SUPABASE: {
        ANON_KEY: 'sb_publishable_ZZatPqqaMNa0sXSGo8Zt_Q_-nlj3Cj8',
    },
    
    // Admin Credentials
    ADMIN: {
        EMAIL: 'admin@example.com',
        PASSWORD: 'Admin@123'
    },
    
    // App Settings
    APP: {
        NAME: 'Party Management System',
        VERSION: '1.0.0'
    },
    
    // Database Table Names
    TABLES: {
        MEMBERS: 'members'
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}