/**
 * User Profiles System
 * Manages user identity, preferences, and permissions
 *
 * Features:
 * - Know who is talking (owner, partner, guest)
 * - Remember user preferences
 * - Onboarding for new users
 * - Permission-based information access
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data file path
const DATA_FILE = path.join(__dirname, '../data/user-profiles.json');

// Default profiles
const DEFAULT_PROFILES = {
  // Owner is set from config.line.owner_id
};

// Permission levels
const PERMISSION_LEVELS = {
  owner: {
    level: 100,
    access: ['all', 'business', 'investment', 'bookings', 'revenue', 'daily_briefing', 'opportunities'],
    dailyBriefing: true,
    investmentAlerts: true,
    businessOpportunities: true,
    fullAccess: true
  },
  partner: {
    level: 50,
    access: ['bookings', 'general', 'reminders'],
    dailyBriefing: false,
    investmentAlerts: false,
    businessOpportunities: false,
    fullAccess: false
  },
  staff: {
    level: 30,
    access: ['bookings', 'checkin', 'guest_info'],
    dailyBriefing: false,
    investmentAlerts: false,
    businessOpportunities: false,
    fullAccess: false
  },
  guest: {
    level: 10,
    access: ['general', 'booking_inquiry'],
    dailyBriefing: false,
    investmentAlerts: false,
    businessOpportunities: false,
    fullAccess: false
  }
};

// In-memory profiles cache
let profiles = {};

/**
 * Initialize profiles system
 */
function init(config = {}) {
  // Load existing profiles
  loadProfiles();

  // Setup owner from config
  if (config.line?.owner_id) {
    const ownerId = config.line.owner_id;
    if (!profiles[ownerId]) {
      profiles[ownerId] = {
        userId: ownerId,
        name: 'Tars',
        role: 'owner',
        permissions: PERMISSION_LEVELS.owner,
        preferences: {
          language: 'th',
          dailyBriefing: true,
          investmentAlerts: true,
          callStyle: 'casual' // พ่อหนุ่ม style
        },
        onboarded: true,
        createdAt: new Date().toISOString()
      };
    }
  }

  // Setup known partners (can be configured)
  // นิว's LINE ID will be learned when she first messages

  saveProfiles();
  console.log(`[USER-PROFILES] Initialized with ${Object.keys(profiles).length} profiles`);
}

/**
 * Load profiles from disk
 */
function loadProfiles() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      profiles = JSON.parse(data);
    } else {
      profiles = { ...DEFAULT_PROFILES };
      // Ensure data directory exists
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  } catch (error) {
    console.error('[USER-PROFILES] Error loading profiles:', error.message);
    profiles = { ...DEFAULT_PROFILES };
  }
}

/**
 * Save profiles to disk
 */
function saveProfiles() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error('[USER-PROFILES] Error saving profiles:', error.message);
  }
}

/**
 * Get user profile
 */
function getProfile(userId) {
  return profiles[userId] || null;
}

/**
 * Check if user is owner
 */
function isOwner(userId) {
  const profile = profiles[userId];
  return profile?.role === 'owner';
}

/**
 * Check if user is known (has profile)
 */
function isKnown(userId) {
  return !!profiles[userId];
}

/**
 * Check if user needs onboarding
 */
function needsOnboarding(userId) {
  const profile = profiles[userId];
  return !profile || !profile.onboarded;
}

/**
 * Get onboarding message for new user
 */
function getOnboardingMessage(userId, displayName = null) {
  const name = displayName ? `คุณ${displayName}` : 'คุณ';

  return `สวัสดีค่ะ ${name}! 👋

ผม Oracle ผู้ช่วยอัจฉริยะค่ะ

ก่อนเริ่มใช้งาน ขอถามหน่อยนะคะ:
อยากให้ผมช่วยเรื่องอะไรบ้างคะ?

1️⃣ ข้อมูลที่พัก / Booking
2️⃣ เรื่องทั่วไป / ถามตอบ
3️⃣ ทั้งสองอย่าง

พิมพ์ตัวเลข หรือบอกเลยก็ได้ค่ะ!`;
}

/**
 * Process onboarding response
 */
function processOnboarding(userId, message, displayName = null) {
  const lowerMsg = message.toLowerCase().trim();

  let preferences = {
    bookingAccess: false,
    generalAccess: true,
    language: 'th'
  };

  // Parse response
  if (lowerMsg === '1' || lowerMsg.includes('ที่พัก') || lowerMsg.includes('booking')) {
    preferences.bookingAccess = true;
    preferences.generalAccess = false;
  } else if (lowerMsg === '2' || lowerMsg.includes('ทั่วไป') || lowerMsg.includes('ถามตอบ')) {
    preferences.bookingAccess = false;
    preferences.generalAccess = true;
  } else if (lowerMsg === '3' || lowerMsg.includes('ทั้ง')) {
    preferences.bookingAccess = true;
    preferences.generalAccess = true;
  } else {
    // Can't parse, ask again or default to general
    return {
      success: false,
      message: `ขอโทษค่ะ ไม่เข้าใจ 😅

ช่วยเลือกอีกครั้งนะคะ:
1️⃣ ข้อมูลที่พัก
2️⃣ เรื่องทั่วไป
3️⃣ ทั้งสองอย่าง`
    };
  }

  // Create profile
  const role = preferences.bookingAccess ? 'partner' : 'guest';

  profiles[userId] = {
    userId,
    name: displayName || 'Unknown',
    role,
    permissions: PERMISSION_LEVELS[role],
    preferences: {
      ...preferences,
      dailyBriefing: false,
      investmentAlerts: false,
      callStyle: 'polite'
    },
    onboarded: true,
    createdAt: new Date().toISOString()
  };

  saveProfiles();

  const accessList = [];
  if (preferences.bookingAccess) accessList.push('ที่พัก');
  if (preferences.generalAccess) accessList.push('ถามตอบทั่วไป');

  return {
    success: true,
    message: `เรียบร้อยค่ะ! 🎉

ผมจะช่วยเรื่อง: ${accessList.join(' + ')}

ถามได้เลยค่ะ!`
  };
}

/**
 * Update user profile
 */
function updateProfile(userId, updates) {
  if (!profiles[userId]) {
    profiles[userId] = {
      userId,
      name: 'Unknown',
      role: 'guest',
      permissions: PERMISSION_LEVELS.guest,
      preferences: {},
      onboarded: false,
      createdAt: new Date().toISOString()
    };
  }

  // Merge updates
  profiles[userId] = {
    ...profiles[userId],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Update permissions if role changed
  if (updates.role && PERMISSION_LEVELS[updates.role]) {
    profiles[userId].permissions = PERMISSION_LEVELS[updates.role];
  }

  saveProfiles();
  return profiles[userId];
}

/**
 * Set user as partner (e.g., นิว)
 */
function setAsPartner(userId, name, customPreferences = {}) {
  profiles[userId] = {
    userId,
    name,
    role: 'partner',
    permissions: PERMISSION_LEVELS.partner,
    preferences: {
      language: 'th',
      dailyBriefing: false,
      investmentAlerts: false,
      callStyle: 'friendly',
      ...customPreferences
    },
    onboarded: true,
    createdAt: new Date().toISOString()
  };

  saveProfiles();
  return profiles[userId];
}

/**
 * Check if user can access specific feature
 */
function canAccess(userId, feature) {
  const profile = profiles[userId];
  if (!profile) return false;

  // Owner can access everything
  if (profile.role === 'owner') return true;

  return profile.permissions.access.includes(feature) ||
         profile.permissions.access.includes('all');
}

/**
 * Get context for AI based on user
 */
function getAIContext(userId) {
  const profile = profiles[userId];

  if (!profile) {
    return {
      isKnown: false,
      needsOnboarding: true,
      context: 'Unknown user, needs onboarding'
    };
  }

  const context = {
    isKnown: true,
    needsOnboarding: false,
    name: profile.name,
    role: profile.role,
    isOwner: profile.role === 'owner',
    callStyle: profile.preferences?.callStyle || 'polite',
    language: profile.preferences?.language || 'th',
    canAccess: {
      business: canAccess(userId, 'business'),
      investment: canAccess(userId, 'investment'),
      bookings: canAccess(userId, 'bookings'),
      revenue: canAccess(userId, 'revenue'),
      opportunities: canAccess(userId, 'opportunities')
    }
  };

  // Build context string for AI
  if (context.isOwner) {
    context.contextString = `กำลังคุยกับ ${profile.name} (เจ้าของ) - ตอบเต็มที่ได้ทุกเรื่อง`;
  } else if (profile.role === 'partner') {
    context.contextString = `กำลังคุยกับ ${profile.name} (partner) - ตอบเรื่องที่พักและทั่วไปได้ ไม่ต้องพูดเรื่อง business/investment`;
  } else {
    context.contextString = `กำลังคุยกับ ${profile.name} (guest) - ตอบเฉพาะเรื่องทั่วไป`;
  }

  return context;
}

/**
 * Get all profiles
 */
function getAllProfiles() {
  return { ...profiles };
}

/**
 * Delete user profile
 */
function deleteProfile(userId) {
  if (profiles[userId]) {
    delete profiles[userId];
    saveProfiles();
    return true;
  }
  return false;
}

/**
 * Register partner by owner command
 * Usage: "ลงทะเบียน นิว เป็น partner"
 */
function registerPartnerByCommand(message) {
  // Pattern: ลงทะเบียน [name] เป็น partner/staff
  const patterns = [
    /ลงทะเบียน\s+(.+?)\s+เป็น\s+(partner|staff)/i,
    /register\s+(.+?)\s+as\s+(partner|staff)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        isCommand: true,
        name: match[1].trim(),
        role: match[2].toLowerCase()
      };
    }
  }

  return { isCommand: false };
}

/**
 * Complete partner registration when they first message
 */
function completePartnerRegistration(userId, pendingName, role = 'partner') {
  return setAsPartner(userId, pendingName, {
    registeredByOwner: true
  });
}

export {
  init,
  getProfile,
  isOwner,
  isKnown,
  needsOnboarding,
  getOnboardingMessage,
  processOnboarding,
  updateProfile,
  setAsPartner,
  canAccess,
  getAIContext,
  getAllProfiles,
  deleteProfile,
  registerPartnerByCommand,
  completePartnerRegistration,
  PERMISSION_LEVELS
};

export default {
  init,
  getProfile,
  isOwner,
  isKnown,
  needsOnboarding,
  getOnboardingMessage,
  processOnboarding,
  updateProfile,
  setAsPartner,
  canAccess,
  getAIContext,
  getAllProfiles,
  deleteProfile,
  registerPartnerByCommand,
  completePartnerRegistration,
  PERMISSION_LEVELS
};
