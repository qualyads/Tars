/**
 * Weekly Revenue Dashboard v1.0
 * สรุปยอด booking/revenue ทุกสัปดาห์จาก Beds24
 *
 * Metrics: Occupancy, ADR, RevPAR, Revenue
 * Compare: Week-over-Week
 *
 * @version 1.0.0
 */

import beds24 from './beds24.js';
import claude from './claude.js';
import line from './line.js';
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
  totalRooms: 11, // The Arch Casa
  oracleMemoryPath: '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory',
  dataFile: path.join(__dirname, '../data/weekly-revenue.json'),
  monthlyTarget: 500000, // THB
};

const LINE_OWNER_ID = 'Uba2ae89ff15d0ca1ea673058844f287c';

// =============================================================================
// DATA STORAGE
// =============================================================================

function loadData() {
  try {
    if (fs.existsSync(CONFIG.dataFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
    }
  } catch (e) {
    console.error('[REVENUE] Error loading data:', e.message);
  }
  return { reports: [], lastRun: null, totalRuns: 0 };
}

function saveDataFile(data) {
  try {
    const dir = path.dirname(CONFIG.dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[REVENUE] Error saving data:', e.message);
  }
}

// =============================================================================
// DATE HELPERS
// =============================================================================

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDateRange(endDate, days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// =============================================================================
// FETCH WEEKLY DATA FROM BEDS24
// =============================================================================

async function fetchWeeklyData(endDate) {
  const dates = getDateRange(endDate, 7);
  console.log(`[REVENUE] Fetching data for ${dates[0]} to ${dates[6]}`);

  const dailyData = [];
  const allBookingIds = new Set();
  const allBookings = [];

  for (const date of dates) {
    try {
      const occupancy = await beds24.getOccupancyForDate(date);

      const dayBookings = occupancy.bookings || [];
      let dayRevenue = 0;

      for (const booking of dayBookings) {
        const price = parseFloat(booking.price) || 0;
        const arrival = booking.arrival || booking.firstNight;
        const departure = booking.departure || booking.lastNight;

        // Calculate nights to get per-night rate
        let nights = 1;
        if (arrival && departure) {
          const diffMs = new Date(departure) - new Date(arrival);
          nights = Math.max(1, Math.round(diffMs / 86400000));
        }

        const nightlyRate = price / nights;
        dayRevenue += nightlyRate;

        // Track unique bookings
        const bookingId = booking.id || booking.bookId || `${booking.roomId}-${arrival}`;
        if (!allBookingIds.has(bookingId)) {
          allBookingIds.add(bookingId);
          allBookings.push({
            id: bookingId,
            roomId: booking.roomId,
            guest: booking.guestName || booking.firstName || 'Unknown',
            arrival,
            departure,
            nights,
            totalPrice: price,
            nightlyRate: Math.round(nightlyRate),
            source: booking.referer || booking.source || 'Direct',
          });
        }
      }

      dailyData.push({
        date,
        occupiedRooms: occupancy.occupiedRooms || 0,
        totalRooms: occupancy.totalRooms || CONFIG.totalRooms,
        occupancyRate: occupancy.occupancyRate || 0,
        revenue: Math.round(dayRevenue),
        bookingCount: dayBookings.length,
      });

      console.log(`[REVENUE] ${date}: ${occupancy.occupancyRate || 0}% occ, ${Math.round(dayRevenue)} THB`);
    } catch (e) {
      console.error(`[REVENUE] Error fetching ${date}:`, e.message);
      dailyData.push({
        date,
        occupiedRooms: 0,
        totalRooms: CONFIG.totalRooms,
        occupancyRate: 0,
        revenue: 0,
        bookingCount: 0,
        error: e.message,
      });
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 500));
  }

  return { dailyData, allBookings };
}

// =============================================================================
// CALCULATE METRICS
// =============================================================================

function calculateMetrics(dailyData, allBookings) {
  const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalOccupiedRoomNights = dailyData.reduce((sum, d) => sum + d.occupiedRooms, 0);
  const totalAvailableRoomNights = dailyData.reduce((sum, d) => sum + d.totalRooms, 0);

  const avgOccupancy = totalAvailableRoomNights > 0
    ? Math.round((totalOccupiedRoomNights / totalAvailableRoomNights) * 100)
    : 0;

  const adr = totalOccupiedRoomNights > 0
    ? Math.round(totalRevenue / totalOccupiedRoomNights)
    : 0;

  const revpar = totalAvailableRoomNights > 0
    ? Math.round(totalRevenue / totalAvailableRoomNights)
    : 0;

  // Best and worst days
  const bestDay = dailyData.reduce((best, d) => d.revenue > best.revenue ? d : best, dailyData[0]);
  const worstDay = dailyData.reduce((worst, d) => d.revenue < worst.revenue ? d : worst, dailyData[0]);

  // Booking sources
  const sources = {};
  for (const b of allBookings) {
    const src = b.source || 'Direct';
    if (!sources[src]) sources[src] = { count: 0, revenue: 0 };
    sources[src].count++;
    sources[src].revenue += b.totalPrice;
  }

  return {
    totalRevenue,
    totalOccupiedRoomNights,
    totalAvailableRoomNights,
    avgOccupancy,
    adr, // Average Daily Rate
    revpar, // Revenue Per Available Room
    bestDay: { date: bestDay.date, revenue: bestDay.revenue, occupancy: bestDay.occupancyRate },
    worstDay: { date: worstDay.date, revenue: worstDay.revenue, occupancy: worstDay.occupancyRate },
    uniqueBookings: allBookings.length,
    sources,
  };
}

// =============================================================================
// WEEK-OVER-WEEK COMPARISON
// =============================================================================

function compareWithLastWeek(currentMetrics, data) {
  if (data.reports.length === 0) {
    return null;
  }

  const lastReport = data.reports[0];
  const lastMetrics = lastReport.metrics;
  if (!lastMetrics) return null;

  const revenueChange = lastMetrics.totalRevenue > 0
    ? Math.round(((currentMetrics.totalRevenue - lastMetrics.totalRevenue) / lastMetrics.totalRevenue) * 100)
    : 0;

  const occupancyChange = currentMetrics.avgOccupancy - (lastMetrics.avgOccupancy || 0);
  const adrChange = currentMetrics.adr - (lastMetrics.adr || 0);
  const revparChange = currentMetrics.revpar - (lastMetrics.revpar || 0);

  return {
    revenueChange,
    occupancyChange,
    adrChange,
    revparChange,
    lastWeekRevenue: lastMetrics.totalRevenue,
    lastWeekOccupancy: lastMetrics.avgOccupancy,
  };
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

async function generateAIAnalysis(metrics, comparison, dailyData) {
  const prompt = `คุณเป็น Revenue Manager โรงแรมมืออาชีพ วิเคราะห์ผลประกอบการ The Arch Casa (ปาย, 11 ห้อง)

**ข้อมูลสัปดาห์นี้:**
- Revenue รวม: ${metrics.totalRevenue.toLocaleString()} บาท
- Occupancy เฉลี่ย: ${metrics.avgOccupancy}%
- ADR: ${metrics.adr.toLocaleString()} บาท
- RevPAR: ${metrics.revpar.toLocaleString()} บาท
- วันที่ดีที่สุด: ${metrics.bestDay.date} (${metrics.bestDay.revenue.toLocaleString()} บาท, ${metrics.bestDay.occupancy}%)
- วันที่แย่ที่สุด: ${metrics.worstDay.date} (${metrics.worstDay.revenue.toLocaleString()} บาท, ${metrics.worstDay.occupancy}%)
- จำนวน booking: ${metrics.uniqueBookings}

**รายวัน:**
${dailyData.map(d => `${d.date}: ${d.occupancyRate}% occ, ${d.revenue.toLocaleString()} THB`).join('\n')}

${comparison ? `**เทียบสัปดาห์ก่อน:**
- Revenue: ${comparison.revenueChange > 0 ? '+' : ''}${comparison.revenueChange}%
- Occupancy: ${comparison.occupancyChange > 0 ? '+' : ''}${comparison.occupancyChange}%
- ADR: ${comparison.adrChange > 0 ? '+' : ''}${comparison.adrChange} บาท` : '(ไม่มีข้อมูลสัปดาห์ก่อน)'}

**เป้าหมายรายเดือน:** ${CONFIG.monthlyTarget.toLocaleString()} บาท

ตอบเป็น JSON:
{
  "assessment": "ประเมินภาพรวม 1-2 ประโยค",
  "highlights": ["จุดเด่น 1", "จุดเด่น 2"],
  "concerns": ["สิ่งที่ต้องระวัง"],
  "recommendations": ["แนะนำสิ่งที่ควรทำสัปดาห์หน้า"],
  "monthlyProjection": "คาดการณ์ revenue สิ้นเดือน",
  "grade": "A/B/C/D/F"
}

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: prompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500
    });
    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[REVENUE] AI analysis error:', e.message);
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
    const m = report.metrics;
    const content = `📊 Weekly Revenue Report - ${report.weekLabel}

💰 Revenue: ${m.totalRevenue.toLocaleString()} THB
🏨 Occupancy: ${m.avgOccupancy}%
📈 ADR: ${m.adr.toLocaleString()} THB
📊 RevPAR: ${m.revpar.toLocaleString()} THB
📋 Bookings: ${m.uniqueBookings}
${report.comparison ? `📉 WoW Revenue: ${report.comparison.revenueChange > 0 ? '+' : ''}${report.comparison.revenueChange}%` : ''}
🎯 Grade: ${report.analysis?.grade || 'N/A'}
💭 ${report.analysis?.assessment || 'N/A'}`;

    let embedding = null;
    try {
      embedding = await generateEmbedding(`hotel revenue report weekly ${report.weekLabel} occupancy ADR RevPAR`);
    } catch (e) { /* skip */ }

    const searchText = `weekly revenue ${report.weekLabel} ${m.totalRevenue} occupancy ${m.avgOccupancy}`.substring(0, 1000);

    await query(`
      INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text${embedding ? ', embedding' : ''})
      VALUES ($1, $2, $3, $4, $5, $6${embedding ? ', $7' : ''})
    `, embedding
      ? ['tars', content, { source: 'weekly-revenue', week: report.weekLabel, revenue: m.totalRevenue, occupancy: m.avgOccupancy }, 'report', 0.8, searchText, embedding]
      : ['tars', content, { source: 'weekly-revenue', week: report.weekLabel, revenue: m.totalRevenue, occupancy: m.avgOccupancy }, 'report', 0.8, searchText]
    );
    console.log('[REVENUE] Saved to Supabase');
  } catch (error) {
    console.error('[REVENUE] Supabase save error:', error.message);
  }
}

// =============================================================================
// SAVE TO LOCAL
// =============================================================================

function saveToLocal(report) {
  const logsDir = path.join(CONFIG.oracleMemoryPath, 'logs');
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `${today}-revenue.md`);

  try {
    const m = report.metrics;
    const c = report.comparison;
    const a = report.analysis;

    let md = `# 📊 Weekly Revenue Dashboard - ${report.weekLabel}\n\n`;
    md += `Generated: ${report.generatedAt}\n\n---\n\n`;

    md += `## 💰 Key Metrics\n\n`;
    md += `| Metric | Value | ${c ? 'WoW Change' : ''} |\n`;
    md += `|--------|-------|${c ? '------------|' : ''}\n`;
    md += `| Revenue | ${m.totalRevenue.toLocaleString()} THB | ${c ? `${c.revenueChange > 0 ? '+' : ''}${c.revenueChange}%` : ''} |\n`;
    md += `| Occupancy | ${m.avgOccupancy}% | ${c ? `${c.occupancyChange > 0 ? '+' : ''}${c.occupancyChange}%` : ''} |\n`;
    md += `| ADR | ${m.adr.toLocaleString()} THB | ${c ? `${c.adrChange > 0 ? '+' : ''}${c.adrChange}` : ''} |\n`;
    md += `| RevPAR | ${m.revpar.toLocaleString()} THB | ${c ? `${c.revparChange > 0 ? '+' : ''}${c.revparChange}` : ''} |\n`;
    md += `| Bookings | ${m.uniqueBookings} | |\n\n`;

    md += `## 📅 Daily Breakdown\n\n`;
    md += `| Date | Occ% | Rooms | Revenue |\n`;
    md += `|------|------|-------|--------|\n`;
    for (const d of report.dailyData) {
      md += `| ${d.date} | ${d.occupancyRate}% | ${d.occupiedRooms}/${d.totalRooms} | ${d.revenue.toLocaleString()} |\n`;
    }
    md += '\n';

    if (Object.keys(m.sources).length > 0) {
      md += `## 📋 Booking Sources\n\n`;
      md += `| Source | Bookings | Revenue |\n`;
      md += `|--------|----------|--------|\n`;
      for (const [src, data] of Object.entries(m.sources)) {
        md += `| ${src} | ${data.count} | ${data.revenue.toLocaleString()} |\n`;
      }
      md += '\n';
    }

    if (a) {
      md += `## 🎯 AI Analysis (Grade: ${a.grade})\n\n`;
      md += `**Assessment:** ${a.assessment}\n\n`;
      if (a.highlights?.length) md += `**Highlights:**\n${a.highlights.map(h => `- ✅ ${h}`).join('\n')}\n\n`;
      if (a.concerns?.length) md += `**Concerns:**\n${a.concerns.map(c => `- ⚠️ ${c}`).join('\n')}\n\n`;
      if (a.recommendations?.length) md += `**Recommendations:**\n${a.recommendations.map(r => `- 💡 ${r}`).join('\n')}\n\n`;
      if (a.monthlyProjection) md += `**Monthly Projection:** ${a.monthlyProjection}\n`;
    }

    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(logFile, md);
    console.log(`[REVENUE] Saved to local: ${logFile}`);
  } catch (error) {
    console.error('[REVENUE] Local save error:', error.message);
  }
}

// =============================================================================
// LINE NOTIFICATION
// =============================================================================

async function sendLineNotification(report, config) {
  const ownerId = config?.line?.owner_id || LINE_OWNER_ID;
  const m = report.metrics;
  const c = report.comparison;
  const a = report.analysis;

  let msg = `📊 Weekly Revenue Dashboard\n`;
  msg += `📅 ${report.weekLabel}\n`;
  if (a?.grade) msg += `🎯 Grade: ${a.grade}\n`;
  msg += '\n';

  msg += `💰 Revenue: ${m.totalRevenue.toLocaleString()} THB`;
  if (c) msg += ` (${c.revenueChange > 0 ? '+' : ''}${c.revenueChange}%)`;
  msg += '\n';

  msg += `🏨 Occupancy: ${m.avgOccupancy}%`;
  if (c) msg += ` (${c.occupancyChange > 0 ? '+' : ''}${c.occupancyChange}%)`;
  msg += '\n';

  msg += `📈 ADR: ${m.adr.toLocaleString()} THB\n`;
  msg += `📊 RevPAR: ${m.revpar.toLocaleString()} THB\n`;
  msg += `📋 Bookings: ${m.uniqueBookings}\n\n`;

  msg += `📅 รายวัน:\n`;
  for (const d of report.dailyData) {
    const dayName = new Date(d.date).toLocaleDateString('th-TH', { weekday: 'short' });
    msg += `${dayName} ${d.date.slice(5)}: ${d.occupancyRate}% | ${d.revenue.toLocaleString()}\n`;
  }

  if (a) {
    msg += `\n💭 ${a.assessment}\n`;
    if (a.recommendations?.length) {
      msg += `\n💡 แนะนำ:\n`;
      for (const r of a.recommendations) msg += `- ${r}\n`;
    }
    if (a.monthlyProjection) msg += `\n📈 คาดการณ์เดือนนี้: ${a.monthlyProjection}`;
  }

  try {
    await gateway.notifyHotelTeam(msg);
    console.log('[REVENUE] Notification sent to hotel team');
  } catch (e) {
    console.error('[REVENUE] Notification error:', e.message);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function runWeeklyReport(config) {
  console.log('\n========================================');
  console.log('[REVENUE] 📊 Starting Weekly Revenue Report');
  console.log('========================================\n');

  const data = loadData();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    // 1. Fetch 7 days of data
    const { dailyData, allBookings } = await fetchWeeklyData(yesterday);

    // 2. Calculate metrics
    const metrics = calculateMetrics(dailyData, allBookings);

    // 3. Compare with last week
    const comparison = compareWithLastWeek(metrics, data);

    // 4. AI analysis
    const analysis = await generateAIAnalysis(metrics, comparison, dailyData);

    const weekNum = getWeekNumber(now);
    const report = {
      weekLabel: `สัปดาห์ที่ ${weekNum}/${now.getFullYear()}`,
      generatedAt: now.toISOString(),
      metrics,
      comparison,
      analysis,
      dailyData,
      bookingCount: allBookings.length,
    };

    // 5. Save everywhere
    await saveToSupabase(report);
    saveToLocal(report);
    await sendLineNotification(report, config);

    // 6. Store report
    data.reports.unshift(report);
    data.reports = data.reports.slice(0, 20);
    data.lastRun = now.toISOString();
    data.totalRuns = (data.totalRuns || 0) + 1;
    saveDataFile(data);

    console.log('[REVENUE] Weekly report complete!');
    return { success: true, report };
  } catch (error) {
    console.error('[REVENUE] Error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

function runNow(config) { return runWeeklyReport(config); }

function getStatus() {
  const data = loadData();
  const lastReport = data.reports[0];
  return {
    lastRun: data.lastRun,
    totalRuns: data.totalRuns || 0,
    reportsStored: data.reports.length,
    lastMetrics: lastReport?.metrics ? {
      revenue: lastReport.metrics.totalRevenue,
      occupancy: lastReport.metrics.avgOccupancy,
      adr: lastReport.metrics.adr,
      revpar: lastReport.metrics.revpar,
      grade: lastReport.analysis?.grade,
    } : null,
    nextRun: 'Monday 10:00 (Bangkok)',
  };
}

function getLatestReport() {
  const data = loadData();
  return data.reports.length > 0 ? data.reports[0] : null;
}

export default { runWeeklyReport, runNow, getStatus, getLatestReport };
