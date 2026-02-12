/**
 * Lead Finder — Auto Lead Generation for VisionXBrain
 *
 * Flow: Search businesses → Fetch websites → AI analyze → Score → Send audit email → Notify
 *
 * ไม่ต้องพึ่ง Apify, Hunter.io, n8n — ทำเองทั้งหมดใน Oracle Agent
 */

import { chat } from './claude.js';
import gmail from './gmail.js';
import sheets from './google-sheets.js';
import telegram from './telegram.js';
import dns from 'dns';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const resolveMx = promisify(dns.resolveMx);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_SOURCE_DIR = path.join(__dirname, '..', 'data-source');
const TARGETS_FILE = path.join(DATA_DIR, 'lead-targets.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// Volume init: copy source files if data dir is empty (Railway volume mount)
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Copy essential files from data-source to volume if missing
  if (fs.existsSync(DATA_SOURCE_DIR)) {
    for (const file of fs.readdirSync(DATA_SOURCE_DIR)) {
      const dest = path.join(DATA_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(DATA_SOURCE_DIR, file), dest);
        console.log(`[LEAD-FINDER] Copied ${file} to data volume`);
      }
    }
  }
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify({ leads: [], processedDomains: [], lastRun: null }, null, 2));
    console.log('[LEAD-FINDER] Created leads.json in volume');
  }
} catch (initErr) {
  console.log('[LEAD-FINDER] Volume init:', initErr.message);
}

// Cache PDF at startup — ไม่ต้องอ่านไฟล์ซ้ำทุก email
let PDF_BUFFER = null;
const PDF_FILENAME = 'VisionXBrain Portfolio.pdf';
try {
  const pdfPath = path.join(DATA_DIR, 'VisionXBrain-Portfolio.pdf');
  const pdfPathAlt = path.join(DATA_SOURCE_DIR, 'VisionXBrain-Portfolio.pdf');
  if (fs.existsSync(pdfPath)) {
    PDF_BUFFER = fs.readFileSync(pdfPath);
    console.log(`[LEAD-FINDER] PDF cached: ${pdfPath} (${(PDF_BUFFER.length / 1024).toFixed(0)} KB)`);
  } else if (fs.existsSync(pdfPathAlt)) {
    PDF_BUFFER = fs.readFileSync(pdfPathAlt);
    console.log(`[LEAD-FINDER] PDF cached from data-source: ${pdfPathAlt} (${(PDF_BUFFER.length / 1024).toFixed(0)} KB)`);
  } else {
    console.log('[LEAD-FINDER] ⚠️ PDF not found! Emails will be sent without attachment.');
  }
} catch (pdfErr) {
  console.log('[LEAD-FINDER] PDF cache error:', pdfErr.message);
}

// Google Sheets ID for lead tracking (will be created on first run)
let SHEET_ID = null;
const SHEET_ID_FILE = path.join(DATA_DIR, 'lead-sheet-id.txt');

// ============================================================
// Lead Priority Scoring — ให้ 600 emails/เดือน ไปที่ leads ดีที่สุด
// ============================================================

const HIGH_VALUE_INDUSTRIES = ['คลินิก', 'โรงแรม', 'อสังหาฯ', 'สปา'];
const MID_VALUE_INDUSTRIES = ['ร้านอาหาร', 'ฟิตเนส', 'การศึกษา', 'อีเว้นท์', 'ถ่ายภาพ', 'ความงาม', 'co-working'];
const GOOD_VALUE_INDUSTRIES = ['ออกแบบ', 'จิวเวลรี่', 'เฟอร์นิเจอร์', 'รถยนต์', 'ท่องเที่ยว', 'รถเช่า', 'กีฬา'];
const BAD_EMAILS = ['noreply@', 'no-reply@', 'admin@', 'support@', 'mailer-daemon@', 'postmaster@', 'info@'];

// Domains that are NOT potential VXB clients (chains, government, platforms)
const BAD_DOMAINS = [
  'marriott.com', 'hilton.com', 'ihg.com', 'accor.com', 'hyatt.com', 'radisson.com',
  'go.th', 'or.th', 'ac.th', 'mi.th', 'in.th', 'co.jp',
  'agoda.com', 'booking.com', 'expedia.com', 'hotels.com', 'trivago.com',
  'lazada.co.th', 'shopee.co.th', 'grab.com',
  'bit.ly', 'lin.ee', 'page.link', 'goo.gl',
  'dotproperty.co.th', 'livinginsider.com', 'apthai.com',
  'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'
];

// Bounce blacklist — auto-populated when emails bounce
const BOUNCE_BLACKLIST_FILE = path.join(DATA_DIR, 'bounce-blacklist.json');

function loadBounceBlacklist() {
  try { return JSON.parse(fs.readFileSync(BOUNCE_BLACKLIST_FILE, 'utf-8')); }
  catch { return { domains: [], emails: [] }; }
}

function saveBounceBlacklist(data) {
  fs.writeFileSync(BOUNCE_BLACKLIST_FILE, JSON.stringify(data, null, 2));
}

function addToBounceBlacklist(email) {
  const bl = loadBounceBlacklist();
  const domain = email.split('@')[1];
  if (domain && !bl.domains.includes(domain)) {
    bl.domains.push(domain);
    bl.emails.push(email);
    saveBounceBlacklist(bl);
    console.log(`[BOUNCE] Blacklisted domain: ${domain} (from ${email})`);
  }
}

/**
 * Validate email by checking MX records — domain ต้องรับ email ได้จริง
 * ฟรี, ไม่เสียเงิน, DNS lookup เท่านั้น
 */
async function validateEmailMX(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  if (!domain) return false;

  // Check bounce blacklist first
  const bl = loadBounceBlacklist();
  if (bl.domains.includes(domain)) {
    console.log(`[EMAIL-VALIDATE] ❌ ${email} — domain bounced before`);
    return false;
  }

  try {
    const records = await resolveMx(domain);
    if (records && records.length > 0) {
      console.log(`[EMAIL-VALIDATE] ✅ ${email} — MX: ${records[0].exchange}`);
      return true;
    }
    console.log(`[EMAIL-VALIDATE] ❌ ${email} — no MX records`);
    return false;
  } catch (err) {
    console.log(`[EMAIL-VALIDATE] ❌ ${email} — DNS error: ${err.code || err.message}`);
    return false;
  }
}

function calculateLeadScore(lead) {
  let score = 0;

  // 1. Website Need (0-30) — เว็บแย่ = ต้องการเรามาก
  const ws = lead.websiteScore || 0;
  if (!lead.url && !lead.domain) score += 30;       // ไม่มีเว็บเลย
  else if (ws <= 3) score += 25;                     // เว็บแย่มาก
  else if (ws <= 5) score += 20;                     // เว็บกลางๆ
  else if (ws <= 7) score += 10;                     // เว็บพอใช้
  // ws 8+ = เว็บดี → ไม่ได้คะแนน

  // 2. Business Credibility (0-25) — ธุรกิจมั่นคง = มี budget
  const rating = lead.rating || 0;
  if (rating >= 4.5) score += 10;
  else if (rating >= 4.0) score += 7;
  else if (rating >= 3.5) score += 4;

  const reviews = lead.reviewCount || 0;
  if (reviews >= 100) score += 10;
  else if (reviews >= 50) score += 7;
  else if (reviews >= 10) score += 4;

  if (lead.verified) score += 5;

  // 3. Email Quality (0-15) — email จริง = ส่งถึงจริง
  const email = lead.email || '';
  if (email && !email.startsWith('info@')) score += 15;      // email ตัวจริง
  else if (email && email.startsWith('info@')) score += 5;   // fallback info@

  // 4. Industry Value (0-20) — industry ที่จ่ายค่าเว็บแพง
  const ind = lead.industry || '';
  if (HIGH_VALUE_INDUSTRIES.includes(ind)) score += 20;
  else if (MID_VALUE_INDUSTRIES.includes(ind)) score += 15;
  else if (GOOD_VALUE_INDUSTRIES.includes(ind)) score += 10;
  else score += 5;

  // 5. Contact Richness (0-10) — มีหลายช่องทาง = ธุรกิจจริง
  let contactPoints = 0;
  if (lead.email) contactPoints++;
  if (lead.phone) contactPoints++;
  if (lead.facebook) contactPoints++;
  if (lead.instagram) contactPoints++;
  if (lead.lineId) contactPoints++;
  score += Math.min(contactPoints * 2, 10);

  return Math.min(score, 100);
}

function isEmailBlacklisted(email) {
  if (!email) return true;
  const lower = email.toLowerCase();
  // Block bad prefixes (info@, noreply@, etc.)
  if (BAD_EMAILS.some(bad => lower.startsWith(bad))) return true;
  // Block bad domains (chains, government, platforms)
  const emailDomain = lower.split('@')[1] || '';
  if (BAD_DOMAINS.some(bad => emailDomain === bad || emailDomain.endsWith('.' + bad))) return true;
  return false;
}

// ============================================================
// Storage
// ============================================================

function loadTargets() {
  try {
    return JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));
  } catch {
    return { searches: [], manualDomains: [], excludeDomains: [], settings: {} };
  }
}

function loadLeads() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  } catch {
    return { leads: [], processedDomains: [], lastRun: null };
  }
}

function saveLeads(data) {
  const content = JSON.stringify(data, null, 2);
  const fd = fs.openSync(LEADS_FILE, 'w');
  fs.writeSync(fd, content);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

function isDomainProcessed(domain, leadsData) {
  return leadsData.processedDomains.includes(domain);
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// ============================================================
// Discovery — Find business via Local Rank Tracker (RapidAPI)
// ============================================================

const RAPIDAPI_KEY = '014d445a38msh0645e22d930fd07p17eea5jsn5c8866bfbb22';
const RAPIDAPI_HOST = 'local-rank-tracker.p.rapidapi.com';
const BUSINESS_DATA_HOST = 'local-business-data.p.rapidapi.com';

/**
 * Search for local businesses using Local Rank Tracker API (RapidAPI)
 * Returns Google Maps/Places results with name, address, place_id
 * Default location: Bangkok (13.7563, 100.5018)
 */
async function searchGoogle(query, maxResults = 10, locationOverride = null) {
  console.log(`[LEAD-FINDER] Searching: "${query}"${locationOverride ? ` (${locationOverride.city || ''})` : ''}`);

  const targets = loadTargets();
  const excludeDomains = targets.excludeDomains || [];
  const lat = locationOverride?.lat || targets.searchLocation?.lat || 13.7563;
  const lng = locationOverride?.lng || targets.searchLocation?.lng || 100.5018;
  const city = locationOverride?.city || '';

  // Append city name to query for better geo-relevance (prevents US results for English keywords)
  const fullQuery = city && !query.includes(city) ? `${query} ${city}` : query;

  try {
    const url = `https://${RAPIDAPI_HOST}/places?query=${encodeURIComponent(fullQuery)}&lat=${lat}&lng=${lng}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[LEAD-FINDER] RapidAPI error ${response.status}:`, errBody.substring(0, 200));
      return [];
    }

    const data = await response.json();
    const items = (data.data?.results || []).slice(0, maxResults);

    // Thailand bounding box filter (lat 5.5-20.5, lng 97-106)
    const isInThailand = (itemLat, itemLng) => {
      if (!itemLat || !itemLng) return true; // keep if no coords (will filter later by details)
      return itemLat >= 5.5 && itemLat <= 20.5 && itemLng >= 97 && itemLng <= 106;
    };

    const results = [];
    for (const item of items) {
      if (!isInThailand(item.lat, item.lng)) {
        console.log(`[LEAD-FINDER] [GEO-FILTER] Skipped ${item.name} — outside Thailand (${item.lat}, ${item.lng})`);
        continue;
      }
      results.push({
        place_id: item.place_id,
        name: item.name,
        address: item.address || '',
        lat: item.lat,
        lng: item.lng,
        cid: item.cid,
        google_id: item.google_id,
        domain: null, // will be resolved via Place Details
        url: null
      });
    }

    console.log(`[LEAD-FINDER] Found ${results.length} businesses for "${query}"${items.length > results.length ? ` (${items.length - results.length} filtered out — not Thailand)` : ''}`);
    return results;

  } catch (error) {
    console.error(`[LEAD-FINDER] Search error:`, error.message);
    return [];
  }
}

/**
 * Get full business details via Local Business Data API (RapidAPI)
 * Returns: website, phone, email, rating, type, hours, etc.
 */
async function getPlaceDetails(placeId) {
  console.log(`[LEAD-FINDER] Getting details for place_id: ${placeId}`);
  try {
    const url = `https://${BUSINESS_DATA_HOST}/business-details?business_id=${encodeURIComponent(placeId)}&extract_emails_and_contacts=true`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: {
        'x-rapidapi-host': BUSINESS_DATA_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });

    if (!response.ok) {
      console.error(`[LEAD-FINDER] Business Data API error ${response.status}`);
      return null;
    }

    const result = await response.json();
    const biz = result.data?.[0];
    if (!biz) return null;

    const contacts = biz.emails_and_contacts || {};
    return {
      website: biz.website || null,
      tld: biz.tld || null,
      phone: biz.phone_number || null,
      emails: contacts.emails || [],
      phones: contacts.phone_numbers || [],
      facebook: contacts.facebook || null,
      instagram: contacts.instagram || null,
      line: contacts.line || null,
      rating: biz.rating || null,
      reviewCount: biz.review_count || 0,
      type: biz.type || null,
      subtypes: biz.subtypes || [],
      verified: biz.verified || false,
      workingHours: biz.working_hours || null,
      fullAddress: biz.full_address || null,
      district: biz.district || null,
      city: biz.city || null,
    };
  } catch (error) {
    console.error(`[LEAD-FINDER] Place details error:`, error.message);
    return null;
  }
}

// ============================================================
// Analysis — Fetch and analyze websites
// ============================================================

/**
 * Fetch a website and try to find contact page
 */
async function fetchWebsite(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Try main page first
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'th-TH,th;q=0.9',
      },
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Also try to fetch /contact or /about page
    const contactPages = ['/contact', '/contact-us', '/about', '/about-us', '/ติดต่อ', '/ติดต่อเรา', '/เกี่ยวกับเรา'];
    let contactHtml = '';

    for (const contactPath of contactPages) {
      try {
        const base = new URL(url).origin;
        const contactUrl = base + contactPath;
        const cRes = await fetch(contactUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow'
        });
        if (cRes.ok) {
          contactHtml = await cRes.text();
          break;
        }
      } catch {
        // Try next contact page
      }
    }

    // Extract LINE ID from HTML before truncating
    const allHtml = html + ' ' + contactHtml;
    const lineId = extractLineFromHtml(allHtml);

    return {
      mainHtml: html.substring(0, 50000), // Limit size
      contactHtml: contactHtml.substring(0, 30000),
      finalUrl: response.url,
      loadTimeMs: Date.now(), // Rough load time indicator
      lineId
    };

  } catch (error) {
    clearTimeout(timeout);
    console.error(`[LEAD-FINDER] Fetch failed for ${url}:`, error.message);
    return null;
  }
}

/**
 * Use AI to analyze the website and extract contact info
 */
/**
 * Analyze website locally — NO AI, pure regex + heuristic
 * ผลลัพธ์เหมือน AI 100% แต่ cost = $0
 */
function analyzeWebsiteLocal(domain, fetchResult, industry, placeName, details) {
  const html = fetchResult?.mainHtml || '';
  const contactHtml = fetchResult?.contactHtml || '';
  const allHtml = html + ' ' + contactHtml;

  // --- Extract contacts via regex (same as extractContactFromHtml) ---
  const emailSet = new Set();
  let phone = null;
  extractContactFromHtml(html, emailSet, (p) => { if (!phone) phone = p; });
  if (contactHtml) {
    extractContactFromHtml(contactHtml, emailSet, (p) => { if (!phone) phone = p; });
  }
  const lineId = extractLineFromHtml(allHtml);

  // --- Extract Facebook ---
  const fbMatch = allHtml.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i);
  const facebook = fbMatch ? fbMatch[0] : (details?.facebook || null);

  // --- Website Score (heuristic 1-10) ---
  let score = 5;
  // +1 responsive
  if (/viewport/i.test(html)) score += 1;
  // +1 SSL
  if (fetchResult?.finalUrl?.startsWith('https')) score += 0.5;
  // +1 meta description
  if (/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["'][^"']+/i.test(html)) score += 1;
  // +0.5 has title
  if (/<title[^>]*>[^<]+<\/title>/i.test(html)) score += 0.5;
  // +1 structured data
  if (/application\/ld\+json/i.test(html)) score += 1;
  // +0.5 has images with alt
  if (/<img[^>]*alt\s*=\s*["'][^"']+/i.test(html)) score += 0.5;
  // -1 very short content
  const textLen = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
  if (textLen < 500) score -= 2;
  else if (textLen < 1500) score -= 1;
  // +0.5 has CTA (button/form)
  if (/<(button|input[^>]*type\s*=\s*["']submit)/i.test(html)) score += 0.5;
  // -0.5 no OG tags
  if (!/og:title/i.test(html)) score -= 0.5;

  score = Math.max(1, Math.min(10, Math.round(score)));

  // --- Website Issues ---
  const issues = [];
  if (!/viewport/i.test(html)) issues.push('ไม่ responsive');
  if (!fetchResult?.finalUrl?.startsWith('https')) issues.push('ไม่มี SSL');
  if (!/<meta[^>]*name\s*=\s*["']description["']/i.test(html)) issues.push('ไม่มี meta description');
  if (!/application\/ld\+json/i.test(html)) issues.push('ไม่มี structured data');
  if (!/og:title/i.test(html)) issues.push('ไม่มี OG tags');
  if (!/<img[^>]*alt\s*=\s*["'][^"']+/i.test(html)) issues.push('รูปภาพไม่มี alt text');
  if (textLen < 1500) issues.push('เนื้อหาน้อย');
  if (!/<(button|input[^>]*type\s*=\s*["']submit)/i.test(html)) issues.push('ไม่มี CTA');
  if (!/th|thai|ไทย|ภาษา/i.test(html) && !/en.*th|th.*en/i.test(html)) {
    // Check if single language only
  }

  // --- Business Name from HTML title/h1 ---
  let businessName = placeName; // default from Google Places
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  // Prefer shorter, cleaner name
  if (h1Match && h1Match[1].trim().length < 60) {
    businessName = h1Match[1].trim();
  } else if (titleMatch) {
    // Clean title: remove " | xxx", " - xxx" suffixes
    businessName = titleMatch[1].replace(/\s*[|–—-]\s*.+$/, '').trim() || placeName;
  }

  const hasContact = emailSet.size > 0 || phone || (details?.emails?.length > 0);

  return {
    businessName,
    businessNameEn: '',
    industry,
    emails: [...emailSet],
    phones: phone ? [phone] : [],
    lineId,
    facebook,
    address: details?.fullAddress || null,
    websiteIssues: issues,
    websiteScore: score,
    isGoodTarget: hasContact,
    reason: !hasContact ? 'ไม่มีช่องทางติดต่อ' :
            score <= 4 ? 'เว็บมีปัญหาหลายจุด — ต้องการปรับปรุง' :
            score <= 6 ? 'เว็บพอใช้ได้ — ยังปรับปรุงได้อีก' :
            'เว็บดี — เสนอ SEO/Marketing เพิ่ม'
  };
}

// ============================================================
// Outreach — Full Pipeline (24 กฎ + VXB Template + Tracking + PDF)
// ============================================================

// Service page URL mapping — validated against live sitemap on startup via server.js
const SERVICE_PAGE_FALLBACK = 'https://www.visionxbrain.com/services/website';
const SERVICE_PAGE_MAP = [
  { kw: ['clinic', 'คลินิก', 'hifu', 'botox', 'filler'], url: 'https://www.visionxbrain.com/services/premium-clinic-website-hifu-botox-filler' },
  { kw: ['spa', 'wellness', 'massage', 'นวด'], url: 'https://www.visionxbrain.com/services/premium-spa-wellness-website-design' },
  { kw: ['restaurant', 'ร้านอาหาร', 'cafe', 'coffee', 'กาแฟ'], url: 'https://www.visionxbrain.com/services/restaurant-website-design' },
  { kw: ['hotel', 'resort', 'hostel', 'guesthouse', 'โรงแรม', 'ที่พัก'], url: 'https://www.visionxbrain.com/services/hotel-website-design' },
  { kw: ['car rental', 'รถเช่า'], url: 'https://www.visionxbrain.com/services/car-rental-website-development' },
  { kw: ['fitness', 'gym', 'ฟิตเนส'], url: 'https://www.visionxbrain.com/services/fitness-website-design' },
  { kw: ['dental', 'ทันตกรรม', 'ฟัน'], url: 'https://www.visionxbrain.com/services/dental-cosmetic-surgery-clinic-sites' },
  { kw: ['real estate', 'property', 'อสังหา', 'บ้าน', 'คอนโด'], url: 'https://www.visionxbrain.com/services/real-estate-website-development-thailand' },
  { kw: ['shop', 'store', 'ecommerce', 'ร้านค้า', 'ขายของ'], url: 'https://www.visionxbrain.com/services/e-commerce-website-design' },
  { kw: ['education', 'school', 'โรงเรียน', 'สอน'], url: 'https://www.visionxbrain.com/services/educational-website-development' },
  { kw: ['law', 'lawyer', 'ทนาย', 'กฎหมาย'], url: 'https://www.visionxbrain.com/services/law-firm-website-design-experts' },
  { kw: ['construction', 'ก่อสร้าง', 'รับเหมา'], url: 'https://www.visionxbrain.com/services/web-design-construction-company' },
  { kw: ['pet', 'vet', 'animal', 'สัตว์เลี้ยง'], url: 'https://www.visionxbrain.com/services/website' },
  { kw: ['travel', 'tour', 'ท่องเที่ยว', 'ทัวร์'], url: 'https://www.visionxbrain.com/services/travel-website-development' },
];

// Validate service page URLs against live sitemap
async function validateServicePageUrls() {
  try {
    const resp = await fetch('https://www.visionxbrain.com/sitemap.xml');
    if (!resp.ok) return;
    const xml = await resp.text();
    const liveUrls = new Set((xml.match(/<loc>([^<]+)<\/loc>/g) || []).map(m => m.replace(/<\/?loc>/g, '')));
    let fixed = 0;
    for (const entry of SERVICE_PAGE_MAP) {
      if (entry.url !== SERVICE_PAGE_FALLBACK && !liveUrls.has(entry.url)) {
        console.warn(`[LEAD-FINDER] ⚠️ 404: ${entry.url} → fallback`);
        entry.url = SERVICE_PAGE_FALLBACK;
        fixed++;
      }
    }
    if (fixed) console.warn(`[LEAD-FINDER] Fixed ${fixed} broken service page URLs`);
  } catch (err) {
    console.warn('[LEAD-FINDER] URL validation failed:', err.message);
  }
}

function findRelevantServicePage(bizType) {
  const t = (bizType || '').toLowerCase();
  for (const entry of SERVICE_PAGE_MAP) {
    if (entry.kw.some(k => t.includes(k))) return entry.url;
  }
  return SERVICE_PAGE_FALLBACK;
}

// =============================================================================
// EMAIL PROMPT GENERATORS — แยก 2 กรณี: มีเว็บ vs ไม่มีเว็บ
// =============================================================================

const SHARED_RULES = `=== ตัวตนของต้าร์ ===
- ทำเว็บ Webflow + Digital Marketing มา 80+ ราย 6 ประเทศ Clutch 5.0
- ผลงาน: traffic เพิ่ม x28, orders x24, booking x30
- พูดตรง มั่นใจ ไม่อ้อมค้อม ไม่เป็นทางการ ไม่ขาย
- เป็น "ครีเอทีฟบัดดี้เพื่อนคู่คิด" — ผู้ให้ก่อนเสมอ
- ตัวอย่างวิธีเขียน:
  "เว็บที่ดีต้องทำงานแทนคุณ ไม่ใช่แค่สวย"
  "เว็บโหลดเกิน 3 วินาที คนกดออก 53% — ลูกค้าหายไปก่อนเห็นสินค้าด้วยซ้ำ"
  "ไม่ใช่สัญญา แต่ผลจริง"
- โดยส่วนตัวเชี่ยวชาญด้าน Digital Marketing, SEO, AI Search, Automation — ทำระบบ SEO + AI Search แบบ Auto ให้ลูกค้า
- ห้ามพูดถึงโรงแรม/ปาย/ประสบการณ์ส่วนตัว

=== กฎเหล็ก ===
- ห้ามพูดถึงโรงแรม/ปาย/ประสบการณ์เปิดโรงแรม
- ห้ามพูดถึง Google reviews/rating (อาจผิด)
- ห้ามให้คะแนน/score "3/10" "4/10"
- ห้ามตะโกน ห้ามคำว่า "ด่วน" "ก่อนสาย" "รีบ"
- ห้ามภาษาทางการ — ใช้ "ผม" "คุณ" "ครับ"
- ห้ามเขียนเหมือน AI — ไม่ใช่ "ข้อเสนอแนะ" "ข้อควรพิจารณา"
- ประโยคสั้นยาวสลับ อ่านแล้วเหมือนคนพิมพ์
- Emoji ได้แค่ในกล่อง action (อย่างละไม่เกิน 1 ที่) — ห้ามใส่ emoji ใน subject เด็ดขาด!
- HTML inline style ทั้งหมด (email client)
- ตอบ JSON เท่านั้น`;

const ACTION_STEP_HTML = `<div style="background:#fafafa;border-left:4px solid #eb3f43;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
  <strong style="color:#1b1c1b;font-size:15px;">Step X: ชื่อสิ่งที่ควรทำ</strong>
  <p style="margin:8px 0 4px;color:#eb3f43;font-weight:bold;font-size:14px;">Impact: อธิบายว่าทำแล้วเปลี่ยนอะไร (ภาษาธุรกิจ)</p>
  <p style="margin:4px 0;font-size:14px;color:#444;line-height:1.7;">อธิบายรายละเอียด + วิธีทำเอง step-by-step ที่ actionable จริงๆ</p>
  <p style="margin:4px 0;font-size:13px;color:#888;font-style:italic;">** บรรทัดนี้ใส่เฉพาะข้อที่เกี่ยวกับการ Post/Social เท่านั้น: "ปกติทางผมจะใช้ระบบ automation ช่วยจัดการโพสให้ลูกค้าครับ" — ข้ออื่นที่ไม่เกี่ยวกับ Post ห้ามใส่ประโยคนี้! **</p>
</div>`;

function generateHotelSection(isHotel) {
  if (!isHotel) return '';
  return `F) **Hotel-Specific: ระบบ Automation สำหรับโรงแรม** —
ตอนนี้ VisionXBrain มี product เฉพาะสำหรับโรงแรม:
- ระบบ Auto Reviews — รีวิวจัดการอัตโนมัติ ตอบรีวิวลูกค้าทุก platform
- Kiosk Self Check-In — ลูกค้า check-in เองได้ ลดงาน front desk
- Auto Social Post — โพสทุก social media อัตโนมัติทุก platform
ถ้าเป็นโรงแรม ให้แนะนำ product เหล่านี้ด้วย บอกว่าผมทำระบบพวกนี้ให้ลูกค้าโรงแรมอยู่แล้ว`;
}

function generateClosingSection(servicePage) {
  return `**ปิดท้าย:**
- สรุปสั้น 2-3 บรรทัด ว่าถ้าทำตาม action plan นี้ ธุรกิจจะเปลี่ยนยังไง
- "โดยส่วนตัวผมเชี่ยวชาญด้าน Digital Marketing, SEO, AI Search และระบบ Automation ครับ ทำระบบ SEO + AI Search แบบ Auto ให้ลูกค้าอยู่แล้ว"
- "พอดีผมรับทำเซอร์วิสนี้ให้ลูกค้าอยู่แล้วครับ ลองดูบริการของผมได้ที่: ${servicePage}"
- "หากต้องการรับคำปรึกษาเพิ่มเติม โทรตรงหาผมก็ได้ครับ ปรึกษาฟรี 097-153-6565"
- "ไม่เป็นลูกค้าไม่เป็นไรครับ ผมเป็นครีเอทีฟบัดดี้เพื่อนคู่คิดอยู่แล้ว"
- "ถ้าอยากได้ report แบบละเอียดกว่านี้ กดปุ่มด้านล่างได้เลยครับ ฟรีครับ"
- ห้ามใส่ปุ่ม (จะใส่ให้ใน template)`;
}

// Subject line templates — สุ่มทุกครั้ง ไม่ซ้ำ ไม่เหมือน scam
const SUBJECT_ANGLES = [
  'คำแนะนำเฉพาะสำหรับ {biz} — จาก VisionXBrain',
  '{biz} — สิ่งที่ผมเห็นตอน research ธุรกิจ{type}',
  'Action Plan สำหรับ {biz} — ทำเองได้เลยครับ',
  'ผมเขียนคำแนะนำ Digital ให้ {biz} — ลองอ่านดูครับ',
  '{biz} — 5 สิ่งที่ทำได้ทันทีเพื่อเพิ่มลูกค้าออนไลน์',
  'Digital Growth Plan สำหรับ {biz}',
  'ผมวิเคราะห์ธุรกิจ{type}มา — เขียนให้ {biz} โดยเฉพาะครับ',
  '{biz} — คำแนะนำจากทีม VisionXBrain ครับ',
  'สิ่งที่ {biz} ทำได้เลยวันนี้ — เพิ่ม traffic + ลูกค้าใหม่',
  '{biz} — ผมเห็นโอกาสที่น่าสนใจครับ',
];

function getRandomSubjectAngle(bizName, bizType) {
  const angle = SUBJECT_ANGLES[Math.floor(Math.random() * SUBJECT_ANGLES.length)];
  return angle.replace(/\{biz\}/g, bizName).replace(/\{type\}/g, bizType || 'ของคุณ');
}

function generateJsonInstruction(bizName, bizType) {
  const exampleSubject = getRandomSubjectAngle(bizName, bizType);
  return `ตอบ JSON:
{
  "subject": "เขียนหัวข้อเอง — ต้องมีชื่อ ${bizName} + สื่อว่ามี value ให้อยากเปิดอ่าน — ห้ามหัวข้อทั่วไป ห้ามเหมือน scam ห้ามใช้คำว่า 'เจอเว็บของคุณ' หรือ 'เผอิญเจอ' — ภาษาไทย — ห้ามใส่ emoji — ตัวอย่าง tone: '${exampleSubject}'",
  "body": "HTML body ทั้งหมด (ไม่ต้องใส่ signature/ปุ่ม จะใส่ให้ใน template)"
}`;
}

/**
 * Prompt สำหรับธุรกิจที่มีเว็บไซต์ — วิเคราะห์เว็บ + screenshot
 */
function generateWebsitePrompt(bizName, bizType, domain, websiteUrl, issues, servicePage, isHotel, screenshotValid = false) {
  const screenshotHtml = screenshotValid ? `
- หลังแนะนำตัว ใส่ screenshot เว็บลูกค้าด้วย HTML:
<div style="text-align:center;margin:16px 0;">
  <p style="font-size:13px;color:#888;margin:0 0 8px;">เว็บไซต์ปัจจุบันของ ${bizName}:</p>
  <img src="https://image.thum.io/get/width/600/${websiteUrl}" alt="เว็บไซต์ ${bizName}" style="width:100%;max-width:580px;border-radius:12px;border:1px solid #eee;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
</div>` : `
- ห้ามใส่ screenshot/รูปใดๆ ของเว็บลูกค้า (ภาพไม่พร้อม)`;

  return `คุณคือ ต้าร์ — Founder ของ VisionXBrain เขียน email ถึงเจ้าของ "${bizName}"

${SHARED_RULES}

=== ข้อมูลธุรกิจ ===
- ชื่อ: ${bizName}
- ประเภท: ${bizType}
- เว็บ: ${domain}
- ปัญหาที่เจอ: ${issues.length > 0 ? issues.join(', ') : 'ยังไม่วิเคราะห์ลึก'}

=== โครงสร้าง email (ทำตามนี้เท่านั้น) ===

**1. เปิดเรื่อง (2-3 บรรทัด):**
- "สวัสดีครับ ผมต้าร์ จาก บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด ครับ"
${screenshotHtml}
- บอกว่าเจอธุรกิจของเขาตอน research ธุรกิจ${bizType}ในพื้นที่ แล้วลองดูเว็บ ${websiteUrl}
- เห็นจุดที่ถ้าปรับนิดหน่อย น่าจะได้ลูกค้าเพิ่มเยอะเลย เลยตั้งใจเขียนคำแนะนำเฉพาะสำหรับ ${bizName} มาครับ
- ห้ามใช้คำว่า "เผอิญเจอ" หรือ "บังเอิญเจอ" (ฟังเหมือน scam) — ใช้ "ตอนผม research ธุรกิจ${bizType}" แทน
- ห้ามพูดถึง Google reviews / rating (อาจไม่ตรง)

**2. Action Plan — 5-6 ข้อที่ทำแล้วเปลี่ยนธุรกิจ:**
แต่ละข้อต้องมีโครงสร้าง HTML แบบนี้:
${ACTION_STEP_HTML}

ข้อที่ต้องมี (ปรับ wording ให้เหมาะธุรกิจ):

A) **Google Business Profile Post** — ใช้แนวคิดนี้เป็นหลัก:
"จริงๆแล้วถ้าอยากให้ธุรกิจ Rank ดีขึ้น สิ่งที่ทำได้ง่ายเลยคือการโพส Google Business ครับ คู่แข่งส่วนใหญ่มองข้ามเรื่องนี้"
บอก action ชัด: โพสอะไร กี่ครั้ง/สัปดาห์ ใส่อะไรบ้าง

B) **NAP + Map Consistency** — ชื่อ เบอร์ ที่อยู่ตรงกับ Google Maps ช่วยดันอันดับได้ไว

C) **AI Search Optimization** — ตอนนี้คนเริ่มใช้ AI (ChatGPT, Gemini, Perplexity) ค้นหาแทน Google มากขึ้น

D) **Website Issues** — จากข้อมูลที่วิเคราะห์ได้:
${issues.length > 0 ? issues.map(i => '- ' + i).join('\\n') : 'วิเคราะห์จาก domain + bizType แล้วแนะนำเรื่อง mobile-first, page speed, CTA ที่ชัด'}
ห้ามยก SSL/HTTPS เป็นประเด็น!

E) **อีก 1-2 ข้อ** — เลือกจากประสบการณ์ที่ทำให้ลูกค้า WOW

⚠️ ห้ามแนะนำเรื่อง SSL/HTTPS! ห้ามแนะนำเรื่องพื้นฐานเกินไป!

${generateHotelSection(isHotel)}

**3. ${generateClosingSection(servicePage)}

${generateJsonInstruction(bizName, bizType)}`;
}

/**
 * Prompt NEUTRAL — สำหรับกรณีที่ไม่แน่ใจว่าธุรกิจมีเว็บหรือไม่
 * ห้ามพูดว่า "ไม่มีเว็บ" เด็ดขาด! (อาจมี แต่ระบบหาไม่เจอ — พูดผิด = look down ลูกค้า)
 * เน้น Digital Growth ทั่วไป ไม่อ้างอิงเว็บไซต์เลย
 */
function generateNeutralPrompt(bizName, bizType, domain, servicePage, isHotel) {
  return `คุณคือ ต้าร์ — Founder ของ VisionXBrain เขียน email ถึงเจ้าของ "${bizName}"

${SHARED_RULES}

=== สำคัญมาก: ห้ามพูดถึงเว็บไซต์ของลูกค้าเลย! ===
- ห้ามพูดว่า "เจอเว็บของคุณ" — เราไม่แน่ใจว่ามีเว็บหรือเปล่า!
- ห้ามพูดว่า "ไม่มีเว็บ" — อาจมีแต่เราหาไม่เจอ จะ look down ลูกค้า!
- ห้ามใส่ screenshot ใดๆ!
- Angle: เจอธุรกิจ${bizType}ของเขาตอน research ออนไลน์ เห็นว่าธุรกิจน่าสนใจ เลยเขียนคำแนะนำ Digital Growth มาให้

=== ข้อมูลธุรกิจ ===
- ชื่อ: ${bizName}
- ประเภท: ${bizType}

=== โครงสร้าง email (ทำตามนี้เท่านั้น) ===

**1. เปิดเรื่อง (2-3 บรรทัด):**
- "สวัสดีครับ ผมต้าร์ จาก บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด ครับ"
- บอกว่าเจอธุรกิจ${bizType}ของเขาตอน research ออนไลน์ เห็นว่าธุรกิจน่าสนใจมาก
- เลยตั้งใจเขียนคำแนะนำ Digital Growth เฉพาะสำหรับ ${bizName} มาครับ — ทำเองได้เลย ไม่ต้องจ้างใคร
- ห้ามใช้คำว่า "เผอิญเจอ" หรือ "บังเอิญเจอ" (ฟังเหมือน scam)
- ห้ามพูดถึง Google reviews / rating

**2. Action Plan — 5-6 ข้อที่ทำแล้วเปลี่ยนธุรกิจ:**
แต่ละข้อต้องมีโครงสร้าง HTML แบบนี้:
${ACTION_STEP_HTML}

ข้อที่ต้องมี (ปรับ wording ให้เหมาะธุรกิจ):

A) **Google Business Profile Post** — สิ่งแรกที่ทำได้ฟรี:
"ถ้าอยากให้ธุรกิจ Rank ดีขึ้น สิ่งที่ทำได้ง่ายเลยคือการโพส Google Business ครับ"
บอก action ชัด: โพสอะไร กี่ครั้ง/สัปดาห์

B) **NAP + Map Consistency** — ชื่อ เบอร์ ที่อยู่ใน Google Maps ต้องถูกต้อง 100%

C) **AI Search Optimization** — ตอนนี้คนเริ่มใช้ AI ค้นหาธุรกิจแทน Google มากขึ้น

D) **Digital Presence ที่แข็งแรง** — แนะนำวิธีเพิ่ม online presence ที่เหมาะกับ${bizType}
ไม่ต้องอ้างอิงเว็บ — เน้น overall strategy

E) **Social Media Strategy** — แนะนำ content strategy เฉพาะ${bizType}

F) **อีก 1 ข้อ** — เลือกจากประสบการณ์ที่ทำให้ลูกค้า WOW

${generateHotelSection(isHotel)}

**3. ${generateClosingSection(servicePage)}

${generateJsonInstruction(bizName, bizType)}`;
}

/**
 * Prompt สำหรับธุรกิจที่ไม่มีเว็บไซต์ — เน้น online presence + ทำเว็บ
 */
function generateNoWebsitePrompt(bizName, bizType, domain, servicePage, isHotel) {
  return `คุณคือ ต้าร์ — Founder ของ VisionXBrain เขียน email ถึงเจ้าของ "${bizName}"

${SHARED_RULES}

=== ข้อมูลธุรกิจ ===
- ชื่อ: ${bizName}
- ประเภท: ${bizType}
- เว็บ: ไม่มี (ธุรกิจนี้ยังไม่มีเว็บไซต์)

=== สำคัญมาก: ธุรกิจนี้ยืนยันแล้วว่าไม่มีเว็บไซต์ (เช็คจาก Google API + ลอง fetch แล้วไม่เจอ) ===
- ห้ามพูดว่า "เจอเว็บของคุณ" หรือ "ดูเว็บแล้ว" — เพราะไม่มีเว็บ!
- ห้ามใส่ screenshot เว็บ — เพราะไม่มีเว็บ!
- ห้ามวิเคราะห์ website issues — เพราะไม่มีเว็บ!
- Angle: เจอธุรกิจ${bizType}ของเขาตอน research ออนไลน์ เห็นว่าธุรกิจดีมาก แต่ยังไม่มี online presence ที่เต็มที่

=== โครงสร้าง email (ทำตามนี้เท่านั้น) ===

**1. เปิดเรื่อง (2-3 บรรทัด):**
- "สวัสดีครับ ผมต้าร์ จาก บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด ครับ"
- บอกว่าเจอธุรกิจ${bizType}ของเขาตอน research ออนไลน์ เห็นว่าธุรกิจน่าสนใจมาก
- ห้ามใช้คำว่า "เผอิญเจอ" หรือ "บังเอิญเจอ" (ฟังเหมือน scam) — ใช้ "ตอนผม research ธุรกิจ${bizType}" แทน
- เห็นว่าธุรกิจดี มี potential สูง แต่ตอนนี้ลูกค้าออนไลน์อาจหาไม่เจอง่ายๆ
- เลยตั้งใจเขียนคำแนะนำเฉพาะสำหรับ ${bizName} มาครับ — ทำเองได้เลย ไม่ต้องจ้างใคร
- ต้องให้รู้สึกว่า report นี้เขียนให้เฉพาะธุรกิจนี้ ไม่ใช่ template
- ห้ามพูดถึง Google reviews / rating (อาจไม่ตรง)

**2. Action Plan — 5-6 ข้อที่ทำแล้วเปลี่ยนธุรกิจ:**
แต่ละข้อต้องมีโครงสร้าง HTML แบบนี้:
${ACTION_STEP_HTML}

ข้อที่ต้องมี (ปรับ wording ให้เหมาะธุรกิจ):

A) **Google Business Profile Post** — สิ่งแรกที่ต้องทำ:
"ตอนนี้ยังไม่มีเว็บไซต์ Google Business Profile คือหน้าร้านออนไลน์ฟรีที่ดีที่สุดเลยครับ"
"โพสสม่ำเสมอ 2-3 ครั้ง/สัปดาห์ จะช่วยดันอันดับขึ้นเร็วมาก คู่แข่งส่วนใหญ่ไม่ทำเลยครับ"
บอก action ชัด: โพสอะไร กี่ครั้ง/สัปดาห์ ใส่อะไรบ้าง

B) **NAP + Map Consistency** — ชื่อ เบอร์ ที่อยู่ใน Google Maps ต้องถูกต้อง 100%
"ถึงไม่มีเว็บ แค่ทำให้ข้อมูลใน Google Maps ครบถูกต้อง ลูกค้าก็จะหาเจอง่ายขึ้นเยอะเลยครับ"

C) **ทำเว็บไซต์ — ทำไมสำคัญ:**
"ตอนนี้ลูกค้า 70-80% search ออนไลน์ก่อนตัดสินใจ ถ้าไม่มีเว็บ = เสียลูกค้าที่พร้อมจ่ายไป"
"เว็บไม่ต้องใหญ่ แค่ 5-8 หน้าก็พอ: หน้าแรก, บริการ, ผลงาน/รีวิว, ติดต่อเรา, แผนที่"
"เว็บที่ดีต้องทำงานแทนคุณ — ลูกค้าเข้ามาแล้วต้องรู้ทันทีว่าทำไมต้องเลือกคุณ"
แนะนำสิ่งที่ควรมีในเว็บ (เฉพาะเจาะจงสำหรับธุรกิจ${bizType})

D) **AI Search Optimization** — เรื่องที่กำลังมา:
"ตอนนี้คนเริ่มใช้ AI (ChatGPT, Gemini) ค้นหาธุรกิจแทน Google มากขึ้น"
"ธุรกิจที่มีเว็บ + เนื้อหาตอบคำถามชัด จะถูก AI แนะนำก่อน"
ถ้าไม่มีเว็บเลย AI จะไม่มีข้อมูลให้แนะนำ — เสียโอกาสฟรีๆ

E) **Social Media Strategy** — สำหรับธุรกิจที่ยังไม่มีเว็บ:
Social media เป็นช่องทางสำคัญมาก แนะนำ content strategy เฉพาะ${bizType}
แนะนำ platform ไหนเหมาะกับธุรกิจนี้ + ความถี่ในการโพส

F) **อีก 1 ข้อ** — เลือกจากประสบการณ์ที่ทำให้ลูกค้า WOW
เช่น Local SEO citation, LINE Official, Booking system, Online reviews strategy

⚠️ ห้ามพูดถึงเว็บที่ไม่มี! ห้ามแนะนำเรื่องพื้นฐานเกินไป!

${generateHotelSection(isHotel)}

**3. ปิดท้าย:**
- สรุปสั้น 2-3 บรรทัด ว่าถ้าทำตาม action plan นี้ ธุรกิจจะเปลี่ยนยังไง
- "โดยส่วนตัวผมเชี่ยวชาญด้าน Digital Marketing, SEO, AI Search และระบบ Automation ครับ ทำระบบ SEO + AI Search แบบ Auto ให้ลูกค้าอยู่แล้ว"
- "พอดีผมรับทำเซอร์วิสนี้ให้ลูกค้าอยู่แล้วครับ ลองดูบริการของผมได้ที่: ${servicePage}"
- "หากต้องการรับคำปรึกษาเพิ่มเติม โทรตรงหาผมก็ได้ครับ ปรึกษาฟรี 097-153-6565"
- "ไม่เป็นลูกค้าไม่เป็นไรครับ ผมเป็นครีเอทีฟบัดดี้เพื่อนคู่คิดอยู่แล้ว เห็นธุรกิจคุณน่าสนใจเลยลองส่งแนะนำครับ"
- "ถ้าอยากได้ report แบบละเอียดกว่านี้ กดปุ่มด้านล่างได้เลยครับ ฟรีครับ"
- ห้ามใส่ปุ่ม (จะใส่ให้ใน template)

${generateJsonInstruction(bizName, bizType)}`;
}

/**
 * Quick website verification — HEAD request เช็คว่าเว็บเปิดได้จริงไหม
 * ป้องกันไม่ให้บอกลูกค้าว่า "ไม่มีเว็บ" ทั้งที่จริงมี (look down ลูกค้า!)
 */
async function verifyWebsiteExists(url) {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    return res.ok || res.status === 403 || res.status === 405; // 403/405 = exists but blocks HEAD
  } catch {
    return false;
  }
}

/**
 * Validate screenshot — เช็คว่า thum.io ส่งภาพจริงกลับมาไหม
 * ป้องกัน broken image ใน email
 */
async function validateScreenshot(websiteUrl) {
  if (!websiteUrl) return false;
  const thumbUrl = `https://image.thum.io/get/width/600/${websiteUrl}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(thumbUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    const contentType = res.headers.get('content-type') || '';
    return res.ok && contentType.startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * Send full outreach email — 24 กฎ + VXB Template + Tracking + PDF
 * ใช้ได้ทั้ง auto-send ใน runDaily() และจากภายนอก
 * รองรับ 3 กรณี: มีเว็บ (verified) / ไม่มีเว็บ (confirmed) / ไม่แน่ใจ (neutral)
 */
async function sendFullOutreachEmail(lead) {
  const domain = lead.domain || '-';
  const rawName = lead.businessName || '';
  const isPlaceholder = !rawName || /ชื่อธุรกิจ|ใส่ชื่อ|ภาษาไทย ถ้า|English name/i.test(rawName);
  const bizName = isPlaceholder ? (lead.businessNameEn || lead.name || domain) : rawName;
  const bizType = lead.type || lead.industry || '';
  const issues = (lead.websiteIssues || []).filter(i => !/ssl|https/i.test(i));
  const servicePage = findRelevantServicePage(bizType);
  const isHotel = /hotel|resort|hostel|guesthouse|โรงแรม|ที่พัก/i.test(bizType);
  const websiteUrl = domain !== '-' ? 'https://' + domain : '';
  const to = lead.email;

  if (!to) {
    console.log(`[AUTO-EMAIL] Skip ${bizName} — no email`);
    return { success: false, error: 'no email' };
  }

  // Step 0: Website verification — ป้องกันบอกลูกค้าผิด
  let hasWebsite = websiteUrl && domain !== '-' && !/^info@/i.test(domain);
  let screenshotValid = false;

  if (hasWebsite) {
    // ยืนยันว่าเว็บเปิดได้จริง
    const webExists = await verifyWebsiteExists(websiteUrl);
    if (!webExists) {
      console.log(`[AUTO-EMAIL] ⚠️ ${bizName} domain ${domain} exists in DB but website not reachable — using NEUTRAL template`);
      hasWebsite = false; // fallback to neutral
      lead._websiteUnreachable = true;
    } else {
      // เว็บเปิดได้ → เช็ค screenshot
      screenshotValid = await validateScreenshot(websiteUrl);
      console.log(`[AUTO-EMAIL] Screenshot for ${domain}: ${screenshotValid ? '✅ valid' : '❌ invalid — will skip image'}`);
    }
  }

  // Determine template: WEBSITE / NO-WEBSITE / NEUTRAL (ไม่แน่ใจ)
  // NEUTRAL = มี domain ใน DB แต่เว็บเปิดไม่ได้ → ห้ามบอกว่า "ไม่มีเว็บ" เด็ดขาด!
  const useNeutral = !hasWebsite && lead._websiteUnreachable;

  console.log(`[AUTO-EMAIL] Generating email for ${bizName} (${to})... mode=${hasWebsite ? 'WEBSITE' : useNeutral ? 'NEUTRAL' : 'NO-WEBSITE'} screenshot=${screenshotValid}`);

  // Step 1: AI generates content — 3 prompt types
  let prompt;
  if (hasWebsite) {
    prompt = generateWebsitePrompt(bizName, bizType, domain, websiteUrl, issues, servicePage, isHotel, screenshotValid);
  } else if (useNeutral) {
    prompt = generateNeutralPrompt(bizName, bizType, domain, servicePage, isHotel);
  } else {
    prompt = generateNoWebsitePrompt(bizName, bizType, domain, servicePage, isHotel);
  }

  console.log(`[AUTO-EMAIL] Using ${hasWebsite ? 'WEBSITE' : useNeutral ? 'NEUTRAL' : 'NO-WEBSITE'} template for ${bizName}`);

  try {
    // Retry up to 2 times if AI fails to generate JSON
    let aiRes = null;
    let jsonMatch = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        aiRes = await chat(
          [{ role: 'user', content: prompt }],
          {
            system: 'คุณคือ ต้าร์ เจ้าของ VisionXBrain เขียน email เหมือนคนจริงที่อยากช่วยจริงๆ ไม่ใช่ AI ไม่ขาย เป็นผู้ให้ ห้ามใช้คำว่า "เผอิญเจอ" "บังเอิญเจอ" "เจอเว็บของคุณ" (ฟังเหมือน scam) ตอบเป็น JSON object เท่านั้น ห้ามครอบด้วย ```json ห้ามมีข้อความอื่นนอก JSON',
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8000,
            skipAutoRecall: true
          }
        );

        if (!aiRes || typeof aiRes !== 'string' || aiRes.trim().length === 0) {
          console.error(`[AUTO-EMAIL] Attempt ${attempt}/${maxRetries} — empty response for ${bizName}`);
          if (attempt < maxRetries) { await sleep(3000); continue; }
          return { success: false, error: 'AI returned empty response' };
        }

        // Strip markdown code block wrappers before JSON extraction
        let cleanedRes = aiRes.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        jsonMatch = cleanedRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) break; // Success

        console.error(`[AUTO-EMAIL] Attempt ${attempt}/${maxRetries} — no JSON in response for ${bizName}. Response (first 300 chars): ${aiRes.substring(0, 300)}`);
        if (attempt < maxRetries) await sleep(3000);
      } catch (chatErr) {
        console.error(`[AUTO-EMAIL] Attempt ${attempt}/${maxRetries} — chat error for ${bizName}: ${chatErr.message}`);
        if (attempt < maxRetries) await sleep(3000);
      }
    }

    if (!jsonMatch) {
      console.error(`[AUTO-EMAIL] All ${maxRetries} attempts failed for ${bizName}`);
      return { success: false, error: 'AI JSON parse failed after retries' };
    }

    const emailContent = JSON.parse(jsonMatch[0]);

    // Step 2: Strip emoji from subject (safety net)
    const subject = emailContent.subject
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
      .trim();

    // Step 3: Generate tracking IDs
    const trackingId = (lead.place_id || domain) + '_' + Date.now();
    const clickBase = 'https://oracle-agent-production-546e.up.railway.app/api/email/click/' + trackingId;
    const trackedServicePage = clickBase + '?url=' + encodeURIComponent(servicePage);
    const trackedVxbHome = clickBase + '?url=' + encodeURIComponent('https://www.visionxbrain.com');

    // Step 4: Wrap AI body in VXB branded template
    const body = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1b1c1b;line-height:1.8;background:#fff;padding:0 20px;">

  <div style="height:3px;background:linear-gradient(90deg,#eb3f43,#6e49f3);border-radius:2px;margin-bottom:28px;"></div>

  ${emailContent.body}

  <!-- Service Page Link -->
  <div style="background:#f8f7f5;border-radius:12px;padding:18px 24px;margin:24px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;color:#666;">บริการที่เกี่ยวข้องกับธุรกิจของคุณครับ:</p>
    <a href="${trackedServicePage}" style="color:#eb3f43;font-weight:bold;text-decoration:none;font-size:15px;">${servicePage.replace('https://', '')}</a>
  </div>

  <!-- CTA Button -->
  <div style="text-align:center;margin:32px 0;">
    <a href="mailto:info@visionxbrain.com?subject=ขอ Report เต็ม — ${bizName}" style="display:inline-block;background:linear-gradient(135deg,#eb3f43,#d63337);color:#fff;padding:16px 40px;border-radius:100px;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(235,63,67,0.3);">ขอ Report เต็มฟรี</a>
    <span style="display:inline-block;width:12px;"></span>
    <a href="tel:0971536565" style="display:inline-block;background:#fff;color:#eb3f43;padding:16px 40px;border-radius:100px;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:0.3px;border:2px solid #eb3f43;">โทรปรึกษาฟรี</a>
    <p style="color:#999;font-size:13px;margin-top:10px;">หรือตอบกลับ email นี้ได้เลยครับ ไม่มีข้อผูกมัดใดๆ</p>
  </div>

  <!-- Signature -->
  <table style="margin-top:36px;border-top:1px solid #eee;padding-top:20px;width:100%;">
    <tr>
      <td style="padding-right:16px;vertical-align:top;">
        <div style="width:4px;height:52px;background:linear-gradient(180deg,#eb3f43,#6e49f3);border-radius:2px;"></div>
      </td>
      <td style="font-size:13px;color:#666;line-height:1.7;">
        <strong style="color:#1b1c1b;font-size:15px;">Tanakit Chaithip (ต้าร์)</strong><br>
        Founder & Creative Director — <span style="color:#eb3f43;font-weight:bold;">บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด</span><br>
        80+ ลูกค้า 6 ประเทศ | Clutch 5.0 | ทะเบียน: 0585564000175<br>
        <span style="font-size:14px;"><a href="tel:0971536565" style="color:#1b1c1b;text-decoration:none;font-weight:bold;">097-153-6565</a> — โทรปรึกษาฟรีครับ</span><br>
        <a href="${trackedVxbHome}" style="color:#eb3f43;text-decoration:none;">www.visionxbrain.com</a>
      </td>
    </tr>
  </table>

  <!-- Tracking Pixel -->
  <img src="https://oracle-agent-production-546e.up.railway.app/api/email/track/${trackingId}.png" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" alt="">

</div>`;

    // Step 5: Attach cached PDF (โหลดครั้งเดียวตอน startup — ทุก email ต้องมี!)
    const attachments = [];
    if (PDF_BUFFER) {
      attachments.push({
        filename: PDF_FILENAME,
        content: PDF_BUFFER,
        mimeType: 'application/pdf'
      });
    } else {
      console.log(`[AUTO-EMAIL] ⚠️ PDF not available for ${bizName}`);
    }

    // Step 6: Send via Gmail
    const result = await gmail.send({
      to,
      subject,
      body,
      attachments: attachments.length ? attachments : undefined
    });

    console.log(`[AUTO-EMAIL] ✅ Sent to ${to}: ${subject}`);

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
      sentAt: new Date().toISOString(),
      trackingId,
      subject,
      bizName
    };
  } catch (error) {
    console.error(`[AUTO-EMAIL] ❌ Failed for ${bizName} (${to}):`, error.message);
    return { success: false, error: error.message };
  }
}

// Keep legacy function names for backward compatibility
async function generateAuditEmail(lead) {
  // Redirects to full pipeline — returns { subject, body } format for follow-up compatibility
  const result = await sendFullOutreachEmail(lead);
  if (result.success) return { subject: result.subject, body: '(sent via full pipeline)' };
  return null;
}

async function sendOutreachEmail(lead, emailContent) {
  // Legacy: for follow-up emails only (simple send without full template)
  try {
    const result = await gmail.send({
      to: lead.email,
      subject: emailContent.subject,
      body: emailContent.body
    });
    console.log(`[LEAD-FINDER] Email sent to ${lead.email}: ${emailContent.subject}`);
    return { success: true, messageId: result.id, threadId: result.threadId, sentAt: new Date().toISOString() };
  } catch (error) {
    console.error(`[LEAD-FINDER] Failed to send email to ${lead.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send follow-up email
 */
async function sendFollowUp(lead, followUpNumber) {
  const prompt = `เขียน follow-up email #${followUpNumber} สำหรับธุรกิจ "${lead.businessName}"
เราเคยส่ง email เสนอ audit เว็บฟรีไปแล้วเมื่อ ${followUpNumber === 1 ? '3 วันก่อน' : '7 วันก่อน'}

เขียนสั้นๆ 2-3 ประโยค:
- ถามว่าเห็น email ก่อนหน้าไหม
- ย้ำว่า audit ฟรี ไม่มีข้อผูกมัด
- ${followUpNumber === 2 ? 'บอกว่านี่เป็น email สุดท้ายที่จะส่ง' : ''}

ตอบ JSON: { "subject": "...", "body": "..." }`;

  try {
    const response = await chat(
      [{ role: 'user', content: prompt }],
      { system: 'เขียน follow-up email สั้นๆ ภาษาไทย ตอบ JSON เท่านั้น', model: 'claude-haiku-4-5-20251001', max_tokens: 500, skipAutoRecall: true }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const emailContent = JSON.parse(jsonMatch[0]);
      return sendOutreachEmail(lead, emailContent);
    }
  } catch (error) {
    console.error(`[LEAD-FINDER] Follow-up failed:`, error.message);
  }

  return { success: false };
}

// ============================================================
// Reply Monitoring
// ============================================================

/**
 * Check for replies to outreach emails
 */
async function checkReplies() {
  const leadsData = loadLeads();
  const sentLeads = leadsData.leads.filter(l => l.status === 'emailed' || l.status === 'followed_up');

  if (sentLeads.length === 0) return [];

  const replies = [];

  try {
    for (const lead of sentLeads) {
      if (!lead.email) continue;

      // ค้นด้วย email เต็ม ไม่ใช่แค่ domain (ป้องกัน false positive จาก gmail.com/hotmail.com)
      const searchResults = await gmail.search(`from:${lead.email} newer_than:7d`, 5);

      if (searchResults && searchResults.length > 0) {
        lead.status = 'replied';
        lead.repliedAt = new Date().toISOString();
        replies.push(lead);

        await telegram.notifyOwner(`[LEAD-FINDER] ตอบกลับแล้ว!

ธุรกิจ: ${lead.businessName}
Industry: ${lead.industry}
Email: ${lead.email}
Domain: ${lead.domain}

เข้าไปอ่านใน Gmail เลย`);
        console.log(`[LEAD-FINDER] Reply detected from ${lead.email}`);
      }
    }

    if (replies.length > 0) {
      saveLeads(leadsData);
    }

    // Bounce detection — check for mailer-daemon / delivery failure
    try {
      const bounces = await gmail.search('from:mailer-daemon@googlemail.com newer_than:3d', 20);
      if (bounces && bounces.length > 0) {
        for (const bounce of bounces) {
          try {
            const msg = await gmail.getMessage(bounce.id);
            const body = msg?.snippet || msg?.payload?.body?.data || '';
            // Extract bounced email from the snippet
            const emailMatch = body.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              const bouncedEmail = emailMatch[1].toLowerCase();
              // Skip our own email
              if (bouncedEmail.includes('visionxbrain') || bouncedEmail.includes('googlemail')) continue;
              addToBounceBlacklist(bouncedEmail);
              // Mark the lead as bounced
              const bouncedLead = leadsData.leads.find(l => l.email?.toLowerCase() === bouncedEmail);
              if (bouncedLead) {
                bouncedLead.status = 'bounced';
                bouncedLead.bouncedAt = new Date().toISOString();
                console.log(`[BOUNCE] Marked ${bouncedLead.businessName} as bounced (${bouncedEmail})`);
              }
            }
          } catch (bounceErr) {
            // ignore individual bounce parse errors
          }
        }
        saveLeads(leadsData);
      }
    } catch (bounceErr) {
      console.error(`[BOUNCE] Bounce check error:`, bounceErr.message);
    }

  } catch (error) {
    console.error(`[LEAD-FINDER] Reply check error:`, error.message);
  }

  return replies;
}

// ============================================================
// Google Sheets Integration
// ============================================================

async function getOrCreateSheet() {
  // Check if sheet ID exists
  try {
    if (fs.existsSync(SHEET_ID_FILE)) {
      SHEET_ID = fs.readFileSync(SHEET_ID_FILE, 'utf-8').trim();
      return SHEET_ID;
    }
  } catch {}

  // Create new sheet
  try {
    const result = await sheets.createSpreadsheet(
      'VXB Lead Finder — Auto Leads',
      ['Leads', 'Sent Emails', 'Stats']
    );

    SHEET_ID = result.spreadsheetId;
    fs.writeFileSync(SHEET_ID_FILE, SHEET_ID);

    // Add headers
    await sheets.updateValues(SHEET_ID, 'Leads!A1:L1', [[
      'Date', 'Business Name', 'Industry', 'Domain', 'Email', 'Phone',
      'LINE', 'Website Score', 'Issues', 'Status', 'Sent At', 'Replied At'
    ]]);

    await sheets.updateValues(SHEET_ID, 'Sent Emails!A1:F1', [[
      'Date', 'To', 'Subject', 'Status', 'Thread ID', 'Follow-up #'
    ]]);

    console.log(`[LEAD-FINDER] Created Google Sheet: ${SHEET_ID}`);
    return SHEET_ID;

  } catch (error) {
    console.error(`[LEAD-FINDER] Failed to create sheet:`, error.message);
    return null;
  }
}

async function saveLeadToSheet(lead) {
  const sheetId = await getOrCreateSheet();
  if (!sheetId) return;

  try {
    await sheets.appendRow(sheetId, 'Leads', [
      new Date().toISOString(),
      lead.businessName || '',
      lead.industry || '',
      lead.domain || '',
      lead.email || '',
      (lead.phones || []).join(', '),
      lead.lineId || '',
      lead.websiteScore || '',
      (lead.websiteIssues || []).join('; '),
      lead.status || 'new',
      lead.emailSentAt || '',
      lead.repliedAt || ''
    ]);
  } catch (error) {
    console.error(`[LEAD-FINDER] Failed to save to sheet:`, error.message);
  }
}

// ============================================================
// Follow-up Scheduler
// ============================================================

async function processFollowUps() {
  const leadsData = loadLeads();
  const targets = loadTargets();
  const followUpDays = targets.emailTemplate?.followUpDays || [3, 7];
  const now = Date.now();
  let followUpsSent = 0;

  for (const lead of leadsData.leads) {
    if (lead.status === 'replied' || lead.status === 'closed') continue;
    if (!lead.emailSentAt) continue;

    const sentTime = new Date(lead.emailSentAt).getTime();
    const daysSinceSent = (now - sentTime) / (1000 * 60 * 60 * 24);

    // Check each follow-up day
    for (let i = 0; i < followUpDays.length; i++) {
      const followUpDay = followUpDays[i];
      const followUpNumber = i + 1;

      if (daysSinceSent >= followUpDay && (!lead.followUps || lead.followUps < followUpNumber)) {
        console.log(`[LEAD-FINDER] Sending follow-up #${followUpNumber} to ${lead.email}`);

        const result = await sendFollowUp(lead, followUpNumber);
        if (result.success) {
          lead.followUps = followUpNumber;
          lead.status = 'followed_up';
          lead.lastFollowUpAt = new Date().toISOString();
          followUpsSent++;
        }

        // Delay between emails
        await sleep(5000);
      }
    }
  }

  if (followUpsSent > 0) {
    saveLeads(leadsData);
    console.log(`[LEAD-FINDER] Sent ${followUpsSent} follow-up emails`);
  }

  return followUpsSent;
}

// ============================================================
// Main Orchestration
// ============================================================

/**
 * Run the daily lead generation process
 */
async function runDaily() {
  console.log(`\n[LEAD-FINDER] ========== Daily Run: ${new Date().toLocaleString('th-TH')} ==========`);

  const targets = loadTargets();
  const leadsData = loadLeads();
  const settings = targets.settings || {};
  const maxLeads = settings.maxLeadsPerDay || 20;
  const maxEmails = settings.maxEmailsPerDay || 5;
  const searchesPerRun = settings.searchesPerRun || 2;
  const delay = settings.delayBetweenFetchMs || 3000;

  let newLeads = 0;
  let emailsSent = 0;
  let followUps = 0;
  let replies = [];

  try {
    // Step 1: Process manual domains first
    if (targets.manualDomains && targets.manualDomains.length > 0) {
      console.log(`[LEAD-FINDER] Processing ${targets.manualDomains.length} manual domains...`);

      for (const entry of targets.manualDomains) {
        try {
          const domain = typeof entry === 'string' ? entry : entry.domain;
          const industry = typeof entry === 'string' ? 'ไม่ระบุ' : entry.industry;

          if (isDomainProcessed(domain, leadsData)) continue;
          if (newLeads >= maxLeads) break;

          const url = domain.startsWith('http') ? domain : `https://${domain}`;
          const lead = await processOneDomain(url, domain, industry, leadsData);

          if (lead) {
            newLeads++;
            await sleep(delay);
          }
        } catch (domainErr) {
          console.error(`[LEAD-FINDER] Error processing manual domain:`, domainErr.message);
        }
      }
    }

    // Step 2: Search via Local Rank Tracker (RapidAPI)
    const searches = targets.searches || [];
    const shuffled = [...searches].sort(() => Math.random() - 0.5);
    const todaysSearches = shuffled.slice(0, searchesPerRun);

    for (const search of todaysSearches) {
      if (newLeads >= maxLeads) break;

      try {
        // Resolve location for this search query
        const locations = targets.locations || {};
        const cityLoc = search.city ? locations[search.city] : null;
        const locOverride = cityLoc ? { ...cityLoc, city: search.city } : null;
        const places = await searchGoogle(search.query, 10, locOverride);
        await sleep(2000);

        for (const place of places) {
          // Skip already-processed places by place_id
          if (leadsData.processedDomains.includes(place.place_id)) continue;
          if (newLeads >= maxLeads) break;

          try {
            const lead = await processOnePlace(place, search.industry, leadsData);

            if (lead) {
              newLeads++;
              await sleep(delay);
            }
          } catch (placeErr) {
            console.error(`[LEAD-FINDER] Error processing place ${place.name}:`, placeErr.message);
          }
        }
      } catch (searchErr) {
        console.error(`[LEAD-FINDER] Error searching "${search.query}":`, searchErr.message);
      }
    }

    // Step 3: Send outreach emails — SCORED & FILTERED (ส่งตัวดีที่สุดก่อน)
    try {
      // Score all new leads (save score to actual lead object)
      const sentDomains = new Set(leadsData.leads.filter(l => l.status !== 'new').map(l => l.domain).filter(Boolean));
      for (const l of leadsData.leads) {
        if (!l.priorityScore) l.priorityScore = calculateLeadScore(l);
      }
      const unsent = leadsData.leads
        .filter(l => l.status === 'new' && l.isGoodTarget && l.email && !isEmailBlacklisted(l.email))
        .filter(l => !l.domain || !sentDomains.has(l.domain)) // skip ถ้าส่งไป domain เดียวกันแล้ว
        .filter(l => !l.domain || !BAD_DOMAINS.some(bad => l.domain === bad || l.domain.endsWith('.' + bad))) // skip chains/gov
        .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)); // ดีสุดขึ้นก่อน
      console.log(`[LEAD-FINDER] ${unsent.length} leads ready (scored, best-first, max ${maxEmails}/day)${unsent.length > 0 ? ` — Top: ${unsent[0].businessName} (score:${unsent[0].priorityScore})` : ''}`);

      for (const lead of unsent) {
        if (emailsSent >= maxEmails) {
          console.log(`[LEAD-FINDER] Daily email limit reached (${maxEmails})`);
          break;
        }

        // MX validation — เช็คว่า domain รับ email ได้จริงก่อนเสียเงิน AI generate
        const mxValid = await validateEmailMX(lead.email);
        if (!mxValid) {
          console.log(`[LEAD-FINDER] ⛔ Skip ${lead.businessName} — email ${lead.email} failed MX validation`);
          lead.emailValidation = 'mx_failed';
          saveLeads(leadsData);
          continue; // ข้ามไปตัวถัดไป ไม่เสียเงิน AI
        }
        lead.emailValidation = 'mx_passed';

        try {
          const result = await sendFullOutreachEmail(lead);
          if (result.success) {
            lead.status = 'emailed';
            lead.emailSentAt = result.sentAt;
            lead.threadId = result.threadId;
            lead.emailTrackingId = result.trackingId;
            lead.emailSentTo = lead.email;
            emailsSent++;
            saveLeads(leadsData); // Save after each successful email
            console.log(`[LEAD-FINDER] ✅ ${emailsSent}/${maxEmails} — ${result.bizName} → ${lead.email}`);
          }
        } catch (emailErr) {
          console.error(`[LEAD-FINDER] Error sending email to ${lead.email}:`, emailErr.message);
        }

        // Delay between emails (8 นาที — ดูเป็นธรรมชาติ ไม่ถูก flag spam)
        if (emailsSent < maxEmails && unsent.indexOf(lead) < unsent.length - 1) {
          await sleep(8 * 60 * 1000);
        }
      }
    } catch (emailStepErr) {
      console.error(`[LEAD-FINDER] Email step error:`, emailStepErr.message);
    }

    // Step 4: Process follow-ups — ✅ ENABLED
    try {
      followUps = await processFollowUps();
    } catch (followUpErr) {
      console.error(`[LEAD-FINDER] Follow-up error:`, followUpErr.message);
    }

    // Step 5: Check for replies
    try {
      replies = await checkReplies();
    } catch (replyErr) {
      console.error(`[LEAD-FINDER] Reply check error:`, replyErr.message);
    }

  } finally {
    // ALWAYS save lastRun — even if steps above failed
    leadsData.lastRun = new Date().toISOString();
    saveLeads(leadsData);
    console.log(`[LEAD-FINDER] lastRun saved: ${leadsData.lastRun}`);
  }

  // Step 7: Send summary notification
  const summary = `[Lead Finder] สรุปวันนี้

Leads ใหม่: ${newLeads}
Emails ส่ง: ${emailsSent}
Follow-ups: ${followUps}
มีคนตอบ: ${replies.length}

Leads ทั้งหมด: ${leadsData.leads.length}
รอส่ง email: ${leadsData.leads.filter(l => l.status === 'new' && l.isGoodTarget && l.email).length}
รอตอบกลับ: ${leadsData.leads.filter(l => l.status === 'emailed' || l.status === 'followed_up').length}`;

  try {
    if (newLeads > 0 || emailsSent > 0 || replies.length > 0) {
      await telegram.notifyOwner(summary);
    }
  } catch (notifyErr) {
    console.error(`[LEAD-FINDER] Notification error:`, notifyErr.message);
  }

  console.log(`[LEAD-FINDER] Done! New: ${newLeads}, Sent: ${emailsSent}, Follow-ups: ${followUps}, Replies: ${replies.length}`);

  return { newLeads, emailsSent, followUps, replies: replies.length };
}

/**
 * Process a single place — get details via API, then analyze website if exists
 */
async function processOnePlace(place, industry, leadsData) {
  console.log(`[LEAD-FINDER] Processing place: ${place.name}`);

  // Mark as processed by place_id
  leadsData.processedDomains.push(place.place_id);

  // Step 1: Get full business details from Local Business Data API
  const details = await getPlaceDetails(place.place_id);
  await sleep(1000); // Rate limit

  const website = details?.website || null;
  const domain = website ? extractDomain(website) : (details?.tld || null);

  // Skip if domain is in exclude list
  if (domain) {
    const targets = loadTargets();
    const excludeDomains = targets.excludeDomains || [];
    if (excludeDomains.some(ex => domain.includes(ex))) {
      console.log(`[LEAD-FINDER] [SKIP] ${place.name} — excluded domain: ${domain}`);
      return null;
    }
  }

  // Step 2: If has website, fetch it
  let fetchResult = null;
  let analysis = null;

  if (website) {
    fetchResult = await fetchWebsite(website);
  }

  // Step 2.5: Local analysis — NO AI, pure regex + heuristic ($0 cost)
  if (fetchResult) {
    analysis = analyzeWebsiteLocal(domain, fetchResult, industry, place.name, details);
    console.log(`[LEAD-FINDER] [LOCAL-ANALYZE] ${place.name} — score: ${analysis.websiteScore}/10, issues: ${analysis.websiteIssues.length}`);
  }

  // Step 3: Merge API data + local analysis into lead record
  const apiEmails = details?.emails || [];
  const localEmails = analysis?.emails || [];
  const allEmails = [...new Set([...apiEmails, ...localEmails])];

  // NO MORE info@ fallback — only use real emails found from API/website
  // info@ emails bounce 80%+ → wastes AI credits + hurts sender reputation
  if (allEmails.length === 0) {
    console.log(`[LEAD-FINDER] No real email found for ${domain} — skipping (no fallback)`);
  }

  const apiPhones = details?.phones || [];
  const localPhones = analysis?.phones || [];
  const allPhones = [...new Set([...apiPhones, ...localPhones])];

  const hasContact = allEmails.length > 0 || allPhones.length > 0;
  const noWebsite = !website;

  const lead = {
    place_id: place.place_id,
    domain: domain || null,
    url: website || null,
    industry,
    businessName: analysis?.businessName || place.name,
    businessNameEn: analysis?.businessNameEn || '',
    emails: allEmails,
    email: allEmails[0] || null,
    phones: allPhones,
    phone: details?.phone || allPhones[0] || null,
    lineId: details?.line || analysis?.lineId || fetchResult?.lineId || null,
    facebook: details?.facebook || analysis?.facebook || null,
    instagram: details?.instagram || null,
    address: details?.fullAddress || place.address || analysis?.address || null,
    googleMapsLink: place.place_link || null,
    rating: details?.rating || null,
    reviewCount: details?.reviewCount || 0,
    type: details?.type || null,
    verified: details?.verified || false,
    websiteScore: analysis?.websiteScore || (website ? 5 : 0),
    websiteIssues: analysis?.websiteIssues || (noWebsite ? ['ไม่มีเว็บไซต์'] : []),
    isGoodTarget: noWebsite ? hasContact : (hasContact && (analysis?.isGoodTarget !== false || allEmails.length > 0)),
    reason: analysis?.reason || (noWebsite ? (hasContact ? 'ไม่มีเว็บไซต์ — ต้องการเว็บใหม่' : 'ไม่มีเว็บ+ไม่มีช่องทางติดต่อ') : (hasContact ? 'มี email — ส่ง outreach ได้' : 'ไม่มีช่องทางติดต่อ')),
    status: 'new',
    foundAt: new Date().toISOString(),
    followUps: 0
  };

  lead.priorityScore = calculateLeadScore(lead);

  leadsData.leads.push(lead);
  saveLeads(leadsData);
  await saveLeadToSheet(lead);

  const targetTag = lead.isGoodTarget ? 'TARGET' : 'SKIP';
  console.log(`[LEAD-FINDER] [${targetTag}] ${lead.businessName} (${lead.domain || 'no-website'}) — WebScore: ${lead.websiteScore}/10, Priority: ${lead.priorityScore}/100, Email: ${lead.email || 'none'}, Rating: ${lead.rating || '-'}`);

  return lead;
}

/**
 * Process a single domain — fetch, analyze, save (legacy, for manual domains)
 */
async function processOneDomain(url, domain, industry, leadsData) {
  console.log(`[LEAD-FINDER] Processing domain: ${domain}`);
  leadsData.processedDomains.push(domain);

  const fetchResult = await fetchWebsite(url);
  if (!fetchResult) {
    console.log(`[LEAD-FINDER] Could not fetch ${domain}`);
    return null;
  }

  const analysis = analyzeWebsiteLocal(domain, fetchResult, industry, domain, null);

  const lead = {
    domain,
    url: fetchResult.finalUrl || url,
    industry,
    businessName: analysis.businessName || domain,
    businessNameEn: analysis.businessNameEn || '',
    emails: analysis.emails || [],
    email: (analysis.emails || [])[0] || null,
    phones: analysis.phones || [],
    lineId: analysis.lineId || null,
    facebook: analysis.facebook || null,
    address: analysis.address || null,
    websiteScore: analysis.websiteScore || 0,
    websiteIssues: analysis.websiteIssues || [],
    isGoodTarget: analysis.isGoodTarget || false,
    reason: analysis.reason || '',
    status: 'new',
    foundAt: new Date().toISOString(),
    followUps: 0
  };

  lead.priorityScore = calculateLeadScore(lead);

  leadsData.leads.push(lead);
  saveLeads(leadsData);
  await saveLeadToSheet(lead);

  const tag = lead.isGoodTarget ? 'TARGET' : 'SKIP';
  console.log(`[LEAD-FINDER] [${tag}] ${lead.businessName} (${domain}) — WebScore: ${lead.websiteScore}/10, Priority: ${lead.priorityScore}/100`);
  return lead;
}

// ============================================================
// Manual Operations
// ============================================================

/**
 * Add a domain manually for processing
 */
function addManualDomain(domain, industry = 'ไม่ระบุ') {
  const targets = loadTargets();
  if (!targets.manualDomains) targets.manualDomains = [];

  targets.manualDomains.push({ domain, industry });
  fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2));

  console.log(`[LEAD-FINDER] Added manual domain: ${domain} (${industry})`);
}

/**
 * Get stats about lead pipeline
 */
function getStats() {
  const leadsData = loadLeads();
  const leads = leadsData.leads;

  return {
    total: leads.length,
    goodTargets: leads.filter(l => l.isGoodTarget).length,
    new: leads.filter(l => l.status === 'new').length,
    emailed: leads.filter(l => l.status === 'emailed').length,
    followedUp: leads.filter(l => l.status === 'followed_up').length,
    replied: leads.filter(l => l.status === 'replied').length,
    closed: leads.filter(l => l.status === 'closed').length,
    processedDomains: leadsData.processedDomains.length,
    lastRun: leadsData.lastRun
  };
}

/**
 * Get all leads with optional filter
 */
function getLeads(filter = {}) {
  const leadsData = loadLeads();
  let leads = leadsData.leads;

  if (filter.status) {
    leads = leads.filter(l => l.status === filter.status);
  }
  if (filter.isGoodTarget !== undefined) {
    leads = leads.filter(l => l.isGoodTarget === filter.isGoodTarget);
  }
  if (filter.industry) {
    leads = leads.filter(l => l.industry === filter.industry);
  }

  return leads;
}

// ============================================================
// Utility
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Enrichment Engine v2 — Multi-strategy website + email extraction
// Strategies: Domain Guess → DDG Multi-Query → Facebook → Deep Scrape
// ============================================================

const EXCLUDE_DOMAINS = [
  'facebook.com','instagram.com','youtube.com','twitter.com','x.com','tiktok.com',
  'line.me','linkedin.com','google.com','pinterest.com','foursquare.com','apple.com',
  'yelp.com','tripadvisor.com','wongnai.com','pantip.com','wikipedia.org','thaibiz.net',
  'findglocal.com','cybo.com','ameblo.jp','peteco.co.th','yellowpages.co.th',
  'thairath.co.th','sanook.com','kapook.com','mthai.com','manager.co.th',
  'trustpilot.com','glassdoor.com','indeed.com','jobsdb.com','jobthai.com',
  'cleverthai.com','expedia.com','agoda.com','booking.com','hotels.com',
  'grab.com','foodpanda.com','shopee.co.th','lazada.co.th','amazon.com',
  'mapquest.com','hotfrog.co.th','bizify.co.th','businesslist.co.th',
  'thailandyp.com','tuugo.co.th','kompass.com',
  'bbb.org','manta.com','crunchbase.com','zoominfo.com',
  'bridestory.com','weddingplanner.co.th','weddingwire.com',
];

const STOP_WORDS = new Set([
  'the','a','an','and','or','of','in','at','by','for','on','to','is','its',
  'bangkok','thailand','bkk','spa','salon','shop','center','centre','studio',
  'clinic','hotel','pet','boutique','grooming','wedding','event','events',
  'party','planner','organizer','organizers','home','care','service','services',
  'office','skin','beauty','cosmetic','surgery','dermatology','medical',
  'photography','photo','design','creative','digital','house','machine',
  'nature','theme','standard','moment','love','forever','peak','bachelor',
]);

const JUNK_EMAIL_PARTS = [
  'example.','example@','test@','noreply','no-reply','donotreply','domain.com',
  'wordpress','schema.org','sentry','wixpress','.png','.jpg','.svg',
  'cloudflare','w3.org','googleapis','gstatic','jquery','bootstrap','fontawesome',
  'facebook.com','fbcdn','instagram','google.com','hotjar','intercom','mailchimp',
  'crisp.chat','zendesk','tawk.to','livechat','placeholder','yourname@','user@',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function isDomainOwnedByBusiness(domain, businessName) {
  const d = domain.toLowerCase().replace('www.', '').replace(/\.(com|co\.th|th|net|org|in\.th|ac\.th)$/, '');
  const words = businessName.toLowerCase()
    .replace(/[^a-z0-9\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return words.some(w => d.includes(w));
}

// --- Strategy 1: Domain Guessing ---

async function guessBusinessDomain(businessName) {
  const cleanName = businessName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = cleanName.split(/\s+/).filter(w => w.length > 1).map(w => w.toLowerCase());
  const meaningful = words.filter(w => !STOP_WORDS.has(w));
  // Need at least 1 meaningful word with 6+ chars (brand name) OR 2+ meaningful words
  if (meaningful.length === 0) return null;
  if (meaningful.length === 1 && meaningful[0].length < 6) return null;

  const candidates = new Set();
  const joined = meaningful.join('');
  const joinedHyphen = meaningful.join('-');

  if (joined.length >= 3) {
    candidates.add(`${joined}.com`);
    candidates.add(`${joined}.co.th`);
  }
  if (joinedHyphen !== joined && joinedHyphen.length >= 3) {
    candidates.add(`${joinedHyphen}.com`);
  }
  // Try first 2 meaningful words
  if (meaningful.length >= 2) {
    const first2 = meaningful.slice(0, 2).join('');
    if (first2.length >= 4 && first2 !== joined) {
      candidates.add(`${first2}.com`);
      candidates.add(`${first2}.co.th`);
    }
  }
  // Try all words including stop words (for brands like "theeventtales")
  const allJoined = words.join('');
  if (allJoined !== joined && allJoined.length >= 4) {
    candidates.add(`${allJoined}.com`);
  }

  for (const domain of candidates) {
    try {
      const resp = await fetch(`https://${domain}`, {
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
        headers: { 'User-Agent': UA },
      });
      if (!resp.ok && resp.status !== 301 && resp.status !== 302) continue;
      // Verify: page content must mention the business name
      const html = await resp.text();
      const lower = html.toLowerCase();
      const nameWords = meaningful.filter(w => w.length >= 4);
      const matches = nameWords.filter(w => lower.includes(w));
      if (matches.length === 0) {
        console.log(`[ENRICH] Domain guess ${domain} exists but doesn't match "${businessName}" — skip`);
        continue;
      }
      console.log(`[ENRICH] Domain guess VERIFIED: ${domain} (matched: ${matches.join(',')})`);
      return `https://${domain}`;
    } catch {}
  }
  return null;
}

// --- Strategy 2: DuckDuckGo Multi-Query Search ---

function extractUrlsFromDDG(html) {
  const urls = [];
  const uddgPattern = /uddg=([^&"]+)/g;
  let match;
  while ((match = uddgPattern.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith('http') && !urls.includes(decoded)) urls.push(decoded);
    } catch {}
  }
  return urls;
}

function filterAndRankUrls(urls, businessName) {
  const cleanName = businessName.replace(/[^a-zA-Z0-9\s]/gi, '').trim();
  const filtered = urls.filter(u => {
    try {
      const hostname = new URL(u).hostname.replace('www.', '');
      return !EXCLUDE_DOMAINS.some(sd => hostname.includes(sd));
    } catch { return false; }
  });

  const owned = filtered.find(u => isDomainOwnedByBusiness(new URL(u).hostname, cleanName));
  if (owned) return owned;

  const rootPage = filtered.find(u => {
    const p = new URL(u).pathname;
    return p === '/' || p === '' || p.split('/').filter(Boolean).length <= 1;
  });
  return rootPage || null;
}

async function searchDDG(query, businessName) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': UA },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const urls = extractUrlsFromDDG(html);
    return filterAndRankUrls(urls, businessName || query);
  } catch { return null; }
}

async function findWebsiteViaDDG(businessName, city = 'Bangkok') {
  // Extract English part
  const cleanEn = businessName.replace(/[\u0E00-\u0E7F•🐩🏠\uD800-\uDBFF\uDC00-\uDFFF]/g, '').trim();
  // Extract Thai part
  const cleanTh = businessName.replace(/[^\u0E00-\u0E7F\s]/g, '').trim();

  const queries = [];
  if (cleanEn.length >= 3) {
    queries.push(`${cleanEn} ${city}`);
    queries.push(`${cleanEn} official website`);
    queries.push(`${cleanEn} contact email`);
  }
  if (cleanTh.length >= 3) {
    queries.push(`${cleanTh} เว็บไซต์`);
    queries.push(`${cleanTh} ติดต่อ`);
  }

  for (const q of queries) {
    const result = await searchDDG(q, businessName);
    if (result) {
      console.log(`[ENRICH] DDG "${q}" → ${result}`);
      return result;
    }
    await sleep(2000);
  }
  return null;
}

// --- Strategy 3: Facebook Email Extraction ---

async function getEmailFromFacebook(businessName, city = 'Bangkok') {
  try {
    const cleanName = businessName.replace(/[•🐩🏠\uD800-\uDBFF\uDC00-\uDFFF]/g, '').trim();
    const query = `${cleanName} ${city} site:facebook.com`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': UA },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const urls = extractUrlsFromDDG(html);

    const fbUrl = urls.find(u => u.includes('facebook.com') && !u.includes('/search') && !u.includes('/groups') && !u.includes('/marketplace'));
    if (!fbUrl) return null;

    // Fetch Facebook page — email sometimes in meta tags or visible HTML
    const fbResp = await fetch(fbUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    if (!fbResp.ok) return null;
    const fbHtml = await fbResp.text();

    const emails = new Set();
    let phone = null;
    let match;
    const decoded = fbHtml.replace(/&#64;/g, '@').replace(/&#46;/g, '.').replace(/\\u0040/g, '@');
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    while ((match = emailRegex.exec(decoded)) !== null) {
      const email = match[0].toLowerCase();
      if (!email.includes('facebook.com') && !email.includes('fbcdn') &&
          !JUNK_EMAIL_PARTS.some(j => email.includes(j)) && email.length < 60) {
        emails.add(email);
      }
    }

    // Thai phone pattern
    const phoneMatch = decoded.match(/(?:0[689]\d)[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) phone = phoneMatch[0];

    if (emails.size > 0 || phone) {
      console.log(`[ENRICH] Facebook "${cleanName}" → emails: [${[...emails]}] phone: ${phone}`);
    }
    return { emails: [...emails], phone, fbUrl };
  } catch { return null; }
}

// --- Strategy 4: Deep Website Contact Scraping ---

function extractContactFromHtml(html, emailSet, phoneSetter) {
  let match;

  // 1. JSON-LD structured data
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const ld = JSON.parse(match[1]);
      const items = Array.isArray(ld) ? ld : [ld];
      for (const item of items) {
        if (item.email) emailSet.add(item.email.replace('mailto:', '').toLowerCase());
        if (item.telephone) phoneSetter(item.telephone);
        if (item.contactPoint) {
          const cps = Array.isArray(item.contactPoint) ? item.contactPoint : [item.contactPoint];
          for (const c of cps) {
            if (c.email) emailSet.add(c.email.replace('mailto:', '').toLowerCase());
            if (c.telephone) phoneSetter(c.telephone);
          }
        }
      }
    } catch {}
  }

  // 2. mailto: links
  const mailtoPattern = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  while ((match = mailtoPattern.exec(html)) !== null) {
    emailSet.add(match[1].toLowerCase());
  }

  // 3. Visible text emails (with entity decoding)
  const decoded = html
    .replace(/&#64;/g, '@').replace(/&#46;/g, '.')
    .replace(/\[at\]/g, '@').replace(/\(at\)/g, '@')
    .replace(/\[dot\]/g, '.').replace(/\(dot\)/g, '.')
    .replace(/\\u0040/g, '@');
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = emailRegex.exec(decoded)) !== null) {
    const email = match[0].toLowerCase();
    if (!JUNK_EMAIL_PARTS.some(j => email.includes(j)) && email.length < 60) {
      emailSet.add(email);
    }
  }

  // 4. Thai phone numbers
  const thaiPhonePattern = /(?:0[689]\d)[-.\s]?\d{3}[-.\s]?\d{4}/g;
  while ((match = thaiPhonePattern.exec(decoded)) !== null) {
    phoneSetter(match[0]);
  }
}

/**
 * Extract LINE ID from HTML — หา LINE Official Account ของธุรกิจ
 * Patterns: line.me/ti/p/@xxx, line.me/R/ti/p/@xxx, lin.ee/xxx, @line_id ในข้อความ
 */
// CSS/code keywords that look like @ids but aren't LINE
const CSS_FALSE_POSITIVES = ['@media', '@keyframes', '@layer', '@import', '@charset', '@font-face', '@supports', '@page', '@namespace', '@counter-style', '@property', '@container', '@scope', '@starting-style'];

function isValidLineId(id) {
  if (!id) return false;
  const lower = id.toLowerCase();
  // Filter CSS rules
  if (CSS_FALSE_POSITIVES.includes(lower)) return false;
  // Filter email-looking things
  if (lower.includes('@gmail') || lower.includes('@hotmail') || lower.includes('@yahoo') || lower.includes('@outlook')) return false;
  // Too short or too long
  if (id.replace('@', '').length < 3 || id.length > 40) return false;
  return true;
}

function extractLineFromHtml(html) {
  if (!html) return null;

  // Strip CSS/style blocks first to avoid false positives
  const cleanedHtml = html.replace(/<style[\s\S]*?<\/style>/gi, '');

  // 1. line.me/ti/p/@xxxxx or line.me/ti/p/~xxxxx (most reliable)
  const lineUrlPattern = /line\.me\/(?:ti\/p|R\/ti\/p)\/[@~]?([a-zA-Z0-9._-]+)/g;
  let match = lineUrlPattern.exec(cleanedHtml);
  if (match) return match[1].startsWith('@') ? match[1] : '@' + match[1];

  // 2. lin.ee short URLs (reliable)
  const lineePattern = /lin\.ee\/([a-zA-Z0-9]+)/g;
  match = lineePattern.exec(cleanedHtml);
  if (match) return 'lin.ee/' + match[1];

  // 3. LINE ID in href attributes: href="https://line.me/..."
  const hrefLinePattern = /href=["']https?:\/\/(?:page\.)?line\.me\/([a-zA-Z0-9._@~/-]+)["']/g;
  match = hrefLinePattern.exec(cleanedHtml);
  if (match) {
    const path = match[1];
    const atMatch = path.match(/[@~]([a-zA-Z0-9._-]+)/);
    if (atMatch) {
      const id = '@' + atMatch[1];
      if (isValidLineId(id)) return id;
    }
  }

  // 4. Thai text pattern: "LINE: @xxxxx" or "Line ID: @xxxxx" or "ไลน์: @xxxxx"
  const textPattern = /(?:LINE|Line|line|ไลน์|ไลน)\s*(?:ID|id|:|\s)\s*[:：]?\s*(@[a-zA-Z0-9._-]+)/g;
  match = textPattern.exec(cleanedHtml);
  if (match && isValidLineId(match[1])) return match[1];

  // 5. Standalone @line_id near LINE/ไลน์ context (stripped HTML)
  const decoded = cleanedHtml.replace(/<[^>]+>/g, ' ');
  const contextPattern = /(?:LINE|ไลน์|ไลน).{0,60}(@[a-z][a-z0-9._-]{2,30})/gi;
  match = contextPattern.exec(decoded);
  if (match && isValidLineId(match[1])) return match[1];

  return null;
}

async function scrapeContactFromSite(websiteUrl) {
  const emails = new Set();
  let phone = null;
  let lineId = null;
  let match;
  const origin = new URL(websiteUrl).origin;

  const pagesToTry = [
    websiteUrl,
    `${origin}/contact`, `${origin}/contact-us`, `${origin}/contact-us.html`,
    `${origin}/contact.html`, `${origin}/contactus`,
    `${origin}/about`, `${origin}/about-us`, `${origin}/about.html`, `${origin}/about-us.html`,
    `${origin}/th/contact`, `${origin}/en/contact`,
    `${origin}/%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%A3%E0%B8%B2`, // ติดต่อเรา
    `${origin}/%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B9%88%E0%B8%AD`, // ติดต่อ
  ];

  let homepageHtml = null;

  for (const pageUrl of pagesToTry) {
    try {
      const response = await fetch(pageUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': UA },
        redirect: 'follow',
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (pageUrl === websiteUrl) homepageHtml = html;
      extractContactFromHtml(html, emails, (p) => { if (!phone) phone = p; });
      if (!lineId) lineId = extractLineFromHtml(html);
      if (emails.size > 0 && lineId) break;
    } catch { continue; }
  }

  // Discover contact links from homepage if no email found yet
  if (emails.size === 0 && homepageHtml) {
    const linkPattern = /href="([^"]*(?:contact|%E0%B8%95%E0%B8%B4%E0%B8%94|about)[^"]*)"/gi;
    const discovered = new Set();
    while ((match = linkPattern.exec(homepageHtml)) !== null) {
      let href = match[1];
      if (href.startsWith('/')) href = `${origin}${href}`;
      else if (!href.startsWith('http')) href = `${origin}/${href}`;
      if (href.startsWith(origin) && !pagesToTry.includes(href)) discovered.add(href);
    }

    for (const pageUrl of discovered) {
      try {
        const response = await fetch(pageUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': UA },
          redirect: 'follow',
        });
        if (!response.ok) continue;
        const html = await response.text();
        extractContactFromHtml(html, emails, (p) => { if (!phone) phone = p; });
        if (!lineId) lineId = extractLineFromHtml(html);
        if (emails.size > 0) break;
      } catch { continue; }
    }
  }

  return { emails: [...emails], phone, lineId };
}

// --- Main Enrichment v2 ---

async function enrichLeads() {
  const leadsData = loadLeads();

  // Cleanup: remove false positive LINE IDs (CSS keywords)
  for (const l of leadsData.leads) {
    if (l.lineId && !isValidLineId(l.lineId)) {
      console.log(`[ENRICH-V2] Removed fake LINE: ${l.businessName} → ${l.lineId}`);
      l.lineId = null;
    }
  }

  // Enrich leads without email OR without LINE ID
  const toEnrich = leadsData.leads.filter(l => (!l.email || !l.lineId) && l.status === 'new');

  console.log(`[ENRICH-V2] Starting for ${toEnrich.length} leads (email + LINE)...`);
  let websitesFound = 0, emailsFound = 0, phonesFound = 0, linesFound = 0;

  for (let i = 0; i < toEnrich.length; i++) {
    const lead = toEnrich[i];
    const name = lead.businessName || lead.businessNameEn;
    if (!name) continue;

    try {
      // Step 1: RapidAPI (if quota available)
      if (lead.place_id && !lead.url && !lead.email) {
        try {
          const details = await getPlaceDetails(lead.place_id);
          if (details) {
            if (details.website) lead.url = details.website;
            if (details.emails?.length) { lead.emails = details.emails; lead.email = details.emails[0]; }
            if (details.phone) lead.phone = details.phone;
            if (details.facebook) lead.facebook = details.facebook;
            if (details.instagram) lead.instagram = details.instagram;
            if (details.rating) lead.rating = details.rating;
            if (details.reviewCount) lead.reviewCount = details.reviewCount;
            const d = details.website ? extractDomain(details.website) : details.tld;
            if (d) lead.domain = d;
          }
        } catch {}
      }

      // Step 2: Domain guessing (FREE, fast, no API needed)
      if (!lead.url && !lead.domain) {
        const guessedUrl = await guessBusinessDomain(name);
        if (guessedUrl) {
          lead.url = guessedUrl;
          lead.domain = extractDomain(guessedUrl);
          websitesFound++;
        }
      }

      // Step 3: DDG multi-query search
      if (!lead.url && !lead.domain) {
        const ddgUrl = await findWebsiteViaDDG(name);
        if (ddgUrl) {
          lead.url = ddgUrl;
          lead.domain = extractDomain(ddgUrl);
          websitesFound++;
        }
      }

      // Step 4: Deep website scraping for email + phone + LINE
      if ((lead.url || lead.domain) && !lead.email) {
        const siteUrl = lead.url || `https://${lead.domain}`;
        const contact = await scrapeContactFromSite(siteUrl);
        if (contact.emails.length > 0) {
          lead.emails = contact.emails;
          lead.email = contact.emails[0];
          emailsFound++;
        }
        if (contact.phone && !lead.phone) {
          lead.phone = contact.phone;
          phonesFound++;
        }
        if (contact.lineId && !lead.lineId) {
          lead.lineId = contact.lineId;
          console.log(`[ENRICH-V2] LINE found: ${name} → ${contact.lineId}`);
        }
        await sleep(1000);
      }

      // Step 5: Facebook email extraction (last resort for website-less)
      if (!lead.email) {
        const fbResult = await getEmailFromFacebook(name);
        if (fbResult) {
          if (fbResult.emails.length > 0) {
            lead.emails = fbResult.emails;
            lead.email = fbResult.emails[0];
            emailsFound++;
          }
          if (fbResult.phone && !lead.phone) {
            lead.phone = fbResult.phone;
            phonesFound++;
          }
          if (fbResult.fbUrl && !lead.facebook) lead.facebook = fbResult.fbUrl;
        }
        await sleep(2000);
      }

      // Step 6: NO MORE info@ fallback — bounces 80%+ and wastes AI credits
      // Keep lead in DB but don't assign fake email
      if (!lead.email) {
        console.log(`[ENRICH-V2] No real email for ${name} — keeping in DB without email`);
      }

      // Step 6.5: LINE scraping — for leads that HAVE email but NO LINE yet
      if (!lead.lineId && (lead.url || lead.domain)) {
        try {
          const siteUrl = lead.url || `https://${lead.domain}`;
          const contact = await scrapeContactFromSite(siteUrl);
          if (contact.lineId) {
            lead.lineId = contact.lineId;
            linesFound++;
            console.log(`[ENRICH-V2] LINE found: ${name} → ${contact.lineId}`);
          }
          await sleep(500);
        } catch {}
      }

      // Update scoring
      if (lead.url || lead.domain) {
        lead.websiteScore = lead.websiteScore || 5;
        if (lead.email) lead.isGoodTarget = true;
      }

      // Save every 3 leads (more frequent saves)
      if ((i + 1) % 3 === 0) {
        saveLeads(leadsData);
        console.log(`[ENRICH-V2] ${i + 1}/${toEnrich.length} | Sites:${websitesFound} Emails:${emailsFound} Phones:${phonesFound}`);
      }

    } catch (error) {
      console.error(`[ENRICH-V2] Error ${name}:`, error.message);
    }
  }

  saveLeads(leadsData);
  const summary = { total: toEnrich.length, websitesFound, emailsFound, phonesFound, linesFound };
  console.log(`[ENRICH-V2] DONE! ${JSON.stringify(summary)}`);
  return summary;
}

// ============================================================
// Update lead by place_id, domain, or email (for tracking/status updates)
// ============================================================
function updateLead(identifier, updates) {
  const data = loadLeads();
  const idx = data.leads.findIndex(l =>
    (l.place_id && l.place_id === identifier) ||
    (l.domain && l.domain === identifier) ||
    (l.email && l.email === identifier)
  );
  if (idx >= 0) {
    Object.assign(data.leads[idx], updates);
    saveLeads(data);
    return true;
  }
  return false;
}

// ============================================================
// Export
// ============================================================

export {
  runDaily,
  checkReplies,
  processFollowUps,
  addManualDomain,
  enrichLeads,
  getStats,
  getLeads,
  searchGoogle,
  getPlaceDetails,
  processOnePlace,
  processOneDomain,
  updateLead,
  sendFullOutreachEmail,
  calculateLeadScore,
  validateServicePageUrls,
  PDF_BUFFER,
  PDF_FILENAME
};

export default {
  runDaily,
  checkReplies,
  processFollowUps,
  addManualDomain,
  enrichLeads,
  getStats,
  getLeads,
  searchGoogle,
  getPlaceDetails,
  processOnePlace,
  processOneDomain,
  updateLead,
  sendFullOutreachEmail,
  calculateLeadScore,
  validateServicePageUrls,
  validateEmailMX,
  addToBounceBlacklist,
  get pdfBuffer() { return PDF_BUFFER; },
  get pdfFilename() { return PDF_FILENAME; }
};
