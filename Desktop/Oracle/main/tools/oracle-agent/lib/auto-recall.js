/**
 * Auto-Recall System for Oracle Agent
 * Automatically retrieves relevant memories before every response
 *
 * Features:
 * - Semantic search using pgvector
 * - Context-aware memory retrieval
 * - Mistake prevention (recalls past errors)
 * - User preference awareness
 */

import { query, getPool, isVectorEnabled } from './db-postgres.js';
import { generateEmbedding } from './embedding.js';

/**
 * Auto-recall relevant memories before responding
 * @param {string} userMessage - The current user message
 * @param {string} userId - User ID (default: tars)
 * @returns {Object} Relevant context for the AI
 */
export async function autoRecall(userMessage, userId = 'tars') {
  const pool = getPool();

  if (!pool) {
    console.log('[Auto-Recall] No database connection, using fallback');
    return getFallbackContext();
  }

  const context = {
    relevantMemories: [],
    relevantMistakes: [],
    userPreferences: {},
    goals: [],
    recentDecisions: []
  };

  try {
    // 1. Semantic search for relevant memories
    if (isVectorEnabled()) {
      const embedding = await generateEmbedding(userMessage);

      if (embedding) {
        const similarResult = await query(`
          SELECT content, memory_type, importance,
                 1 - (embedding <=> $1::vector) as similarity
          FROM episodic_memory
          WHERE embedding IS NOT NULL
            AND user_id = $2
          ORDER BY embedding <=> $1::vector
          LIMIT 5
        `, [embedding, userId]);  // embedding already formatted as "[1,2,3,...]"

        context.relevantMemories = similarResult.rows.filter(r => r.similarity > 0.3);
      }
    }

    // 2. Get relevant mistakes to avoid repeating
    const mistakeKeywords = extractKeywords(userMessage);
    if (mistakeKeywords.length > 0) {
      const mistakesResult = await query(`
        SELECT description, lesson, category
        FROM learnings
        WHERE type = 'mistake'
          AND (
            ${mistakeKeywords.map((_, i) => `description ILIKE $${i + 1} OR lesson ILIKE $${i + 1}`).join(' OR ')}
          )
        ORDER BY created_at DESC
        LIMIT 3
      `, mistakeKeywords.map(k => `%${k}%`));

      context.relevantMistakes = mistakesResult.rows;
    }

    // 3. Get user preferences
    const prefsResult = await query(`
      SELECT preferences, personality_traits
      FROM user_profiles
      WHERE user_id = $1
    `, [userId]);

    if (prefsResult.rows[0]) {
      context.userPreferences = prefsResult.rows[0].preferences || {};
    }

    // 4. Get active goals
    const goalsResult = await query(`
      SELECT content, importance
      FROM episodic_memory
      WHERE memory_type = 'decision'
        AND importance >= 0.8
        AND user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

    context.goals = goalsResult.rows;

    // 5. Get recent decisions for consistency
    const decisionsResult = await query(`
      SELECT content, created_at
      FROM episodic_memory
      WHERE memory_type IN ('decision', 'commitment')
        AND user_id = $1
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 3
    `, [userId]);

    context.recentDecisions = decisionsResult.rows;

    console.log(`[Auto-Recall] Found: ${context.relevantMemories.length} memories, ${context.relevantMistakes.length} mistakes`);

  } catch (error) {
    console.error('[Auto-Recall] Error:', error);
  }

  return context;
}

/**
 * Format recalled context into system prompt addition
 */
export function formatRecalledContext(context) {
  const parts = [];

  if (context.relevantMemories?.length > 0) {
    parts.push('📚 **Relevant Memories:**');
    context.relevantMemories.forEach(m => {
      parts.push(`- [${m.memory_type}] ${m.content.substring(0, 200)}...`);
    });
    parts.push('');
  }

  if (context.relevantMistakes?.length > 0) {
    parts.push('⚠️ **Avoid These Mistakes:**');
    context.relevantMistakes.forEach(m => {
      parts.push(`- ${m.description}: ${m.lesson}`);
    });
    parts.push('');
  }

  if (context.goals?.length > 0) {
    parts.push('🎯 **Active Goals:**');
    context.goals.forEach(g => {
      parts.push(`- ${g.content.substring(0, 150)}...`);
    });
    parts.push('');
  }

  if (context.recentDecisions?.length > 0) {
    parts.push('📌 **Recent Decisions (be consistent):**');
    context.recentDecisions.forEach(d => {
      parts.push(`- ${d.content.substring(0, 150)}...`);
    });
    parts.push('');
  }

  if (Object.keys(context.userPreferences || {}).length > 0) {
    parts.push('👤 **User Preferences:**');
    parts.push(`- Language: ${context.userPreferences.language || 'th'}`);
    parts.push(`- Style: ${context.userPreferences.callStyle || 'casual'}`);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Extract keywords for mistake search
 */
function extractKeywords(text) {
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'ไหม', 'ครับ', 'ค่ะ', 'นะ', 'จ้า'];
  const words = text.toLowerCase()
    .replace(/[^\w\sก-๙]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));

  return [...new Set(words)].slice(0, 5);
}

/**
 * Fallback context when no database
 */
function getFallbackContext() {
  return {
    relevantMemories: [],
    relevantMistakes: [],
    userPreferences: { language: 'th', callStyle: 'casual' },
    goals: [],
    recentDecisions: []
  };
}

/**
 * Quick check if message needs deep recall
 * (optimization to avoid unnecessary queries)
 */
export function needsDeepRecall(message) {
  const deepRecallTriggers = [
    /เคย|จำได้|ก่อนหน้า|ที่แล้ว|ตอนนั้น/i,
    /remember|recall|previous|before|last time/i,
    /บันทึก|จดไว้|save|note/i,
    /api|google|ecommerce|shopify|lazada|shopee/i,
    /goal|เป้าหมาย|plan|แผน/i,
    /mistake|ผิด|error|wrong/i
  ];

  return deepRecallTriggers.some(trigger => trigger.test(message));
}

export default {
  autoRecall,
  formatRecalledContext,
  needsDeepRecall
};
