#!/usr/bin/env node
/**
 * Migration Script: SQLite + JSON → PostgreSQL
 * Migrates user profiles, mistakes, and conversation chunks
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateUserProfiles() {
  console.log('\n📊 Migrating user profiles...');

  const filePath = path.join(dataDir, 'user-profiles.json');
  if (!fs.existsSync(filePath)) {
    console.log('  No user-profiles.json found');
    return 0;
  }

  const profiles = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let count = 0;

  for (const [userId, profile] of Object.entries(profiles)) {
    try {
      await pool.query(`
        INSERT INTO user_profiles (user_id, display_name, preferences, personality_traits, created_at, last_interaction)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          preferences = EXCLUDED.preferences,
          personality_traits = EXCLUDED.personality_traits,
          last_interaction = NOW()
      `, [
        userId,
        profile.name || profile.displayName || null,
        JSON.stringify(profile.preferences || {}),
        JSON.stringify({ role: profile.role, permissions: profile.permissions }),
        profile.createdAt || new Date().toISOString()
      ]);
      count++;
      console.log(`  ✓ ${profile.name || userId}`);
    } catch (error) {
      console.error(`  ✗ ${userId}: ${error.message}`);
    }
  }

  return count;
}

async function migrateMistakes() {
  console.log('\n📝 Migrating mistakes/learnings...');

  const filePath = path.join(dataDir, 'mistakes.json');
  if (!fs.existsSync(filePath)) {
    console.log('  No mistakes.json found');
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const mistakes = data.mistakes || [];
  let count = 0;

  for (const mistake of mistakes) {
    try {
      await pool.query(`
        INSERT INTO learnings (type, category, description, lesson, context, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [
        'mistake',
        mistake.category || 'general',
        mistake.description,
        mistake.correction || mistake.prevention,
        JSON.stringify({
          severity: mistake.severity,
          rootCause: mistake.rootCause,
          correctedBy: mistake.correctedBy,
          originalId: mistake.id
        }),
        mistake.timestamp || new Date().toISOString()
      ]);
      count++;
      console.log(`  ✓ ${mistake.category}: ${mistake.description.substring(0, 50)}...`);
    } catch (error) {
      console.error(`  ✗ ${mistake.id}: ${error.message}`);
    }
  }

  return count;
}

async function migrateConversationChunks() {
  console.log('\n💬 Migrating conversation chunks from SQLite...');

  const dbPath = path.join(dataDir, 'memory.db');
  if (!fs.existsSync(dbPath)) {
    console.log('  No memory.db found');
    return 0;
  }

  const sqlite = new Database(dbPath, { readonly: true });
  let count = 0;

  try {
    const chunks = sqlite.prepare(`
      SELECT id, path, content, source, tokens, created_at
      FROM chunks
      ORDER BY created_at DESC
      LIMIT 500
    `).all();

    console.log(`  Found ${chunks.length} chunks`);

    for (const chunk of chunks) {
      try {
        // Convert Unix timestamp to ISO string
        const createdAt = chunk.created_at
          ? new Date(chunk.created_at * 1000).toISOString()
          : new Date().toISOString();

        await pool.query(`
          INSERT INTO episodic_memory (user_id, content, context, memory_type, importance, search_text, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          'tars',
          chunk.content,
          JSON.stringify({ path: chunk.path, source: chunk.source, tokens: chunk.tokens, originalId: chunk.id }),
          chunk.source || 'memory',
          0.5,
          chunk.content.toLowerCase().substring(0, 1000),
          createdAt
        ]);
        count++;
      } catch (error) {
        // Skip duplicates silently
        if (!error.message.includes('duplicate')) {
          console.error(`  ✗ Chunk: ${error.message}`);
        }
      }
    }

    console.log(`  ✓ Migrated ${count} chunks`);
  } finally {
    sqlite.close();
  }

  return count;
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM user_profiles) as users,
      (SELECT COUNT(*) FROM learnings) as learnings,
      (SELECT COUNT(*) FROM episodic_memory) as memories
  `);

  const row = counts.rows[0];
  console.log(`  Users: ${row.users}`);
  console.log(`  Learnings: ${row.learnings}`);
  console.log(`  Memories: ${row.memories}`);

  return row;
}

async function main() {
  console.log('🚀 Starting migration to PostgreSQL...');
  console.log(`   Database: ${process.env.DATABASE_URL?.substring(0, 30)}...`);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL');

    // Run migrations
    const userCount = await migrateUserProfiles();
    const mistakeCount = await migrateMistakes();
    const chunkCount = await migrateConversationChunks();

    // Verify
    await verifyMigration();

    console.log('\n✅ Migration complete!');
    console.log(`   Users: ${userCount}`);
    console.log(`   Mistakes: ${mistakeCount}`);
    console.log(`   Chunks: ${chunkCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
