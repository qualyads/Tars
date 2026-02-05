/**
 * Unified Memory System for Oracle Agent
 * Single Brain Architecture: Claude Code + Oracle Agent share memory
 */

import { initPostgres, query, getPool } from './db-postgres.js';
import { generateEmbedding } from './embedding.js';
import { loadSelfModel, updateSelfModel, logReasoning, analyzeUserReaction } from './self-awareness.js';
import { preResponseCheck, postResponseAnalysis, incrementMetric } from './practical-agi.js';

let initialized = false;

/**
 * Initialize Unified Memory System
 */
export async function initUnifiedMemory() {
  if (initialized) return true;

  console.log('[Unified Memory] Initializing...');

  // Initialize PostgreSQL
  const pool = await initPostgres();

  if (pool) {
    console.log('[Unified Memory] PostgreSQL connected');
  } else {
    console.log('[Unified Memory] Running in file-based mode (PostgreSQL not available)');
  }

  initialized = true;
  return true;
}

/**
 * Remember: Save information to memory
 */
export async function remember({ userId = 'tars', content, type = 'conversation', importance = 0.5, context = {} }) {
  const pool = getPool();

  if (!content) return null;

  // Generate embedding for semantic search
  let embedding = null;
  try {
    embedding = await generateEmbedding(content);
  } catch (e) {
    console.log('[Unified Memory] Embedding skipped');
  }

  // Save to PostgreSQL
  if (pool) {
    try {
      const result = await query(`
        INSERT INTO episodic_memory (user_id, content, context, memory_type, embedding, importance)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [userId, content, context, type, embedding, importance]);

      return { id: result.rows[0].id, source: 'postgres' };
    } catch (error) {
      console.error('[Unified Memory] Save to PostgreSQL failed:', error);
    }
  }

  // Fallback: Return acknowledgment
  return { id: null, source: 'fallback' };
}

/**
 * Recall: Search memories semantically
 */
export async function recall({ query: searchQuery, userId = 'tars', limit = 5 }) {
  const pool = getPool();

  if (!searchQuery) return [];

  // Try semantic search
  if (pool) {
    try {
      // Generate embedding for query
      const embedding = await generateEmbedding(searchQuery);

      if (embedding) {
        const result = await query(`
          SELECT content, context, memory_type, importance,
                 1 - (embedding <=> $1) as similarity
          FROM episodic_memory
          WHERE user_id = $2 AND embedding IS NOT NULL
          ORDER BY embedding <=> $1
          LIMIT $3
        `, [embedding, userId, limit]);

        if (result.rows.length > 0) {
          return result.rows;
        }
      }

      // Fallback to text search
      const textResult = await query(`
        SELECT content, context, memory_type, importance, 0.5 as similarity
        FROM episodic_memory
        WHERE user_id = $1 AND content ILIKE $2
        ORDER BY importance DESC, created_at DESC
        LIMIT $3
      `, [userId, `%${searchQuery}%`, limit]);

      return textResult.rows;
    } catch (error) {
      console.error('[Unified Memory] Recall failed:', error);
    }
  }

  return [];
}

/**
 * Get Context: Full context for starting a session
 */
export async function getContext(userId = 'tars') {
  const pool = getPool();
  const selfModel = await loadSelfModel();

  const context = {
    self_model: selfModel,
    user: null,
    recent_memories: [],
    recent_mistakes: [],
    semantic_knowledge: []
  };

  if (pool) {
    try {
      // Get user profile
      const userResult = await query(
        'SELECT * FROM user_profiles WHERE user_id = $1',
        [userId]
      );
      context.user = userResult.rows[0] || null;

      // Get recent memories
      const memoriesResult = await query(`
        SELECT content, context, memory_type, importance
        FROM episodic_memory
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY importance DESC, created_at DESC
        LIMIT 10
      `, [userId]);
      context.recent_memories = memoriesResult.rows;

      // Get recent mistakes
      const mistakesResult = await query(`
        SELECT description, lesson, category
        FROM learnings WHERE type = 'mistake'
        ORDER BY created_at DESC LIMIT 5
      `);
      context.recent_mistakes = mistakesResult.rows;

      // Get semantic knowledge
      const knowledgeResult = await query(`
        SELECT subject, predicate, object
        FROM semantic_memory
        WHERE confidence > 0.7
        ORDER BY updated_at DESC LIMIT 20
      `);
      context.semantic_knowledge = knowledgeResult.rows;
    } catch (error) {
      console.error('[Unified Memory] Get context failed:', error);
    }
  }

  return context;
}

/**
 * Learn: Record a mistake or lesson
 */
export async function learn({ type = 'learning', category, description, lesson, context = {} }) {
  const pool = getPool();

  if (!description) return null;

  // Save to PostgreSQL
  if (pool) {
    try {
      const result = await query(`
        INSERT INTO learnings (type, category, description, lesson, context)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [type, category, description, lesson, context]);

      // Increment mistake counter if it's a mistake
      if (type === 'mistake') {
        await incrementMetric('mistakes');
      }

      // Update self-model's bad_at if pattern detected
      if (type === 'mistake' && category) {
        const selfModel = await loadSelfModel();
        const badAt = selfModel.capabilities.bad_at || [];
        if (!badAt.includes(category)) {
          badAt.push(category);
          await updateSelfModel({
            capabilities: { ...selfModel.capabilities, bad_at: badAt.slice(-5) }
          });
        }
      }

      return { id: result.rows[0].id };
    } catch (error) {
      console.error('[Unified Memory] Learn failed:', error);
    }
  }

  return null;
}

/**
 * Process Response: Full pipeline for handling a response
 * Includes: Pre-check, Response, Post-analysis, Learning
 */
export async function processResponse({ userId, message, generateResponse }) {
  // 1. Pre-response check (mistake prevention)
  const preCheck = await preResponseCheck(message, userId);

  // 2. Get relevant context
  const context = await getContext(userId);

  // 3. Build enhanced prompt with warnings
  const warnings = preCheck.warnings.join('\n');

  // 4. Generate response (caller provides this)
  const startTime = Date.now();
  const response = await generateResponse({
    message,
    context,
    warnings,
    preCheck
  });
  const responseTime = Date.now() - startTime;

  // 5. Log reasoning
  const reasoningLog = await logReasoning({
    userId,
    input: message,
    intent: 'user_message',
    contextRetrieved: context.recent_memories.slice(0, 3),
    decisionProcess: [
      `Pre-check: ${preCheck.warnings.length} warnings`,
      `Context: ${context.recent_memories.length} memories`,
      `Response time: ${responseTime}ms`
    ],
    confidence: preCheck.warnings.length > 0 ? 0.7 : 0.9,
    output: response,
    selfCheckResult: { warnings: preCheck.warnings.length }
  });

  // 6. Increment conversation counter
  await incrementMetric('conversations');

  return {
    response,
    reasoningId: reasoningLog?.id,
    preCheck,
    context,
    responseTime
  };
}

/**
 * Analyze Feedback: Process user's follow-up message
 */
export async function analyzeFeedback({ userId, message, previousResponse, reasoningId }) {
  const analysis = await postResponseAnalysis(message, previousResponse, userId, reasoningId);

  // If correction detected, record as learning
  if (analysis.reaction.isCorrection) {
    await learn({
      type: 'mistake',
      category: 'response_error',
      description: `User corrected response: ${message.substring(0, 100)}`,
      lesson: 'Review similar responses',
      context: { previous_response: previousResponse?.substring(0, 200) }
    });
  }

  return analysis;
}

/**
 * Save Semantic Knowledge (Subject-Predicate-Object)
 */
export async function saveKnowledge({ subject, predicate, object, confidence = 1.0, sourceEpisodes = [] }) {
  const pool = getPool();
  if (!pool) return null;

  try {
    // Check if exists
    const existing = await query(`
      SELECT id FROM semantic_memory
      WHERE subject = $1 AND predicate = $2 AND object = $3
    `, [subject, predicate, object]);

    if (existing.rows.length > 0) {
      // Update confidence
      await query(`
        UPDATE semantic_memory
        SET confidence = $2, updated_at = NOW()
        WHERE id = $1
      `, [existing.rows[0].id, Math.min(confidence + 0.1, 1.0)]);
      return { id: existing.rows[0].id, updated: true };
    }

    // Insert new
    const embedding = await generateEmbedding(`${subject} ${predicate} ${object}`);
    const result = await query(`
      INSERT INTO semantic_memory (subject, predicate, object, confidence, source_episodes, embedding)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [subject, predicate, object, confidence, sourceEpisodes, embedding]);

    return { id: result.rows[0].id, created: true };
  } catch (error) {
    console.error('[Unified Memory] Save knowledge failed:', error);
    return null;
  }
}

/**
 * Get Memory Stats
 */
export async function getStats() {
  const pool = getPool();
  const selfModel = await loadSelfModel();

  const stats = {
    self_awareness_level: selfModel.meta.self_awareness_level,
    lessons_learned: selfModel.growth.lessons_learned?.length || 0,
    database_connected: !!pool
  };

  if (pool) {
    try {
      const countResult = await query(`
        SELECT
          (SELECT COUNT(*) FROM episodic_memory) as episodic_count,
          (SELECT COUNT(*) FROM semantic_memory) as semantic_count,
          (SELECT COUNT(*) FROM learnings) as learnings_count,
          (SELECT COUNT(*) FROM reasoning_logs) as reasoning_count
      `);

      const counts = countResult.rows[0];
      stats.episodic_memories = parseInt(counts.episodic_count);
      stats.semantic_memories = parseInt(counts.semantic_count);
      stats.learnings = parseInt(counts.learnings_count);
      stats.reasoning_logs = parseInt(counts.reasoning_count);
    } catch (error) {
      console.error('[Unified Memory] Get stats failed:', error);
    }
  }

  return stats;
}

export default {
  initUnifiedMemory,
  remember,
  recall,
  getContext,
  learn,
  processResponse,
  analyzeFeedback,
  saveKnowledge,
  getStats
};
