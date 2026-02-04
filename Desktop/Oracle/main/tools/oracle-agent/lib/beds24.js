/**
 * Beds24 API Integration v3
 * Enhanced with patterns from checkin-main
 *
 * Features:
 * - Auto Token Refresh (5 min buffer)
 * - Room Mapping (11 rooms - The Arch Casa)
 * - Retry with Exponential Backoff
 * - Stale Cache Fallback
 * - Response Parsing (9+ formats)
 *
 * API Docs: https://api.beds24.com/
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BEDS24_API = 'api.beds24.com';
const TOKEN_FILE = path.join(__dirname, '..', '.beds24_tokens.json');

// ============================================================
// ROOM MAPPING - The Arch Casa (11 Rooms)
// ============================================================

const ROOM_MAP = {
  642555: { id: 'A01', name: 'Executive Suite', nameTh: 'ห้องเอ็กเซ็กคูทีฟ สวีท' },
  642557: { id: 'A02', name: 'Studio Garden View', nameTh: 'ห้องสตูดิโอ วิวสวน' },
  642556: { id: 'A03', name: 'Standard Studio', nameTh: 'ห้องสตูดิโอ มาตรฐาน' },
  642561: { id: 'A04', name: 'Suite Mountain View', nameTh: 'ห้องสวีท วิวภูเขา' },
  642553: { id: 'A05', name: 'Deluxe Double Room with Bath', nameTh: 'ห้องดีลักซ์ ดับเบิล พร้อมอ่างอาบน้ำ' },
  642560: { id: 'A06', name: 'Suite Garden View', nameTh: 'ห้องสวีท วิวสวน' },
  642562: { id: 'B07', name: 'Superior Studio', nameTh: 'ห้องสุพีเรียร์ สตูดิโอ' },
  642558: { id: 'B08', name: 'Studio Mountain View', nameTh: 'ห้องสตูดิโอ วิวภูเขา' },
  642559: { id: 'B09', name: 'Studio Terrace', nameTh: 'ห้องสตูดิโอ ระเบียง' },
  642552: { id: 'C10', name: 'Classic Quadruple', nameTh: 'ห้องคลาสสิก 4 คน' },
  642554: { id: 'C11', name: 'Deluxe King Studio', nameTh: 'ห้องดีลักซ์ คิง สตูดิโอ' }
};

const TOTAL_ROOMS = 11;

/**
 * Get room info by Beds24 room ID
 */
function getRoomById(beds24RoomId) {
  return ROOM_MAP[beds24RoomId] || { id: `R${beds24RoomId}`, name: `Room ${beds24RoomId}`, nameTh: `ห้อง ${beds24RoomId}` };
}

/**
 * Get room info by system ID (A01, B07, etc.)
 */
function getRoomBySystemId(systemId) {
  for (const [beds24Id, room] of Object.entries(ROOM_MAP)) {
    if (room.id === systemId) {
      return { ...room, beds24Id: parseInt(beds24Id) };
    }
  }
  return null;
}

/**
 * Get all rooms
 */
function getAllRooms() {
  return Object.entries(ROOM_MAP).map(([beds24Id, room]) => ({
    ...room,
    beds24Id: parseInt(beds24Id)
  }));
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

let tokenCache = {
  accessToken: process.env.BEDS24_ACCESS_TOKEN,
  refreshToken: process.env.BEDS24_REFRESH_TOKEN,
  expiresAt: null
};

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

loadTokens();

/**
 * Check if token needs refresh (5 min buffer)
 */
function tokenNeedsRefresh() {
  if (!tokenCache.accessToken) return true;
  if (!tokenCache.expiresAt) return false;
  const buffer = 5 * 60 * 1000; // 5 minutes
  return Date.now() + buffer >= tokenCache.expiresAt;
}

/**
 * Refresh the access token
 */
async function refreshAccessToken() {
  return new Promise((resolve) => {
    console.log('[BEDS24] Refreshing access token...');
    const refreshToken = tokenCache.refreshToken || process.env.BEDS24_REFRESH_TOKEN;

    const options = {
      hostname: BEDS24_API,
      path: '/v2/authentication/token',
      method: 'GET',
      headers: {
        'refreshToken': refreshToken,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.token) {
            tokenCache.accessToken = result.token;
            if (result.refreshToken) tokenCache.refreshToken = result.refreshToken;
            if (result.expiresIn) tokenCache.expiresAt = Date.now() + (result.expiresIn * 1000);
            saveTokens();
            console.log('[BEDS24] Token refreshed, expires in:', result.expiresIn, 'seconds');
            resolve(true);
          } else {
            console.error('[BEDS24] Token refresh failed:', result);
            resolve(false);
          }
        } catch (e) {
          console.error('[BEDS24] Token parse error:', e.message);
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

// ============================================================
// CACHING SYSTEM
// ============================================================

const cache = new Map();
const CACHE_TTL = {
  bookings: 30 * 1000,      // 30 seconds
  availability: 60 * 1000,  // 60 seconds
  occupancy: 60 * 1000      // 60 seconds
};

function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  const isExpired = Date.now() > cached.expiresAt;
  if (isExpired) {
    return { data: cached.data, stale: true };
  }
  return { data: cached.data, stale: false };
}

function setCache(key, data, ttlMs) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    cachedAt: Date.now()
  });
}

// ============================================================
// API REQUEST WITH RETRY
// ============================================================

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make API request with retry and exponential backoff
 */
async function apiRequest(method, endpoint, body = null, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 3000]; // Exponential backoff

  // Auto refresh token if needed
  if (tokenNeedsRefresh()) {
    await refreshAccessToken();
  }

  const token = tokenCache.accessToken || process.env.BEDS24_ACCESS_TOKEN;
  const postData = body ? JSON.stringify(body) : null;

  const options = {
    hostname: BEDS24_API,
    path: '/v2' + endpoint,
    method: method,
    headers: {
      'token': token,
      'Content-Type': 'application/json'
    }
  };

  if (postData) {
    options.headers['Content-Length'] = Buffer.byteLength(postData);
  }

  return new Promise(async (resolve) => {
    console.log(`[BEDS24] ${method}: /v2${endpoint}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const result = JSON.parse(data);

          // Handle 401 - refresh token and retry
          if ((result.code === 401 || res.statusCode === 401) && retryCount === 0) {
            console.log('[BEDS24] Got 401, refreshing token...');
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              const retryResult = await apiRequest(method, endpoint, body, 1);
              resolve(retryResult);
              return;
            }
          }

          // Handle other errors with retry
          if (result.success === false && retryCount < MAX_RETRIES) {
            console.log(`[BEDS24] Request failed, retrying in ${RETRY_DELAYS[retryCount]}ms...`);
            await delay(RETRY_DELAYS[retryCount]);
            const retryResult = await apiRequest(method, endpoint, body, retryCount + 1);
            resolve(retryResult);
            return;
          }

          resolve(result);
        } catch (e) {
          // Retry on parse error
          if (retryCount < MAX_RETRIES) {
            console.log(`[BEDS24] Parse error, retrying in ${RETRY_DELAYS[retryCount]}ms...`);
            await delay(RETRY_DELAYS[retryCount]);
            const retryResult = await apiRequest(method, endpoint, body, retryCount + 1);
            resolve(retryResult);
            return;
          }
          resolve({ success: false, error: `Parse error: ${e.message}` });
        }
      });
    });

    req.on('error', async (e) => {
      // Retry on network error
      if (retryCount < MAX_RETRIES) {
        console.log(`[BEDS24] Network error, retrying in ${RETRY_DELAYS[retryCount]}ms...`);
        await delay(RETRY_DELAYS[retryCount]);
        const retryResult = await apiRequest(method, endpoint, body, retryCount + 1);
        resolve(retryResult);
        return;
      }
      resolve({ success: false, error: e.message });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * GET request wrapper
 */
async function apiGet(endpoint) {
  return apiRequest('GET', endpoint);
}

/**
 * POST request wrapper
 */
async function apiPost(endpoint, body = []) {
  return apiRequest('POST', endpoint, body);
}

// ============================================================
// RESPONSE PARSING (9+ formats from checkin-main)
// ============================================================

/**
 * Extract booking ID from various response formats
 * Beds24 API is inconsistent, this handles all known formats
 */
function extractBookingId(result) {
  if (!result) return null;

  // Format 1: Direct ID
  if (typeof result === 'number') return result;
  if (typeof result === 'string' && /^\d+$/.test(result)) return parseInt(result);

  // Format 2: Array with ID
  if (Array.isArray(result)) {
    if (typeof result[0] === 'number') return result[0];
    if (result[0]?.id) return result[0].id;
  }

  // Format 3: Object with various structures
  if (typeof result === 'object') {
    // { id: 123 }
    if (result.id) return result.id;

    // { data: [{ id: 123 }] }
    if (result.data?.[0]?.id) return result.data[0].id;

    // { bookings: [{ id: 123 }] }
    if (result.bookings?.[0]?.id) return result.bookings[0].id;

    // { ids: [123] }
    if (result.ids?.[0]) return result.ids[0];

    // { "0": { id: 123 } }
    if (result['0']?.id) return result['0'].id;

    // { success: true, id: 123 }
    if (result.success && result.id) return result.id;
  }

  return null;
}

/**
 * Extract data array from various response formats
 */
function extractDataArray(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.data && Array.isArray(result.data)) return result.data;
  if (result.bookings && Array.isArray(result.bookings)) return result.bookings;
  return [];
}

// ============================================================
// BOOKING FUNCTIONS
// ============================================================

/**
 * Enrich booking with room info
 */
function enrichBooking(booking) {
  if (!booking) return booking;
  const room = getRoomById(booking.roomId);
  return {
    ...booking,
    roomName: room.name,
    roomNameTh: room.nameTh,
    roomSystemId: room.id,
    guestName: `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || 'Guest'
  };
}

/**
 * Get bookings for a specific date with caching
 */
async function getBookingsByDate(date) {
  const cacheKey = `bookings:${date}`;
  const cached = getCached(cacheKey);

  try {
    const result = await apiGet(`/bookings?arrivalFrom=${date}&arrivalTo=${date}`);
    const bookings = extractDataArray(result).map(enrichBooking);
    setCache(cacheKey, bookings, CACHE_TTL.bookings);
    return bookings;
  } catch (error) {
    console.error('[BEDS24] Error getting bookings by date:', error);
    // Return stale cache if available
    if (cached?.data) {
      console.log('[BEDS24] Returning stale cache for bookings');
      return cached.data;
    }
    return { error: error.message };
  }
}

/**
 * Get today's bookings (arrivals)
 */
async function getTodayBookings() {
  const today = new Date().toISOString().split('T')[0];
  return getBookingsByDate(today);
}

/**
 * Get all active bookings (30 days)
 */
async function getAllActiveBookings() {
  const cacheKey = 'bookings:active';
  const cached = getCached(cacheKey);

  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await apiGet(`/bookings?arrivalFrom=${today}&departureFrom=${today}&departureTo=${futureDate}`);
    const bookings = extractDataArray(result).map(enrichBooking);
    setCache(cacheKey, bookings, CACHE_TTL.bookings);
    return bookings;
  } catch (error) {
    if (cached?.data) return cached.data;
    return { error: error.message };
  }
}

/**
 * Get check-ins today
 */
async function getCheckInsToday() {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `checkins:${today}`;
  const cached = getCached(cacheKey);

  try {
    const result = await apiGet(`/bookings?arrival=${today}&status=confirmed`);
    const bookings = extractDataArray(result).map(enrichBooking);
    setCache(cacheKey, bookings, CACHE_TTL.bookings);
    return bookings;
  } catch (error) {
    if (cached?.data) return cached.data;
    return { error: error.message };
  }
}

/**
 * Get check-outs today
 */
async function getCheckOutsToday() {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `checkouts:${today}`;
  const cached = getCached(cacheKey);

  try {
    const result = await apiGet(`/bookings?departure=${today}`);
    const bookings = extractDataArray(result).map(enrichBooking);
    setCache(cacheKey, bookings, CACHE_TTL.bookings);
    return bookings;
  } catch (error) {
    if (cached?.data) return cached.data;
    return { error: error.message };
  }
}

/**
 * Get current guests (staying now)
 */
async function getCurrentGuests() {
  const cacheKey = 'guests:current';
  const cached = getCached(cacheKey);

  try {
    const result = await apiGet('/bookings?filter=current');
    const bookings = extractDataArray(result).map(enrichBooking);
    setCache(cacheKey, bookings, CACHE_TTL.bookings);
    return bookings;
  } catch (error) {
    if (cached?.data) return cached.data;
    return { error: error.message };
  }
}

/**
 * Get availability for a date range
 */
async function getAvailability(from, to) {
  const cacheKey = `availability:${from}:${to}`;
  const cached = getCached(cacheKey);

  try {
    const result = await apiGet(`/inventory/calendar?startDate=${from}&endDate=${to}`);
    const data = result.data || result;
    setCache(cacheKey, data, CACHE_TTL.availability);
    return data;
  } catch (error) {
    if (cached?.data) return cached.data;
    return { error: error.message };
  }
}

/**
 * Get occupancy summary (30 days)
 */
async function getOccupancy() {
  const cacheKey = 'occupancy:30d';
  const cached = getCached(cacheKey);

  try {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const to = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await apiGet(`/inventory/calendar?startDate=${from}&endDate=${to}`);
    const data = result.data || result;
    setCache(cacheKey, data, CACHE_TTL.occupancy);
    return data;
  } catch (error) {
    if (cached?.data) return cached.data;
    return { error: error.message };
  }
}

/**
 * Get occupancy summary for a specific date
 */
async function getOccupancyForDate(date) {
  try {
    // Get all bookings that overlap with this date
    const result = await apiGet(`/bookings?arrivalTo=${date}&departureFrom=${date}`);
    const bookings = extractDataArray(result).map(enrichBooking);

    const occupiedRooms = new Set(bookings.map(b => b.roomId));
    const occupiedCount = occupiedRooms.size;
    const availableCount = TOTAL_ROOMS - occupiedCount;

    return {
      date,
      totalRooms: TOTAL_ROOMS,
      occupied: occupiedCount,
      available: availableCount,
      occupancyRate: Math.round((occupiedCount / TOTAL_ROOMS) * 100),
      bookings,
      occupiedRoomIds: Array.from(occupiedRooms)
    };
  } catch (error) {
    return { error: error.message };
  }
}

// ============================================================
// TOKEN MANAGEMENT EXPORTS
// ============================================================

async function forceRefreshToken() {
  return await refreshAccessToken();
}

function getTokenStatus() {
  return {
    hasAccessToken: !!tokenCache.accessToken,
    hasRefreshToken: !!tokenCache.refreshToken,
    expiresAt: tokenCache.expiresAt,
    tokenLength: tokenCache.accessToken?.length || 0,
    needsRefresh: tokenNeedsRefresh()
  };
}

// ============================================================
// EXPORTS
// ============================================================

// Named exports
export {
  // Room Mapping
  ROOM_MAP,
  TOTAL_ROOMS,
  getRoomById,
  getRoomBySystemId,
  getAllRooms,

  // Bookings
  getTodayBookings,
  getBookingsByDate,
  getAllActiveBookings,
  getCheckInsToday,
  getCheckOutsToday,
  getCurrentGuests,

  // Availability
  getAvailability,
  getOccupancy,
  getOccupancyForDate,

  // Token Management
  forceRefreshToken,
  getTokenStatus,

  // Utilities
  enrichBooking,
  extractBookingId,
  extractDataArray
};

// Default export (for import beds24 from './beds24.js')
export default {
  ROOM_MAP,
  TOTAL_ROOMS,
  getRoomById,
  getRoomBySystemId,
  getAllRooms,
  getTodayBookings,
  getBookingsByDate,
  getAllActiveBookings,
  getCheckInsToday,
  getCheckOutsToday,
  getCurrentGuests,
  getAvailability,
  getOccupancy,
  getOccupancyForDate,
  forceRefreshToken,
  getTokenStatus,
  enrichBooking,
  extractBookingId,
  extractDataArray
};
