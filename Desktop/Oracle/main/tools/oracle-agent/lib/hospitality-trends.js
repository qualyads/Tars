/**
 * Hospitality Industry Trends Weekly v1.0
 * ดึงข่าวอุตสาหกรรมโรงแรม/ท่องเที่ยว → AI สรุปภาษาไทย + วิเคราะห์เทรนด์ปาย
 *
 * Sources: Skift, Hospitality Net, Hotel Dive, TTG Asia, PhocusWire
 * Special: วิเคราะห์กลุ่มอายุ + เทรนด์นักท่องเที่ยวปาย
 *
 * @version 1.0.0
 */

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
  feeds: [
    { url: 'https://skift.com/feed/', category: 'Travel Industry', needsUA: false },
    { url: 'https://www.hospitalitynet.org/news/global.xml', category: 'Hotel Industry', needsUA: false },
    { url: 'https://www.hoteldive.com/feeds/news/', category: 'Hotel Operations', needsUA: false },
    { url: 'https://www.ttgasia.com/RSS/rss_feed.xml', category: 'Asia-Pacific Travel', needsUA: false },
    { url: 'https://www.phocuswire.com/RSS/All-News', category: 'Travel Tech', needsUA: true },
  ],

  maxArticlesPerFeed: 10,
  topStoriesCount: 7,
  oracleMemoryPath: '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory',
  dataFile: path.join(__dirname, '../data/hospitality-trends.json'),

  // Tars's hotel context
  tarsContext: `
Tars เป็นเจ้าของโรงแรมในปาย:
- The Arch Casa: Design Boutique Hotel, 11 ห้อง, 2,000-3,500 บาท/คืน
- Betel Palm Village: Boutique Hotel, 4 ห้อง, 1,500-2,500 บาท/คืน
- Paddy Fields Haven: Homestay/Bamboo Glamping, 3 ห้อง, 800-1,500 บาท/คืน
- 365 Vila: Family Villa, 1 ห้อง, 3,500-5,000 บาท/คืน

ปาย (แม่ฮ่องสอน):
- เมืองท่องเที่ยวเล็กๆ ในภาคเหนือ
- High season: พ.ย.-ก.พ. (อากาศเย็น)
- Low season: เม.ย.-ก.ย. (ฝน)
- นักท่องเที่ยว: ไทย (ส่วนใหญ่) + ต่างชาติ (backpackers, digital nomads)
- คู่แข่ง: โรงแรม/รีสอร์ทขนาดเล็กจำนวนมาก
`,
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
    console.error('[HOSP] Error loading data:', e.message);
  }
  return { summaries: [], lastRun: null, totalRuns: 0 };
}

function saveData(data) {
  try {
    const dir = path.dirname(CONFIG.dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[HOSP] Error saving data:', e.message);
  }
}

// =============================================================================
// RSS FETCH
// =============================================================================

async function fetchRSS(feedUrl, needsUA = false) {
  const { default: https } = await import('https');
  const { default: http } = await import('http');

  return new Promise((resolve, reject) => {
    const client = feedUrl.startsWith('https') ? https : http;
    const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };
    if (!needsUA) headers['User-Agent'] = 'OracleAgent/1.0';

    const req = client.get(feedUrl, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchRSS(res.headers.location, needsUA).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${feedUrl}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const creator = extractTag(itemXml, 'dc:creator');
    const categories = extractAllTags(itemXml, 'category');

    if (title) {
      items.push({
        title: cleanHTML(title),
        link,
        description: cleanHTML(description || '').substring(0, 500),
        pubDate,
        author: creator || '',
        categories,
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(regex);
  return m ? (m[1] || m[2] || '').trim() : '';
}

function extractAllTags(xml, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const val = (m[1] || m[2] || '').trim();
    if (val) results.push(val);
  }
  return results;
}

function cleanHTML(str) {
  return str.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// =============================================================================
// FETCH ALL FEEDS
// =============================================================================

async function fetchAllFeeds() {
  console.log('[HOSP] Fetching hospitality RSS feeds...');
  const allArticles = [];

  for (const feed of CONFIG.feeds) {
    try {
      console.log(`[HOSP] Fetching ${feed.category}: ${feed.url}`);
      const xml = await fetchRSS(feed.url, feed.needsUA);
      const items = parseRSSItems(xml).slice(0, CONFIG.maxArticlesPerFeed);
      for (const item of items) {
        allArticles.push({ ...item, feedCategory: feed.category });
      }
      console.log(`[HOSP] Got ${items.length} articles from ${feed.category}`);
    } catch (e) {
      console.error(`[HOSP] Error fetching ${feed.category}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[HOSP] Total articles fetched: ${allArticles.length}`);
  return allArticles;
}

// =============================================================================
// AI SUMMARIZE (with Pai Demographics Analysis)
// =============================================================================

async function summarizeArticles(articles) {
  if (!articles || articles.length === 0) return null;

  console.log(`[HOSP] Summarizing ${articles.length} articles with AI...`);

  const articleList = articles.map((a, i) =>
    `${i + 1}. [${a.feedCategory}] ${a.title}\n   ${a.description}`
  ).join('\n\n');

  const now = new Date();
  const weekNum = getWeekNumber(now);
  const year = now.getFullYear();

  const prompt = `คุณเป็นที่ปรึกษาอุตสาหกรรมโรงแรมระดับโลก วิเคราะห์เทรนด์ให้เจ้าของโรงแรมในปาย

**Context ของ Tars:**
${CONFIG.tarsContext}

**ข่าวอุตสาหกรรมโรงแรม/ท่องเที่ยวสัปดาห์นี้:**
${articleList}

---

**ตอบเป็น JSON เท่านั้น:**
{
  "weekLabel": "สัปดาห์ที่ ${weekNum}/${year}",
  "topStories": [
    {
      "title": "ชื่อข่าว (ภาษาไทย)",
      "originalTitle": "Original English title",
      "category": "Hotel/Travel/Tech/Asia",
      "summary": "สรุป 2-3 ประโยค ภาษาไทย",
      "impactOnPai": "ส่งผลต่อโรงแรมในปายอย่างไร (1-2 ประโยค)"
    }
  ],
  "paiTourismAnalysis": {
    "currentTrends": [
      "เทรนด์ท่องเที่ยวปายตอนนี้ (จากข่าว + ความรู้ทั่วไป)"
    ],
    "demographics": {
      "overview": "ภาพรวมนักท่องเที่ยวปาย",
      "ageGroups": [
        {
          "range": "18-25",
          "percentage": "ประมาณ %",
          "characteristics": "ลักษณะ, พฤติกรรม, งบประมาณ",
          "channels": "ช่องทางที่ใช้จอง (Agoda, Booking, walk-in, etc.)"
        },
        {
          "range": "26-35",
          "percentage": "ประมาณ %",
          "characteristics": "...",
          "channels": "..."
        },
        {
          "range": "36-50",
          "percentage": "ประมาณ %",
          "characteristics": "...",
          "channels": "..."
        },
        {
          "range": "50+",
          "percentage": "ประมาณ %",
          "characteristics": "...",
          "channels": "..."
        }
      ],
      "nationalityMix": "สัดส่วนไทย vs ต่างชาติ",
      "seasonalChanges": "กลุ่มอายุเปลี่ยนยังไงตามฤดูกาล"
    },
    "opportunities": [
      "โอกาสสำหรับ Tars จากเทรนด์ปัจจุบัน"
    ]
  },
  "actionableInsights": [
    "สิ่งที่ Tars ควรทำเลย (ภาษาไทย)",
    "..."
  ],
  "industryTrendSummary": "ภาพรวมเทรนด์อุตสาหกรรมสัปดาห์นี้ 2-3 ประโยค"
}

**กฎ:**
1. เลือก ${CONFIG.topStoriesCount} ข่าวเด่นที่เกี่ยวกับโรงแรม/ท่องเที่ยว
2. วิเคราะห์ผลกระทบต่อโรงแรมในปายโดยเฉพาะ
3. ส่วน demographics ให้วิเคราะห์ลึก ใช้ข้อมูลจากเทรนด์ปัจจุบัน + ความรู้ทั่วไปเกี่ยวกับปาย
4. actionableInsights ต้องทำได้จริง เฉพาะเจาะจงสำหรับโรงแรมใน Pai
5. ตอบ JSON เท่านั้น`;

  try {
    const response = await claude.chat([{ role: 'user', content: prompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000
    });

    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const summary = JSON.parse(jsonMatch[0]);
      summary.generatedAt = now.toISOString();
      summary.articleCount = articles.length;
      return summary;
    }
    console.error('[HOSP] Could not parse AI response');
    return null;
  } catch (e) {
    console.error('[HOSP] AI summarize error:', e.message);
    return null;
  }
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// =============================================================================
// SAVE TO SUPABASE
// =============================================================================

async function saveToSupabase(summary) {
  const pool = getPool();
  if (!pool) return;

  try {
    const stories = summary.topStories || [];
    const demographics = summary.paiTourismAnalysis?.demographics;
    const insights = summary.actionableInsights || [];

    const content = `🏨 Hospitality Trends - ${summary.weekLabel}

🔥 Top Stories:
${stories.map((s, i) => `${i + 1}. ${s.title}: ${s.summary}`).join('\n')}

👥 Pai Demographics:
${demographics ? `- ${demographics.overview}
- Nationality: ${demographics.nationalityMix}
${demographics.ageGroups?.map(g => `- ${g.range}: ${g.percentage} - ${g.characteristics}`).join('\n') || ''}` : 'N/A'}

💡 Insights:
${insights.map(i => `- ${i}`).join('\n')}

📊 Trend: ${summary.industryTrendSummary || 'N/A'}`;

    let embedding = null;
    try {
      embedding = await generateEmbedding(`hospitality hotel tourism Pai trends demographics ${summary.weekLabel}`);
    } catch (e) {
      console.log('[HOSP] Embedding error:', e.message);
    }

    const searchText = `hospitality trends ${summary.weekLabel} pai hotel tourism ${stories.map(s => s.title).join(' ')}`.toLowerCase().substring(0, 1000);

    await query(`
      INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text${embedding ? ', embedding' : ''})
      VALUES ($1, $2, $3, $4, $5, $6${embedding ? ', $7' : ''})
    `, embedding
      ? ['tars', content, { source: 'hospitality-trends', week: summary.weekLabel }, 'news_summary', 0.8, searchText, embedding]
      : ['tars', content, { source: 'hospitality-trends', week: summary.weekLabel }, 'news_summary', 0.8, searchText]
    );
    console.log('[HOSP] Saved to Supabase');
  } catch (error) {
    console.error('[HOSP] Supabase save error:', error.message);
  }
}

// =============================================================================
// SAVE TO LOCAL
// =============================================================================

function saveToLocal(summary) {
  const logsDir = path.join(CONFIG.oracleMemoryPath, 'logs');
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `${today}-hospitality.md`);

  try {
    const stories = summary.topStories || [];
    const demographics = summary.paiTourismAnalysis?.demographics;
    const paiTrends = summary.paiTourismAnalysis?.currentTrends || [];
    const opportunities = summary.paiTourismAnalysis?.opportunities || [];
    const insights = summary.actionableInsights || [];

    let md = `# 🏨 Hospitality Trends - ${summary.weekLabel}\n\n`;
    md += `Generated: ${summary.generatedAt}\n`;
    md += `Articles analyzed: ${summary.articleCount}\n\n---\n\n`;

    md += `## 🔥 Top Stories\n\n`;
    for (let i = 0; i < stories.length; i++) {
      const s = stories[i];
      md += `### ${i + 1}. ${s.title}\n`;
      md += `**[${s.category}]** ${s.originalTitle || ''}\n\n`;
      md += `${s.summary}\n\n`;
      if (s.impactOnPai) md += `> 🏔️ **ผลต่อปาย:** ${s.impactOnPai}\n\n`;
      md += `---\n\n`;
    }

    md += `## 🏔️ วิเคราะห์ท่องเที่ยวปาย\n\n`;

    if (paiTrends.length > 0) {
      md += `### เทรนด์ปัจจุบัน\n`;
      for (const t of paiTrends) md += `- ${t}\n`;
      md += '\n';
    }

    if (demographics) {
      md += `### 👥 กลุ่มนักท่องเที่ยว\n\n`;
      if (demographics.overview) md += `**ภาพรวม:** ${demographics.overview}\n\n`;
      if (demographics.nationalityMix) md += `**สัดส่วนสัญชาติ:** ${demographics.nationalityMix}\n\n`;

      if (demographics.ageGroups?.length > 0) {
        md += `| ช่วงอายุ | สัดส่วน | ลักษณะ | ช่องทางจอง |\n`;
        md += `|----------|---------|--------|------------|\n`;
        for (const g of demographics.ageGroups) {
          md += `| ${g.range} | ${g.percentage} | ${g.characteristics} | ${g.channels} |\n`;
        }
        md += '\n';
      }

      if (demographics.seasonalChanges) {
        md += `**การเปลี่ยนแปลงตามฤดูกาล:** ${demographics.seasonalChanges}\n\n`;
      }
    }

    if (opportunities.length > 0) {
      md += `### 🎯 โอกาสสำหรับ Tars\n`;
      for (const o of opportunities) md += `- ${o}\n`;
      md += '\n';
    }

    md += `## 💡 Action Items\n\n`;
    for (const insight of insights) md += `- ${insight}\n`;
    md += '\n';

    if (summary.industryTrendSummary) {
      md += `## 📊 ภาพรวมอุตสาหกรรม\n\n${summary.industryTrendSummary}\n`;
    }

    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(logFile, md);
    console.log(`[HOSP] Saved to local: ${logFile}`);
  } catch (error) {
    console.error('[HOSP] Local save error:', error.message);
  }
}

// =============================================================================
// LINE NOTIFICATION
// =============================================================================

async function sendLineNotification(summary, config) {
  const ownerId = config?.line?.owner_id || LINE_OWNER_ID;
  const stories = summary.topStories || [];
  const demographics = summary.paiTourismAnalysis?.demographics;
  const insights = summary.actionableInsights || [];

  let msg = `🏨 Hospitality Trends Weekly\n`;
  msg += `📅 ${summary.weekLabel}\n\n`;

  msg += `🔥 Top Stories:\n`;
  for (let i = 0; i < Math.min(5, stories.length); i++) {
    const s = stories[i];
    msg += `${i + 1}. [${s.category}] ${s.title}\n`;
    msg += `   ${s.summary}\n`;
    if (s.impactOnPai) msg += `   🏔️ ${s.impactOnPai}\n`;
    msg += '\n';
  }

  if (demographics?.ageGroups) {
    msg += `👥 นักท่องเที่ยวปาย:\n`;
    for (const g of demographics.ageGroups) {
      msg += `• ${g.range} ปี (${g.percentage}): ${g.characteristics}\n`;
    }
    if (demographics.nationalityMix) msg += `🌏 ${demographics.nationalityMix}\n`;
    msg += '\n';
  }

  msg += `💡 Action Items:\n`;
  for (const insight of insights) msg += `- ${insight}\n`;

  if (summary.industryTrendSummary) {
    msg += `\n📊 ${summary.industryTrendSummary}`;
  }

  try {
    await gateway.notifyOwner(msg);
    console.log('[HOSP] Notification sent');
  } catch (e) {
    console.error('[HOSP] Notification error:', e.message);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function runWeeklySummary(config) {
  console.log('\n========================================');
  console.log('[HOSP] 🏨 Starting Hospitality Trends Summary');
  console.log('========================================\n');

  const data = loadData();

  try {
    const articles = await fetchAllFeeds();
    if (articles.length === 0) {
      return { success: false, error: 'No articles fetched' };
    }

    const summary = await summarizeArticles(articles);
    if (!summary) {
      return { success: false, error: 'Summarization failed' };
    }

    await saveToSupabase(summary);
    saveToLocal(summary);
    await sendLineNotification(summary, config);

    data.summaries.unshift(summary);
    data.summaries = data.summaries.slice(0, 20);
    data.lastRun = summary.generatedAt;
    data.totalRuns = (data.totalRuns || 0) + 1;
    saveData(data);

    console.log('[HOSP] Weekly summary complete!');
    return {
      success: true,
      summary,
      storiesCount: (summary.topStories || []).length,
      articlesAnalyzed: articles.length,
    };
  } catch (error) {
    console.error('[HOSP] Error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

function runNow(config) { return runWeeklySummary(config); }

function getStatus() {
  const data = loadData();
  return {
    lastRun: data.lastRun,
    totalRuns: data.totalRuns || 0,
    summariesStored: data.summaries.length,
    feeds: CONFIG.feeds.map(f => f.category),
    nextRun: 'Monday 09:30 (Bangkok)',
  };
}

function getLatestSummary() {
  const data = loadData();
  return data.summaries.length > 0 ? data.summaries[0] : null;
}

export default { runWeeklySummary, runNow, getStatus, getLatestSummary };
