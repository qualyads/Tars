#!/usr/bin/env node
/**
 * Migration Script: Railway PostgreSQL → Supabase (with pgvector)
 *
 * Usage:
 *   SUPABASE_URL="postgresql://..." node scripts/migrate-to-supabase.js
 */

import pg from 'pg';

const RAILWAY_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL environment variable');
  console.log('Usage: SUPABASE_URL="postgresql://..." node scripts/migrate-to-supabase.js');
  process.exit(1);
}

const railwayPool = RAILWAY_URL ? new pg.Pool({
  connectionString: RAILWAY_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

const supabasePool = new pg.Pool({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupSupabaseSchema() {
  console.log('\n📐 Setting up Supabase schema with pgvector...');

  const schema = `
    -- Enable pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Episodic Memory with vector embeddings
    CREATE TABLE IF NOT EXISTS episodic_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      context JSONB DEFAULT '{}',
      memory_type TEXT DEFAULT 'conversation',
      embedding vector(1536),
      importance FLOAT DEFAULT 0.5,
      search_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_accessed TIMESTAMPTZ DEFAULT NOW()
    );

    -- Semantic Memory with vector embeddings
    CREATE TABLE IF NOT EXISTS semantic_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      confidence FLOAT DEFAULT 1.0,
      source_episodes UUID[],
      embedding vector(1536),
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
    CREATE INDEX IF NOT EXISTS idx_episodic_embedding ON episodic_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_semantic_embedding ON semantic_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_learnings_type ON learnings(type);
    CREATE INDEX IF NOT EXISTS idx_reasoning_created ON reasoning_logs(created_at DESC);
  `;

  try {
    await supabasePool.query(schema);
    console.log('  ✅ Schema created with pgvector support!');
    return true;
  } catch (error) {
    console.error('  ❌ Schema creation failed:', error.message);
    return false;
  }
}

async function migrateTable(tableName) {
  if (!railwayPool) {
    console.log(`  ⏭️ Skipping ${tableName} (no Railway source)`);
    return 0;
  }

  try {
    // Get data from Railway
    const result = await railwayPool.query(`SELECT * FROM ${tableName}`);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log(`  ⏭️ ${tableName}: empty`);
      return 0;
    }

    // Get column names (excluding 'embedding' for now - we'll regenerate those)
    const columns = Object.keys(rows[0]).filter(c => c !== 'embedding');

    let count = 0;
    for (const row of rows) {
      try {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        await supabasePool.query(`
          INSERT INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `, values);
        count++;
      } catch (e) {
        // Skip duplicates
      }
    }

    console.log(`  ✅ ${tableName}: ${count}/${rows.length} rows`);
    return count;
  } catch (error) {
    console.error(`  ❌ ${tableName}: ${error.message}`);
    return 0;
  }
}

async function verifyPgvector() {
  console.log('\n🔍 Verifying pgvector...');

  try {
    // Test vector operations
    await supabasePool.query(`
      SELECT '[1,2,3]'::vector(3) <-> '[4,5,6]'::vector(3) as distance
    `);
    console.log('  ✅ pgvector is working!');

    // Check vector index
    const indexResult = await supabasePool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname LIKE '%embedding%'
    `);
    console.log(`  ✅ Vector indexes created: ${indexResult.rows.length}`);

    return true;
  } catch (error) {
    console.error('  ❌ pgvector verification failed:', error.message);
    return false;
  }
}

async function showStats() {
  console.log('\n📊 Supabase Database Stats:');

  const tables = ['user_profiles', 'learnings', 'episodic_memory', 'semantic_memory', 'sessions'];

  for (const table of tables) {
    try {
      const result = await supabasePool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  ${table}: ${result.rows[0].count} rows`);
    } catch (e) {
      console.log(`  ${table}: (not created)`);
    }
  }
}

async function main() {
  console.log('🚀 Migrating to Supabase with pgvector...\n');
  console.log(`  Source: ${RAILWAY_URL ? 'Railway PostgreSQL' : 'None (fresh install)'}`);
  console.log(`  Target: Supabase`);

  try {
    // Test Supabase connection
    await supabasePool.query('SELECT NOW()');
    console.log('✅ Connected to Supabase');

    // Setup schema
    const schemaOk = await setupSupabaseSchema();
    if (!schemaOk) {
      process.exit(1);
    }

    // Migrate data if Railway source exists
    if (railwayPool) {
      console.log('\n📦 Migrating data from Railway...');
      await migrateTable('user_profiles');
      await migrateTable('learnings');
      await migrateTable('episodic_memory');
      await migrateTable('semantic_memory');
      await migrateTable('sessions');
      await migrateTable('reasoning_logs');
      await migrateTable('performance_metrics');
    }

    // Verify pgvector
    await verifyPgvector();

    // Show stats
    await showStats();

    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update Railway environment variable:');
    console.log(`     DATABASE_URL=${SUPABASE_URL.substring(0, 50)}...`);
    console.log('  2. Redeploy Oracle Agent');
    console.log('  3. Test vector search');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await supabasePool.end();
    if (railwayPool) await railwayPool.end();
  }
}

main();
