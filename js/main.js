// Use the global CONFIG object
const API_URL = CONFIG.API.BASE_URL;
const ENDPOINT = CONFIG.API.ENDPOINTS.MEMBERS;
const ADMIN_EMAIL = CONFIG.ADMIN.EMAIL;

// Example: Fetch data from API
async function fetchMembers() {
    try {
        const response = await fetch(`${API_URL}${ENDPOINT}`, {
            headers: {
                'apikey': CONFIG.SUPABASE.ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log('Members:', data);
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example: Admin Login
function adminLogin(email, password) {
    const adminEmail = CONFIG.ADMIN.EMAIL;
    const adminPassword = CONFIG.ADMIN.PASSWORD;
    
    if (email === adminEmail && password === adminPassword) {
        localStorage.setItem('admin_logged_in', 'true');
        window.location.href = 'admin/dashboard.html';
        return true;
    }
    return false;
}

// Example: Get API URL
function getApiUrl(endpoint) {
    return `${CONFIG.API.BASE_URL}${endpoint}`;
}