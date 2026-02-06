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

  // Categories to explore
  categories: [
    'micro-saas',
    'ai-tools',
    'automation',
    'developer-tools',
    'hospitality-tech',
    'thailand-market'
  ],

  // Tars's context for idea generation
  tarsContext: `
Tars owns:
- Hotels in Pai (The Arch Casa, Betel Palm Village, Paddy Fields Haven)
- Tech skills: Next.js, Railway, AI, Automation
- Interest: Gold, Bitcoin, Crypto investments
- Goal: Passive income, automation, minimal maintenance
- Budget: Can invest time but prefers low-cost MVPs
- Market: Thailand + International tourists
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
  return { ideas: [], lastThinking: null, executedIdeas: [] };
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
// WEB RESEARCH (using Claude's knowledge + search hints)
// =============================================================================

async function researchTrends(category) {
  console.log(`[IDEAS] Researching trends in: ${category}`);

  const researchPrompt = `คุณเป็น market researcher ที่เก่งมาก

หา 3 trends/opportunities ใน "${category}" ที่:
1. มีความต้องการจริงในตลาด (2024-2025)
2. สามารถสร้าง MVP ได้ใน 1-2 วัน
3. ใช้ tech stack: Next.js, Railway, AI APIs
4. เหมาะกับ solo developer

Context ของ Tars (เจ้าของ):
${CONFIG.tarsContext}

ตอบเป็น JSON array:
[
  {
    "trend": "ชื่อ trend",
    "opportunity": "โอกาสทำเงินอย่างไร",
    "targetAudience": "กลุ่มเป้าหมาย",
    "competition": "low/medium/high",
    "potentialRevenue": "ประมาณรายได้ต่อเดือน"
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

  const ideaPrompt = `คุณเป็น startup idea generator ที่เก่งมาก

**สำคัญมาก: ตอบเป็นภาษาไทยทั้งหมด! ห้ามใช้ภาษาอังกฤษหรือภาษาจีน!**

จาก trends เหล่านี้:
${JSON.stringify(trends, null, 2)}

สร้าง ${CONFIG.maxIdeasPerCycle} micro-SaaS ideas ที่:
1. สร้าง MVP ได้ใน 1-2 วัน
2. ใช้ Next.js + Railway + AI
3. มี potential revenue $100-1000/month
4. ต้องการ maintenance น้อย

Context ของ Tars:
${CONFIG.tarsContext}

ตอบเป็น JSON array (ภาษาไทยทั้งหมด ยกเว้น techStack):
[
  {
    "name": "ชื่อโปรเจคภาษาไทย (สั้น จำง่าย ห้ามใช้ภาษาจีน)",
    "tagline": "คำอธิบายสั้นๆ ภาษาไทย",
    "problem": "ปัญหาที่แก้ (ภาษาไทย)",
    "solution": "วิธีแก้ (ภาษาไทย)",
    "features": ["ฟีเจอร์1 ภาษาไทย", "ฟีเจอร์2", "ฟีเจอร์3"],
    "techStack": ["Next.js", "..."],
    "monetization": "วิธีหาเงิน (ภาษาไทย)",
    "mvpScope": "สิ่งที่ต้องทำใน MVP (ภาษาไทย)",
    "estimatedHours": 8-16,
    "targetUsers": "กลุ่มเป้าหมาย (ภาษาไทย)"
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

  const scorePrompt = `คุณเป็น startup advisor ที่ประเมิน idea อย่างเข้มงวด

ประเมิน idea นี้:
${JSON.stringify(idea, null, 2)}

ให้คะแนน 0-100 ในแต่ละด้าน:

1. **Feasibility** (สร้างได้จริงใน 1-2 วันไหม?)
2. **Market Demand** (มีคนต้องการจริงไหม?)
3. **Revenue Potential** (หาเงินได้จริงไหม?)
4. **Competition** (แข่งขันได้ไหม?)
5. **Maintenance** (ดูแลง่ายไหม?)
6. **Tars Fit** (เหมาะกับ Tars ไหม - มีโรงแรม, สนใจ AI/automation)

ตอบเป็น JSON:
{
  "scores": {
    "feasibility": 0-100,
    "marketDemand": 0-100,
    "revenuePotential": 0-100,
    "competition": 0-100,
    "maintenance": 0-100,
    "tarsFit": 0-100
  },
  "totalScore": 0-100 (weighted average),
  "recommendation": "GO / MAYBE / SKIP",
  "reasoning": "เหตุผลสั้นๆ",
  "risks": ["ความเสี่ยง 1", "ความเสี่ยง 2"],
  "suggestions": ["ข้อเสนอแนะ"]
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
  let content = `# 💡 Oracle Ideas Engine - ${today}\n\n`;
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
      let saasContent = `# 💡 SaaS Ideas - Top Picks\n\n`;
      saasContent += `Last updated: ${new Date().toLocaleString('th-TH')}\n\n`;
      saasContent += `Ideas with score >= 60\n\n---\n\n`;

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
    // Save each idea separately for easy search
    for (const idea of ideas.slice(0, 5)) {
      const content = `💡 SaaS Idea: ${idea.name}

📝 **${idea.tagline || 'No tagline'}**

❓ ปัญหา: ${idea.problem || 'N/A'}
✅ วิธีแก้: ${idea.solution || 'N/A'}
👥 กลุ่มเป้าหมาย: ${idea.targetUsers || 'N/A'}
💰 วิธีหาเงิน: ${idea.monetization || 'N/A'}
🛠️ MVP: ${idea.mvpScope || 'N/A'}
⏱️ เวลาสร้าง: ${idea.estimatedHours || 8} ชม.

📊 Score: ${idea.score?.totalScore || 0}/100
📋 Recommendation: ${idea.score?.recommendation || 'MAYBE'}
💰 Revenue: ${idea.score?.scores?.revenuePotential || 0}/100
🔧 Feasibility: ${idea.score?.scores?.feasibility || 0}/100`;

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
        ? ['tars', content, { source: 'idea-engine', idea_name: idea.name, score: idea.score?.totalScore }, 'idea', 0.8, searchText, embedding]
        : ['tars', content, { source: 'idea-engine', idea_name: idea.name, score: idea.score?.totalScore }, 'idea', 0.8, searchText]
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
  const ownerId = config?.line?.owner_id || LINE_OWNER_ID;
  try {
    await line.push(ownerId, message);
    console.log('[IDEAS] LINE notification sent');
  } catch (e) {
    console.error('[IDEAS] LINE notification error:', e.message);
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

    // Build detailed Thai message
    let summaryMessage = `💡 **Oracle พบโอกาสทำเงิน!**\n\n`;

    for (let i = 0; i < Math.min(3, qualityIdeas.length); i++) {
      const idea = qualityIdeas[i];
      const revenue = idea.score?.scores?.revenuePotential || 0;
      const feasibility = idea.score?.scores?.feasibility || 0;
      const total = idea.score?.totalScore || 0;

      summaryMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      summaryMessage += `${i + 1}. **${idea.name}** (${total}/100)\n\n`;

      // Problem & Solution (Thai)
      if (idea.problem) {
        summaryMessage += `❓ **ปัญหา:** ${idea.problem}\n`;
      }
      if (idea.solution) {
        summaryMessage += `✅ **วิธีแก้:** ${idea.solution}\n`;
      }

      // Target users
      if (idea.targetUsers) {
        summaryMessage += `👥 **กลุ่มเป้าหมาย:** ${idea.targetUsers}\n`;
      }

      // Monetization
      if (idea.monetization) {
        summaryMessage += `💰 **วิธีหาเงิน:** ${idea.monetization}\n`;
      }

      // MVP Scope
      if (idea.mvpScope) {
        summaryMessage += `🛠️ **MVP:** ${idea.mvpScope}\n`;
      }

      // Scores
      summaryMessage += `\n📊 Revenue: ${revenue} | Feasibility: ${feasibility}\n`;
      summaryMessage += `📋 ${idea.score?.recommendation || 'MAYBE'}\n\n`;
    }

    summaryMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
    summaryMessage += `สนใจ idea ไหนบอกได้เลยครับ! 🚀`;

    // 6. Auto-execute if score is high enough
    if (bestIdea.score?.totalScore >= CONFIG.autoExecuteThreshold &&
        bestIdea.score?.recommendation === 'GO') {

      summaryMessage += `\n🚀 **Auto-executing:** ${bestIdea.name}\n`;
      summaryMessage += `Score ${bestIdea.score.totalScore} >= ${CONFIG.autoExecuteThreshold} threshold\n`;
      summaryMessage += `Terminal จะเปิดบน Mac เพื่อสร้างโปรเจค...`;

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
    } else {
      summaryMessage += `สนใจ idea ไหน บอกได้เลยครับ! 🚀`;

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

  // Utilities
  researchTrends,
  generateIdeas,
  scoreIdea,
  executeIdea,

  // Config
  CONFIG
};
