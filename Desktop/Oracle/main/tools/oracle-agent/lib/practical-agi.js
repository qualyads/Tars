/**
 * Practical AGI Integration for Oracle Agent
 * Features: Opportunity Detection, Enhanced Heartbeat, Goal Tracking, Proactive Suggestions
 */

import { query, getPool } from './db-postgres.js';
import { loadSelfModel, updateSelfModel, analyzeUserReaction, logReasoning } from './self-awareness.js';

/**
 * Opportunity Detection
 * Analyzes conversation for business/improvement opportunities
 */
export async function detectOpportunities({ message, response, context = {}, userId = 'tars' }) {
  const opportunities = [];

  // Patterns to detect
  const patterns = {
    business: [
      { regex: /ขาย|ลูกค้า|ราคา|revenue|profit/i, type: 'business', action: 'pricing_analysis' },
      { regex: /ทำเงิน|รายได้|passive/i, type: 'business', action: 'revenue_opportunity' },
      { regex: /SaaS|subscription|ค่าบริการ/i, type: 'business', action: 'saas_opportunity' }
    ],
    efficiency: [
      { regex: /ทำซ้ำ|ถามบ่อย|ทุกวัน/i, type: 'efficiency', action: 'automation' },
      { regex: /นานไป|ช้า|เร็วกว่า/i, type: 'efficiency', action: 'optimization' }
    ],
    learning: [
      { regex: /ผิด|แก้|ไม่ใช่|wrong/i, type: 'learning', action: 'record_mistake' },
      { regex: /จำไว้|อย่าลืม|remember/i, type: 'learning', action: 'record_preference' }
    ],
    investment: [
      { regex: /ทอง|gold|ซื้อ|ขาย/i, type: 'investment', action: 'market_check' },
      { regex: /btc|bitcoin|crypto/i, type: 'investment', action: 'crypto_check' }
    ]
  };

  // Check message against patterns
  for (const [category, categoryPatterns] of Object.entries(patterns)) {
    for (const pattern of categoryPatterns) {
      if (pattern.regex.test(message)) {
        opportunities.push({
          type: pattern.type,
          action: pattern.action,
          trigger: message.match(pattern.regex)?.[0],
          priority: category === 'business' ? 'high' : 'medium',
          detected_at: new Date().toISOString()
        });
      }
    }
  }

  // Check for repeated questions (efficiency opportunity)
  if (context.recentQuestions) {
    const similarCount = context.recentQuestions.filter(q =>
      q.toLowerCase().includes(message.toLowerCase().substring(0, 20))
    ).length;

    if (similarCount >= 2) {
      opportunities.push({
        type: 'efficiency',
        action: 'create_shortcut',
        trigger: `Asked similar question ${similarCount + 1} times`,
        priority: 'high'
      });
    }
  }

  return opportunities;
}

/**
 * Queue Proactive Suggestions
 */
export async function queueSuggestion({ userId, type, content, priority = 'medium', context = {} }) {
  const pool = getPool();

  const suggestion = {
    user_id: userId,
    type,
    content,
    priority,
    context,
    created_at: new Date().toISOString(),
    sent: false
  };

  // Save to database if available
  if (pool) {
    try {
      await query(`
        INSERT INTO episodic_memory (user_id, content, context, memory_type, importance)
        VALUES ($1, $2, $3, 'suggestion', $4)
      `, [userId, content, { type, priority, ...context }, priority === 'high' ? 0.9 : 0.7]);
    } catch (error) {
      console.error('[Practical AGI] Failed to queue suggestion:', error);
    }
  }

  return suggestion;
}

/**
 * Enhanced Heartbeat Routine
 * Called every 30 minutes
 */
export async function enhancedHeartbeat({ claudeClient, notifyUser }) {
  const actions = [];
  const now = new Date();
  const hour = now.getHours();

  console.log('[Practical AGI] Heartbeat running at', now.toISOString());

  // 1. Check market changes
  try {
    // This would integrate with existing gold/BTC tracking
    // For now, just log
    console.log('[Practical AGI] Market check scheduled');
  } catch (error) {
    console.error('[Practical AGI] Market check failed:', error);
  }

  // 2. Memory consolidation (night time: 23:00 - 05:00)
  if (hour >= 23 || hour < 5) {
    try {
      console.log('[Practical AGI] Night-time memory consolidation');
      // Trigger consolidation
      const pool = getPool();
      if (pool) {
        // Consolidate old episodic memories into semantic
        await query(`
          UPDATE episodic_memory
          SET importance = importance * 0.95
          WHERE created_at < NOW() - INTERVAL '7 days'
            AND importance > 0.1
        `);
      }
    } catch (error) {
      console.error('[Practical AGI] Consolidation failed:', error);
    }
  }

  // 3. Self-improvement check
  try {
    const pool = getPool();
    if (pool) {
      const mistakesResult = await query(`
        SELECT COUNT(*) as count
        FROM learnings
        WHERE type = 'mistake' AND created_at > NOW() - INTERVAL '24 hours'
      `);

      const mistakeCount = parseInt(mistakesResult.rows[0]?.count || 0);

      if (mistakeCount > 3) {
        actions.push({
          type: 'self_improve',
          message: `${mistakeCount} mistakes in 24h - review needed`,
          data: { mistake_count: mistakeCount }
        });
      }
    }
  } catch (error) {
    console.error('[Practical AGI] Self-improvement check failed:', error);
  }

  // 4. Daily reflection trigger (at 23:00)
  if (hour === 23) {
    try {
      const { dailyReflection } = await import('./self-awareness.js');
      const reflection = await dailyReflection(claudeClient);
      if (reflection) {
        console.log('[Practical AGI] Daily reflection completed');
      }
    } catch (error) {
      console.error('[Practical AGI] Daily reflection failed:', error);
    }
  }

  // 5. Update performance metrics
  try {
    await updateDailyMetrics();
  } catch (error) {
    console.error('[Practical AGI] Metrics update failed:', error);
  }

  return actions;
}

/**
 * Update Daily Performance Metrics
 */
async function updateDailyMetrics() {
  const pool = getPool();
  if (!pool) return;

  try {
    // Ensure today's row exists
    await query(`
      INSERT INTO performance_metrics (date)
      VALUES (CURRENT_DATE)
      ON CONFLICT (date) DO NOTHING
    `);
  } catch (error) {
    console.error('[Practical AGI] Metrics update failed:', error);
  }
}

/**
 * Increment Performance Metric
 */
export async function incrementMetric(field) {
  const pool = getPool();
  if (!pool) return;

  const validFields = ['conversations', 'tasks_completed', 'tasks_failed', 'mistakes', 'proactive_suggestions', 'positive_feedback', 'negative_feedback'];
  if (!validFields.includes(field)) return;

  try {
    await query(`
      INSERT INTO performance_metrics (date, ${field})
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (date)
      DO UPDATE SET ${field} = performance_metrics.${field} + 1
    `);
  } catch (error) {
    console.error('[Practical AGI] Metric increment failed:', error);
  }
}

/**
 * Goal Tracking
 */
export async function trackGoalProgress() {
  const model = await loadSelfModel();
  const pool = getPool();

  const progress = {
    timestamp: new Date().toISOString(),
    goals: {}
  };

  if (pool) {
    try {
      // Get weekly stats
      const weeklyResult = await query(`
        SELECT
          SUM(tasks_completed) as completed,
          SUM(tasks_failed) as failed,
          SUM(mistakes) as mistakes,
          SUM(proactive_suggestions) as suggestions
        FROM performance_metrics
        WHERE date > CURRENT_DATE - INTERVAL '7 days'
      `);

      const weekly = weeklyResult.rows[0] || {};

      // Calculate goal progress
      const totalTasks = (weekly.completed || 0) + (weekly.failed || 0);
      const successRate = totalTasks > 0 ? (weekly.completed / totalTasks * 100) : 0;
      const mistakeRate = totalTasks > 0 ? (weekly.mistakes / totalTasks * 100) : 0;

      progress.goals = {
        'mistake_rate_under_5': {
          current: mistakeRate.toFixed(1),
          target: 5,
          achieved: mistakeRate < 5
        },
        'proactive_suggestions_10_per_week': {
          current: weekly.suggestions || 0,
          target: 10,
          achieved: (weekly.suggestions || 0) >= 10
        },
        'success_rate_above_90': {
          current: successRate.toFixed(1),
          target: 90,
          achieved: successRate >= 90
        }
      };
    } catch (error) {
      console.error('[Practical AGI] Goal tracking failed:', error);
    }
  }

  return progress;
}

/**
 * Pre-Response Check (Mistake Prevention)
 */
export async function preResponseCheck(message, userId) {
  const checks = {
    relevantMistakes: [],
    relevantPreferences: [],
    warnings: []
  };

  const pool = getPool();
  if (!pool) return checks;

  try {
    // Get relevant mistakes
    const mistakesResult = await query(`
      SELECT description, lesson, category
      FROM learnings
      WHERE type = 'mistake'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    checks.relevantMistakes = mistakesResult.rows;

    // Get user preferences
    const prefsResult = await query(`
      SELECT preferences
      FROM user_profiles
      WHERE user_id = $1
    `, [userId]);

    if (prefsResult.rows[0]?.preferences) {
      checks.relevantPreferences = prefsResult.rows[0].preferences;
    }

    // Generate warnings based on mistakes
    for (const mistake of checks.relevantMistakes) {
      if (message.toLowerCase().includes(mistake.category?.toLowerCase() || '')) {
        checks.warnings.push(`⚠️ เคยผิดเรื่อง ${mistake.category}: ${mistake.lesson}`);
      }
    }
  } catch (error) {
    console.error('[Practical AGI] Pre-response check failed:', error);
  }

  return checks;
}

/**
 * Post-Response Analysis (Learning Loop)
 */
export async function postResponseAnalysis(message, response, userId, reasoningId) {
  // Analyze user reaction
  const reaction = analyzeUserReaction(message, response);

  // Record feedback if we have a reasoning log
  if (reasoningId && reaction.needsImprovement) {
    const { recordFeedback } = await import('./self-awareness.js');
    await recordFeedback(reasoningId, {
      sentiment: reaction.sentiment,
      isCorrection: reaction.isCorrection,
      analyzed_at: new Date().toISOString()
    });
  }

  // Increment appropriate metric
  if (reaction.sentiment === 'positive') {
    await incrementMetric('positive_feedback');
  } else if (reaction.sentiment === 'negative') {
    await incrementMetric('negative_feedback');
  }

  // Detect opportunities
  const opportunities = await detectOpportunities({ message, response, userId });

  return {
    reaction,
    opportunities,
    shouldFollowUp: opportunities.length > 0 && opportunities.some(o => o.priority === 'high')
  };
}

export default {
  detectOpportunities,
  queueSuggestion,
  enhancedHeartbeat,
  incrementMetric,
  trackGoalProgress,
  preResponseCheck,
  postResponseAnalysis
};
