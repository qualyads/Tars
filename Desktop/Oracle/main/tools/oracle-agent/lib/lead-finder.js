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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2));
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
async function searchGoogle(query, maxResults = 10) {
  console.log(`[LEAD-FINDER] Searching: "${query}"`);

  const targets = loadTargets();
  const excludeDomains = targets.excludeDomains || [];
  const lat = targets.searchLocation?.lat || 13.7563;
  const lng = targets.searchLocation?.lng || 100.5018;

  try {
    const url = `https://${RAPIDAPI_HOST}/places?query=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}`;

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

    const results = [];
    for (const item of items) {
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

    console.log(`[LEAD-FINDER] Found ${results.length} businesses for "${query}"`);
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

    return {
      mainHtml: html.substring(0, 50000), // Limit size
      contactHtml: contactHtml.substring(0, 30000),
      finalUrl: response.url,
      loadTimeMs: Date.now() // Rough load time indicator
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
async function analyzeWebsite(domain, fetchResult, industry) {
  const { mainHtml, contactHtml } = fetchResult;

  // Strip HTML tags for cleaner AI input, keep essential text
  const cleanHtml = (html) => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);
  };

  const mainText = cleanHtml(mainHtml);
  const contactText = contactHtml ? cleanHtml(contactHtml) : '';

  const prompt = `วิเคราะห์เว็บไซต์นี้และดึงข้อมูลออกมาเป็น JSON

Domain: ${domain}
Industry: ${industry}

=== เนื้อหาหน้าหลัก ===
${mainText}

=== เนื้อหาหน้า Contact (ถ้ามี) ===
${contactText || 'ไม่พบหน้า Contact'}

ตอบเป็น JSON เท่านั้น:
{
  "businessName": "ใส่ชื่อจริงของธุรกิจนี้ (ภาษาไทย ถ้าหาได้, ถ้าไม่มีชื่อไทยให้ใส่ชื่อ EN — ห้าม copy ข้อความนี้เป็นค่า!)",
  "businessNameEn": "ใส่ชื่อ English จริงของธุรกิจนี้ (ห้าม copy ข้อความนี้เป็นค่า!)",
  "industry": "ประเภทธุรกิจ",
  "emails": ["email ทั้งหมดที่เจอ"],
  "phones": ["เบอร์โทรทั้งหมด"],
  "lineId": "LINE ID ถ้ามี",
  "facebook": "Facebook page URL ถ้ามี",
  "address": "ที่อยู่ ถ้ามี",
  "websiteIssues": ["ปัญหาที่พบ เช่น: ไม่ responsive, โหลดช้า, ไม่มี meta description, ไม่มี alt text, เนื้อหาน้อย, ไม่มี CTA, ไม่มีเว็บหลายภาษา, ไม่มี structured data, ไม่มี Google Business Post"],
  "websiteScore": 1-10,
  "isGoodTarget": true/false,
  "reason": "เหตุผลว่าทำไมเป็น/ไม่เป็น target ที่ดี"
}

กฎ:
- isGoodTarget = true เมื่อ: เป็นธุรกิจจริง + มี email หรือ เบอร์โทร (แม้เว็บจะดูดีก็ส่งได้ — เราช่วยเพิ่มลูกค้าได้ทุกเว็บ)
- isGoodTarget = false เฉพาะเมื่อ: ไม่ใช่ธุรกิจจริง (เป็นบล็อก/ข่าว/directory) หรือ ไม่มีช่องทางติดต่อเลย
- websiteScore: 1 = แย่มาก, 10 = ดีมาก
- ถ้าไม่เจอ email แต่มีเว็บไซต์ ให้ลอง guess: info@domain, contact@domain — ใส่ใน emails array
- ตอบ JSON เท่านั้น ไม่ต้องอธิบายเพิ่ม`;

  try {
    const response = await chat(
      [{ role: 'user', content: prompt }],
      {
        system: 'คุณเป็นผู้เชี่ยวชาญ Web Development & SEO ที่วิเคราะห์เว็บไซต์ธุรกิจไทย ตอบ JSON เท่านั้น',
        max_tokens: 1000,
        skipAutoRecall: true
      }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error(`[LEAD-FINDER] AI analysis failed for ${domain}:`, error.message);
  }

  return null;
}

// ============================================================
// Outreach — Full Pipeline (24 กฎ + VXB Template + Tracking + PDF)
// ============================================================

function findRelevantServicePage(bizType) {
  const t = (bizType || '').toLowerCase();
  const map = [
    { kw: ['clinic', 'คลินิก', 'hifu', 'botox', 'filler'], url: 'https://www.visionxbrain.com/services/premium-clinic-website-hifu-botox-filler' },
    { kw: ['spa', 'wellness', 'massage', 'นวด'], url: 'https://www.visionxbrain.com/services/premium-spa-wellness-website-design' },
    { kw: ['restaurant', 'ร้านอาหาร', 'cafe', 'coffee', 'กาแฟ'], url: 'https://www.visionxbrain.com/services/restaurant-website-design' },
    { kw: ['hotel', 'resort', 'hostel', 'guesthouse', 'โรงแรม', 'ที่พัก'], url: 'https://www.visionxbrain.com/services/hotel-website-design' },
    { kw: ['car rental', 'รถเช่า'], url: 'https://www.visionxbrain.com/services/car-rental-website-design' },
    { kw: ['fitness', 'gym', 'ฟิตเนส'], url: 'https://www.visionxbrain.com/services/fitness-gym-website-design' },
    { kw: ['dental', 'ทันตกรรม', 'ฟัน'], url: 'https://www.visionxbrain.com/services/dental-clinic-website-design' },
    { kw: ['real estate', 'property', 'อสังหา', 'บ้าน', 'คอนโด'], url: 'https://www.visionxbrain.com/services/real-estate-property-website-design' },
    { kw: ['shop', 'store', 'ecommerce', 'ร้านค้า', 'ขายของ'], url: 'https://www.visionxbrain.com/services/e-commerce-online-store-website-design' },
    { kw: ['education', 'school', 'โรงเรียน', 'สอน'], url: 'https://www.visionxbrain.com/services/education-website-design' },
    { kw: ['law', 'lawyer', 'ทนาย', 'กฎหมาย'], url: 'https://www.visionxbrain.com/services/law-firm-website-design' },
    { kw: ['construction', 'ก่อสร้าง', 'รับเหมา'], url: 'https://www.visionxbrain.com/services/construction-company-website-design' },
    { kw: ['pet', 'vet', 'animal', 'สัตว์เลี้ยง'], url: 'https://www.visionxbrain.com/services/pet-shop-veterinary-website-design' },
    { kw: ['travel', 'tour', 'ท่องเที่ยว', 'ทัวร์'], url: 'https://www.visionxbrain.com/services/travel-agency-tour-website-design' },
  ];
  for (const entry of map) {
    if (entry.kw.some(k => t.includes(k))) return entry.url;
  }
  return 'https://www.visionxbrain.com/services/website';
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

function generateJsonInstruction(bizName) {
  return `ตอบ JSON:
{
  "subject": "หัวข้อ — ต้องมีชื่อธุรกิจลูกค้า (${bizName}) + สื่อว่ามีคำแนะนำดีๆ ให้อยากเปิดอ่าน — ห้ามหัวข้อทั่วไป! ใช้ CRO คิดเอง ภาษาไทย — ห้ามใส่ emoji เด็ดขาด!",
  "body": "HTML body ทั้งหมด (ไม่ต้องใส่ signature/ปุ่ม จะใส่ให้ใน template)"
}`;
}

/**
 * Prompt สำหรับธุรกิจที่มีเว็บไซต์ — วิเคราะห์เว็บ + screenshot
 */
function generateWebsitePrompt(bizName, bizType, domain, websiteUrl, issues, servicePage, isHotel) {
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
- หลังแนะนำตัว ใส่ screenshot เว็บลูกค้าด้วย HTML:
<div style="text-align:center;margin:16px 0;">
  <p style="font-size:13px;color:#888;margin:0 0 8px;">เว็บไซต์ปัจจุบันของ ${bizName}:</p>
  <img src="https://image.thum.io/get/width/600/${websiteUrl}" alt="เว็บไซต์ ${bizName}" style="width:100%;max-width:580px;border-radius:12px;border:1px solid #eee;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
</div>
แสดงให้เห็นว่าเราดูเว็บจริงๆ ไม่ได้ส่ง template
- บอกตรงๆ ว่าเจอเว็บเขาตอน research ธุรกิจ${bizType}ออนไลน์
- ลองดูเว็บแล้วเห็นจุดที่ถ้าปรับนิดหน่อย น่าจะได้ลูกค้าเพิ่มเยอะเลย เลยตั้งใจเขียนคำแนะนำเฉพาะสำหรับธุรกิจของคุณมาครับ
- ใส่ลิงก์เว็บลูกค้าด้วย เช่น "ผมเจอเว็บของคุณ (${websiteUrl}) ตอน research..." — แสดงว่าเราใส่ใจดูจริง
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

${generateJsonInstruction(bizName)}`;
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

=== สำคัญมาก: ธุรกิจนี้ไม่มีเว็บไซต์! ===
- ห้ามพูดว่า "เจอเว็บของคุณ" หรือ "ดูเว็บแล้ว" — เพราะไม่มีเว็บ!
- ห้ามใส่ screenshot เว็บ — เพราะไม่มีเว็บ!
- ห้ามวิเคราะห์ website issues — เพราะไม่มีเว็บ!
- Angle ต้องเปลี่ยน: "เจอธุรกิจ${bizType}ของคุณตอน research ออนไลน์ เห็นว่าธุรกิจดีมาก แต่ยังไม่มี online presence ที่เต็มที่"

=== โครงสร้าง email (ทำตามนี้เท่านั้น) ===

**1. เปิดเรื่อง (2-3 บรรทัด):**
- "สวัสดีครับ ผมต้าร์ จาก บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด ครับ"
- บอกตรงๆ ว่าเจอธุรกิจเขาตอน research ธุรกิจ${bizType}ในพื้นที่ (จาก Google Maps / Social Media)
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

${generateJsonInstruction(bizName)}`;
}

/**
 * Send full outreach email — 24 กฎ + VXB Template + Tracking + PDF
 * ใช้ได้ทั้ง auto-send ใน runDaily() และจากภายนอก
 * รองรับ 2 กรณี: มีเว็บ vs ไม่มีเว็บ
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
  const hasWebsite = websiteUrl && domain !== '-' && !/^info@/i.test(domain);
  const to = lead.email;

  if (!to) {
    console.log(`[AUTO-EMAIL] Skip ${bizName} — no email`);
    return { success: false, error: 'no email' };
  }

  console.log(`[AUTO-EMAIL] Generating email for ${bizName} (${to})... hasWebsite=${hasWebsite}`);

  // Step 1: AI generates content — different prompt for with/without website
  const prompt = hasWebsite ? generateWebsitePrompt(bizName, bizType, domain, websiteUrl, issues, servicePage, isHotel)
    : generateNoWebsitePrompt(bizName, bizType, domain, servicePage, isHotel);

  console.log(`[AUTO-EMAIL] Using ${hasWebsite ? 'WEBSITE' : 'NO-WEBSITE'} template for ${bizName}`);

  try {
    const aiRes = await chat(
      [{ role: 'user', content: prompt }],
      {
        system: 'คุณคือ ต้าร์ เจ้าของ VisionXBrain เขียน email เหมือนคนจริงที่อยากช่วยจริงๆ ไม่ใช่ AI ไม่ขาย เป็นผู้ให้ ตอบ JSON เท่านั้น',
        max_tokens: 4000,
        skipAutoRecall: true
      }
    );

    const jsonMatch = aiRes.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[AUTO-EMAIL] AI failed to generate JSON for ${bizName}`);
      return { success: false, error: 'AI JSON parse failed' };
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
      { system: 'เขียน follow-up email สั้นๆ ภาษาไทย ตอบ JSON เท่านั้น', max_tokens: 500, skipAutoRecall: true }
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
    // Search Gmail for replies from leads
    for (const lead of sentLeads) {
      if (!lead.email) continue;

      const domain = lead.email.split('@')[1];
      const searchResults = await gmail.search(`from:${domain} newer_than:7d`, 5);

      if (searchResults && searchResults.length > 0) {
        // Mark as replied
        lead.status = 'replied';
        lead.repliedAt = new Date().toISOString();
        replies.push(lead);

        // Notify via Telegram
        const notifMsg = `[LEAD-FINDER] ตอบกลับแล้ว!

ธุรกิจ: ${lead.businessName}
Industry: ${lead.industry}
Email: ${lead.email}
Domain: ${lead.domain}

เข้าไปอ่านใน Gmail เลย`;

        await telegram.notifyOwner(notifMsg);
        console.log(`[LEAD-FINDER] Reply detected from ${lead.email}`);
      }
    }

    if (replies.length > 0) {
      saveLeads(leadsData);
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

  // Step 1: Process manual domains first
  if (targets.manualDomains && targets.manualDomains.length > 0) {
    console.log(`[LEAD-FINDER] Processing ${targets.manualDomains.length} manual domains...`);

    for (const entry of targets.manualDomains) {
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
    }
  }

  // Step 2: Search via Local Rank Tracker (RapidAPI)
  const shuffled = [...targets.searches].sort(() => Math.random() - 0.5);
  const todaysSearches = shuffled.slice(0, searchesPerRun);

  for (const search of todaysSearches) {
    if (newLeads >= maxLeads) break;

    const places = await searchGoogle(search.query);
    await sleep(2000);

    for (const place of places) {
      // Skip already-processed places by place_id
      if (leadsData.processedDomains.includes(place.place_id)) continue;
      if (newLeads >= maxLeads) break;

      const lead = await processOnePlace(place, search.industry, leadsData);

      if (lead) {
        newLeads++;
        await sleep(delay);
      }
    }
  }

  // Step 3: Send outreach emails to good targets — ✅ ENABLED (Tar approved 2026-02-08)
  const unsent = leadsData.leads.filter(l => l.status === 'new' && l.isGoodTarget && l.email);
  console.log(`[LEAD-FINDER] ${unsent.length} leads ready to send (max ${maxEmails}/day)`);

  for (const lead of unsent) {
    if (emailsSent >= maxEmails) {
      console.log(`[LEAD-FINDER] Daily email limit reached (${maxEmails})`);
      break;
    }

    const result = await sendFullOutreachEmail(lead);
    if (result.success) {
      lead.status = 'emailed';
      lead.emailSentAt = result.sentAt;
      lead.threadId = result.threadId;
      lead.emailTrackingId = result.trackingId;
      lead.emailSentTo = lead.email;
      emailsSent++;
      console.log(`[LEAD-FINDER] ✅ ${emailsSent}/${maxEmails} — ${result.bizName} → ${lead.email}`);
    }

    // Delay between emails (8 นาที — ดูเป็นธรรมชาติ ไม่ถูก flag spam)
    await sleep(8 * 60 * 1000);
  }

  // Step 4: Process follow-ups — ✅ ENABLED
  const followUps = await processFollowUps();

  // Step 5: Check for replies
  const replies = await checkReplies();

  // Step 6: Save everything
  leadsData.lastRun = new Date().toISOString();
  saveLeads(leadsData);

  // Step 7: Send summary notification
  const summary = `[Lead Finder] สรุปวันนี้

Leads ใหม่: ${newLeads}
Emails ส่ง: ${emailsSent}
Follow-ups: ${followUps}
มีคนตอบ: ${replies.length}

Leads ทั้งหมด: ${leadsData.leads.length}
รอส่ง email: ${leadsData.leads.filter(l => l.status === 'new' && l.isGoodTarget && l.email).length}
รอตอบกลับ: ${leadsData.leads.filter(l => l.status === 'emailed' || l.status === 'followed_up').length}`;

  if (newLeads > 0 || emailsSent > 0 || replies.length > 0) {
    await telegram.notifyOwner(summary);
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

  // Step 2: If has website, fetch and AI-analyze it
  let fetchResult = null;
  let analysis = null;

  if (website) {
    fetchResult = await fetchWebsite(website);
    if (fetchResult) {
      analysis = await analyzeWebsite(domain, fetchResult, industry);
    }
  }

  // Step 3: Merge API data + AI analysis into lead record
  const apiEmails = details?.emails || [];
  const aiEmails = analysis?.emails || [];
  const allEmails = [...new Set([...apiEmails, ...aiEmails])];

  // Fallback: if no email found but has domain, try info@domain
  if (allEmails.length === 0 && domain && !['facebook.com','instagram.com','line.me','google.com'].includes(domain)) {
    allEmails.push(`info@${domain}`);
    console.log(`[LEAD-FINDER] No email found for ${domain} — using fallback info@${domain}`);
  }

  const apiPhones = details?.phones || [];
  const aiPhones = analysis?.phones || [];
  const allPhones = [...new Set([...apiPhones, ...aiPhones])];

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
    lineId: details?.line || analysis?.lineId || null,
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

  leadsData.leads.push(lead);
  saveLeads(leadsData);
  await saveLeadToSheet(lead);

  const targetTag = lead.isGoodTarget ? 'TARGET' : 'SKIP';
  console.log(`[LEAD-FINDER] [${targetTag}] ${lead.businessName} (${lead.domain || 'no-website'}) — Score: ${lead.websiteScore}/10, Email: ${lead.email || 'none'}, Phone: ${lead.phone || 'none'}, Rating: ${lead.rating || '-'}`);

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

  const analysis = await analyzeWebsite(domain, fetchResult, industry);
  if (!analysis) {
    console.log(`[LEAD-FINDER] Could not analyze ${domain}`);
    return null;
  }

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

  leadsData.leads.push(lead);
  saveLeads(leadsData);
  await saveLeadToSheet(lead);

  const tag = lead.isGoodTarget ? 'TARGET' : 'SKIP';
  console.log(`[LEAD-FINDER] [${tag}] ${lead.businessName} (${domain}) — Score: ${lead.websiteScore}/10`);
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
  getStats,
  getLeads,
  searchGoogle,
  getPlaceDetails,
  processOnePlace,
  processOneDomain,
  updateLead,
  sendFullOutreachEmail,
  PDF_BUFFER,
  PDF_FILENAME
};

export default {
  runDaily,
  checkReplies,
  processFollowUps,
  addManualDomain,
  getStats,
  getLeads,
  searchGoogle,
  getPlaceDetails,
  processOnePlace,
  processOneDomain,
  updateLead,
  sendFullOutreachEmail,
  get pdfBuffer() { return PDF_BUFFER; },
  get pdfFilename() { return PDF_FILENAME; }
};
