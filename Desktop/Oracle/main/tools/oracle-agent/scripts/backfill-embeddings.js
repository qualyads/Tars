#!/usr/bin/env node
/**
 * Backfill Embeddings Script
 * Generate embeddings for existing memories that don't have one
 */

import pg from 'pg';
import OpenAI from 'openai';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: 1536
  });
  return `[${response.data[0].embedding.join(',')}]`;
}

async function backfill() {
  console.log('🔄 Starting embedding backfill...\n');

  // Get memories without embeddings
  const result = await pool.query(`
    SELECT id, content
    FROM episodic_memory
    WHERE embedding IS NULL
    ORDER BY created_at DESC
    LIMIT 500
  `);

  const memories = result.rows;
  console.log(`📊 Found ${memories.length} memories without embeddings\n`);

  if (memories.length === 0) {
    console.log('✅ All memories already have embeddings!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < memories.length; i++) {
    const memory = memories[i];

    try {
      // Generate embedding
      const embedding = await generateEmbedding(memory.content);

      // Update database
      await pool.query(
        'UPDATE episodic_memory SET embedding = $1 WHERE id = $2',
        [embedding, memory.id]
      );

      success++;
      process.stdout.write(`\r  Progress: ${i + 1}/${memories.length} (${success} success, ${failed} failed)`);

      // Rate limit: 60 requests/min for OpenAI
      if ((i + 1) % 50 === 0) {
        console.log('\n  ⏳ Pausing 10s for rate limit...');
        await new Promise(r => setTimeout(r, 10000));
      } else {
        // Small delay between requests
        await new Promise(r => setTimeout(r, 100));
      }

    } catch (error) {
      failed++;
      console.log(`\n  ❌ Failed: ${memory.id} - ${error.message}`);
    }
  }

  console.log(`\n\n✅ Backfill complete!`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);

  // Verify
  const verifyResult = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embedding
    FROM episodic_memory
  `);

  const stats = verifyResult.rows[0];
  console.log(`\n📊 Database stats:`);
  console.log(`   Total memories: ${stats.total}`);
  console.log(`   With embeddings: ${stats.with_embedding}`);
  console.log(`   Coverage: ${((stats.with_embedding / stats.total) * 100).toFixed(1)}%`);
}

backfill()
  .catch(console.error)
  .finally(() => pool.end());
