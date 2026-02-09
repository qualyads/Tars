/**
 * Autonomous Idea Engine v2.0
 * Oracle คิดเอง หา idea ทำเอง deploy เอง
 *
 * v2.0 Changes:
 * - Auto-save ideas to Supabase
 * - Direct LINE notification (no config needed)
 * - Better error handling
 *
 * @version 2.0.0
 */

import claude from './claude.js';
import localAgentServer from './local-agent-server.js';
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
  // How often to think (in hours)
  thinkingInterval: 6,

  // Ideas storage
  ideasFile: path.join(__dirname, '../data/autonomous-ideas.json'),

  // Minimum score to auto-execute (0-100)
  autoExecuteThreshold: 75,

  // Max ideas to generate per cycle
  maxIdeasPerCycle: 3,

  // Categories to explore — focused on VXB Digital Growth Partner
  categories: [
    'partner-acquisition',      // หาลูกค้า retainer ใหม่
    'vertical-expansion',       // เจาะ industry ใหม่ (โรงแรม, คลินิก, อสังหา, แฟรนไชส์)
    'service-productization',   // เปลี่ยน service → productized/SaaS
    'outbound-strategy',        // LinkedIn, email, referral, content marketing
    'retention-upsell',         // เพิ่ม LTV ลูกค้าเดิม, upsell services
    'competitive-advantage'     // AI automation, pricing, positioning vs agencies
  ],

  // VXB Digital Growth Partner context
  tarsContext: `
VisionXBrain (VXB) — Digital Growth Partner Agency
เป้าหมาย: 100M/ปี (8.33M/เดือน)

สถานะปัจจุบัน:
- เว็บ VXB: 700+ URLs (126 service pages, 77 location pages, 300+ blogs)
- บริการ: Web Design (Webflow), SEO, CRO, Content
- ราคา project: 80K-3M+
- Proof: 30x booking, 24x orders, 3x sales (case studies)
- Positioning เป้าหมาย: "Digital Growth Partner" (ไม่ใช่แค่รับทำเว็บ)

Revenue Mix เป้าหมาย:
- Enterprise Projects (2-10M/งาน): 48%
- Monthly Retainer (30-80K/ลูกค้า): 30% → ต้องมี 50 ราย
- SaaS / Productized: 18%
- Training / Course: 4%

Unfair Advantage:
- Tar + Oracle (AI) = ทำงานแทนทีม 8-15 คน
- Margin 85-95% (agency อื่น 30-40%)
- ไม่ต้องจ้างคน — Oracle ทำ SEO, content, audit, report, coding, automation

บริการที่กำลังเปิดใหม่:
- SEO Retainer (19,900-49,900/เดือน)
- Content Marketing (14,900-39,900/เดือน)
- Google Ads Management (15,000-50,000 + % ad spend)
- Monthly Report + Analytics (9,900-19,900/เดือน)
- AI Chatbot / Automation (29,900-99,900 setup + monthly)

ลูกค้าเป้าหมาย:
- โรงแรม/ที่พัก chain
- คลินิกเสริมความงาม/ทันตกรรม
- อสังหาริมทรัพย์
- แฟรนไชส์
- SME ที่ต้องการโตออนไลน์
- E-commerce brands

Tech Stack: Webflow, Next.js, Railway, AI APIs, n8n
ตลาด: ไทย (primary), SEA (expansion)
`
};

// =============================================================================
// IDEAS STORAGE
// =============================================================================

function loadIdeas() {
  try {
    if (fs.existsSync(CONFIG.ideasFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.ideasFile, 'utf8'));
    }
  } catch (e) {
    console.error('[IDEAS] Error loading ideas:', e.message);
  }
  return { ideas: [], lastThinking: null, executedIdeas: [], masterAutoExecute: false, toggles: {} };
}

function saveIdeas(data) {
  try {
    const dir = path.dirname(CONFIG.ideasFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.ideasFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[IDEAS] Error saving ideas:', e.message);
  }
}

// =============================================================================
// TOGGLE SYSTEM — Master switch + per-idea toggles
// =============================================================================

function getToggles() {
  const data = loadIdeas();
  return {
    masterAutoExecute: data.masterAutoExecute || false,
    toggles: data.toggles || {}
  };
}

function setMasterSwitch(enabled) {
  const data = loadIdeas();
  data.masterAutoExecute = !!enabled;
  saveIdeas(data);
  console.log(`[IDEAS] Master auto-execute: ${enabled ? 'ON' : 'OFF'}`);
  return getToggles();
}

function setToggle(name, enabled) {
  const data = loadIdeas();
  if (!data.toggles) data.toggles = {};
  data.toggles[name] = !!enabled;
  saveIdeas(data);
  console.log(`[IDEAS] Toggle ${name}: ${enabled ? 'ON' : 'OFF'}`);
  return getToggles();
}

// =============================================================================
// WEB RESEARCH (using Claude's knowledge + search hints)
// =============================================================================

async function researchTrends(category) {
  console.log(`[IDEAS] Researching trends in: ${category}`);

  const researchPrompt = `คุณเป็น digital agency growth strategist ที่เก่งมาก

หา 3 โอกาสเติบโตสำหรับ VisionXBrain ในหมวด "${category}" ที่:
1. ทำให้ได้ลูกค้า retainer ใหม่ หรือเพิ่มรายได้จากลูกค้าเดิม
2. เหมาะกับ agency ที่ใช้ AI ทำงานแทนทีมคน (margin 85-95%)
3. สามารถเริ่มทำได้ทันที หรือภายใน 1-2 สัปดาห์
4. เจาะตลาดไทย (SME, โรงแรม, คลินิก, อสังหา, แฟรนไชส์, E-commerce)

Context ของ VisionXBrain:
${CONFIG.tarsContext}

ตอบเป็น JSON array:
[
  {
    "trend": "โอกาส/กลยุทธ์",
    "opportunity": "ทำเงินได้อย่างไร (retainer/project/upsell)",
    "targetAudience": "กลุ่มลูกค้าเป้าหมายเฉพาะเจาะจง",
    "competition": "low/medium/high",
    "potentialRevenue": "ประมาณรายได้ต่อเดือนที่เพิ่มขึ้น",
    "actionable": "ขั้นตอนที่ทำได้ทันที 1-2-3"
  }
]

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: researchPrompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000
    });

    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[IDEAS] Research error:', e.message);
  }

  return [];
}

// =============================================================================
// IDEA GENERATION
// =============================================================================

async function generateIdeas(trends) {
  console.log('[IDEAS] Generating ideas from trends...');

  const ideaPrompt = `คุณเป็น digital agency growth strategist ที่ช่วย VisionXBrain หาลูกค้าและเพิ่มรายได้

**สำคัญมาก: ตอบเป็นภาษาไทยทั้งหมด!**

จากโอกาสเหล่านี้:
${JSON.stringify(trends, null, 2)}

สร้าง ${CONFIG.maxIdeasPerCycle} กลยุทธ์ที่ actionable สำหรับ VXB:
1. ทำได้ทันที ไม่ต้องรอ (Oracle + Tar ลงมือได้เลย)
2. เพิ่มรายได้ retainer/project อย่างน้อย 30-100K/เดือน
3. ใช้ AI (Oracle) ทำงาน 80%+ → margin สูง
4. ไม่ใช่ไอเดียลอยๆ — ต้องมีขั้นตอนชัดเจน

Context ของ VXB:
${CONFIG.tarsContext}

ตอบเป็น JSON array (ภาษาไทยทั้งหมด):
[
  {
    "name": "ชื่อกลยุทธ์ (สั้น ชัด)",
    "tagline": "สรุป 1 บรรทัด",
    "problem": "ปัญหาของลูกค้าเป้าหมายที่ VXB แก้ได้",
    "solution": "VXB ทำอะไรให้ (service/package)",
    "features": ["สิ่งที่ทำให้ลูกค้า 1", "สิ่งที่ทำให้ 2", "สิ่งที่ทำให้ 3"],
    "techStack": ["Webflow", "Oracle AI", "..."],
    "monetization": "รายได้: retainer X บาท/เดือน × Y ลูกค้า = Z บาท",
    "mvpScope": "ขั้นตอนเริ่มต้นที่ทำได้ใน 1-2 สัปดาห์",
    "estimatedHours": 8-40,
    "targetUsers": "ลูกค้าเป้าหมายเฉพาะเจาะจง (industry + ขนาด + pain point)"
  }
]

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: ideaPrompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000
    });

    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[IDEAS] Generation error:', e.message);
  }

  return [];
}

// =============================================================================
// IDEA SCORING
// =============================================================================

async function scoreIdea(idea) {
  console.log(`[IDEAS] Scoring idea: ${idea.name}`);

  const scorePrompt = `คุณเป็น agency growth advisor ที่ประเมินกลยุทธ์สำหรับ VisionXBrain

ประเมินกลยุทธ์นี้:
${JSON.stringify(idea, null, 2)}

ให้คะแนน 0-100 ในแต่ละด้าน:

1. **Feasibility** (ทำได้จริงด้วย Tar + Oracle AI ไหม? ไม่ต้องจ้างคนเพิ่ม?)
2. **Market Demand** (ลูกค้าไทยต้องการจริงไหม? มี pain point ชัดเจน?)
3. **Revenue Potential** (สร้างรายได้ retainer/project ได้เท่าไหร่ต่อเดือน?)
4. **Scalability** (ขยายได้ไหม? เพิ่มลูกค้าโดยไม่ต้องเพิ่มคน?)
5. **Speed to Revenue** (เริ่มหาเงินได้เร็วแค่ไหน? ภายใน 1-4 สัปดาห์?)
6. **VXB Fit** (สอดคล้องกับ positioning "Digital Growth Partner" ไหม? เสริม service เดิมไหม?)

ตอบเป็น JSON:
{
  "scores": {
    "feasibility": 0-100,
    "marketDemand": 0-100,
    "revenuePotential": 0-100,
    "scalability": 0-100,
    "speedToRevenue": 0-100,
    "vxbFit": 0-100
  },
  "totalScore": 0-100 (weighted average),
  "recommendation": "GO / MAYBE / SKIP",
  "reasoning": "เหตุผลสั้นๆ ว่าทำไม VXB ควร/ไม่ควรทำ",
  "risks": ["ความเสี่ยง 1", "ความเสี่ยง 2"],
  "suggestions": ["ข้อเสนอแนะเพื่อเพิ่มโอกาสสำเร็จ"]
}

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: scorePrompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800
    });

    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[IDEAS] Scoring error:', e.message);
  }

  return { totalScore: 0, recommendation: 'SKIP', reasoning: 'Could not score' };
}

// =============================================================================
// AUTO-EXECUTION
// =============================================================================

async function executeIdea(idea, score) {
  console.log(`[IDEAS] Auto-executing idea: ${idea.name}`);

  // Check if Local Agent is connected
  if (!localAgentServer.isConnected()) {
    console.log('[IDEAS] Local Agent not connected, skipping execution');
    return { success: false, error: 'Local Agent not connected' };
  }

  // Generate detailed prompt for Claude Code
  const buildPrompt = `สร้าง MVP สำหรับ "${idea.name}"

${idea.tagline}

**Problem:** ${idea.problem}
**Solution:** ${idea.solution}

**Features for MVP:**
${idea.features.map(f => `- ${f}`).join('\n')}

**Tech Stack:** ${idea.techStack.join(', ')}

**Scope:**
${idea.mvpScope}

**Requirements:**
1. สร้างเป็น Next.js 14 app (App Router)
2. ใช้ Tailwind CSS สำหรับ styling
3. Deploy ได้บน Railway
4. มี landing page + core feature
5. Mobile responsive

สร้างโปรเจคให้เสร็จสมบูรณ์พร้อม deploy`;

  try {
    // Execute workflow
    const result = await localAgentServer.executeWorkflow({
      projectName: idea.name.toLowerCase().replace(/\s+/g, '-'),
      prompt: buildPrompt,
      model: 'opus',
      deploy: true,
      notifyLine: true
    });

    return result;
  } catch (e) {
    console.error('[IDEAS] Execution error:', e.message);
    return { success: false, error: e.message };
  }
}

// =============================================================================
// SAVE TO LOCAL ORACLE MEMORY (ψ/memory/)
// =============================================================================

const ORACLE_MEMORY_PATH = '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory';

/**
 * Build markdown content from ideas for saving to files
 */
function buildIdeasMarkdown(ideas) {
  const today = new Date().toISOString().split('T')[0];
  let content = `# 📈 VXB Growth Strategy Engine - ${today}\n\n`;
  content += `Generated: ${new Date().toLocaleString('th-TH')}\n\n`;
  content += `---\n\n`;

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const score = idea.score?.totalScore || 0;
    const rec = idea.score?.recommendation || 'MAYBE';

    content += `## ${i + 1}. ${idea.name} (${score}/100) ${rec === 'GO' ? '🚀' : rec === 'SKIP' ? '⏭️' : '🤔'}\n\n`;
    content += `**${idea.tagline || 'No tagline'}**\n\n`;

    if (idea.problem) content += `❓ **ปัญหา:** ${idea.problem}\n\n`;
    if (idea.solution) content += `✅ **วิธีแก้:** ${idea.solution}\n\n`;
    if (idea.targetUsers) content += `👥 **กลุ่มเป้าหมาย:** ${idea.targetUsers}\n\n`;
    if (idea.monetization) content += `💰 **วิธีหาเงิน:** ${idea.monetization}\n\n`;
    if (idea.mvpScope) content += `🛠️ **MVP Scope:** ${idea.mvpScope}\n\n`;
    if (idea.estimatedHours) content += `⏱️ **เวลาสร้าง:** ${idea.estimatedHours} ชม.\n\n`;

    if (idea.features?.length > 0) {
      content += `**Features:**\n`;
      idea.features.forEach(f => content += `- ${f}\n`);
      content += '\n';
    }

    if (idea.techStack?.length > 0) {
      content += `**Tech Stack:** ${idea.techStack.join(', ')}\n\n`;
    }

    // Scores breakdown
    if (idea.score?.scores) {
      const s = idea.score.scores;
      content += `**📊 Scores:**\n`;
      content += `| Metric | Score |\n|--------|-------|\n`;
      if (s.feasibility) content += `| Feasibility | ${s.feasibility}/100 |\n`;
      if (s.marketDemand) content += `| Market Demand | ${s.marketDemand}/100 |\n`;
      if (s.revenuePotential) content += `| Revenue Potential | ${s.revenuePotential}/100 |\n`;
      if (s.competition) content += `| Competition | ${s.competition}/100 |\n`;
      if (s.maintenance) content += `| Maintenance | ${s.maintenance}/100 |\n`;
      if (s.tarsFit) content += `| Tars Fit | ${s.tarsFit}/100 |\n`;
      content += '\n';
    }

    if (idea.score?.reasoning) {
      content += `**💭 Reasoning:** ${idea.score.reasoning}\n\n`;
    }

    if (idea.score?.risks?.length > 0) {
      content += `**⚠️ Risks:** ${idea.score.risks.join(', ')}\n\n`;
    }

    content += `---\n\n`;
  }

  return content;
}

async function saveIdeasToOracleMemory(ideas) {
  if (!ideas || ideas.length === 0) {
    console.log('[IDEAS] No ideas to save to Oracle memory');
    return;
  }

  // Check if running on local Mac (path exists)
  if (!fs.existsSync(ORACLE_MEMORY_PATH)) {
    console.log('[IDEAS] Oracle memory path not found (running on Railway?), using Local Agent...');

    // Try to save via Local Agent shell command
    if (localAgentServer.isConnected()) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const content = buildIdeasMarkdown(ideas);
        const filePath = `${ORACLE_MEMORY_PATH}/logs/${today}-ideas.md`;

        // Use base64 encoding to safely pass content
        const base64Content = Buffer.from(content).toString('base64');

        // Create directory and decode base64 to file
        const result = await localAgentServer.executeShell(
          `mkdir -p "${ORACLE_MEMORY_PATH}/logs" && echo "${base64Content}" | base64 -d > "${filePath}"`,
          { approved: true }
        );

        console.log('[IDEAS] Local Agent result:', JSON.stringify(result));

        if (result && result.success) {
          console.log('[IDEAS] Saved ideas via Local Agent shell to:', filePath);
        } else {
          console.error('[IDEAS] Local Agent write failed:', result?.error || 'Unknown error');
        }
      } catch (e) {
        console.error('[IDEAS] Local Agent write error:', e.message);
      }
    }
    return;
  }

  try {
    // 1. Save to logs/YYYY-MM-DD-ideas.md
    const today = new Date().toISOString().split('T')[0];
    const logsDir = path.join(ORACLE_MEMORY_PATH, 'logs');
    const logFile = path.join(logsDir, `${today}-ideas.md`);

    // Build markdown content using helper function
    let content = buildIdeasMarkdown(ideas);

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Append to existing file if exists, otherwise create new
    if (fs.existsSync(logFile)) {
      const existing = fs.readFileSync(logFile, 'utf8');
      content = existing + '\n\n---\n\n# 🔄 Next Cycle\n\n' + content.split('---\n\n').slice(1).join('---\n\n');
    }

    fs.writeFileSync(logFile, content);
    console.log(`[IDEAS] Saved to Oracle memory: ${logFile}`);

    // 2. Update knowledge/saas-ideas.md (top ideas only)
    const knowledgeDir = path.join(ORACLE_MEMORY_PATH, 'knowledge');
    const saasFile = path.join(knowledgeDir, 'saas-ideas.md');

    const topIdeas = ideas.filter(i => (i.score?.totalScore || 0) >= 60).slice(0, 10);

    if (topIdeas.length > 0) {
      let saasContent = `# 📈 VXB Growth Strategies - Top Picks\n\n`;
      saasContent += `Last updated: ${new Date().toLocaleString('th-TH')}\n\n`;
      saasContent += `Strategies with score >= 60\n\n---\n\n`;

      for (const idea of topIdeas) {
        const score = idea.score?.totalScore || 0;
        saasContent += `## ${idea.name} (${score}/100)\n\n`;
        saasContent += `${idea.tagline || ''}\n\n`;
        if (idea.problem) saasContent += `- **ปัญหา:** ${idea.problem}\n`;
        if (idea.solution) saasContent += `- **วิธีแก้:** ${idea.solution}\n`;
        if (idea.monetization) saasContent += `- **หาเงิน:** ${idea.monetization}\n`;
        if (idea.estimatedHours) saasContent += `- **เวลา:** ${idea.estimatedHours} ชม.\n`;
        saasContent += '\n---\n\n';
      }

      if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
      }
      fs.writeFileSync(saasFile, saasContent);
      console.log(`[IDEAS] Updated knowledge: ${saasFile}`);
    }

  } catch (error) {
    console.error('[IDEAS] Oracle memory save error:', error.message);
  }
}

// =============================================================================
// SAVE TO SUPABASE
// =============================================================================

async function saveIdeasToSupabase(ideas) {
  const pool = getPool();
  if (!pool) {
    console.log('[IDEAS] No database pool, skipping Supabase save');
    return;
  }

  try {
    // Save each strategy separately for easy search
    for (const idea of ideas.slice(0, 5)) {
      const content = `📈 VXB Growth Strategy: ${idea.name}

📝 **${idea.tagline || 'No tagline'}**

🎯 Pain: ${idea.problem || 'N/A'}
💼 Service: ${idea.solution || 'N/A'}
👥 ลูกค้าเป้าหมาย: ${idea.targetUsers || 'N/A'}
💰 Revenue: ${idea.monetization || 'N/A'}
⚡ เริ่มยังไง: ${idea.mvpScope || 'N/A'}
⏱️ เวลา: ${idea.estimatedHours || 8} ชม.

📊 Score: ${idea.score?.totalScore || 0}/100
📋 Recommendation: ${idea.score?.recommendation || 'MAYBE'}
💰 Revenue Potential: ${idea.score?.scores?.revenuePotential || 0}/100
📈 Scalability: ${idea.score?.scores?.scalability || 0}/100`;

      let embedding = null;
      try {
        embedding = await generateEmbedding(`${idea.name} ${idea.problem} ${idea.solution} ${idea.targetUsers}`);
      } catch (e) {
        console.log('[IDEAS] Embedding error:', e.message);
      }

      const searchText = `${idea.name} ${idea.tagline} ${idea.problem} ${idea.solution}`.toLowerCase().substring(0, 1000);

      await query(`
        INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text${embedding ? ', embedding' : ''})
        VALUES ($1, $2, $3, $4, $5, $6${embedding ? ', $7' : ''})
      `, embedding
        ? ['tars', content, { source: 'vxb-growth-engine', strategy_name: idea.name, score: idea.score?.totalScore }, 'decision', 0.8, searchText, embedding]
        : ['tars', content, { source: 'vxb-growth-engine', strategy_name: idea.name, score: idea.score?.totalScore }, 'decision', 0.8, searchText]
      );
    }

    console.log('[IDEAS] Saved to Supabase:', Math.min(5, ideas.length), 'ideas');
  } catch (error) {
    console.error('[IDEAS] Supabase save error:', error.message);
  }
}

// =============================================================================
// NOTIFY TARS (Direct LINE)
// =============================================================================

// Line owner ID (hardcoded for reliability)
const LINE_OWNER_ID = 'Uba2ae89ff15d0ca1ea673058844f287c';

async function notifyTars(message, config) {
  try {
    await gateway.notifyOwner(message);
    console.log('[IDEAS] Notification sent');
  } catch (e) {
    console.error('[IDEAS] Notification error:', e.message);
  }
}

// =============================================================================
// MAIN THINKING LOOP
// =============================================================================

async function runThinkingCycle(config) {
  console.log('\n========================================');
  console.log('[IDEAS] 🧠 Starting Autonomous Thinking Cycle');
  console.log('========================================\n');

  const data = loadIdeas();
  const cycleStart = new Date().toISOString();

  try {
    // 1. Research trends
    console.log('[IDEAS] Step 1: Researching trends...');
    const allTrends = [];
    for (const category of CONFIG.categories.slice(0, 2)) { // Limit to 2 categories per cycle
      const trends = await researchTrends(category);
      allTrends.push(...trends);
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }
    console.log(`[IDEAS] Found ${allTrends.length} trends`);

    // 2. Generate ideas
    console.log('[IDEAS] Step 2: Generating ideas...');
    const ideas = await generateIdeas(allTrends);
    console.log(`[IDEAS] Generated ${ideas.length} ideas`);

    // 3. Score each idea
    console.log('[IDEAS] Step 3: Scoring ideas...');
    const scoredIdeas = [];
    for (const idea of ideas) {
      const score = await scoreIdea(idea);
      scoredIdeas.push({
        ...idea,
        score,
        generatedAt: cycleStart
      });
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }

    // Sort by score
    scoredIdeas.sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));

    // Save all ideas (local file)
    data.ideas = [...scoredIdeas, ...data.ideas].slice(0, 50); // Keep last 50 ideas
    data.lastThinking = cycleStart;
    saveIdeas(data);

    // Save to Supabase (persistent memory)
    await saveIdeasToSupabase(scoredIdeas);

    // Save to Oracle memory files (ψ/memory/)
    await saveIdeasToOracleMemory(scoredIdeas);

    // 4. Find best idea
    const bestIdea = scoredIdeas[0];
    if (!bestIdea) {
      console.log('[IDEAS] No ideas generated this cycle');
      return { success: false, message: 'No ideas generated' };
    }

    console.log(`\n[IDEAS] Best idea: ${bestIdea.name}`);
    console.log(`[IDEAS] Score: ${bestIdea.score?.totalScore || 0}`);
    console.log(`[IDEAS] Recommendation: ${bestIdea.score?.recommendation}`);

    // 5. Filter for high-quality ideas only (score >= 60 or recommendation GO/MAYBE)
    const qualityIdeas = scoredIdeas.filter(idea => {
      const score = idea.score?.totalScore || 0;
      const rec = idea.score?.recommendation;
      const revenuePotential = idea.score?.scores?.revenuePotential || 0;
      return score >= 60 || rec === 'GO' || revenuePotential >= 60;
    });

    // Only notify if there are quality ideas worth reporting
    if (qualityIdeas.length === 0) {
      console.log('[IDEAS] No high-quality ideas this cycle, skipping notification');
      return {
        success: true,
        executed: false,
        ideas: scoredIdeas,
        bestIdea,
        skippedNotification: true
      };
    }

    // Build detailed Thai message — VXB Growth Strategy
    let summaryMessage = `📈 **VXB Growth Strategy — Oracle คิดให้**\n\n`;

    for (let i = 0; i < Math.min(3, qualityIdeas.length); i++) {
      const idea = qualityIdeas[i];
      const revenue = idea.score?.scores?.revenuePotential || 0;
      const scalability = idea.score?.scores?.scalability || 0;
      const total = idea.score?.totalScore || 0;

      summaryMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      summaryMessage += `${i + 1}. **${idea.name}** (${total}/100)\n\n`;

      // Pain point ลูกค้า
      if (idea.problem) {
        summaryMessage += `🎯 **Pain:** ${idea.problem}\n`;
      }
      // VXB ทำอะไรให้
      if (idea.solution) {
        summaryMessage += `💼 **Service:** ${idea.solution}\n`;
      }

      // ลูกค้าเป้าหมาย
      if (idea.targetUsers) {
        summaryMessage += `👥 **ลูกค้า:** ${idea.targetUsers}\n`;
      }

      // Revenue model
      if (idea.monetization) {
        summaryMessage += `💰 **Revenue:** ${idea.monetization}\n`;
      }

      // ขั้นตอนเริ่มต้น
      if (idea.mvpScope) {
        summaryMessage += `⚡ **เริ่มยังไง:** ${idea.mvpScope}\n`;
      }

      // Scores
      summaryMessage += `\n📊 Revenue: ${revenue} | Scale: ${scalability}\n`;
      summaryMessage += `📋 ${idea.score?.recommendation || 'MAYBE'}\n\n`;
    }

    summaryMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
    summaryMessage += `สนใจกลยุทธ์ไหน สั่งเลยครับ — Oracle ทำให้ได้`;

    // 6. Auto-execute if score is high enough + toggle approved
    const currentToggles = getToggles();
    const bestIdeaKey = bestIdea.name.toLowerCase().replace(/\s+/g, '-');
    const isApproved = currentToggles.masterAutoExecute && currentToggles.toggles[bestIdeaKey] !== false;

    if (bestIdea.score?.totalScore >= CONFIG.autoExecuteThreshold &&
        bestIdea.score?.recommendation === 'GO' &&
        isApproved) {

      summaryMessage += `\n🚀 **Auto-executing:** ${bestIdea.name}\n`;
      summaryMessage += `Score ${bestIdea.score.totalScore} >= ${CONFIG.autoExecuteThreshold} threshold\n`;
      summaryMessage += `Oracle กำลังเริ่มทำให้...`;

      await notifyTars(summaryMessage, config);

      // Execute!
      const execResult = await executeIdea(bestIdea, bestIdea.score);

      if (execResult.success) {
        data.executedIdeas.push({
          idea: bestIdea,
          executedAt: new Date().toISOString(),
          workflowId: execResult.workflowId
        });
        saveIdeas(data);

        return {
          success: true,
          executed: true,
          idea: bestIdea,
          workflowId: execResult.workflowId
        };
      } else {
        await notifyTars(`❌ ไม่สามารถ execute idea: ${execResult.error}`, config);
      }
    } else if (bestIdea.score?.totalScore >= CONFIG.autoExecuteThreshold && !isApproved) {
      summaryMessage += `\n⏸️ Auto-execute disabled — เปิดได้ที่ Dashboard /vision/growthstrategy/`;
      await notifyTars(summaryMessage, config);
    } else {
      await notifyTars(summaryMessage, config);
    }

    return {
      success: true,
      executed: false,
      ideas: scoredIdeas,
      bestIdea
    };

  } catch (error) {
    console.error('[IDEAS] Thinking cycle error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// MANUAL COMMANDS
// =============================================================================

/**
 * Get all stored ideas
 */
function getIdeas() {
  return loadIdeas();
}

/**
 * Execute a specific idea by name
 */
async function executeIdeaByName(name, config) {
  const data = loadIdeas();
  const idea = data.ideas.find(i =>
    i.name.toLowerCase().includes(name.toLowerCase())
  );

  if (!idea) {
    return { success: false, error: `Idea "${name}" not found` };
  }

  await notifyTars(`🚀 Executing idea: ${idea.name}...`, config);
  return executeIdea(idea, idea.score);
}

/**
 * Force a thinking cycle now
 */
async function thinkNow(config) {
  return runThinkingCycle(config);
}

/**
 * Get thinking status
 */
function getStatus() {
  const data = loadIdeas();
  return {
    totalIdeas: data.ideas.length,
    executedIdeas: data.executedIdeas.length,
    lastThinking: data.lastThinking,
    topIdeas: data.ideas.slice(0, 5).map(i => ({
      name: i.name,
      score: i.score?.totalScore,
      recommendation: i.score?.recommendation
    })),
    config: {
      thinkingInterval: CONFIG.thinkingInterval,
      autoExecuteThreshold: CONFIG.autoExecuteThreshold,
      categories: CONFIG.categories
    }
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Main loop
  runThinkingCycle,
  thinkNow,

  // Manual commands
  getIdeas,
  getStatus,
  executeIdeaByName,

  // Toggle system
  getToggles,
  setToggle,
  setMasterSwitch,

  // Utilities
  researchTrends,
  generateIdeas,
  scoreIdea,
  executeIdea,

  // Config
  CONFIG
};
