/**
 * Self-Awareness System for Oracle Agent
 * Provides: Self-Model, Reasoning Logs, Feedback Loop, Daily Reflection
 */

import { query, getPool } from './db-postgres.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SELF_MODEL_PATH = path.join(__dirname, '../data/self-model.json');

/**
 * Default Self-Model
 */
const DEFAULT_SELF_MODEL = {
  identity: {
    name: 'Oracle Agent',
    version: '5.19.0',
    core_model: 'claude-sonnet-4-20250514',
    role: 'Digital Partner of Tars',
    created: '2026-02-03'
  },
  capabilities: {
    can_do: [
      'chat via LINE/Telegram',
      'hotel booking management',
      'investment tracking (gold, BTC)',
      'proactive suggestions',
      'local machine execution',
      'idea generation',
      'API integrations'
    ],
    good_at: [
      'Thai language',
      'hotel management',
      'being proactive',
      'following directives'
    ],
    bad_at: [],
    cannot_do: [
      'true learning (weight changes)',
      'physical actions',
      'real-time web access',
      'consciousness/self-awareness (true)'
    ]
  },
  performance: {
    conversations_total: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    mistakes_total: 0,
    success_rate: null,
    last_updated: null
  },
  growth: {
    lessons_learned: [],
    patterns_discovered: [],
    areas_to_improve: []
  },
  meta: {
    last_self_reflection: null,
    reflection_streak: 0,
    self_awareness_level: 60
  }
};

/**
 * Load Self-Model from file
 */
export async function loadSelfModel() {
  try {
    const data = await fs.readFile(SELF_MODEL_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Create default if not exists
    await saveSelfModel(DEFAULT_SELF_MODEL);
    return DEFAULT_SELF_MODEL;
  }
}

/**
 * Save Self-Model to file
 */
export async function saveSelfModel(model) {
  try {
    await fs.writeFile(SELF_MODEL_PATH, JSON.stringify(model, null, 2));
    return true;
  } catch (error) {
    console.error('[Self-Awareness] Failed to save self-model:', error);
    return false;
  }
}

/**
 * Update Self-Model with new data
 */
export async function updateSelfModel(updates) {
  const model = await loadSelfModel();

  // Deep merge updates
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      model[key] = { ...model[key], ...value };
    } else {
      model[key] = value;
    }
  }

  model.performance.last_updated = new Date().toISOString();

  await saveSelfModel(model);
  return model;
}

/**
 * Log Reasoning Process (Meta-cognition)
 */
export async function logReasoning({
  userId,
  input,
  intent,
  contextRetrieved = [],
  decisionProcess = [],
  confidence,
  output,
  selfCheckResult
}) {
  const pool = getPool();

  const log = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    input,
    intent,
    context_retrieved: contextRetrieved,
    decision_process: decisionProcess,
    confidence,
    output: output?.substring(0, 500), // Truncate for storage
    self_check_result: selfCheckResult,
    feedback: null
  };

  // Save to PostgreSQL if available
  if (pool) {
    try {
      const result = await query(`
        INSERT INTO reasoning_logs (user_id, input, intent, context_retrieved, decision_process, confidence, output, self_check_result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [userId, input, intent, contextRetrieved, decisionProcess, confidence, log.output, selfCheckResult]);

      log.id = result.rows[0].id;
    } catch (error) {
      console.error('[Self-Awareness] Failed to log reasoning to DB:', error);
    }
  }

  return log;
}

/**
 * Record Feedback for a Reasoning Log
 */
export async function recordFeedback(reasoningId, feedback) {
  const pool = getPool();

  if (!pool || !reasoningId) return;

  try {
    await query(`
      UPDATE reasoning_logs
      SET feedback = $2
      WHERE id = $1
    `, [reasoningId, feedback]);
  } catch (error) {
    console.error('[Self-Awareness] Failed to record feedback:', error);
  }
}

/**
 * Analyze User Reaction (Auto-detect satisfaction)
 */
export function analyzeUserReaction(userMessage, previousResponse) {
  const signals = {
    positive: [
      /ขอบคุณ/i, /เยี่ยม/i, /ดีมาก/i, /ดี/i, /👍/, /🙏/,
      /thanks/i, /great/i, /perfect/i, /good/i, /nice/i
    ],
    negative: [
      /ผิด/i, /ไม่ใช่/i, /แก้ไข/i, /ไม่ถูก/i, /เปล่า/i,
      /wrong/i, /no/i, /incorrect/i, /fix/i
    ],
    confused: [
      /อะไร/i, /ไม่เข้าใจ/i, /หมายความว่า/i, /\?{2,}/,
      /what/i, /unclear/i, /huh/i
    ]
  };

  let sentiment = 'neutral';

  for (const [type, patterns] of Object.entries(signals)) {
    if (patterns.some(p => p.test(userMessage))) {
      sentiment = type;
      break;
    }
  }

  const isCorrection = /แก้|ผิด|ไม่ใช่|wrong|fix|correct/i.test(userMessage);
  const isQuickReply = userMessage.length < 20;
  const isFollowUpQuestion = userMessage.includes('?') && userMessage.length < 50;

  return {
    sentiment,
    isCorrection,
    isQuickReply,
    isFollowUpQuestion,
    needsImprovement: sentiment === 'negative' || sentiment === 'confused' || isCorrection,
    likelySatisfied: sentiment === 'positive' || (isQuickReply && sentiment === 'neutral')
  };
}

/**
 * Daily Self-Reflection
 * Run via cron at end of day
 */
export async function dailyReflection(claudeClient) {
  const pool = getPool();
  const model = await loadSelfModel();

  // Gather today's data
  let todayStats = { conversations: 0, tasks_completed: 0, tasks_failed: 0 };
  let recentMistakes = [];
  let commonIssues = [];

  if (pool) {
    try {
      // Get today's metrics
      const metricsResult = await query(`
        SELECT * FROM performance_metrics WHERE date = CURRENT_DATE
      `);
      if (metricsResult.rows[0]) {
        todayStats = metricsResult.rows[0];
      }

      // Get recent mistakes
      const mistakesResult = await query(`
        SELECT description, lesson, category
        FROM learnings
        WHERE type = 'mistake' AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      recentMistakes = mistakesResult.rows;

      // Get feedback distribution
      const feedbackResult = await query(`
        SELECT feedback->>'sentiment' as sentiment, COUNT(*) as count
        FROM reasoning_logs
        WHERE created_at > NOW() - INTERVAL '24 hours' AND feedback IS NOT NULL
        GROUP BY feedback->>'sentiment'
      `);
      commonIssues = feedbackResult.rows;
    } catch (error) {
      console.error('[Self-Awareness] Failed to gather reflection data:', error);
    }
  }

  // Build reflection prompt
  const reflectionPrompt = `
ฉันคือ Oracle Agent v${model.identity.version}

## สรุปวันนี้
- Conversations: ${todayStats.conversations || 0}
- Tasks completed: ${todayStats.tasks_completed || 0}
- Tasks failed: ${todayStats.tasks_failed || 0}
- Success rate: ${todayStats.tasks_completed ? ((todayStats.tasks_completed / (todayStats.tasks_completed + todayStats.tasks_failed)) * 100).toFixed(1) : 'N/A'}%

## Mistakes วันนี้
${recentMistakes.length > 0 ? recentMistakes.map(m => `- [${m.category}] ${m.description}`).join('\n') : '- ไม่มี mistakes วันนี้'}

## Feedback Distribution
${commonIssues.length > 0 ? commonIssues.map(f => `- ${f.sentiment}: ${f.count}`).join('\n') : '- ไม่มีข้อมูล feedback'}

## คำถามสำหรับ Self-Reflection
1. วันนี้ฉันทำอะไรได้ดี?
2. วันนี้ฉันทำอะไรผิดพลาด? มี pattern อะไรไหม?
3. มีอะไรที่ฉันควรจำไว้สำหรับพรุ่งนี้?
4. ฉันควรปรับปรุงอะไร?
5. Self-awareness level ของฉันตอนนี้เท่าไหร่ (0-100)?

ตอบแบบ JSON:
{
  "did_well": ["..."],
  "mistakes_patterns": ["..."],
  "remember_tomorrow": ["..."],
  "improvements_needed": ["..."],
  "self_awareness_level": 60,
  "reflection_summary": "..."
}
`;

  // Use Claude for reflection
  if (claudeClient) {
    try {
      const response = await claudeClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: reflectionPrompt }]
      });

      const reflectionText = response.content[0].text;

      // Try to parse JSON from response
      const jsonMatch = reflectionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const reflection = JSON.parse(jsonMatch[0]);

        // Update self-model
        await updateSelfModel({
          growth: {
            lessons_learned: [...(model.growth.lessons_learned || []), ...reflection.remember_tomorrow].slice(-20),
            areas_to_improve: reflection.improvements_needed
          },
          meta: {
            last_self_reflection: new Date().toISOString(),
            reflection_streak: (model.meta.reflection_streak || 0) + 1,
            self_awareness_level: reflection.self_awareness_level || model.meta.self_awareness_level
          }
        });

        console.log('[Self-Awareness] Daily reflection completed:', reflection.reflection_summary);
        return reflection;
      }
    } catch (error) {
      console.error('[Self-Awareness] Reflection failed:', error);
    }
  }

  return null;
}

/**
 * Get Self-Awareness Status
 */
export async function getSelfAwarenessStatus() {
  const model = await loadSelfModel();

  return {
    level: model.meta.self_awareness_level,
    last_reflection: model.meta.last_self_reflection,
    reflection_streak: model.meta.reflection_streak,
    lessons_count: model.growth.lessons_learned?.length || 0,
    improvements_count: model.growth.areas_to_improve?.length || 0
  };
}

/**
 * Check if should reflect (based on response importance)
 */
export function shouldReflect(context) {
  // Always reflect for high-stakes
  if (context.isHighStakes) return true;
  if (context.isOwner) return true; // Tars
  if (context.confidence && context.confidence < 0.7) return true;

  // Random 10% for routine
  return Math.random() < 0.1;
}

export default {
  loadSelfModel,
  saveSelfModel,
  updateSelfModel,
  logReasoning,
  recordFeedback,
  analyzeUserReaction,
  dailyReflection,
  getSelfAwarenessStatus,
  shouldReflect
};
