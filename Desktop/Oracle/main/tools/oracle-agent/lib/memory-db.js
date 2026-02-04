/**
 * Oracle Memory System - Vector + Keyword Search
 *
 * Based on OpenClaw's hybrid search approach:
 * - Vector search (OpenAI embeddings) for semantic understanding
 * - Keyword search (SQLite FTS5) for exact matches
 * - Hybrid score = 0.7 * vector + 0.3 * keyword
 *
 * Cost: ~$0.00002 per 1K tokens (text-embedding-3-small)
 */

// Dynamic import for optional better-sqlite3
let Database = null;
try {
  Database = (await import('better-sqlite3')).default;
} catch (e) {
  console.warn('[MEMORY] better-sqlite3 not available - SQLite features disabled');
}

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Embedding
  model: 'text-embedding-3-small',  // 1536 dimensions, $0.00002/1K tokens
  dimensions: 1536,

  // Chunking
  chunkTokens: 400,      // tokens per chunk
  chunkOverlap: 80,      // overlap between chunks

  // Search
  maxResults: 6,
  minScore: 0.35,
  hybridWeights: {
    vector: 0.7,
    keyword: 0.3
  },
  candidateMultiplier: 4,  // fetch 4x candidates for hybrid merge

  // Paths
  dbPath: path.join(__dirname, '..', 'data', 'memory.db'),
  sourcePaths: [
    path.join(__dirname, '..', '..', '..', 'ψ', 'memory'),  // Main memory
  ]
};

// =============================================================================
// OPENAI CLIENT
// =============================================================================

let openai = null;

function getOpenAI() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[MEMORY] No OPENAI_API_KEY found - vector search disabled');
      return null;
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// =============================================================================
// DATABASE
// =============================================================================

let db = null;

function getDB() {
  if (!Database) {
    console.warn('[MEMORY] SQLite not available');
    return null;
  }
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(CONFIG.dbPath);
    ensureSchema();
    console.log('[MEMORY] Database initialized:', CONFIG.dbPath);
  }
  return db;
}

function ensureSchema() {
  const database = db || getDB();

  database.exec(`
    -- Main chunks table
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      start_line INTEGER,
      end_line INTEGER,
      content TEXT NOT NULL,
      embedding BLOB,
      source TEXT DEFAULT 'memory',
      tokens INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- FTS5 for keyword search
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      content='chunks',
      content_rowid='rowid',
      tokenize='unicode61'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    -- Embedding cache (to avoid re-embedding same content)
    CREATE TABLE IF NOT EXISTS embedding_cache (
      content_hash TEXT PRIMARY KEY,
      embedding BLOB,
      model TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Sync state
    CREATE TABLE IF NOT EXISTS sync_state (
      path TEXT PRIMARY KEY,
      mtime INTEGER,
      chunk_count INTEGER,
      last_sync INTEGER
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
    CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
  `);
}

// =============================================================================
// EMBEDDING
// =============================================================================

/**
 * Get embedding for text using OpenAI API
 * Uses cache to avoid duplicate API calls
 */
async function getEmbedding(text) {
  const client = getOpenAI();
  if (!client) {
    return null;  // No API key - return null
  }

  const database = getDB();
  if (!database) {
    return null;  // No SQLite - return null
  }

  // Check cache first
  const hash = hashContent(text);
  const cached = database.prepare(
    'SELECT embedding FROM embedding_cache WHERE content_hash = ?'
  ).get(hash);

  if (cached) {
    return bufferToFloat32Array(cached.embedding);
  }

  try {
    const response = await client.embeddings.create({
      model: CONFIG.model,
      input: text.slice(0, 8000),  // Limit input size
      dimensions: CONFIG.dimensions
    });

    const embedding = response.data[0].embedding;

    // Cache the embedding
    database.prepare(
      'INSERT OR REPLACE INTO embedding_cache (content_hash, embedding, model) VALUES (?, ?, ?)'
    ).run(hash, float32ArrayToBuffer(embedding), CONFIG.model);

    return embedding;
  } catch (error) {
    console.error('[MEMORY] Embedding error:', error.message);
    return null;
  }
}

/**
 * Batch embed multiple texts
 */
async function getEmbeddings(texts) {
  const client = getOpenAI();
  if (!client || texts.length === 0) {
    return texts.map(() => null);
  }

  const database = getDB();
  if (!database) {
    return texts.map(() => null);
  }
  const results = new Array(texts.length).fill(null);
  const toEmbed = [];
  const toEmbedIndices = [];

  // Check cache for each text
  for (let i = 0; i < texts.length; i++) {
    const hash = hashContent(texts[i]);
    const cached = database.prepare(
      'SELECT embedding FROM embedding_cache WHERE content_hash = ?'
    ).get(hash);

    if (cached) {
      results[i] = bufferToFloat32Array(cached.embedding);
    } else {
      toEmbed.push(texts[i].slice(0, 8000));
      toEmbedIndices.push(i);
    }
  }

  // Batch embed uncached texts
  if (toEmbed.length > 0) {
    try {
      const response = await client.embeddings.create({
        model: CONFIG.model,
        input: toEmbed,
        dimensions: CONFIG.dimensions
      });

      for (let i = 0; i < response.data.length; i++) {
        const embedding = response.data[i].embedding;
        const originalIndex = toEmbedIndices[i];
        results[originalIndex] = embedding;

        // Cache
        const hash = hashContent(texts[originalIndex]);
        database.prepare(
          'INSERT OR REPLACE INTO embedding_cache (content_hash, embedding, model) VALUES (?, ?, ?)'
        ).run(hash, float32ArrayToBuffer(embedding), CONFIG.model);
      }
    } catch (error) {
      console.error('[MEMORY] Batch embedding error:', error.message);
    }
  }

  return results;
}

// =============================================================================
// CHUNKING
// =============================================================================

/**
 * Split text into chunks with overlap
 */
function chunkText(text, path, source = 'memory') {
  const lines = text.split('\n');
  const chunks = [];

  let currentChunk = [];
  let currentTokens = 0;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTokens = estimateTokens(line);

    if (currentTokens + lineTokens > CONFIG.chunkTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        id: `${hashContent(path)}-${startLine}`,
        path,
        startLine,
        endLine: startLine + currentChunk.length - 1,
        content: currentChunk.join('\n'),
        tokens: currentTokens,
        source
      });

      // Start new chunk with overlap
      const overlapLines = Math.ceil(CONFIG.chunkOverlap / 10);  // ~10 tokens per line estimate
      const keepLines = currentChunk.slice(-overlapLines);
      currentChunk = [...keepLines, line];
      currentTokens = keepLines.reduce((sum, l) => sum + estimateTokens(l), 0) + lineTokens;
      startLine = i + 1 - overlapLines;
    } else {
      currentChunk.push(line);
      currentTokens += lineTokens;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      id: `${hashContent(path)}-${startLine}`,
      path,
      startLine,
      endLine: startLine + currentChunk.length - 1,
      content: currentChunk.join('\n'),
      tokens: currentTokens,
      source
    });
  }

  return chunks;
}

/**
 * Rough token estimation (~4 chars per token)
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// SYNC - Index files into database
// =============================================================================

/**
 * Sync a single file into the database
 */
async function syncFile(filePath, source = 'memory') {
  const database = getDB();
  if (!database) {
    return { error: 'SQLite not available' };
  }

  if (!fs.existsSync(filePath)) {
    // File deleted - remove chunks
    database.prepare('DELETE FROM chunks WHERE path = ?').run(filePath);
    database.prepare('DELETE FROM sync_state WHERE path = ?').run(filePath);
    return { deleted: true };
  }

  const stats = fs.statSync(filePath);
  const mtime = stats.mtimeMs;

  // Check if file changed
  const syncState = database.prepare('SELECT mtime FROM sync_state WHERE path = ?').get(filePath);
  if (syncState && syncState.mtime >= mtime) {
    return { skipped: true };  // No changes
  }

  // Read and chunk file
  const content = fs.readFileSync(filePath, 'utf8');
  const chunks = chunkText(content, filePath, source);

  if (chunks.length === 0) {
    return { empty: true };
  }

  // Get embeddings for all chunks
  console.log(`[MEMORY] Syncing ${filePath} (${chunks.length} chunks)...`);
  const embeddings = await getEmbeddings(chunks.map(c => c.content));

  // Delete old chunks for this file
  database.prepare('DELETE FROM chunks WHERE path = ?').run(filePath);

  // Insert new chunks
  const insert = database.prepare(`
    INSERT INTO chunks (id, path, start_line, end_line, content, embedding, source, tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((chunks, embeddings) => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i] ? float32ArrayToBuffer(embeddings[i]) : null;
      insert.run(
        chunk.id,
        chunk.path,
        chunk.startLine,
        chunk.endLine,
        chunk.content,
        embedding,
        chunk.source,
        chunk.tokens
      );
    }
  });

  insertMany(chunks, embeddings);

  // Update sync state
  database.prepare(`
    INSERT OR REPLACE INTO sync_state (path, mtime, chunk_count, last_sync)
    VALUES (?, ?, ?, strftime('%s', 'now'))
  `).run(filePath, mtime, chunks.length);

  console.log(`[MEMORY] Synced ${filePath}: ${chunks.length} chunks`);
  return { synced: true, chunks: chunks.length };
}

/**
 * Sync all files in configured paths
 */
async function syncAll() {
  console.log('[MEMORY] Starting full sync...');
  const results = { synced: 0, skipped: 0, deleted: 0, errors: 0 };

  for (const sourcePath of CONFIG.sourcePaths) {
    if (!fs.existsSync(sourcePath)) continue;

    const files = walkDir(sourcePath, ['.md', '.json', '.jsonl', '.txt']);

    for (const file of files) {
      try {
        const result = await syncFile(file, 'memory');
        if (result.synced) results.synced++;
        else if (result.skipped) results.skipped++;
        else if (result.deleted) results.deleted++;
      } catch (error) {
        console.error(`[MEMORY] Error syncing ${file}:`, error.message);
        results.errors++;
      }
    }
  }

  console.log(`[MEMORY] Sync complete:`, results);
  return results;
}

/**
 * Walk directory recursively
 */
function walkDir(dir, extensions) {
  const files = [];

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!item.startsWith('.') && item !== 'node_modules') {
        files.push(...walkDir(fullPath, extensions));
      }
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

// =============================================================================
// SEARCH
// =============================================================================

/**
 * Hybrid search: vector + keyword
 */
async function search(query, options = {}) {
  const database = getDB();
  if (!database) {
    return [];  // No SQLite - return empty
  }
  const maxResults = options.maxResults || CONFIG.maxResults;
  const minScore = options.minScore || CONFIG.minScore;

  // Get candidates from both methods
  const candidateCount = maxResults * CONFIG.candidateMultiplier;

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, candidateCount),
    keywordSearch(query, candidateCount)
  ]);

  // Merge results with hybrid scoring
  const merged = mergeHybridResults(vectorResults, keywordResults);

  // Filter by min score and limit
  return merged
    .filter(r => r.score >= minScore)
    .slice(0, maxResults)
    .map(r => ({
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      snippet: r.content.slice(0, 500),
      score: r.score,
      source: r.source,
      citation: `${path.basename(r.path)}:${r.startLine}-${r.endLine}`
    }));
}

/**
 * Vector search using cosine similarity
 */
async function vectorSearch(query, limit) {
  const database = getDB();
  if (!database) {
    return [];
  }
  const queryEmbedding = await getEmbedding(query);

  if (!queryEmbedding) {
    return [];  // No embedding available
  }

  // Get all chunks with embeddings
  const chunks = database.prepare(`
    SELECT id, path, start_line, end_line, content, embedding, source
    FROM chunks
    WHERE embedding IS NOT NULL
  `).all();

  // Calculate cosine similarity for each
  const results = chunks
    .map(chunk => {
      const embedding = bufferToFloat32Array(chunk.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        id: chunk.id,
        path: chunk.path,
        startLine: chunk.start_line,
        endLine: chunk.end_line,
        content: chunk.content,
        source: chunk.source,
        score: similarity
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

/**
 * Keyword search using FTS5
 */
function keywordSearch(query, limit) {
  const database = getDB();
  if (!database) {
    return [];
  }

  // Build FTS query
  const tokens = query.match(/[A-Za-z0-9ก-๙]+/g) || [];
  if (tokens.length === 0) return [];

  const ftsQuery = tokens.map(t => `"${t}"`).join(' OR ');

  try {
    const results = database.prepare(`
      SELECT
        c.id, c.path, c.start_line, c.end_line, c.content, c.source,
        bm25(chunks_fts) as bm25_score
      FROM chunks_fts f
      JOIN chunks c ON f.rowid = c.rowid
      WHERE chunks_fts MATCH ?
      ORDER BY bm25_score
      LIMIT ?
    `).all(ftsQuery, limit);

    // Normalize BM25 scores to 0-1 range
    const maxScore = results.length > 0 ? Math.abs(results[0].bm25_score) : 1;

    return results.map(r => ({
      id: r.id,
      path: r.path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
      source: r.source,
      score: 1 / (1 + Math.abs(r.bm25_score) / maxScore)
    }));
  } catch (error) {
    console.error('[MEMORY] FTS search error:', error.message);
    return [];
  }
}

/**
 * Merge vector and keyword results with hybrid scoring
 */
function mergeHybridResults(vectorResults, keywordResults) {
  const byId = new Map();

  // Add vector results
  for (const r of vectorResults) {
    byId.set(r.id, {
      ...r,
      vectorScore: r.score,
      keywordScore: 0
    });
  }

  // Add/merge keyword results
  for (const r of keywordResults) {
    if (byId.has(r.id)) {
      byId.get(r.id).keywordScore = r.score;
    } else {
      byId.set(r.id, {
        ...r,
        vectorScore: 0,
        keywordScore: r.score
      });
    }
  }

  // Calculate hybrid scores
  const weights = CONFIG.hybridWeights;
  return Array.from(byId.values())
    .map(r => ({
      ...r,
      score: weights.vector * r.vectorScore + weights.keyword * r.keywordScore
    }))
    .sort((a, b) => b.score - a.score);
}

// =============================================================================
// UTILITIES
// =============================================================================

function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function float32ArrayToBuffer(arr) {
  return Buffer.from(new Float32Array(arr).buffer);
}

function bufferToFloat32Array(buffer) {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4));
}

// =============================================================================
// STATUS
// =============================================================================

function getStatus() {
  const database = getDB();
  if (!database) {
    return {
      totalChunks: 0,
      withEmbeddings: 0,
      cacheSize: 0,
      sources: {},
      vectorEnabled: !!getOpenAI(),
      dbPath: CONFIG.dbPath,
      sqliteAvailable: false
    };
  }

  const chunks = database.prepare('SELECT COUNT(*) as count FROM chunks').get();
  const withEmbeddings = database.prepare('SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL').get();
  const cacheSize = database.prepare('SELECT COUNT(*) as count FROM embedding_cache').get();
  const sources = database.prepare('SELECT source, COUNT(*) as count FROM chunks GROUP BY source').all();

  return {
    totalChunks: chunks.count,
    withEmbeddings: withEmbeddings.count,
    cacheSize: cacheSize.count,
    sources: Object.fromEntries(sources.map(s => [s.source, s.count])),
    vectorEnabled: !!getOpenAI(),
    dbPath: CONFIG.dbPath
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Core
  search,
  syncFile,
  syncAll,
  getStatus,

  // Low-level
  getEmbedding,
  getEmbeddings,
  chunkText,

  // Config
  CONFIG
};

export default {
  search,
  syncFile,
  syncAll,
  getStatus,
  CONFIG
};
