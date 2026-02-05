/**
 * Memory API Routes for Oracle Agent
 * Provides REST endpoints for Unified Memory System
 * Used by: MCP Server (Claude Code), External Apps
 */

import express from 'express';
import { query, getPool, isVectorEnabled } from './db-postgres.js';
import { generateEmbedding } from './embedding.js';

const router = express.Router();

// API Key authentication middleware
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validKey = process.env.MEMORY_API_KEY || process.env.ORACLE_API_KEY;

  // Allow localhost without auth
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.hostname === 'localhost';

  if (!validKey || isLocalhost || apiKey === validKey) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
  }
};

router.use(authenticate);

/**
 * GET /api/memory/context
 * Get context for Claude Code at session start
 */
router.get('/context', async (req, res) => {
  try {
    const userId = req.query.user_id || 'tars';
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database', context: getFileBasedContext() });
    }

    // Get user profile
    const profileResult = await query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0] || null;

    // Get recent memories (last 24h)
    const memoriesResult = await query(`
      SELECT content, context, memory_type, importance
      FROM episodic_memory
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY importance DESC, created_at DESC
      LIMIT 10
    `, [userId]);

    // Get recent mistakes
    const mistakesResult = await query(`
      SELECT description, lesson
      FROM learnings
      WHERE type = 'mistake'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get semantic knowledge
    const knowledgeResult = await query(`
      SELECT subject, predicate, object
      FROM semantic_memory
      WHERE confidence > 0.7
      ORDER BY updated_at DESC
      LIMIT 20
    `);

    res.json({
      status: 'ok',
      vector_enabled: isVectorEnabled(),
      user: profile,
      recent_memories: memoriesResult.rows,
      recent_mistakes: mistakesResult.rows,
      knowledge: knowledgeResult.rows
    });
  } catch (error) {
    console.error('[Memory API] Context error:', error);
    res.status(500).json({ error: 'Failed to get context', message: error.message });
  }
});

/**
 * POST /api/memory/save
 * Save a new memory
 */
router.post('/save', async (req, res) => {
  try {
    const { user_id = 'tars', content, context = {}, memory_type = 'conversation', importance = 0.5 } = req.body;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database', message: 'Memory saved to fallback' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Generate embedding if vector is enabled
    let embedding = null;
    if (isVectorEnabled()) {
      try {
        embedding = await generateEmbedding(content);
      } catch (e) {
        console.log('[Memory API] Embedding generation skipped:', e.message);
      }
    }

    // Create search text for full-text search
    const searchText = content.toLowerCase();

    const result = await query(`
      INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text${embedding ? ', embedding' : ''})
      VALUES ($1, $2, $3, $4, $5, $6${embedding ? ', $7' : ''})
      RETURNING id
    `, embedding
      ? [user_id, content, context, memory_type, importance, searchText, embedding]
      : [user_id, content, context, memory_type, importance, searchText]);

    res.json({
      status: 'ok',
      id: result.rows[0].id,
      message: 'Memory saved successfully',
      vector_enabled: isVectorEnabled()
    });
  } catch (error) {
    console.error('[Memory API] Save error:', error);
    res.status(500).json({ error: 'Failed to save memory', message: error.message });
  }
});

/**
 * GET /api/memory/search
 * Semantic search through memories
 */
router.get('/search', async (req, res) => {
  try {
    const { q, query: searchQuery, user_id = 'tars', limit = 5 } = req.query;
    const searchText = q || searchQuery;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database', results: [] });
    }

    if (!searchText) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let results = [];
    let searchMode = 'text';

    // Try semantic search with embedding if vector is enabled
    if (isVectorEnabled()) {
      try {
        const embedding = await generateEmbedding(searchText);
        if (embedding) {
          const semanticResult = await query(`
            SELECT content, context, memory_type, importance,
                   1 - (embedding <=> $1) as similarity
            FROM episodic_memory
            WHERE user_id = $2 AND embedding IS NOT NULL
            ORDER BY embedding <=> $1
            LIMIT $3
          `, [embedding, user_id, parseInt(limit)]);
          results = semanticResult.rows;
          searchMode = 'semantic';
        }
      } catch (e) {
        console.log('[Memory API] Semantic search failed, falling back to text search');
      }
    }

    // Fallback to full-text search
    if (results.length === 0) {
      // Try PostgreSQL full-text search first
      try {
        const ftsResult = await query(`
          SELECT content, context, memory_type, importance,
                 ts_rank(to_tsvector('english', COALESCE(search_text, content)), plainto_tsquery('english', $2)) as similarity
          FROM episodic_memory
          WHERE user_id = $1
            AND to_tsvector('english', COALESCE(search_text, content)) @@ plainto_tsquery('english', $2)
          ORDER BY similarity DESC, importance DESC
          LIMIT $3
        `, [user_id, searchText, parseInt(limit)]);
        results = ftsResult.rows;
        searchMode = 'fulltext';
      } catch (e) {
        // Fallback to ILIKE search
        const textResult = await query(`
          SELECT content, context, memory_type, importance, 0.5 as similarity
          FROM episodic_memory
          WHERE user_id = $1 AND content ILIKE $2
          ORDER BY importance DESC, created_at DESC
          LIMIT $3
        `, [user_id, `%${searchText}%`, parseInt(limit)]);
        results = textResult.rows;
        searchMode = 'ilike';
      }
    }

    res.json({
      status: 'ok',
      query: searchText,
      search_mode: searchMode,
      vector_enabled: isVectorEnabled(),
      results
    });
  } catch (error) {
    console.error('[Memory API] Search error:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

/**
 * GET /api/memory/user/:id
 * Get user profile
 */
router.get('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database', user: null });
    }

    const result = await query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ status: 'ok', user: result.rows[0] });
  } catch (error) {
    console.error('[Memory API] User error:', error);
    res.status(500).json({ error: 'Failed to get user', message: error.message });
  }
});

/**
 * PUT /api/memory/user/:id/preferences
 * Update user preferences
 */
router.put('/user/:id/preferences', async (req, res) => {
  try {
    const { id } = req.params;
    const { preferences } = req.body;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database' });
    }

    await query(`
      INSERT INTO user_profiles (user_id, preferences, last_interaction)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET preferences = user_profiles.preferences || $2, last_interaction = NOW()
    `, [id, preferences]);

    res.json({ status: 'ok', message: 'Preferences updated' });
  } catch (error) {
    console.error('[Memory API] Preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences', message: error.message });
  }
});

/**
 * GET /api/memory/recent
 * Get recent memories
 */
router.get('/recent', async (req, res) => {
  try {
    const { hours = 24, user_id = 'tars', limit = 20 } = req.query;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database', memories: [] });
    }

    const result = await query(`
      SELECT id, content, context, memory_type, importance, created_at
      FROM episodic_memory
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
      ORDER BY created_at DESC
      LIMIT $2
    `, [user_id, parseInt(limit)]);

    res.json({ status: 'ok', memories: result.rows });
  } catch (error) {
    console.error('[Memory API] Recent error:', error);
    res.status(500).json({ error: 'Failed to get recent memories', message: error.message });
  }
});

/**
 * POST /api/memory/learn
 * Record a learning (mistake or lesson)
 */
router.post('/learn', async (req, res) => {
  try {
    const { type = 'learning', category, description, lesson, context = {} } = req.body;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const result = await query(`
      INSERT INTO learnings (type, category, description, lesson, context)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [type, category, description, lesson, context]);

    res.json({
      status: 'ok',
      id: result.rows[0].id,
      message: 'Learning recorded'
    });
  } catch (error) {
    console.error('[Memory API] Learn error:', error);
    res.status(500).json({ error: 'Failed to record learning', message: error.message });
  }
});

/**
 * POST /api/memory/reasoning
 * Log reasoning process (meta-cognition)
 */
router.post('/reasoning', async (req, res) => {
  try {
    const {
      user_id,
      input,
      intent,
      context_retrieved = [],
      decision_process = [],
      confidence,
      output,
      self_check_result
    } = req.body;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database' });
    }

    const result = await query(`
      INSERT INTO reasoning_logs (user_id, input, intent, context_retrieved, decision_process, confidence, output, self_check_result)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [user_id, input, intent, context_retrieved, decision_process, confidence, output, self_check_result]);

    res.json({ status: 'ok', id: result.rows[0].id });
  } catch (error) {
    console.error('[Memory API] Reasoning error:', error);
    res.status(500).json({ error: 'Failed to log reasoning', message: error.message });
  }
});

/**
 * POST /api/memory/feedback
 * Update reasoning log with user feedback
 */
router.post('/feedback', async (req, res) => {
  try {
    const { reasoning_id, feedback } = req.body;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database' });
    }

    await query(`
      UPDATE reasoning_logs
      SET feedback = $2
      WHERE id = $1
    `, [reasoning_id, feedback]);

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Memory API] Feedback error:', error);
    res.status(500).json({ error: 'Failed to update feedback', message: error.message });
  }
});

/**
 * GET /api/memory/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database', metrics: [] });
    }

    const result = await query(`
      SELECT *
      FROM performance_metrics
      WHERE date > CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY date DESC
    `);

    res.json({ status: 'ok', metrics: result.rows });
  } catch (error) {
    console.error('[Memory API] Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics', message: error.message });
  }
});

/**
 * POST /api/memory/metrics/increment
 * Increment a metric counter
 */
router.post('/metrics/increment', async (req, res) => {
  try {
    const { field } = req.body;
    const pool = getPool();

    if (!pool) {
      return res.json({ status: 'no_database' });
    }

    const validFields = ['conversations', 'tasks_completed', 'tasks_failed', 'mistakes', 'proactive_suggestions', 'positive_feedback', 'negative_feedback'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }

    await query(`
      INSERT INTO performance_metrics (date, ${field})
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (date)
      DO UPDATE SET ${field} = performance_metrics.${field} + 1
    `);

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Memory API] Metrics increment error:', error);
    res.status(500).json({ error: 'Failed to increment metric', message: error.message });
  }
});

/**
 * GET /api/memory/self-model
 * Get Oracle's self-model
 */
router.get('/self-model', async (req, res) => {
  try {
    const pool = getPool();

    // Get performance stats
    let performance = {};
    if (pool) {
      const todayResult = await query(`
        SELECT * FROM performance_metrics WHERE date = CURRENT_DATE
      `);
      performance = todayResult.rows[0] || {};
    }

    // Get recent mistakes count
    let mistakeCount = 0;
    if (pool) {
      const mistakesResult = await query(`
        SELECT COUNT(*) as count FROM learnings
        WHERE type = 'mistake' AND created_at > NOW() - INTERVAL '7 days'
      `);
      mistakeCount = parseInt(mistakesResult.rows[0]?.count || 0);
    }

    res.json({
      status: 'ok',
      self_model: {
        identity: {
          name: 'Oracle Agent',
          version: process.env.VERSION || '5.19.0',
          core_model: 'claude-sonnet-4-20250514',
          role: 'Digital Partner of Tars'
        },
        capabilities: {
          can_do: ['chat', 'bookings', 'investment_tracking', 'api_calls', 'local_execution', 'idea_generation'],
          good_at: ['thai_language', 'hotel_management', 'proactive_suggestions'],
          bad_at: [], // Populated from mistakes
          cannot_do: ['true_learning', 'physical_actions', 'change_weights']
        },
        performance: {
          conversations_today: performance.conversations || 0,
          tasks_completed: performance.tasks_completed || 0,
          tasks_failed: performance.tasks_failed || 0,
          success_rate: performance.tasks_completed ?
            (performance.tasks_completed / (performance.tasks_completed + performance.tasks_failed) * 100).toFixed(1) : null,
          mistakes_this_week: mistakeCount
        }
      }
    });
  } catch (error) {
    console.error('[Memory API] Self-model error:', error);
    res.status(500).json({ error: 'Failed to get self-model', message: error.message });
  }
});

// Helper function for file-based context fallback
function getFileBasedContext() {
  return {
    note: 'PostgreSQL not available, using file-based memory',
    core: 'See ψ/memory/core.md',
    goals: 'See ψ/memory/goals.md'
  };
}

export default router;
