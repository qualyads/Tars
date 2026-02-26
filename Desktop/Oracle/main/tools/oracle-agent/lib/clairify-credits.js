/**
 * Clairify Credits — API key + tier system
 * Quick Pass: 99 THB → 50 credits (one-time)
 * Pro: 490 THB/month → unlimited + PDF
 * Agency: 1,990 THB/month → unlimited + white-label + API
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDITS_FILE = join(__dirname, '..', 'data', 'clairify-credits.json');

export const TIERS = {
  'quick-pass': {
    name: 'Quick Pass',
    nameTh: 'Quick Pass',
    price: 99,
    stripAmount: 9900,
    credits: 50,
    mode: 'payment',
    features: ['50 audits', 'ไม่หมดอายุ', 'ใช้ได้ทันที'],
  },
  'pro': {
    name: 'Pro',
    nameTh: 'Pro',
    price: 490,
    stripAmount: 49000,
    credits: -1, // unlimited
    mode: 'subscription',
    features: ['Unlimited audits', 'PDF export', 'Email report', 'Priority support'],
  },
  'agency': {
    name: 'Agency',
    nameTh: 'Agency',
    price: 1990,
    stripAmount: 199000,
    credits: -1, // unlimited
    mode: 'subscription',
    features: ['Unlimited audits', 'White-label report', 'Custom logo + branding', 'API access', 'Bulk audit'],
  },
};

function loadCredits() {
  try {
    if (existsSync(CREDITS_FILE)) return JSON.parse(readFileSync(CREDITS_FILE, 'utf8'));
  } catch {}
  return { keys: {} };
}

function saveCredits(data) {
  writeFileSync(CREDITS_FILE, JSON.stringify(data, null, 2));
}

function generateApiKey() {
  return 'ck_' + randomBytes(20).toString('hex');
}

// Create new API key after payment
export function createKey(email, tier, stripeCustomerId, stripeSubscriptionId) {
  const data = loadCredits();
  const apiKey = generateApiKey();
  const tierConfig = TIERS[tier];
  if (!tierConfig) throw new Error(`Unknown tier: ${tier}`);

  data.keys[apiKey] = {
    email,
    tier,
    credits: tierConfig.credits, // -1 for unlimited
    totalUsed: 0,
    createdAt: new Date().toISOString(),
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    active: true,
    whiteLabel: tier === 'agency' ? { companyName: '', logoUrl: '', primaryColor: '#000000' } : null,
  };

  saveCredits(data);
  console.log(`[CLAIRIFY-CREDITS] Key created: ${apiKey.slice(0, 10)}... (${tier}) for ${email}`);
  return apiKey;
}

// Validate key and deduct credit
export function useCredit(apiKey) {
  if (!apiKey) return { valid: false, reason: 'no-key' };

  const data = loadCredits();
  const entry = data.keys[apiKey];

  if (!entry) return { valid: false, reason: 'invalid-key' };
  if (!entry.active) return { valid: false, reason: 'inactive' };

  // Unlimited tier
  if (entry.credits === -1) {
    entry.totalUsed++;
    saveCredits(data);
    return { valid: true, tier: entry.tier, remaining: -1, whiteLabel: entry.whiteLabel };
  }

  // Credit-based tier
  if (entry.credits <= 0) return { valid: false, reason: 'no-credits', tier: entry.tier };

  entry.credits--;
  entry.totalUsed++;
  saveCredits(data);
  return { valid: true, tier: entry.tier, remaining: entry.credits, whiteLabel: entry.whiteLabel };
}

// Check key info without consuming credit
export function getKeyInfo(apiKey) {
  if (!apiKey) return null;
  const data = loadCredits();
  const entry = data.keys[apiKey];
  if (!entry) return null;
  return {
    tier: entry.tier,
    credits: entry.credits,
    totalUsed: entry.totalUsed,
    active: entry.active,
    email: entry.email,
    whiteLabel: entry.whiteLabel,
    createdAt: entry.createdAt,
  };
}

// Find key by email (for recovery)
export function findKeyByEmail(email) {
  const data = loadCredits();
  for (const [key, entry] of Object.entries(data.keys)) {
    if (entry.email === email && entry.active) return { apiKey: key, ...entry };
  }
  return null;
}

// Add credits (for Quick Pass re-purchase)
export function addCredits(apiKey, amount) {
  const data = loadCredits();
  const entry = data.keys[apiKey];
  if (!entry) return false;
  if (entry.credits === -1) return true; // already unlimited
  entry.credits += amount;
  saveCredits(data);
  return true;
}

// Update white-label settings (Agency tier)
export function updateWhiteLabel(apiKey, whiteLabel) {
  const data = loadCredits();
  const entry = data.keys[apiKey];
  if (!entry || entry.tier !== 'agency') return false;
  entry.whiteLabel = { ...entry.whiteLabel, ...whiteLabel };
  saveCredits(data);
  return true;
}

// Cancel subscription (set inactive)
export function cancelKey(stripeSubscriptionId) {
  const data = loadCredits();
  for (const [key, entry] of Object.entries(data.keys)) {
    if (entry.stripeSubscriptionId === stripeSubscriptionId) {
      entry.active = false;
      saveCredits(data);
      console.log(`[CLAIRIFY-CREDITS] Key cancelled: ${key.slice(0, 10)}... (${entry.tier})`);
      return entry;
    }
  }
  return null;
}

// Reactivate key (on invoice.paid)
export function reactivateBySubscription(stripeSubscriptionId) {
  const data = loadCredits();
  for (const [key, entry] of Object.entries(data.keys)) {
    if (entry.stripeSubscriptionId === stripeSubscriptionId) {
      entry.active = true;
      saveCredits(data);
      return entry;
    }
  }
  return null;
}

// Get all active keys stats
export function getStats() {
  const data = loadCredits();
  const stats = { total: 0, quickPass: 0, pro: 0, agency: 0, totalUsed: 0 };
  for (const entry of Object.values(data.keys)) {
    if (!entry.active) continue;
    stats.total++;
    if (entry.tier === 'quick-pass') stats.quickPass++;
    if (entry.tier === 'pro') stats.pro++;
    if (entry.tier === 'agency') stats.agency++;
    stats.totalUsed += entry.totalUsed;
  }
  return stats;
}

export default {
  TIERS, createKey, useCredit, getKeyInfo, findKeyByEmail,
  addCredits, updateWhiteLabel, cancelKey, reactivateBySubscription, getStats,
};
