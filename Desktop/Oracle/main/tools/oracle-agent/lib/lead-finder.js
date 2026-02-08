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
const TARGETS_FILE = path.join(DATA_DIR, 'lead-targets.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

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
 * Try to find business website by searching Google Maps place link
 * Scrapes the Google Maps redirect to get website URL
 */
async function getPlaceDetails(placeId, businessName) {
  // Try to find website by fetching Google Maps place page
  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(businessName)}`;
    console.log(`[LEAD-FINDER] Looking up details for: ${businessName}`);
    // For now, return null — website discovery happens via fetchWebsite in processOnePlace
    return null;
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
  "businessName": "ชื่อธุรกิจ (ภาษาไทย ถ้ามี)",
  "businessNameEn": "English name if available",
  "industry": "ประเภทธุรกิจ",
  "emails": ["email ทั้งหมดที่เจอ"],
  "phones": ["เบอร์โทรทั้งหมด"],
  "lineId": "LINE ID ถ้ามี",
  "facebook": "Facebook page URL ถ้ามี",
  "address": "ที่อยู่ ถ้ามี",
  "websiteIssues": ["ปัญหาที่พบ เช่น: ไม่มี SSL, ไม่ responsive, โหลดช้า, ไม่มี meta description, ไม่มี alt text, เนื้อหาน้อย, ไม่มี CTA"],
  "websiteScore": 1-10,
  "isGoodTarget": true/false,
  "reason": "เหตุผลว่าทำไมเป็น/ไม่เป็น target ที่ดี"
}

กฎ:
- isGoodTarget = true เมื่อ: เว็บเก่า/ช้า/ไม่สวย + มี email หรือ เบอร์โทร + เป็นธุรกิจจริง
- isGoodTarget = false เมื่อ: เว็บดีอยู่แล้ว หรือ ไม่ใช่ธุรกิจ หรือ ไม่มีช่องทางติดต่อ
- websiteScore: 1 = แย่มาก (target ดี), 10 = ดีมาก (ไม่ต้อง pitch)
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
// Outreach — Generate and send audit emails
// ============================================================

/**
 * Generate personalized audit email using AI
 */
async function generateAuditEmail(lead) {
  const prompt = `เขียน email สั้นๆ ให้ธุรกิจ "${lead.businessName}" (${lead.industry})
Domain: ${lead.domain}

ปัญหาที่พบในเว็บของเขา:
${lead.websiteIssues.map(i => `- ${i}`).join('\n')}

Website Score: ${lead.websiteScore}/10

เขียน email ที่:
1. เปิดด้วยการชมสิ่งที่ดีของธุรกิจเขา (ถ้ามี)
2. บอกว่าเราเจอเว็บเขาตอน research
3. พูดถึง 2-3 จุดที่ปรับแล้วจะดีขึ้น (ไม่ต้องลงรายละเอียดมาก)
4. เสนอว่าเราทำ audit ละเอียดให้ฟรี
5. CTA: ตอบ email นี้ หรือ นัดคุย 15 นาที

กฎเขียน:
- ภาษาไทย สุภาพ เป็นกันเอง ไม่ขายของตรงๆ
- ไม่เกิน 150 คำ
- ลงชื่อ: ทนกิจ (Tar) — VisionXBrain | รับทำเว็บ Webflow
- ห้ามใช้ emoji

ตอบเป็น JSON:
{
  "subject": "หัวข้อ email (สั้น น่าสนใจ ไม่ spam)",
  "body": "เนื้อหา email (HTML format)"
}`;

  try {
    const response = await chat(
      [{ role: 'user', content: prompt }],
      {
        system: 'คุณเป็นนักเขียน cold email ที่เก่งมาก เขียนแบบ human-to-human ไม่ spammy ตอบ JSON เท่านั้น',
        max_tokens: 800,
        skipAutoRecall: true
      }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error(`[LEAD-FINDER] Email generation failed:`, error.message);
  }

  return null;
}

/**
 * Send audit email via Gmail API
 */
async function sendOutreachEmail(lead, emailContent) {
  try {
    const result = await gmail.send({
      to: lead.email,
      subject: emailContent.subject,
      body: emailContent.body
    });

    console.log(`[LEAD-FINDER] Email sent to ${lead.email}: ${emailContent.subject}`);

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
      sentAt: new Date().toISOString()
    };
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
  const maxEmails = settings.maxEmailsPerDay || 10;
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

  // Step 3: Send outreach emails to good targets
  const unsent = leadsData.leads.filter(l => l.status === 'new' && l.isGoodTarget && l.email);

  for (const lead of unsent) {
    if (emailsSent >= maxEmails) break;

    const emailContent = await generateAuditEmail(lead);
    if (!emailContent) continue;

    const result = await sendOutreachEmail(lead, emailContent);
    if (result.success) {
      lead.status = 'emailed';
      lead.emailSentAt = new Date().toISOString();
      lead.threadId = result.threadId;
      emailsSent++;
    }

    await sleep(3000);
  }

  // Step 4: Process follow-ups
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
 * Process a single place from Local Rank Tracker — try to find website, analyze
 */
async function processOnePlace(place, industry, leadsData) {
  console.log(`[LEAD-FINDER] Processing place: ${place.name}`);

  // Mark as processed by place_id
  leadsData.processedDomains.push(place.place_id);

  // Try common domain patterns from business name
  const cleanName = place.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const guessUrls = cleanName.length > 2 ? [
    `https://www.${cleanName}.com`,
    `https://${cleanName}.com`,
    `https://www.${cleanName}.co.th`,
  ] : [];

  // Try to find and fetch website
  let website = null;
  let fetchResult = null;
  let analysis = null;

  for (const guessUrl of guessUrls) {
    try {
      const res = await fetch(guessUrl, {
        signal: AbortSignal.timeout(5000),
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        website = res.url;
        break;
      }
    } catch { /* try next */ }
  }

  const domain = website ? extractDomain(website) : null;

  if (website) {
    fetchResult = await fetchWebsite(website);
    if (fetchResult) {
      analysis = await analyzeWebsite(domain, fetchResult, industry);
    }
  }

  // Create lead record
  const lead = {
    place_id: place.place_id,
    domain: domain || null,
    url: website || null,
    industry,
    businessName: place.name,
    businessNameEn: analysis?.businessNameEn || '',
    emails: analysis?.emails || [],
    email: (analysis?.emails || [])[0] || null,
    phones: analysis?.phones || [],
    lineId: analysis?.lineId || null,
    facebook: analysis?.facebook || null,
    address: place.address || analysis?.address || null,
    googleMapsLink: place.place_link || null,
    websiteScore: analysis?.websiteScore || (website ? 5 : 0),
    websiteIssues: analysis?.websiteIssues || (website ? [] : ['ไม่มีเว็บไซต์']),
    isGoodTarget: website ? (analysis?.isGoodTarget || false) : true,
    reason: analysis?.reason || (website ? '' : 'ไม่มีเว็บไซต์ — ต้องการเว็บใหม่'),
    status: 'new',
    foundAt: new Date().toISOString(),
    followUps: 0
  };

  leadsData.leads.push(lead);
  saveLeads(leadsData);

  // Save to Google Sheets
  await saveLeadToSheet(lead);

  const targetTag = lead.isGoodTarget ? 'TARGET' : 'SKIP';
  console.log(`[LEAD-FINDER] [${targetTag}] ${lead.businessName} (${lead.domain || 'no-website'}) — Score: ${lead.websiteScore}/10, Email: ${lead.email || 'none'}, Phone: ${lead.phones[0] || 'none'}`);

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
  processOneDomain
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
  processOneDomain
};
