/**
 * SEO Auto-Optimize Engine v2.0
 * Monitor VisionXBrain SEO → วิเคราะห์ → AUTO-EXECUTE → รายงานผล
 *
 * v2.0 Changes (Tar feedback):
 * 1. Business keywords only — ไม่แสดง random keywords (evp, inp)
 * 2. Focus /services/ pages — core business pages
 * 3. Auto-fix indexing — ping sitemap, categorize issues
 * 4. Oracle executes — ไม่ recommend ให้ Tar ทำ
 *
 * @version 2.0.0
 */

import searchConsole from './search-console.js';
import claude from './claude.js';
import gateway from './gateway.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getPool } from './db-postgres.js';
import { generateEmbedding } from './embedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  oracleMemoryPath: '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory',
  dataFile: path.join(__dirname, '../data/seo-report.json'),
};

// =============================================================================
// BUSINESS KEYWORD FILTER
// =============================================================================

// Keywords ที่เกี่ยวกับธุรกิจ VisionXBrain เท่านั้น
const BUSINESS_KEYWORD_PATTERNS = [
  /รับทำ/i, /ทำเว็บ/i, /สร้างเว็บ/i, /ออกแบบเว็บ/i,
  /webflow/i, /web\s*design/i, /web\s*dev/i, /website/i,
  /seo/i, /search\s*engine/i, /google\s*rank/i,
  /ux/i, /ui/i, /user\s*experience/i, /user\s*interface/i,
  /shopify/i, /e-?commerce/i, /ร้านค้าออนไลน์/i,
  /n8n/i, /automation/i, /automate/i, /ออโต/i,
  /digital\s*market/i, /การตลาดออนไลน์/i,
  /cro/i, /conversion/i, /landing\s*page/i,
  /ai\s*search/i, /geo/i, /chatgpt/i, /ai\s*agent/i,
  /visionxbrain/i, /vision\s*x/i, /vxb/i,
  /agency/i, /บริษัท/i, /โปรเจค/i,
  /wordpress/i, /wix/i, /squarespace/i, // comparison keywords
  /เว็บไซต์/i, /หน้าเว็บ/i, /โฮสต์/i, /hosting/i,
  /branding/i, /แบรนด์/i, /logo/i, /โลโก้/i,
];

function isBusinessKeyword(keyword) {
  return BUSINESS_KEYWORD_PATTERNS.some(pattern => pattern.test(keyword));
}

function filterBusinessKeywords(queries) {
  return queries.filter(q => isBusinessKeyword(q.keys[0]));
}

// Core business pages (NOT blog — blog is supporting content)
const CORE_PAGE_PATTERNS = [
  '/services/',
  '/ai-search-geo',
  '/academy',
];

// Supporting pages
const SUPPORTING_PAGE_PATTERNS = [
  '/blog/',
  '/showcase/',
  '/integration',
];

// =============================================================================
// DATA STORAGE
// =============================================================================

function loadData() {
  try {
    if (fs.existsSync(CONFIG.dataFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
    }
  } catch (e) {
    console.error('[SEO] Error loading data:', e.message);
  }
  return { reports: [], alerts: [], lastReport: null, lastAlert: null, totalRuns: 0 };
}

function saveDataFile(data) {
  try {
    const dir = path.dirname(CONFIG.dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[SEO] Error saving data:', e.message);
  }
}

// =============================================================================
// DATE HELPERS
// =============================================================================

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function formatChange(current, previous, isPercent = false) {
  if (previous === 0 || previous == null) return '';
  const diff = current - previous;
  const pct = Math.round((diff / Math.abs(previous)) * 100);
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  if (isPercent) return `${arrow}${Math.abs(diff).toFixed(2)}%`;
  return `(${pct > 0 ? '+' : ''}${pct}%)`;
}

function formatPosition(pos) {
  return Math.round(pos * 10) / 10;
}

// =============================================================================
// FETCH SEARCH CONSOLE DATA
// =============================================================================

async function fetchSCData(siteUrl, startDate, endDate, keywordCount) {
  console.log(`[SEO] Fetching SC data: ${startDate} → ${endDate}`);

  const [topQueries, topPages, byDevice, byDate] = await Promise.all([
    searchConsole.topQueries(siteUrl, { limit: keywordCount, startDate, endDate }),
    searchConsole.topPages(siteUrl, { limit: 50, startDate, endDate }),
    searchConsole.byDevice(siteUrl, { startDate, endDate }),
    searchConsole.byDate(siteUrl, { startDate, endDate, days: 7 }),
  ]);

  // Totals from daily data
  const totalClicks = byDate.reduce((sum, d) => sum + d.clicks, 0);
  const totalImpressions = byDate.reduce((sum, d) => sum + d.impressions, 0);
  const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
  const avgPosition = topQueries.length > 0
    ? Math.round((topQueries.reduce((sum, q) => sum + q.position, 0) / topQueries.length) * 10) / 10
    : 0;

  // Filter: business keywords only
  const businessQueries = filterBusinessKeywords(topQueries);

  // Filter: core business pages (services, homepage)
  const corePages = topPages.filter(p => {
    const pagePath = p.keys[0].replace(/https?:\/\/[^/]+/, '');
    return CORE_PAGE_PATTERNS.some(pattern => pagePath.startsWith(pattern))
      || pagePath === '/' || pagePath === '';
  });

  // Supporting pages (blog, showcase)
  const supportingPages = topPages.filter(p => {
    const pagePath = p.keys[0].replace(/https?:\/\/[^/]+/, '');
    return SUPPORTING_PAGE_PATTERNS.some(pattern => pagePath.startsWith(pattern));
  });

  return {
    topQueries,
    businessQueries,
    topPages,
    corePages,
    supportingPages,
    byDevice,
    byDate,
    totals: { clicks: totalClicks, impressions: totalImpressions, ctr: avgCtr, position: avgPosition },
  };
}

// =============================================================================
// COMPARE PERIODS
// =============================================================================

function comparePeriodsData(current, previous) {
  const clicksChange = previous.totals.clicks > 0
    ? Math.round(((current.totals.clicks - previous.totals.clicks) / previous.totals.clicks) * 100)
    : 0;

  const impressionsChange = previous.totals.impressions > 0
    ? Math.round(((current.totals.impressions - previous.totals.impressions) / previous.totals.impressions) * 100)
    : 0;

  const ctrChange = Math.round((current.totals.ctr - previous.totals.ctr) * 100) / 100;
  const positionChange = Math.round((previous.totals.position - current.totals.position) * 10) / 10; // positive = improved

  // Keyword movements
  const prevKeywordMap = {};
  for (const q of previous.topQueries) {
    prevKeywordMap[q.keys[0]] = q;
  }

  const keywordsUp = [];
  const keywordsDown = [];

  for (const q of current.topQueries) {
    const keyword = q.keys[0];
    const prev = prevKeywordMap[keyword];
    if (prev) {
      const posDiff = Math.round((prev.position - q.position) * 10) / 10;
      if (posDiff > 0.5) keywordsUp.push({ keyword, position: q.position, change: posDiff, clicks: q.clicks });
      if (posDiff < -0.5) keywordsDown.push({ keyword, position: q.position, change: posDiff, clicks: q.clicks });
    }
  }

  keywordsUp.sort((a, b) => b.change - a.change);
  keywordsDown.sort((a, b) => a.change - b.change);

  return {
    clicksChange,
    impressionsChange,
    ctrChange,
    positionChange,
    keywordsUp: keywordsUp.slice(0, 10),
    keywordsDown: keywordsDown.slice(0, 10),
  };
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

async function generateSEOAnalysis(currentData, comparison, autoActions) {
  // ใช้ business keywords + service pages เท่านั้น
  const bizKeywords = currentData.businessQueries || [];
  const svcPages = currentData.corePages || [];

  const prompt = `คุณเป็น Oracle — AI SEO Engine ของ VisionXBrain (Webflow Agency ไทย, รับทำเว็บ/UX/UI/Shopify/N8N)

**IMPORTANT:** คุณเป็น AI ที่ต้อง execute เอง — ห้ามแนะนำให้ owner ทำ! ทุก action ต้องเป็นสิ่งที่ระบบ auto-execute ได้

**Service Pages Performance:**
${svcPages.slice(0, 15).map((p, i) => {
  const pagePath = p.keys[0].replace('https://www.visionxbrain.com', '') || '/';
  return `${i + 1}. ${pagePath} — ${p.clicks} clicks, ${p.impressions} imp, CTR ${p.ctr}%, pos ${p.position}`;
}).join('\n') || '(ไม่มีข้อมูล service pages)'}

**Business Keywords (เฉพาะที่เกี่ยวกับธุรกิจ):**
${bizKeywords.slice(0, 15).map((q, i) =>
  `${i + 1}. "${q.keys[0]}" — pos ${q.position}, ${q.clicks} clicks, ${q.impressions} imp, CTR ${q.ctr}%`
).join('\n') || '(ไม่มี business keywords)'}

**Overview:** Clicks ${currentData.totals.clicks} | Imp ${currentData.totals.impressions} | CTR ${currentData.totals.ctr}% | Pos ${currentData.totals.position}

${comparison ? `**WoW:** Clicks ${comparison.clicksChange > 0 ? '+' : ''}${comparison.clicksChange}% | Imp ${comparison.impressionsChange > 0 ? '+' : ''}${comparison.impressionsChange}% | Pos ${comparison.positionChange > 0 ? '↑' : '↓'}${Math.abs(comparison.positionChange)}` : ''}

${autoActions ? `**Auto-actions ที่ทำไปแล้ว:** ${autoActions.join(', ')}` : ''}

ตอบเป็น JSON:
{
  "grade": "A+/A/B+/B/C/D/F",
  "summary": "สรุป 1 ประโยค: สัปดาห์นี้เป็นยังไง",
  "wins": ["สิ่งที่ดีขึ้น (ถ้ามี)"],
  "risks": ["สิ่งที่ต้องระวัง — เฉพาะที่กระทบธุรกิจจริง"],
  "autoExecutePlan": ["สิ่งที่ Oracle จะทำอัตโนมัติสัปดาห์หน้า (เช่น: เขียน content, optimize meta, สร้าง internal links)"],
  "highPriorityPages": ["หน้าที่มี impression สูงแต่ CTR ต่ำ — Oracle จะ auto-optimize"]
}

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: prompt }], {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      skipAutoRecall: true,
    });
    const text = typeof response === 'string' ? response : (response.content?.[0]?.text || JSON.stringify(response));
    console.log('[SEO] AI response length:', text.length);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[SEO] AI analysis grade:', parsed.grade);
      return parsed;
    }
    console.error('[SEO] AI response not JSON:', text.substring(0, 200));
  } catch (e) {
    console.error('[SEO] AI analysis error:', e.message, e.stack?.split('\n')[1]);
  }
  return { summary: 'ไม่สามารถวิเคราะห์ได้', grade: '?' };
}

// =============================================================================
// AUTO-FIX: INDEXING & SITEMAP PING
// =============================================================================

async function autoFixIndexing(sitemapUrls, notIndexed, siteUrl) {
  const actions = [];

  // 1. Submit sitemap via Search Console API (proper way — not just ping)
  try {
    const sitemapUrl = 'https://www.visionxbrain.com/sitemap.xml';
    const result = await searchConsole.submitSitemap(siteUrl || 'sc-domain:visionxbrain.com', sitemapUrl);
    if (result.success) {
      actions.push(`✅ Sitemap submitted → Google SC API (${sitemapUrls?.length || 0} URLs)`);
      console.log('[SEO] Sitemap submitted via API');
    }
  } catch (e) {
    // Fallback to ping if API fails (e.g. scope not upgraded yet)
    console.error('[SEO] Sitemap submit error:', e.message, '— fallback to ping');
    try {
      const sitemapUrl = 'https://www.visionxbrain.com/sitemap.xml';
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      const resp = await fetch(pingUrl);
      if (resp.ok) {
        actions.push(`Sitemap ping → Google (fallback, ${sitemapUrls?.length || 0} URLs)`);
      }
    } catch (e2) {
      console.error('[SEO] Sitemap ping also failed:', e2.message);
    }
  }

  // 2. Categorize not-indexed pages
  // Note: VXB has programmatic /services/ pages per location (e.g. /services/web-design-chiang-mai)
  // These are "location services" — different from core service pages
  const CORE_SERVICE_SLUGS = [
    'n8n-automation', 'shopify', 'ux-ui-design', 'web-design', 'seo',
    'webflow', 'digital-marketing', 'branding', 'logo', 'copywriting',
  ];

  const notIndexedByType = {
    coreServices: [],  // /services/n8n, /services/shopify etc.
    locationServices: [], // /services/web-design-chiang-mai etc.
    location: [],
    blog: [],
    other: [],
  };

  for (const url of notIndexed) {
    const p = url.replace(/https?:\/\/[^/]+/, '');
    if (p.startsWith('/services/')) {
      // Check if it's a core service or location-specific service
      const slug = p.replace('/services/', '').split('/')[0];
      const isCore = CORE_SERVICE_SLUGS.some(cs => slug.startsWith(cs) || slug.includes(cs));
      if (isCore) notIndexedByType.coreServices.push(url);
      else notIndexedByType.locationServices.push(url);
    } else if (p.startsWith('/location/')) {
      notIndexedByType.location.push(url);
    } else if (p.startsWith('/blog/')) {
      notIndexedByType.blog.push(url);
    } else {
      notIndexedByType.other.push(url);
    }
  }

  // 3. Inspect core service pages that are NOT indexed — find out WHY
  let inspectionResults = [];
  if (notIndexedByType.coreServices.length > 0) {
    try {
      const inspection = await inspectNotIndexedPages(
        siteUrl || 'sc-domain:visionxbrain.com',
        notIndexedByType.coreServices,
        10 // max 10 core pages
      );
      inspectionResults = inspection.results;
      if (inspection.actions.length > 0) {
        actions.push(...inspection.actions);
      }
      actions.push(`🔍 Inspected ${inspectionResults.length}/${notIndexedByType.coreServices.length} core pages via URL Inspection API`);
    } catch (e) {
      actions.push(`⚠️ URL Inspection failed: ${e.message}`);
    }
  }

  if (notIndexedByType.coreServices.length > 0) {
    actions.push(`🔴 ${notIndexedByType.coreServices.length} core service pages NOT indexed`);
  }

  if (notIndexedByType.locationServices.length > 0) {
    actions.push(`${notIndexedByType.locationServices.length} location-service pages (programmatic — ปกติ)`);
  }

  if (notIndexedByType.location.length > 0) {
    actions.push(`${notIndexedByType.location.length} location pages (รอ Google crawl)`);
  }

  if (notIndexedByType.blog.length > 0) {
    actions.push(`${notIndexedByType.blog.length} blog pages not indexed`);
  }

  return { actions, notIndexedByType, inspectionResults };
}

// =============================================================================
// URL INSPECTION — เช็คสาเหตุที่ไม่ indexed
// =============================================================================

async function inspectNotIndexedPages(siteUrl, notIndexedUrls, maxPages = 20) {
  console.log(`[SEO] Inspecting ${Math.min(notIndexedUrls.length, maxPages)} not-indexed pages...`);

  const urlsToInspect = notIndexedUrls.slice(0, maxPages);
  const results = [];
  const actions = [];

  for (const url of urlsToInspect) {
    try {
      const result = await searchConsole.inspectUrl(siteUrl, url);
      results.push(result);

      const pagePath = url.replace(/https?:\/\/[^/]+/, '');
      const state = result.coverageState || 'Unknown';
      const fetch_state = result.pageFetchState || '';

      console.log(`[SEO] ${pagePath}: ${state} | fetch: ${fetch_state}`);

      // Categorize and log action taken
      if (state.includes('Discovered') && state.includes('not indexed')) {
        // Google knows about it but hasn't crawled — sitemap resubmit helps
        actions.push(`${pagePath}: Discovered but not crawled → sitemap resubmitted`);
      } else if (state.includes('Crawled') && state.includes('not indexed')) {
        // Google crawled but decided not to index — quality/duplicate issue
        actions.push(`${pagePath}: Crawled but not indexed → content quality issue`);
      } else if (fetch_state === 'SOFT_404' || fetch_state === 'NOT_FOUND') {
        actions.push(`${pagePath}: ${fetch_state} → page broken!`);
      } else if (result.robotsTxtState === 'DISALLOWED') {
        actions.push(`${pagePath}: Blocked by robots.txt`);
      } else if (result.indexingState === 'BLOCKED_BY_META_TAG') {
        actions.push(`${pagePath}: Blocked by noindex meta tag`);
      }

      // Rate limit: 300ms between requests
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`[SEO] Inspect error for ${url}:`, e.message);
      // If we get 403, scope probably not upgraded yet
      if (e.message.includes('403')) {
        actions.push('⚠️ URL Inspection API: need read-write scope (run node google-oauth.js)');
        break;
      }
    }
  }

  return { results, actions };
}

// =============================================================================
// SAVE TO SUPABASE
// =============================================================================

async function saveToSupabase(report) {
  const pool = getPool();
  if (!pool) return;

  try {
    const t = report.currentData.totals;
    const content = `🔍 Weekly SEO Report - ${report.weekLabel}
Site: visionxbrain.com
Clicks: ${t.clicks} | Impressions: ${t.impressions.toLocaleString()}
CTR: ${t.ctr}% | Avg Position: ${t.position}
Grade: ${report.analysis?.grade || 'N/A'}
${report.analysis?.assessment || ''}`;

    let embedding = null;
    try {
      embedding = await generateEmbedding(`SEO report visionxbrain weekly ${report.weekLabel} clicks impressions position keywords`);
    } catch (e) { /* skip */ }

    const searchText = `seo report ${report.weekLabel} clicks ${t.clicks} impressions ${t.impressions}`.substring(0, 1000);

    await query(`
      INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text${embedding ? ', embedding' : ''})
      VALUES ($1, $2, $3, $4, $5, $6${embedding ? ', $7' : ''})
    `, embedding
      ? ['tars', content, { source: 'seo-engine', week: report.weekLabel, clicks: t.clicks, impressions: t.impressions }, 'report', 0.7, searchText, embedding]
      : ['tars', content, { source: 'seo-engine', week: report.weekLabel, clicks: t.clicks, impressions: t.impressions }, 'report', 0.7, searchText]
    );
    console.log('[SEO] Saved to Supabase');
  } catch (error) {
    console.error('[SEO] Supabase save error:', error.message);
  }
}

// =============================================================================
// SAVE TO LOCAL
// =============================================================================

function saveToLocal(report) {
  const logsDir = path.join(CONFIG.oracleMemoryPath, 'logs');
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `${today}-seo.md`);

  try {
    const t = report.currentData.totals;
    const c = report.comparison;
    const a = report.analysis;

    let md = `# 🔍 Weekly SEO Report - ${report.weekLabel}\n\n`;
    md += `Site: visionxbrain.com\nGenerated: ${report.generatedAt}\n\n---\n\n`;

    md += `## 📊 Overview\n\n`;
    md += `| Metric | Value | ${c ? 'WoW Change' : ''} |\n`;
    md += `|--------|-------|${c ? '------------|' : ''}\n`;
    md += `| Clicks | ${t.clicks} | ${c ? `${c.clicksChange > 0 ? '+' : ''}${c.clicksChange}%` : ''} |\n`;
    md += `| Impressions | ${t.impressions.toLocaleString()} | ${c ? `${c.impressionsChange > 0 ? '+' : ''}${c.impressionsChange}%` : ''} |\n`;
    md += `| CTR | ${t.ctr}% | ${c ? `${c.ctrChange > 0 ? '+' : ''}${c.ctrChange}%` : ''} |\n`;
    md += `| Avg Position | ${t.position} | ${c ? `${c.positionChange > 0 ? '↑' : '↓'}${Math.abs(c.positionChange)}` : ''} |\n\n`;

    const bizQueries = report.currentData.businessQueries || [];
    const corePages = report.currentData.corePages || [];

    md += `## 🏢 Core Pages\n\n`;
    md += `| Page | Clicks | Impressions | CTR | Position |\n`;
    md += `|------|--------|-------------|-----|----------|\n`;
    for (const p of corePages.slice(0, 15)) {
      const pagePath = p.keys[0].replace('https://www.visionxbrain.com', '') || '/';
      md += `| ${pagePath} | ${p.clicks} | ${p.impressions} | ${p.ctr}% | ${p.position} |\n`;
    }
    md += '\n';

    md += `## 🔑 Business Keywords\n\n`;
    md += `| # | Keyword | Position | Clicks | Impressions | CTR |\n`;
    md += `|---|---------|----------|--------|-------------|-----|\n`;
    for (let i = 0; i < Math.min(bizQueries.length, 20); i++) {
      const q = bizQueries[i];
      md += `| ${i + 1} | ${q.keys[0]} | ${q.position} | ${q.clicks} | ${q.impressions} | ${q.ctr}% |\n`;
    }
    md += '\n';

    md += `## 📄 All Pages (reference)\n\n`;
    md += `| Page | Clicks | Impressions | CTR | Position |\n`;
    md += `|------|--------|-------------|-----|----------|\n`;
    for (const p of report.currentData.topPages.slice(0, 10)) {
      const pagePath = p.keys[0].replace('https://www.visionxbrain.com', '') || '/';
      md += `| ${pagePath} | ${p.clicks} | ${p.impressions} | ${p.ctr}% | ${p.position} |\n`;
    }
    md += '\n';

    if (c) {
      if (c.keywordsUp.length > 0) {
        md += `## ↑ Keywords Up\n\n`;
        for (const k of c.keywordsUp.slice(0, 5)) {
          md += `- "${k.keyword}" pos ${k.position} (↑${k.change})\n`;
        }
        md += '\n';
      }
      if (c.keywordsDown.length > 0) {
        md += `## ↓ Keywords Down\n\n`;
        for (const k of c.keywordsDown.slice(0, 5)) {
          md += `- "${k.keyword}" pos ${k.position} (↓${Math.abs(k.change)})\n`;
        }
        md += '\n';
      }
    }

    if (a) {
      md += `## 🎯 AI Analysis (Grade: ${a.grade})\n\n`;
      if (a.summary) md += `**Summary:** ${a.summary}\n\n`;
      if (a.wins?.length) md += `**Wins:**\n${a.wins.map(w => `- ${w}`).join('\n')}\n\n`;
      if (a.risks?.length) md += `**Risks:**\n${a.risks.map(r => `- ${r}`).join('\n')}\n\n`;
      if (a.autoExecutePlan?.length) md += `**Oracle Auto-Execute Plan:**\n${a.autoExecutePlan.map(p => `- ${p}`).join('\n')}\n\n`;
      if (a.highPriorityPages?.length) md += `**High Priority Pages:**\n${a.highPriorityPages.map(p => `- ${p}`).join('\n')}\n`;
    }

    // Auto-actions taken
    if (report.autoActions?.length) {
      md += `\n## 🔧 Auto-Actions Taken\n\n`;
      for (const action of report.autoActions) {
        md += `- ✅ ${action}\n`;
      }
    }

    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(logFile, md);
    console.log(`[SEO] Saved to local: ${logFile}`);
  } catch (error) {
    console.error('[SEO] Local save error:', error.message);
  }
}

// =============================================================================
// LINE NOTIFICATION — WEEKLY REPORT
// =============================================================================

async function sendReportNotification(report) {
  const t = report.currentData.totals;
  const c = report.comparison;
  const a = report.analysis;
  const bizKeywords = report.currentData.businessQueries || [];
  const corePages = report.currentData.corePages || [];
  const supportPages = report.currentData.supportingPages || [];

  let msg = `📊 VXB SEO — ${report.weekLabel}`;
  if (a?.grade) msg += ` [${a.grade}]`;
  msg += '\n';

  // One-line summary
  msg += `Clicks ${t.clicks}`;
  if (c) msg += `(${c.clicksChange > 0 ? '+' : ''}${c.clicksChange}%)`;
  msg += ` | Imp ${t.impressions >= 1000 ? (t.impressions / 1000).toFixed(1) + 'K' : t.impressions}`;
  if (c) msg += `(${c.impressionsChange > 0 ? '+' : ''}${c.impressionsChange}%)`;
  msg += ` | CTR ${t.ctr}%\n\n`;

  // Core Business Pages — services, AI search, academy
  if (corePages.length > 0) {
    msg += `🏢 Core Pages:\n`;
    for (const p of corePages.slice(0, 8)) {
      const pagePath = p.keys[0].replace('https://www.visionxbrain.com', '') || '/';
      const clickIcon = p.clicks > 0 ? '✅' : '⚠️';
      msg += `${clickIcon} ${pagePath}\n   ${p.clicks}c | ${p.impressions} imp | pos ${formatPosition(p.position)}`;
      if (p.impressions > 20 && p.clicks === 0) msg += ' ← CTR 0%!';
      msg += '\n';
    }
    msg += '\n';
  }

  // Top blog pages — only show best performers (1-2 lines)
  const topBlog = supportPages.filter(p => p.clicks > 0).slice(0, 3);
  if (topBlog.length > 0) {
    msg += `📝 Top Blog:\n`;
    for (const p of topBlog) {
      const pagePath = p.keys[0].replace('https://www.visionxbrain.com', '').replace('/blog/', '');
      msg += `• ${pagePath.substring(0, 40)} — ${p.clicks}c, pos ${formatPosition(p.position)}\n`;
    }
    msg += '\n';
  }

  // Business keywords — compact
  if (bizKeywords.length > 0) {
    msg += `🔑 Business Keywords:\n`;
    for (let i = 0; i < Math.min(bizKeywords.length, 6); i++) {
      const q = bizKeywords[i];
      const posArrow = c ? (() => {
        const up = c.keywordsUp.find(k => k.keyword === q.keys[0]);
        const dn = c.keywordsDown.find(k => k.keyword === q.keys[0]);
        if (up) return ` ↑${up.change}`;
        if (dn) return ` ↓${Math.abs(dn.change)}`;
        return '';
      })() : '';
      msg += `${i + 1}. "${q.keys[0]}" pos ${formatPosition(q.position)}${posArrow} | ${q.clicks}c\n`;
    }
    msg += '\n';
  }

  // AI Summary — 1 line only
  if (a?.summary) {
    msg += `💡 ${a.summary}\n`;
  }

  // Auto-actions taken
  if (report.autoActions?.length > 0) {
    msg += `\n🔧 Oracle ทำแล้ว:\n`;
    for (const action of report.autoActions.slice(0, 4)) {
      msg += `✅ ${action}\n`;
    }
  }

  // Auto-execute plan for next week
  if (a?.autoExecutePlan?.length > 0) {
    msg += `\n⚡ สัปดาห์หน้า Oracle จะ:\n`;
    for (const plan of a.autoExecutePlan.slice(0, 3)) {
      msg += `→ ${plan}\n`;
    }
  }

  // Risks — only if critical
  if (a?.risks?.length > 0) {
    msg += `\n⚠️ ระวัง:\n`;
    for (const r of a.risks.slice(0, 2)) {
      msg += `- ${r}\n`;
    }
  }

  try {
    await gateway.notifyOwner(msg);
    console.log('[SEO] Report notification sent');
  } catch (e) {
    console.error('[SEO] Notification error:', e.message);
  }
}

// =============================================================================
// KEYWORD ALERT
// =============================================================================

async function runKeywordAlert(seoConfig) {
  console.log('\n========================================');
  console.log('[SEO] 🔔 Running Keyword Alert Check (Business Keywords Only)');
  console.log('========================================\n');

  const siteUrl = seoConfig?.siteUrl || 'sc-domain:visionxbrain.com';
  const dropThreshold = seoConfig?.keywordDropThreshold || 3;
  const topThreshold = seoConfig?.topRankThreshold || 10;
  const keywordCount = seoConfig?.monitoredKeywordsCount || 50; // fetch more, filter later

  if (!searchConsole.isConfigured()) {
    console.log('[SEO] Search Console not configured, skipping alert');
    return { success: false, error: 'Search Console not configured' };
  }

  const data = loadData();

  try {
    // Current period: last 3 days (fresher data)
    const current = await fetchSCData(siteUrl, daysAgo(4), daysAgo(1), keywordCount);
    // Previous period: 4-7 days ago
    const previous = await fetchSCData(siteUrl, daysAgo(8), daysAgo(5), keywordCount);

    const prevMap = {};
    for (const q of previous.topQueries) {
      prevMap[q.keys[0]] = q;
    }

    const alerts = [];

    // Only check BUSINESS keywords — skip irrelevant ones
    const bizCurrent = filterBusinessKeywords(current.topQueries);
    console.log(`[SEO] Monitoring ${bizCurrent.length}/${current.topQueries.length} business keywords`);

    for (const q of bizCurrent) {
      const keyword = q.keys[0];
      const prev = prevMap[keyword];
      if (!prev) continue;

      const posDiff = Math.round((q.position - prev.position) * 10) / 10;

      // Alert 1: keyword dropped > threshold positions
      if (posDiff > dropThreshold) {
        alerts.push({
          type: 'position_drop',
          keyword,
          currentPos: q.position,
          previousPos: prev.position,
          drop: posDiff,
          clicks: q.clicks,
          impressions: q.impressions,
        });
      }

      // Alert 2: keyword fell out of top N
      if (prev.position <= topThreshold && q.position > topThreshold) {
        alerts.push({
          type: 'left_top10',
          keyword,
          currentPos: q.position,
          previousPos: prev.position,
          clicks: q.clicks,
        });
      }
    }

    // Also check service pages for traffic drops
    const pageAlerts = [];
    const currentSvcPages = current.corePages || [];
    const prevSvcMap = {};
    for (const p of (previous.corePages || [])) {
      prevSvcMap[p.keys[0]] = p;
    }
    for (const p of currentSvcPages) {
      const prev = prevSvcMap[p.keys[0]];
      if (!prev) continue;
      // Alert if clicks dropped significantly
      if (prev.clicks > 2 && p.clicks === 0) {
        pageAlerts.push({
          type: 'page_traffic_drop',
          page: p.keys[0].replace('https://www.visionxbrain.com', ''),
          currentClicks: p.clicks,
          previousClicks: prev.clicks,
        });
      }
    }

    const totalAlerts = alerts.length + pageAlerts.length;

    if (totalAlerts > 0) {
      let msg = `🚨 SEO Alert — ${totalAlerts} issue(s)\n\n`;

      for (const alert of alerts) {
        if (alert.type === 'position_drop') {
          msg += `⬇️ "${alert.keyword}" ตก ${alert.drop} pos (${formatPosition(alert.previousPos)} → ${formatPosition(alert.currentPos)})\n`;
        } else if (alert.type === 'left_top10') {
          msg += `❌ "${alert.keyword}" หลุด Top 10 (${formatPosition(alert.previousPos)} → ${formatPosition(alert.currentPos)})\n`;
        }
      }

      for (const pa of pageAlerts) {
        msg += `📉 ${pa.page} clicks ลดจาก ${pa.previousClicks} → ${pa.currentClicks}\n`;
      }

      msg += `\n🔧 Oracle กำลังวิเคราะห์สาเหตุ...`;

      try {
        await gateway.notifyOwner(msg);
        console.log('[SEO] Alert notification sent');
      } catch (e) {
        console.error('[SEO] Alert notify error:', e.message);
      }
    } else {
      // Still send a quiet "all good" daily
      console.log('[SEO] No keyword alerts — all business keywords stable');
    }

    // Save alerts
    const alertEntry = {
      date: new Date().toISOString(),
      alertCount: totalAlerts,
      alerts: [...alerts, ...pageAlerts],
      businessKeywordsMonitored: bizCurrent.length,
    };
    data.alerts.unshift(alertEntry);
    data.alerts = data.alerts.slice(0, 30);
    data.lastAlert = new Date().toISOString();
    saveDataFile(data);

    return { success: true, alertCount: totalAlerts, alerts: [...alerts, ...pageAlerts], businessKeywordsMonitored: bizCurrent.length };
  } catch (error) {
    console.error('[SEO] Keyword alert error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// MAIN — WEEKLY REPORT
// =============================================================================

async function runWeeklyReport(seoConfig) {
  console.log('\n========================================');
  console.log('[SEO] 📊 Starting Weekly SEO Report v2.0');
  console.log('========================================\n');

  const siteUrl = seoConfig?.siteUrl || 'sc-domain:visionxbrain.com';
  const keywordCount = seoConfig?.monitoredKeywordsCount || 50; // fetch more, filter to business

  if (!searchConsole.isConfigured()) {
    console.log('[SEO] Search Console not configured, skipping');
    return { success: false, error: 'Search Console not configured' };
  }

  const data = loadData();
  const now = new Date();

  try {
    // 1. Fetch current week (last 7 days, with SC data delay of ~2 days)
    const currentData = await fetchSCData(siteUrl, daysAgo(9), daysAgo(2), keywordCount);

    // 2. Fetch previous week for comparison
    const previousData = await fetchSCData(siteUrl, daysAgo(16), daysAgo(9), keywordCount);

    // 3. Compare (uses all keywords for trend detection)
    const comparison = comparePeriodsData(currentData, previousData);

    // 4. Auto-fix: sitemap ping + indexing check
    const autoActions = [];
    let sitemapUrls = [];
    let notIndexed = [];
    try {
      sitemapUrls = await fetchSitemap(siteUrl);
      if (sitemapUrls.length > 0) {
        // Quick indexing check
        const scPages = await searchConsole.searchAnalytics(siteUrl, {
          dimensions: ['page'],
          rowLimit: 1000,
          startDate: daysAgo(30),
          endDate: daysAgo(1),
        });
        const scUrlSet = new Set(scPages.map(p => p.keys[0]));
        notIndexed = sitemapUrls.filter(u => !scUrlSet.has(u));

        const { actions } = await autoFixIndexing(sitemapUrls, notIndexed);
        autoActions.push(...actions);
      }
    } catch (e) {
      console.error('[SEO] Auto-fix error:', e.message);
    }

    // 5. AI analysis (with auto-actions context)
    const analysis = await generateSEOAnalysis(currentData, comparison, autoActions);

    const weekNum = getWeekNumber(now);
    const report = {
      weekLabel: `W${weekNum}/${now.getFullYear()}`,
      generatedAt: now.toISOString(),
      siteUrl,
      currentData,
      comparison,
      analysis,
      autoActions,
      indexing: {
        sitemapTotal: sitemapUrls.length,
        notIndexedCount: notIndexed.length,
        coverageRate: sitemapUrls.length > 0
          ? Math.round((1 - notIndexed.length / sitemapUrls.length) * 10000) / 100
          : 0,
      },
    };

    // 6. Save everywhere
    await saveToSupabase(report);
    saveToLocal(report);
    await sendReportNotification(report);

    // 7. Store report
    data.reports.unshift(report);
    data.reports = data.reports.slice(0, 20);
    data.lastReport = now.toISOString();
    data.totalRuns = (data.totalRuns || 0) + 1;
    saveDataFile(data);

    console.log(`[SEO] Weekly report v2.0 complete! Business keywords: ${currentData.businessQueries.length}, Service pages: ${currentData.corePages.length}`);
    return { success: true, report };
  } catch (error) {
    console.error('[SEO] Error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// SITEMAP AUDIT
// =============================================================================

async function fetchSitemap(siteUrl) {
  const baseUrl = siteUrl.replace('sc-domain:', 'https://www.');
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  console.log(`[SEO] Fetching sitemap: ${sitemapUrl}`);

  try {
    const response = await fetch(sitemapUrl);
    if (!response.ok) throw new Error(`Sitemap fetch failed: ${response.status}`);
    const xml = await response.text();

    // Parse URLs from XML (simple regex — works for standard sitemaps)
    const urls = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      // Skip nested sitemap references (they end with .xml)
      if (!url.endsWith('.xml')) {
        urls.push(url);
      }
    }

    console.log(`[SEO] Sitemap: ${urls.length} URLs found`);
    return urls;
  } catch (error) {
    console.error('[SEO] Sitemap fetch error:', error.message);
    return [];
  }
}

function categorizeSitemapUrls(urls) {
  const categories = {
    main: [],
    services: [],
    location: [],
    blog: [],
    blogCategory: [],
    showcase: [],
    integration: [],
    other: [],
  };

  for (const url of urls) {
    const path = url.replace(/https?:\/\/[^/]+/, '');
    if (path.startsWith('/services/')) categories.services.push(url);
    else if (path.startsWith('/location/')) categories.location.push(url);
    else if (path.startsWith('/blog/category/')) categories.blogCategory.push(url);
    else if (path.startsWith('/blog/')) categories.blog.push(url);
    else if (path.startsWith('/showcase/') || path.startsWith('/portfolio/')) categories.showcase.push(url);
    else if (path.startsWith('/integration')) categories.integration.push(url);
    else if (path === '/' || path.split('/').filter(Boolean).length <= 1) categories.main.push(url);
    else categories.other.push(url);
  }

  return categories;
}

async function runSitemapAudit(seoConfig) {
  console.log('\n========================================');
  console.log('[SEO] 🗺️ Running Sitemap Audit');
  console.log('========================================\n');

  const siteUrl = seoConfig?.siteUrl || 'sc-domain:visionxbrain.com';

  if (!searchConsole.isConfigured()) {
    return { success: false, error: 'Search Console not configured' };
  }

  try {
    // 1. Fetch sitemap URLs
    const sitemapUrls = await fetchSitemap(siteUrl);
    if (sitemapUrls.length === 0) {
      return { success: false, error: 'No URLs found in sitemap' };
    }

    // 2. Fetch all pages from Search Console (high limit)
    const scPages = await searchConsole.searchAnalytics(siteUrl, {
      dimensions: ['page'],
      rowLimit: 1000,
      startDate: daysAgo(30),
      endDate: daysAgo(1),
    });

    const scUrlSet = new Set(scPages.map(p => p.keys[0]));
    const scUrlMap = {};
    for (const p of scPages) {
      scUrlMap[p.keys[0]] = p;
    }

    // 3. Compare: sitemap URLs vs Search Console URLs
    const notIndexed = []; // in sitemap but 0 data in SC
    const lowPerformers = []; // in SC but very low metrics
    const highPotential = []; // high impressions but 0 or very low clicks

    for (const url of sitemapUrls) {
      const scData = scUrlMap[url];
      if (!scData) {
        notIndexed.push(url);
      } else if (scData.impressions > 20 && scData.clicks === 0) {
        highPotential.push({ url, ...scData });
      } else if (scData.impressions > 0 && scData.ctr < 1 && scData.position > 20) {
        lowPerformers.push({ url, ...scData });
      }
    }

    // 4. Pages in SC but not in sitemap
    const notInSitemap = [];
    const sitemapSet = new Set(sitemapUrls);
    for (const p of scPages) {
      if (!sitemapSet.has(p.keys[0]) && p.clicks > 0) {
        notInSitemap.push({ url: p.keys[0], ...p });
      }
    }

    // 5. Categorize
    const categories = categorizeSitemapUrls(sitemapUrls);

    const audit = {
      date: new Date().toISOString(),
      sitemapTotal: sitemapUrls.length,
      scTotal: scPages.length,
      categories: {
        main: categories.main.length,
        services: categories.services.length,
        location: categories.location.length,
        blog: categories.blog.length,
        blogCategory: categories.blogCategory.length,
        showcase: categories.showcase.length,
        integration: categories.integration.length,
        other: categories.other.length,
      },
      notIndexedCount: notIndexed.length,
      notIndexedSample: notIndexed.slice(0, 20),
      highPotential: highPotential.sort((a, b) => b.impressions - a.impressions).slice(0, 10),
      lowPerformers: lowPerformers.sort((a, b) => b.impressions - a.impressions).slice(0, 10),
      notInSitemap: notInSitemap.slice(0, 10),
      coverageRate: Math.round((1 - notIndexed.length / sitemapUrls.length) * 10000) / 100,
    };

    // 6. Save audit data
    const data = loadData();
    data.lastAudit = audit;
    saveDataFile(data);

    // 7. Auto-fix: ping sitemap + categorize
    const { actions: autoActions, notIndexedByType } = await autoFixIndexing(sitemapUrls, notIndexed);
    audit.autoActions = autoActions;
    audit.notIndexedByType = {
      coreServices: notIndexedByType.coreServices.length,
      locationServices: notIndexedByType.locationServices.length,
      location: notIndexedByType.location.length,
      blog: notIndexedByType.blog.length,
      other: notIndexedByType.other.length,
    };

    // 8. Send notification — actionable format
    let msg = `🗺️ Sitemap Audit — VXB\n\n`;
    msg += `Coverage: ${audit.coverageRate}% (${audit.sitemapTotal - notIndexed.length}/${audit.sitemapTotal})\n\n`;

    // Show NOT indexed breakdown by type
    if (notIndexed.length > 0) {
      msg += `❌ Not Indexed:\n`;
      if (notIndexedByType.coreServices.length > 0) {
        msg += `🔴 Core Services: ${notIndexedByType.coreServices.length} (CRITICAL!)\n`;
        for (const u of notIndexedByType.coreServices.slice(0, 3)) {
          msg += `   → ${u.replace('https://www.visionxbrain.com', '')}\n`;
        }
      }
      if (notIndexedByType.locationServices.length > 0) msg += `🏙️ Location-Services: ${notIndexedByType.locationServices.length} (programmatic)\n`;
      if (notIndexedByType.blog.length > 0) msg += `📝 Blog: ${notIndexedByType.blog.length}\n`;
      if (notIndexedByType.location.length > 0) msg += `📍 Location: ${notIndexedByType.location.length} (ปกติ)\n`;
      if (notIndexedByType.other.length > 0) msg += `📄 Other: ${notIndexedByType.other.length}\n`;
      msg += '\n';
    }

    // High potential pages — Oracle will auto-fix these
    if (highPotential.length > 0) {
      msg += `⚡ High Potential (imp สูง, 0 clicks):\n`;
      for (const p of highPotential.slice(0, 5)) {
        const pagePath = p.url.replace('https://www.visionxbrain.com', '');
        msg += `→ ${pagePath} (${p.impressions} imp, pos ${formatPosition(p.position)})\n`;
      }
      msg += '\n';
    }

    // Auto-actions
    if (autoActions.length > 0) {
      msg += `🔧 Oracle ทำแล้ว:\n`;
      for (const a of autoActions) {
        msg += `✅ ${a}\n`;
      }
    }

    try {
      await gateway.notifyOwner(msg);
    } catch (e) {
      console.error('[SEO] Audit notify error:', e.message);
    }

    console.log(`[SEO] Sitemap audit complete: ${audit.sitemapTotal} URLs, ${audit.coverageRate}% coverage`);
    return { success: true, audit };
  } catch (error) {
    console.error('[SEO] Sitemap audit error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

function getKeywordSummary() {
  const data = loadData();
  const lastReport = data.reports[0];
  if (!lastReport) return 'ยังไม่มีข้อมูล SEO — ลอง "seo report" ก่อน';

  const t = lastReport.currentData.totals;
  const bizQueries = lastReport.currentData.businessQueries || filterBusinessKeywords(lastReport.currentData.topQueries);

  let msg = `🔑 VXB Business Keywords\n`;
  msg += `📊 Clicks: ${t.clicks} | Imp: ${t.impressions.toLocaleString()} | CTR: ${t.ctr}%\n\n`;

  for (let i = 0; i < Math.min(bizQueries.length, 15); i++) {
    const q = bizQueries[i];
    msg += `${i + 1}. "${q.keys[0]}" — pos ${formatPosition(q.position)}, ${q.clicks} clicks\n`;
  }

  if (bizQueries.length === 0) {
    msg += '(ยังไม่มี business keywords ที่ rank)\n';
  }

  msg += `\n📅 อัพเดท: ${new Date(lastReport.generatedAt).toLocaleDateString('th-TH')}`;
  return msg;
}

function getLatestAlerts() {
  const data = loadData();
  if (data.alerts.length === 0) return 'ยังไม่มี SEO alerts — ระบบจะเช็คทุกวัน 08:00';

  const latest = data.alerts[0];
  if (latest.alertCount === 0) {
    return `✅ SEO Alert Check (${new Date(latest.date).toLocaleDateString('th-TH')})\nไม่มี keyword ตก — ทุกอย่างปกติ`;
  }

  let msg = `🚨 SEO Alerts (${new Date(latest.date).toLocaleDateString('th-TH')})\n`;
  msg += `พบ ${latest.alertCount} keyword(s) ที่ต้องดูแล:\n\n`;

  for (const alert of latest.alerts) {
    if (alert.type === 'position_drop') {
      msg += `⬇️ "${alert.keyword}" ตก ${alert.drop} pos (${alert.previousPos} → ${alert.currentPos})\n`;
    } else if (alert.type === 'left_top10') {
      msg += `❌ "${alert.keyword}" หลุด Top 10 (${alert.previousPos} → ${alert.currentPos})\n`;
    }
  }

  return msg;
}

// =============================================================================
// EXPORTS
// =============================================================================

function runNow(seoConfig) { return runWeeklyReport(seoConfig); }

function getStatus() {
  const data = loadData();
  const lastReport = data.reports[0];
  return {
    configured: searchConsole.isConfigured(),
    siteUrl: 'visionxbrain.com',
    lastReport: data.lastReport,
    lastAlert: data.lastAlert,
    totalRuns: data.totalRuns || 0,
    reportsStored: data.reports.length,
    alertsStored: data.alerts.length,
    lastMetrics: lastReport?.currentData?.totals ? {
      clicks: lastReport.currentData.totals.clicks,
      impressions: lastReport.currentData.totals.impressions,
      ctr: lastReport.currentData.totals.ctr,
      position: lastReport.currentData.totals.position,
      grade: lastReport.analysis?.grade,
    } : null,
    nextReport: 'Monday 10:30 (Bangkok)',
    nextAlert: 'Daily 08:00 (Bangkok)',
  };
}

function getLatestReport() {
  const data = loadData();
  return data.reports.length > 0 ? data.reports[0] : null;
}

export default {
  runWeeklyReport,
  runKeywordAlert,
  runSitemapAudit,
  getKeywordSummary,
  getLatestAlerts,
  runNow,
  getStatus,
  getLatestReport,
};
