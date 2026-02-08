/**
 * Forbes Weekly Summary v1.0
 * ดึงข่าว Forbes → AI สรุปภาษาไทย → ส่ง LINE ทุกวันจันทร์ 09:00
 *
 * Pattern: ตาม autonomous-ideas.js
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
  // RSS feeds
  feeds: [
    { url: 'https://www.forbes.com/innovation/feed2/', category: 'Tech/AI' },
    { url: 'https://www.forbes.com/business/feed2/', category: 'Business' },
    { url: 'https://www.forbes.com/money/feed2/', category: 'Investment' },
  ],

  // Topics Tars สนใจ
  relevantTopics: ['AI', 'artificial intelligence', 'startup', 'investment', 'tech', 'automation', 'SaaS', 'crypto', 'bitcoin', 'hotel', 'hospitality', 'Thailand', 'Southeast Asia'],

  // Max articles per feed
  maxArticlesPerFeed: 15,

  // Summary: 5-7 top stories
  topStoriesCount: 7,

  // Local save path
  oracleMemoryPath: '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory',

  // Data file
  dataFile: path.join(__dirname, '../data/forbes-weekly.json'),
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
    console.error('[FORBES] Error loading data:', e.message);
  }
  return { summaries: [], lastRun: null, totalRuns: 0 };
}

function saveData(data) {
  try {
    const dir = path.dirname(CONFIG.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[FORBES] Error saving data:', e.message);
  }
}

// =============================================================================
// RSS FETCH (simple XML parsing without dependencies)
// =============================================================================

async function fetchRSS(feedUrl) {
  const { default: https } = await import('https');
  const { default: http } = await import('http');

  return new Promise((resolve, reject) => {
    const client = feedUrl.startsWith('https') ? https : http;
    const req = client.get(feedUrl, { headers: { 'User-Agent': 'OracleAgent/1.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchRSS(res.headers.location).then(resolve).catch(reject);
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
  return str
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// FETCH ALL FEEDS
// =============================================================================

async function fetchAllFeeds() {
  console.log('[FORBES] Fetching RSS feeds...');
  const allArticles = [];

  for (const feed of CONFIG.feeds) {
    try {
      console.log(`[FORBES] Fetching ${feed.category}: ${feed.url}`);
      const xml = await fetchRSS(feed.url);
      const items = parseRSSItems(xml).slice(0, CONFIG.maxArticlesPerFeed);

      for (const item of items) {
        allArticles.push({ ...item, feedCategory: feed.category });
      }

      console.log(`[FORBES] Got ${items.length} articles from ${feed.category}`);
    } catch (e) {
      console.error(`[FORBES] Error fetching ${feed.category}:`, e.message);
    }

    // Rate limit between feeds
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[FORBES] Total articles fetched: ${allArticles.length}`);
  return allArticles;
}

// =============================================================================
// AI SUMMARIZE
// =============================================================================

async function summarizeArticles(articles) {
  if (!articles || articles.length === 0) {
    console.log('[FORBES] No articles to summarize');
    return null;
  }

  console.log(`[FORBES] Summarizing ${articles.length} articles with AI...`);

  // Build article list for AI
  const articleList = articles.map((a, i) =>
    `${i + 1}. [${a.feedCategory}] ${a.title}\n   ${a.description}\n   Author: ${a.author || 'N/A'} | Categories: ${a.categories.join(', ') || 'N/A'}`
  ).join('\n\n');

  const now = new Date();
  const weekNum = getWeekNumber(now);
  const year = now.getFullYear();

  const prompt = `คุณเป็นนักข่าวเทคโนโลยีและธุรกิจระดับโลก ที่สรุปข่าวให้ผู้บริหารไทย

จากข่าว Forbes สัปดาห์นี้ ให้สรุปเป็นภาษาไทย:

${articleList}

---

สรุปให้ Tars (เจ้าของธุรกิจโรงแรมใน Pai + นักพัฒนา AI/SaaS + นักลงทุน Gold/Crypto):

**กรุณาตอบเป็น JSON เท่านั้น:**
{
  "weekLabel": "สัปดาห์ที่ ${weekNum}/${year}",
  "topStories": [
    {
      "title": "ชื่อข่าว (ภาษาไทย)",
      "originalTitle": "Original English title",
      "category": "Tech/AI/Business/Investment/Startup",
      "summary": "สรุป 2-3 ประโยค ภาษาไทย กระชับ อ่านง่าย",
      "relevanceToTars": "เกี่ยวกับ Tars อย่างไร (1 ประโยค)",
      "link": "URL ของข่าว (ถ้ามี)"
    }
  ],
  "insights": [
    "Actionable insight สำหรับ Tars (ภาษาไทย)",
    "อีก insight..."
  ],
  "trendSummary": "ภาพรวมเทรนด์สัปดาห์นี้ 2-3 ประโยค"
}

**กฎ:**
1. เลือก ${CONFIG.topStoriesCount} ข่าวที่เด่นและเกี่ยวข้องกับ Tars มากที่สุด
2. เน้น: Tech, AI, Business, Investment, Startup
3. insights ต้อง actionable (Tars ทำอะไรได้บ้าง)
4. ตอบ JSON เท่านั้น ห้ามมีข้อความอื่น`;

  try {
    const response = await claude.chat([{ role: 'user', content: prompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000
    });

    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const summary = JSON.parse(jsonMatch[0]);
      summary.generatedAt = now.toISOString();
      summary.articleCount = articles.length;
      return summary;
    }

    console.error('[FORBES] Could not parse AI response as JSON');
    return null;
  } catch (e) {
    console.error('[FORBES] AI summarize error:', e.message);
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
  if (!pool) {
    console.log('[FORBES] No database pool, skipping Supabase save');
    return;
  }

  try {
    const topStories = summary.topStories || [];
    const storiesList = topStories.map((s, i) => `${i + 1}. ${s.title}: ${s.summary}`).join('\n');
    const insightsList = (summary.insights || []).map(i => `- ${i}`).join('\n');

    const content = `📰 Forbes Weekly Summary - ${summary.weekLabel}

🔥 Top Stories:
${storiesList}

💡 Insights:
${insightsList}

📊 Trend: ${summary.trendSummary || 'N/A'}
📅 Generated: ${summary.generatedAt}
📄 Articles analyzed: ${summary.articleCount}`;

    let embedding = null;
    try {
      embedding = await generateEmbedding(`Forbes weekly news summary ${summary.weekLabel} tech AI business investment`);
    } catch (e) {
      console.log('[FORBES] Embedding error:', e.message);
    }

    const searchText = `forbes weekly summary ${summary.weekLabel} ${topStories.map(s => s.title).join(' ')}`.toLowerCase().substring(0, 1000);

    await query(`
      INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text${embedding ? ', embedding' : ''})
      VALUES ($1, $2, $3, $4, $5, $6${embedding ? ', $7' : ''})
    `, embedding
      ? ['tars', content, { source: 'forbes-weekly', week: summary.weekLabel, stories: topStories.length }, 'news_summary', 0.7, searchText, embedding]
      : ['tars', content, { source: 'forbes-weekly', week: summary.weekLabel, stories: topStories.length }, 'news_summary', 0.7, searchText]
    );

    console.log('[FORBES] Saved to Supabase');
  } catch (error) {
    console.error('[FORBES] Supabase save error:', error.message);
  }
}

// =============================================================================
// SAVE TO LOCAL (ψ/memory/logs/)
// =============================================================================

function saveToLocal(summary) {
  const logsDir = path.join(CONFIG.oracleMemoryPath, 'logs');
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `${today}-forbes.md`);

  try {
    const topStories = summary.topStories || [];
    const insights = summary.insights || [];

    let md = `# 📰 Forbes Weekly Summary - ${summary.weekLabel}\n\n`;
    md += `Generated: ${summary.generatedAt}\n`;
    md += `Articles analyzed: ${summary.articleCount}\n\n`;
    md += `---\n\n`;

    md += `## 🔥 Top Stories\n\n`;
    for (let i = 0; i < topStories.length; i++) {
      const s = topStories[i];
      md += `### ${i + 1}. ${s.title}\n`;
      md += `**[${s.category}]** ${s.originalTitle || ''}\n\n`;
      md += `${s.summary}\n\n`;
      if (s.relevanceToTars) md += `> 🎯 **Tars:** ${s.relevanceToTars}\n\n`;
      if (s.link) md += `🔗 ${s.link}\n\n`;
      md += `---\n\n`;
    }

    md += `## 💡 Insights สำหรับ Tars\n\n`;
    for (const insight of insights) {
      md += `- ${insight}\n`;
    }
    md += '\n';

    if (summary.trendSummary) {
      md += `## 📊 Trend สรุป\n\n${summary.trendSummary}\n`;
    }

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(logFile, md);
    console.log(`[FORBES] Saved to local: ${logFile}`);
  } catch (error) {
    console.error('[FORBES] Local save error:', error.message);
  }
}

// =============================================================================
// LINE NOTIFICATION
// =============================================================================

async function sendLineNotification(summary, config) {
  const ownerId = config?.line?.owner_id || LINE_OWNER_ID;
  const topStories = summary.topStories || [];
  const insights = summary.insights || [];

  let msg = `📰 Forbes Weekly Summary\n`;
  msg += `📅 ${summary.weekLabel}\n\n`;

  msg += `🔥 Top Stories:\n`;
  for (let i = 0; i < topStories.length; i++) {
    const s = topStories[i];
    msg += `${i + 1}. [${s.category}] ${s.title}\n`;
    msg += `   ${s.summary}\n\n`;
  }

  msg += `💡 Insight สำหรับ Tars:\n`;
  for (const insight of insights) {
    msg += `- ${insight}\n`;
  }

  if (summary.trendSummary) {
    msg += `\n📊 ${summary.trendSummary}`;
  }

  try {
    await gateway.notifyOwner(msg);
    console.log('[FORBES] Notification sent');
  } catch (e) {
    console.error('[FORBES] Notification error:', e.message);
  }
}

// =============================================================================
// MAIN: RUN WEEKLY SUMMARY
// =============================================================================

async function runWeeklySummary(config) {
  console.log('\n========================================');
  console.log('[FORBES] 📰 Starting Forbes Weekly Summary');
  console.log('========================================\n');

  const data = loadData();

  try {
    // 1. Fetch RSS feeds
    const articles = await fetchAllFeeds();
    if (articles.length === 0) {
      console.log('[FORBES] No articles fetched, aborting');
      return { success: false, error: 'No articles fetched' };
    }

    // 2. AI Summarize
    const summary = await summarizeArticles(articles);
    if (!summary) {
      console.log('[FORBES] AI summarization failed');
      return { success: false, error: 'Summarization failed' };
    }

    // 3. Save to Supabase
    await saveToSupabase(summary);

    // 4. Save to local
    saveToLocal(summary);

    // 5. Send LINE notification
    await sendLineNotification(summary, config);

    // 6. Update data file
    data.summaries.unshift(summary);
    data.summaries = data.summaries.slice(0, 20); // Keep last 20
    data.lastRun = summary.generatedAt;
    data.totalRuns = (data.totalRuns || 0) + 1;
    saveData(data);

    console.log('[FORBES] Weekly summary complete!');

    return {
      success: true,
      summary,
      storiesCount: (summary.topStories || []).length,
      articlesAnalyzed: articles.length,
    };
  } catch (error) {
    console.error('[FORBES] Weekly summary error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

function runNow(config) {
  return runWeeklySummary(config);
}

function getStatus() {
  const data = loadData();
  return {
    lastRun: data.lastRun,
    totalRuns: data.totalRuns || 0,
    summariesStored: data.summaries.length,
    feeds: CONFIG.feeds.map(f => f.category),
    nextRun: 'Monday 09:00 (Bangkok)',
  };
}

function getLatestSummary() {
  const data = loadData();
  if (data.summaries.length === 0) return null;
  return data.summaries[0];
}

export default {
  runWeeklySummary,
  runNow,
  getStatus,
  getLatestSummary,
};
