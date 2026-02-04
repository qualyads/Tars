/**
 * Beds24 API Integration v2
 * With Auto Token Refresh
 * API Docs: https://api.beds24.com/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BEDS24_API = 'api.beds24.com';
const TOKEN_FILE = path.join(__dirname, '..', '.beds24_tokens.json');

// In-memory token cache
let tokenCache = {
  accessToken: process.env.BEDS24_ACCESS_TOKEN,
  refreshToken: process.env.BEDS24_REFRESH_TOKEN,
  expiresAt: null
};

/**
 * Load tokens from file (if exists)
 */
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (data.accessToken) {
        tokenCache = { ...tokenCache, ...data };
        console.log('[BEDS24] Loaded tokens from file');
      }
    }
  } catch (e) {
    console.log('[BEDS24] No saved tokens found, using env');
  }
}

/**
 * Save tokens to file
 */
function saveTokens() {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
      accessToken: tokenCache.accessToken,
      refreshToken: tokenCache.refreshToken,
      expiresAt: tokenCache.expiresAt,
      updatedAt: new Date().toISOString()
    }, null, 2));
    console.log('[BEDS24] Tokens saved to file');
  } catch (e) {
    console.error('[BEDS24] Failed to save tokens:', e.message);
  }
}

// Load tokens on startup
loadTokens();

/**
 * Refresh the access token using refresh token
 * Uses GET with refreshToken header (per Beds24 v2 API spec)
 */
async function refreshAccessToken() {
  return new Promise((resolve, reject) => {
    console.log('[BEDS24] Refreshing access token...');

    const refreshToken = tokenCache.refreshToken || process.env.BEDS24_REFRESH_TOKEN;

    const options = {
      hostname: 'api.beds24.com',
      path: '/v2/authentication/token',
      method: 'GET',
      headers: {
        'refreshToken': refreshToken,
        'Content-Type': 'application/json'
      }
    };

    console.log('[BEDS24] Refresh token length:', refreshToken?.length || 0);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          console.log('[BEDS24] Refresh response:', data.substring(0, 200));
          const result = JSON.parse(data);

          if (result.token) {
            // Success - update tokens
            tokenCache.accessToken = result.token;
            if (result.refreshToken) {
              tokenCache.refreshToken = result.refreshToken;
            }
            // Calculate expiry (expiresIn is in seconds)
            if (result.expiresIn) {
              tokenCache.expiresAt = Date.now() + (result.expiresIn * 1000);
            }

            // Save to file for persistence
            saveTokens();

            console.log('[BEDS24] Token refreshed successfully, expires in:', result.expiresIn, 'seconds');
            resolve(true);
          } else {
            console.error('[BEDS24] Token refresh failed:', result);
            resolve(false);
          }
        } catch (e) {
          console.error('[BEDS24] Token refresh parse error:', e.message, 'Data:', data);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[BEDS24] Token refresh error:', e.message);
      resolve(false);
    });

    req.end();
  });
}

/**
 * Make GET API request to Beds24 v2
 * Auto-refreshes token on 401 error
 */
async function apiGet(endpoint, retried = false) {
  return new Promise(async (resolve, reject) => {
    const token = tokenCache.accessToken || process.env.BEDS24_ACCESS_TOKEN;

    const options = {
      hostname: 'api.beds24.com',
      path: '/v2' + endpoint,
      method: 'GET',
      headers: {
        'token': token,
        'Content-Type': 'application/json'
      }
    };

    console.log('[BEDS24] GET:', '/api/v2' + endpoint);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const result = JSON.parse(data);

          // Check for 401 error and retry with refreshed token
          if ((result.code === 401 || res.statusCode === 401) && !retried) {
            console.log('[BEDS24] Got 401, attempting token refresh...');
            const refreshed = await refreshAccessToken();

            if (refreshed) {
              const retryResult = await apiGet(endpoint, true);
              resolve(retryResult);
              return;
            }
          }

          resolve(result);
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.end();
  });
}

/**
 * Make POST API request to Beds24 v2
 */
async function apiPost(endpoint, body = [], retried = false) {
  return new Promise(async (resolve, reject) => {
    const postData = JSON.stringify(body);
    const token = tokenCache.accessToken || process.env.BEDS24_ACCESS_TOKEN;

    const options = {
      hostname: 'api.beds24.com',
      path: '/v2' + endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'token': token
      }
    };

    console.log('[BEDS24] POST:', '/api/v2' + endpoint);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const result = JSON.parse(data);
          const response = Array.isArray(result) ? result[0] : result;

          if ((response.code === 401 || res.statusCode === 401) && !retried) {
            console.log('[BEDS24] Got 401, attempting token refresh...');
            const refreshed = await refreshAccessToken();

            if (refreshed) {
              const retryResult = await apiPost(endpoint, body, true);
              resolve(retryResult);
              return;
            }
          }

          resolve(response);
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Get today's bookings (arrivals)
 */
async function getTodayBookings() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await apiGet(`/bookings?arrival=${today}&status=confirmed`);
    return result.data || result;
  } catch (error) {
    console.error('[BEDS24] Error getting bookings:', error);
    return { error: error.message };
  }
}

/**
 * Get bookings for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function getBookingsByDate(date) {
  try {
    // Get bookings that are staying on this date (arrival <= date < departure)
    const result = await apiGet(`/bookings?arrivalFrom=${date}&arrivalTo=${date}`);
    return result.data || result;
  } catch (error) {
    console.error('[BEDS24] Error getting bookings by date:', error);
    return { error: error.message };
  }
}

/**
 * Get all current and future bookings (for occupancy check)
 */
async function getAllActiveBookings() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await apiGet(`/bookings?arrivalFrom=${today}&departureFrom=${today}&departureTo=${futureDate}`);
    return result.data || result;
  } catch (error) {
    console.error('[BEDS24] Error getting active bookings:', error);
    return { error: error.message };
  }
}

/**
 * Get availability for a date range
 */
async function getAvailability(from, to) {
  try {
    const result = await apiGet(`/inventory/calendar?startDate=${from}&endDate=${to}`);
    return result.data || result;
  } catch (error) {
    console.error('[BEDS24] Error getting availability:', error);
    return { error: error.message };
  }
}

/**
 * Get occupancy summary (30 days)
 */
async function getOccupancy() {
  try {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const to = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await apiGet(`/inventory/calendar?startDate=${from}&endDate=${to}`);
    return result.data || result;
  } catch (error) {
    console.error('[BEDS24] Error getting occupancy:', error);
    return { error: error.message };
  }
}

/**
 * Get check-ins today
 */
async function getCheckInsToday() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await apiGet(`/bookings?arrival=${today}&status=confirmed`);
    return result.data || result;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get check-outs today
 */
async function getCheckOutsToday() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await apiGet(`/bookings?departure=${today}`);
    return result.data || result;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get current guests (staying now)
 */
async function getCurrentGuests() {
  try {
    const result = await apiGet('/bookings?filter=current');
    return result.data || result;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Force refresh token (for manual trigger)
 */
async function forceRefreshToken() {
  return await refreshAccessToken();
}

/**
 * Get current token status
 */
function getTokenStatus() {
  return {
    hasAccessToken: !!tokenCache.accessToken,
    hasRefreshToken: !!tokenCache.refreshToken,
    expiresAt: tokenCache.expiresAt,
    tokenLength: tokenCache.accessToken?.length || 0
  };
}

module.exports = {
  getTodayBookings,
  getBookingsByDate,
  getAllActiveBookings,
  getAvailability,
  getOccupancy,
  getCheckInsToday,
  getCheckOutsToday,
  getCurrentGuests,
  forceRefreshToken,
  getTokenStatus
};
