/**
 * SEO Auto-Optimize Engine v1.0
 * Monitor VisionXBrain SEO → วิเคราะห์ → แนะนำ action → ส่ง LINE
 *
 * Pipeline: Search Console → Compare → AI Analysis → Notify
 *
 * @version 1.0.0
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
    searchConsole.topPages(siteUrl, { limit: 20, startDate, endDate }),
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

  return {
    topQueries,
    topPages,
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

async function generateSEOAnalysis(currentData, comparison) {
  const prompt = `คุณเป็น SEO Strategist มืออาชีพ วิเคราะห์ performance ของ visionxbrain.com (Webflow Agency ไทย)

**ข้อมูลสัปดาห์นี้:**
- Clicks: ${currentData.totals.clicks}
- Impressions: ${currentData.totals.impressions.toLocaleString()}
- CTR: ${currentData.totals.ctr}%
- Avg Position: ${currentData.totals.position}

**Top Keywords:**
${currentData.topQueries.slice(0, 15).map((q, i) =>
  `${i + 1}. "${q.keys[0]}" — pos ${q.position}, clicks ${q.clicks}, imp ${q.impressions}, CTR ${q.ctr}%`
).join('\n')}

**Top Pages:**
${currentData.topPages.slice(0, 10).map((p, i) =>
  `${i + 1}. ${p.keys[0].replace('https://www.visionxbrain.com', '')} — clicks ${p.clicks}, imp ${p.impressions}`
).join('\n')}

**Device Breakdown:**
${currentData.byDevice.map(d => `${d.keys[0]}: clicks ${d.clicks}, CTR ${d.ctr}%`).join(', ')}

${comparison ? `**เทียบสัปดาห์ก่อน:**
- Clicks: ${comparison.clicksChange > 0 ? '+' : ''}${comparison.clicksChange}%
- Impressions: ${comparison.impressionsChange > 0 ? '+' : ''}${comparison.impressionsChange}%
- CTR Change: ${comparison.ctrChange > 0 ? '+' : ''}${comparison.ctrChange}%
- Position: ${comparison.positionChange > 0 ? '↑' : '↓'}${Math.abs(comparison.positionChange)}

Keywords ขึ้น: ${comparison.keywordsUp.slice(0, 5).map(k => `"${k.keyword}" ↑${k.change}`).join(', ') || 'ไม่มี'}
Keywords ตก: ${comparison.keywordsDown.slice(0, 5).map(k => `"${k.keyword}" ↓${Math.abs(k.change)}`).join(', ') || 'ไม่มี'}` : '(ไม่มีข้อมูลสัปดาห์ก่อน)'}

ตอบเป็น JSON:
{
  "grade": "A/A+/B+/B/C/D/F",
  "assessment": "ประเมินภาพรวม 2-3 ประโยค",
  "opportunities": ["keyword/topic ที่มี potential แต่ยังไม่ได้ push"],
  "problems": ["ปัญหาที่ต้องแก้"],
  "recommendations": ["action ที่ควรทำสัปดาห์นี้"],
  "contentGaps": ["หัวข้อที่ควรเขียนบทความ พร้อมเหตุผล"]
}

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: prompt }], {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      skipAutoRecall: true,
    });
    // claude.chat() returns string directly, not API response object
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
  return { assessment: 'ไม่สามารถวิเคราะห์ได้', grade: '?' };
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

    md += `## 🔑 Top Keywords\n\n`;
    md += `| # | Keyword | Position | Clicks | Impressions | CTR |\n`;
    md += `|---|---------|----------|--------|-------------|-----|\n`;
    for (let i = 0; i < Math.min(report.currentData.topQueries.length, 20); i++) {
      const q = report.currentData.topQueries[i];
      md += `| ${i + 1} | ${q.keys[0]} | ${q.position} | ${q.clicks} | ${q.impressions} | ${q.ctr}% |\n`;
    }
    md += '\n';

    md += `## 📄 Top Pages\n\n`;
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
      md += `**Assessment:** ${a.assessment}\n\n`;
      if (a.opportunities?.length) md += `**Opportunities:**\n${a.opportunities.map(o => `- ${o}`).join('\n')}\n\n`;
      if (a.problems?.length) md += `**Problems:**\n${a.problems.map(p => `- ${p}`).join('\n')}\n\n`;
      if (a.recommendations?.length) md += `**Recommendations:**\n${a.recommendations.map(r => `- ${r}`).join('\n')}\n\n`;
      if (a.contentGaps?.length) md += `**Content Gaps:**\n${a.contentGaps.map(g => `- ${g}`).join('\n')}\n`;
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

  let msg = `🔍 Weekly SEO Report — ${report.weekLabel}\n`;
  if (a?.grade) msg += `🎯 Grade: ${a.grade}\n`;
  msg += '\n';

  msg += `📊 Clicks: ${t.clicks}`;
  if (c) msg += ` (${c.clicksChange > 0 ? '+' : ''}${c.clicksChange}%)`;
  msg += ` | Imp: ${t.impressions >= 1000 ? (t.impressions / 1000).toFixed(1) + 'K' : t.impressions}`;
  if (c) msg += ` (${c.impressionsChange > 0 ? '+' : ''}${c.impressionsChange}%)`;
  msg += '\n';

  msg += `📈 CTR: ${t.ctr}% | Avg Pos: ${t.position}`;
  if (c) msg += ` (${c.positionChange > 0 ? '↑' : '↓'}${Math.abs(c.positionChange)})`;
  msg += '\n\n';

  // Top keywords
  msg += `🔑 Keywords:\n`;
  for (let i = 0; i < Math.min(report.currentData.topQueries.length, 8); i++) {
    const q = report.currentData.topQueries[i];
    let line = `${i + 1}. "${q.keys[0]}" pos ${q.position}`;

    // Show change if comparison available
    if (c) {
      const upK = c.keywordsUp.find(k => k.keyword === q.keys[0]);
      const downK = c.keywordsDown.find(k => k.keyword === q.keys[0]);
      if (upK) line += ` ↑${upK.change}`;
      if (downK) line += ` ↓${Math.abs(downK.change)}`;
    }
    msg += line + '\n';
  }

  if (a) {
    msg += `\n💭 ${a.assessment}\n`;

    if (a.recommendations?.length) {
      msg += `\n💡 แนะนำ:\n`;
      for (const r of a.recommendations.slice(0, 3)) msg += `- ${r}\n`;
    }

    if (a.contentGaps?.length) {
      msg += `\n📝 Content Gaps:\n`;
      for (const g of a.contentGaps.slice(0, 2)) msg += `- ${g}\n`;
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
  console.log('[SEO] 🔔 Running Keyword Alert Check');
  console.log('========================================\n');

  const siteUrl = seoConfig?.siteUrl || 'sc-domain:visionxbrain.com';
  const dropThreshold = seoConfig?.keywordDropThreshold || 3;
  const topThreshold = seoConfig?.topRankThreshold || 10;
  const keywordCount = seoConfig?.monitoredKeywordsCount || 20;

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

    for (const q of current.topQueries) {
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

    if (alerts.length > 0) {
      let msg = `🚨 SEO Alert — ${alerts.length} keyword(s) need attention\n\n`;

      for (const alert of alerts) {
        if (alert.type === 'position_drop') {
          msg += `⬇️ "${alert.keyword}" ตก ${alert.drop} positions (${alert.previousPos} → ${alert.currentPos})\n`;
        } else if (alert.type === 'left_top10') {
          msg += `❌ "${alert.keyword}" หลุด Top 10 (${alert.previousPos} → ${alert.currentPos})\n`;
        }
      }

      try {
        await gateway.notifyOwner(msg);
        console.log('[SEO] Alert notification sent');
      } catch (e) {
        console.error('[SEO] Alert notify error:', e.message);
      }
    } else {
      console.log('[SEO] No keyword alerts');
    }

    // Save alerts
    const alertEntry = {
      date: new Date().toISOString(),
      alertCount: alerts.length,
      alerts,
    };
    data.alerts.unshift(alertEntry);
    data.alerts = data.alerts.slice(0, 30);
    data.lastAlert = new Date().toISOString();
    saveDataFile(data);

    return { success: true, alertCount: alerts.length, alerts };
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
  console.log('[SEO] 🔍 Starting Weekly SEO Report');
  console.log('========================================\n');

  const siteUrl = seoConfig?.siteUrl || 'sc-domain:visionxbrain.com';
  const keywordCount = seoConfig?.monitoredKeywordsCount || 20;

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

    // 3. Compare
    const comparison = comparePeriodsData(currentData, previousData);

    // 4. AI analysis
    const analysis = await generateSEOAnalysis(currentData, comparison);

    const weekNum = getWeekNumber(now);
    const report = {
      weekLabel: `สัปดาห์ที่ ${weekNum}/${now.getFullYear()}`,
      generatedAt: now.toISOString(),
      siteUrl,
      currentData,
      comparison,
      analysis,
    };

    // 5. Save everywhere
    await saveToSupabase(report);
    saveToLocal(report);
    await sendReportNotification(report);

    // 6. Store report
    data.reports.unshift(report);
    data.reports = data.reports.slice(0, 20);
    data.lastReport = now.toISOString();
    data.totalRuns = (data.totalRuns || 0) + 1;
    saveDataFile(data);

    console.log('[SEO] Weekly report complete!');
    return { success: true, report };
  } catch (error) {
    console.error('[SEO] Error:', error);
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
  const queries = lastReport.currentData.topQueries;

  let msg = `🔑 SEO Keywords — visionxbrain.com\n`;
  msg += `📊 Clicks: ${t.clicks} | Imp: ${t.impressions.toLocaleString()} | CTR: ${t.ctr}%\n\n`;

  for (let i = 0; i < Math.min(queries.length, 15); i++) {
    const q = queries[i];
    msg += `${i + 1}. "${q.keys[0]}" — pos ${q.position}, ${q.clicks} clicks\n`;
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
  getKeywordSummary,
  getLatestAlerts,
  runNow,
  getStatus,
  getLatestReport,
};
