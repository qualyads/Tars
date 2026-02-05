/**
 * PostgreSQL Database Connection for Oracle Agent
 * Part of Unified Memory Architecture
 */

import pg from 'pg';
const { Pool } = pg;

let pool = null;
let vectorEnabled = false;

/**
 * Check if pgvector is enabled
 */
export function isVectorEnabled() {
  return vectorEnabled;
}

/**
 * Initialize PostgreSQL connection pool
 */
export async function initPostgres() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('[DB] No DATABASE_URL found, PostgreSQL disabled');
    return null;
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('[DB] PostgreSQL connected successfully');

    // Try to enable pgvector extension (optional)
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      vectorEnabled = true;
      console.log('[DB] pgvector extension enabled');
    } catch (vectorError) {
      vectorEnabled = false;
      console.log('[DB] pgvector not available, using text search instead');
    }

    client.release();

    // Initialize schema
    await initSchema();

    return pool;
  } catch (error) {
    console.error('[DB] PostgreSQL connection failed:', error.message);
    pool = null;
    return null;
  }
}

/**
 * Initialize database schema
 */
async function initSchema() {
  // Schema without vector columns (works without pgvector)
  const baseSchema = `
    -- Episodic Memory: conversations and events
    CREATE TABLE IF NOT EXISTS episodic_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      context JSONB DEFAULT '{}',
      memory_type TEXT DEFAULT 'conversation',
      importance FLOAT DEFAULT 0.5,
      search_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_accessed TIMESTAMPTZ DEFAULT NOW()
    );

    -- Semantic Memory: extracted knowledge
    CREATE TABLE IF NOT EXISTS semantic_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      confidence FLOAT DEFAULT 1.0,
      source_episodes UUID[],
      search_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- User Profiles
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      preferences JSONB DEFAULT '{}',
      personality_traits JSONB DEFAULT '{}',
      statistics JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_interaction TIMESTAMPTZ DEFAULT NOW()
    );

    -- Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      platform TEXT DEFAULT 'line',
      summary TEXT,
      key_topics TEXT[],
      message_count INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    );

    -- Learnings (mistakes and lessons)
    CREATE TABLE IF NOT EXISTS learnings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      category TEXT,
      description TEXT NOT NULL,
      lesson TEXT,
      context JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Reasoning Logs (meta-cognition)
    CREATE TABLE IF NOT EXISTS reasoning_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT,
      input TEXT,
      intent TEXT,
      context_retrieved JSONB DEFAULT '[]',
      decision_process TEXT[],
      confidence FLOAT,
      output TEXT,
      self_check_result JSONB,
      feedback JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Performance Metrics
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      conversations INTEGER DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0,
      tasks_failed INTEGER DEFAULT 0,
      mistakes INTEGER DEFAULT 0,
      proactive_suggestions INTEGER DEFAULT 0,
      positive_feedback INTEGER DEFAULT 0,
      negative_feedback INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_episodic_user ON episodic_memory(user_id);
    CREATE INDEX IF NOT EXISTS idx_episodic_created ON episodic_memory(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_episodic_search ON episodic_memory USING gin(to_tsvector('english', search_text));
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_learnings_type ON learnings(type);
    CREATE INDEX IF NOT EXISTS idx_reasoning_created ON reasoning_logs(created_at DESC);
  `;

  try {
    await pool.query(baseSchema);
    console.log('[DB] Schema initialized (text search mode)');

    // Add vector columns if pgvector is available
    if (vectorEnabled) {
      try {
        await pool.query(`
          ALTER TABLE episodic_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);
          ALTER TABLE semantic_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);
        `);
        console.log('[DB] Vector columns added');
      } catch (e) {
        console.log('[DB] Could not add vector columns:', e.message);
      }
    }
  } catch (error) {
    console.error('[DB] Schema initialization failed:', error.message);
  }
}

/**
 * Get database pool
 */
export function getPool() {
  return pool;
}

/**
 * Query helper
 */
export async function query(text, params) {
  if (!pool) {
    throw new Error('PostgreSQL not initialized');
  }
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.log('[DB] Slow query:', { text: text.substring(0, 50), duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Close connection pool
 */
export async function closePostgres() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] PostgreSQL connection closed');
  }
}

export default {
  initPostgres,
  getPool,
  query,
  closePostgres,
  isVectorEnabled
};
