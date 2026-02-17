/**
 * Email Verification API Client
 *
 * ใช้ EmailListVerify API ตรวจ email ก่อนส่ง — จบปัญหา bounce ถาวร
 * API: GET https://apps.emaillistverify.com/api/verifyEmail?secret=KEY&email=xxx
 * Response: "ok" | "fail" | "unknown" | "email_disabled" | "catch_all" | "disposable" | "role" | "spamtrap"
 *
 * Pricing: $4/1,000 emails (credits ไม่หมดอายุ)
 * Setup: เพิ่ม EMAILVERIFY_API_KEY ใน .env
 */

const VALID_STATUSES = ['ok'];
const RISKY_STATUSES = ['catch_all', 'unknown', 'role'];
const INVALID_STATUSES = ['fail', 'email_disabled', 'disposable', 'spamtrap'];

// In-memory cache — ป้องกันเรียก API ซ้ำสำหรับ email เดียวกัน
const verifyCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify email address via EmailListVerify API
 * @param {string} email
 * @returns {{ valid: boolean, status: string, risky: boolean, source: string }}
 */
async function verifyEmail(email) {
  const apiKey = process.env.EMAILVERIFY_API_KEY;

  if (!apiKey) {
    console.log('[EMAIL-VERIFY] ⚠️ No EMAILVERIFY_API_KEY — skipping verification');
    return { valid: true, status: 'skipped', risky: false, source: 'no_api_key' };
  }

  const emailLower = email.toLowerCase().trim();

  // Check cache
  const cached = verifyCache.get(emailLower);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...cached.result, source: 'cache' };
  }

  try {
    const url = `https://apps.emaillistverify.com/api/verifyEmail?secret=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(emailLower)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[EMAIL-VERIFY] API error (${response.status}): ${text}`);
      // API error → fail-open (ให้ส่งได้ แต่ flag ว่า risky)
      return { valid: true, status: 'api_error', risky: true, source: 'error' };
    }

    const status = (await response.text()).trim().toLowerCase();

    const result = {
      valid: VALID_STATUSES.includes(status) || RISKY_STATUSES.includes(status),
      status,
      risky: RISKY_STATUSES.includes(status),
      source: 'api'
    };

    // Cache result
    verifyCache.set(emailLower, { result, timestamp: Date.now() });

    const emoji = result.valid ? (result.risky ? '⚠️' : '✅') : '❌';
    console.log(`[EMAIL-VERIFY] ${emoji} ${emailLower} → ${status}`);

    return result;
  } catch (err) {
    console.error(`[EMAIL-VERIFY] Error verifying ${emailLower}:`, err.message);
    // Network error → fail-open
    return { valid: true, status: 'network_error', risky: true, source: 'error' };
  }
}

/**
 * Batch verify multiple emails
 * @param {string[]} emails
 * @returns {Map<string, { valid: boolean, status: string, risky: boolean }>}
 */
async function verifyEmails(emails) {
  const results = new Map();

  for (const email of emails) {
    results.set(email, await verifyEmail(email));
    // Rate limit: 100ms between requests
    await new Promise(r => setTimeout(r, 100));
  }

  return results;
}

/**
 * Check if email verification API is configured
 */
function isConfigured() {
  return !!process.env.EMAILVERIFY_API_KEY;
}

/**
 * Get cache stats
 */
function getCacheStats() {
  let valid = 0, invalid = 0, risky = 0;
  for (const [, entry] of verifyCache) {
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      if (!entry.result.valid) invalid++;
      else if (entry.result.risky) risky++;
      else valid++;
    }
  }
  return { total: verifyCache.size, valid, invalid, risky };
}

export { verifyEmail, verifyEmails, isConfigured, getCacheStats };
export default { verifyEmail, verifyEmails, isConfigured, getCacheStats };
