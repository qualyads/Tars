/**
 * Memory Consolidation System for Oracle Agent
 * Consolidates memories, removes duplicates, maintains health
 */

import { query, getPool, isVectorEnabled } from './db-postgres.js';
import { generateEmbedding } from './embedding.js';

const SIMILARITY_THRESHOLD = 0.85;
const LOW_IMPORTANCE_THRESHOLD = 0.3;
const OLD_MEMORY_DAYS = 90;

export async function findDuplicates(userId = 'tars', limit = 50) {
  const pool = getPool();
  if (!pool || !isVectorEnabled()) return [];

  try {
    const result = await query(
      `SELECT id, content, embedding, importance, created_at
       FROM episodic_memory WHERE user_id = $1 AND embedding IS NOT NULL
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    const duplicates = [];
    const memories = result.rows;

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const simResult = await query(
          'SELECT 1 - ($1::vector <=> $2::vector) as similarity',
          [memories[i].embedding, memories[j].embedding]
        );
        const similarity = simResult.rows[0]?.similarity || 0;

        if (similarity >= SIMILARITY_THRESHOLD) {
          duplicates.push({
            memory1: { id: memories[i].id, content: memories[i].content.substring(0, 100) },
            memory2: { id: memories[j].id, content: memories[j].content.substring(0, 100) },
            similarity: Math.round(similarity * 100) / 100
          });
        }
      }
    }
    return duplicates;
  } catch (error) {
    console.error('[Consolidation] Error:', error);
    return [];
  }
}

export async function getMemoryHealth(userId = 'tars') {
  const pool = getPool();
  if (!pool) return null;

  try {
    const total = await query('SELECT COUNT(*) as count FROM episodic_memory WHERE user_id = $1', [userId]);
    const withEmbed = await query('SELECT COUNT(*) as count FROM episodic_memory WHERE user_id = $1 AND embedding IS NOT NULL', [userId]);
    const byType = await query('SELECT memory_type, COUNT(*) as count FROM episodic_memory WHERE user_id = $1 GROUP BY memory_type', [userId]);
    const avgImp = await query('SELECT AVG(importance) as avg FROM episodic_memory WHERE user_id = $1', [userId]);

    const t = parseInt(total.rows[0]?.count || 0);
    const e = parseInt(withEmbed.rows[0]?.count || 0);

    return {
      total: t,
      withEmbedding: e,
      embeddingCoverage: t > 0 ? Math.round((e / t) * 100) : 0,
      byType: byType.rows,
      avgImportance: Math.round((avgImp.rows[0]?.avg || 0) * 100) / 100,
      health: Math.round(Math.min(100, (e / Math.max(t, 1)) * 100))
    };
  } catch (error) {
    console.error('[Consolidation] Health error:', error);
    return null;
  }
}

export async function runConsolidation(userId = 'tars', dryRun = true) {
  console.log('[Consolidation] Starting...');
  const duplicates = await findDuplicates(userId);
  const health = await getMemoryHealth(userId);
  return { duplicates: duplicates.length, health, dryRun };
}

export default { findDuplicates, getMemoryHealth, runConsolidation };
