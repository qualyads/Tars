/**
 * Memory Index - Semantic Memory System จาก OpenClaw Pattern
 *
 * Features:
 * - SQLite-based storage (better-sqlite3)
 * - Hybrid search (keyword + vector)
 * - Incremental indexing (hash-based)
 * - Chunking with overlap
 *
 * @module memory-index
 */

import crypto from 'crypto';

// ============================================================
// Schema Constants
// ============================================================

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  chunking: {
    tokens: 256,       // Max tokens per chunk
    overlap: 32,       // Overlap tokens
    charsPerToken: 4,  // Approximate chars per token
  },
  query: {
    maxResults: 20,
    minScore: 0.3,
    snippetMaxChars: 700,
  },
  hybrid: {
    enabled: true,
    vectorWeight: 0.5,
    textWeight: 0.5,
  },
};

/**
 * Memory sources
 */
export const MEMORY_SOURCES = {
  MEMORY: 'memory',
  SESSIONS: 'sessions',
};

// ============================================================
// Chunking
// ============================================================

/**
 * Hash text content
 * @param {string} text
 * @returns {string}
 */
export function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Chunk markdown content
 * @param {string} content - Markdown content
 * @param {object} options
 * @returns {Array<{startLine, endLine, text, hash}>}
 */
export function chunkMarkdown(content, options = {}) {
  const {
    tokens = DEFAULT_CONFIG.chunking.tokens,
    overlap = DEFAULT_CONFIG.chunking.overlap,
    charsPerToken = DEFAULT_CONFIG.chunking.charsPerToken,
  } = options;

  if (!content || !content.trim()) {
    return [];
  }

  const maxChars = tokens * charsPerToken;
  const overlapChars = overlap * charsPerToken;

  const lines = content.split('\n');
  const chunks = [];

  let currentChunk = [];
  let currentChars = 0;
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineChars = line.length + 1; // +1 for newline

    // If single line exceeds max, split it
    if (lineChars > maxChars && currentChunk.length === 0) {
      // Split long line horizontally
      let remaining = line;
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, maxChars);
        remaining = remaining.slice(maxChars);

        chunks.push({
          startLine: i,
          endLine: i,
          text: chunk,
          hash: hashText(chunk),
        });
      }
      startLine = i + 1;
      continue;
    }

    // Check if adding this line exceeds max
    if (currentChars + lineChars > maxChars && currentChunk.length > 0) {
      // Save current chunk
      const text = currentChunk.join('\n');
      chunks.push({
        startLine,
        endLine: i - 1,
        text,
        hash: hashText(text),
      });

      // Start new chunk with overlap
      const overlapLines = [];
      let overlapTotal = 0;

      for (let j = currentChunk.length - 1; j >= 0 && overlapTotal < overlapChars; j--) {
        overlapLines.unshift(currentChunk[j]);
        overlapTotal += currentChunk[j].length + 1;
      }

      currentChunk = overlapLines;
      currentChars = overlapTotal;
      startLine = i - overlapLines.length;
    }

    currentChunk.push(line);
    currentChars += lineChars;
  }

  // Save remaining chunk
  if (currentChunk.length > 0) {
    const text = currentChunk.join('\n');
    chunks.push({
      startLine,
      endLine: lines.length - 1,
      text,
      hash: hashText(text),
    });
  }

  return chunks;
}

// ============================================================
// In-Memory Index (for Oracle without sqlite-vec)
// ============================================================

/**
 * Create an in-memory memory index
 * Uses Map-based storage with cosine similarity search
 *
 * @param {object} options
 * @returns {object} Index API
 */
export function createMemoryIndex(options = {}) {
  const {
    config = DEFAULT_CONFIG,
    getEmbedding, // (text) => Promise<number[]>
  } = options;

  // Storage
  const files = new Map();      // path → {hash, mtime, size}
  const chunks = new Map();     // id → {path, source, text, embedding, startLine, endLine}
  const keywords = new Map();   // word → Set<chunkId>

  let chunkIdCounter = 0;
  let dirty = false;

  /**
   * Tokenize text for keyword index
   * @param {string} text
   * @returns {string[]}
   */
  function tokenize(text) {
    if (!text) return [];
    return text.toLowerCase().match(/[a-z0-9_]+/g) || [];
  }

  /**
   * Cosine similarity between two vectors
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number}
   */
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

  /**
   * Index a file
   * @param {string} path
   * @param {string} content
   * @param {string} source
   */
  async function indexFile(path, content, source = MEMORY_SOURCES.MEMORY) {
    const hash = hashText(content);
    const existing = files.get(path);

    // Skip if unchanged
    if (existing && existing.hash === hash) {
      return { changed: false };
    }

    // Remove old chunks
    if (existing) {
      for (const [id, chunk] of chunks) {
        if (chunk.path === path) {
          // Remove from keyword index
          for (const word of tokenize(chunk.text)) {
            const ids = keywords.get(word);
            if (ids) {
              ids.delete(id);
              if (ids.size === 0) {
                keywords.delete(word);
              }
            }
          }
          chunks.delete(id);
        }
      }
    }

    // Chunk content
    const newChunks = chunkMarkdown(content, config.chunking);

    // Index chunks
    for (const chunk of newChunks) {
      const id = String(++chunkIdCounter);

      // Get embedding if function provided
      let embedding = null;
      if (getEmbedding) {
        try {
          embedding = await getEmbedding(chunk.text);
        } catch (error) {
          console.warn(`[MEMORY] Failed to get embedding for chunk ${id}:`, error.message);
        }
      }

      chunks.set(id, {
        id,
        path,
        source,
        text: chunk.text,
        embedding,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        hash: chunk.hash,
      });

      // Add to keyword index
      for (const word of tokenize(chunk.text)) {
        if (!keywords.has(word)) {
          keywords.set(word, new Set());
        }
        keywords.get(word).add(id);
      }
    }

    // Update file record
    files.set(path, {
      hash,
      mtime: Date.now(),
      size: content.length,
      chunkCount: newChunks.length,
    });

    dirty = true;
    return { changed: true, chunks: newChunks.length };
  }

  /**
   * Remove a file from index
   * @param {string} path
   */
  function removeFile(path) {
    if (!files.has(path)) return false;

    // Remove chunks
    for (const [id, chunk] of chunks) {
      if (chunk.path === path) {
        // Remove from keyword index
        for (const word of tokenize(chunk.text)) {
          const ids = keywords.get(word);
          if (ids) {
            ids.delete(id);
          }
        }
        chunks.delete(id);
      }
    }

    files.delete(path);
    dirty = true;
    return true;
  }

  /**
   * Search by keywords (BM25-like)
   * @param {string} query
   * @param {number} limit
   * @returns {Array}
   */
  function searchKeywords(query, limit = config.query.maxResults) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = new Map();
    const N = chunks.size; // Total documents

    for (const token of queryTokens) {
      const matchingIds = keywords.get(token);
      if (!matchingIds) continue;

      // IDF: log(N / df)
      const df = matchingIds.size;
      const idf = Math.log((N + 1) / (df + 1)) + 1;

      for (const id of matchingIds) {
        const current = scores.get(id) || 0;
        scores.set(id, current + idf);
      }
    }

    // Normalize scores to 0-1
    const maxScore = Math.max(...scores.values(), 1);

    return Array.from(scores.entries())
      .map(([id, score]) => ({
        id,
        score: score / maxScore,
        chunk: chunks.get(id),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search by vector similarity
   * @param {number[]} queryEmbedding
   * @param {number} limit
   * @returns {Array}
   */
  function searchVector(queryEmbedding, limit = config.query.maxResults) {
    if (!queryEmbedding) return [];

    const results = [];

    for (const [id, chunk] of chunks) {
      if (!chunk.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score > 0) {
        results.push({ id, score, chunk });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Hybrid search (keyword + vector)
   * @param {string} query
   * @param {object} options
   * @returns {Promise<Array>}
   */
  async function search(query, options = {}) {
    const {
      limit = config.query.maxResults,
      minScore = config.query.minScore,
      hybrid = config.hybrid,
    } = options;

    const keywordResults = searchKeywords(query, limit * 2);

    let vectorResults = [];
    if (getEmbedding && hybrid.enabled) {
      try {
        const queryEmbedding = await getEmbedding(query);
        vectorResults = searchVector(queryEmbedding, limit * 2);
      } catch (error) {
        console.warn('[MEMORY] Vector search failed:', error.message);
      }
    }

    // Merge results
    const merged = new Map();

    for (const r of keywordResults) {
      merged.set(r.id, {
        ...r.chunk,
        textScore: r.score,
        vectorScore: 0,
      });
    }

    for (const r of vectorResults) {
      const existing = merged.get(r.id);
      if (existing) {
        existing.vectorScore = r.score;
      } else {
        merged.set(r.id, {
          ...r.chunk,
          textScore: 0,
          vectorScore: r.score,
        });
      }
    }

    // Calculate final scores
    const results = Array.from(merged.values())
      .map(item => ({
        path: item.path,
        startLine: item.startLine,
        endLine: item.endLine,
        source: item.source,
        snippet: item.text.slice(0, config.query.snippetMaxChars),
        score: hybrid.vectorWeight * item.vectorScore + hybrid.textWeight * item.textScore,
        textScore: item.textScore,
        vectorScore: item.vectorScore,
      }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * Get status
   * @returns {object}
   */
  function getStatus() {
    let embeddedCount = 0;
    for (const chunk of chunks.values()) {
      if (chunk.embedding) embeddedCount++;
    }

    return {
      files: files.size,
      chunks: chunks.size,
      embedded: embeddedCount,
      keywords: keywords.size,
      dirty,
    };
  }

  /**
   * Clear all data
   */
  function clear() {
    files.clear();
    chunks.clear();
    keywords.clear();
    chunkIdCounter = 0;
    dirty = false;
  }

  /**
   * Export data for persistence
   * @returns {object}
   */
  function exportData() {
    return {
      files: Object.fromEntries(files),
      chunks: Array.from(chunks.values()),
      chunkIdCounter,
    };
  }

  /**
   * Import data from persistence
   * @param {object} data
   */
  function importData(data) {
    clear();

    if (data.files) {
      for (const [path, info] of Object.entries(data.files)) {
        files.set(path, info);
      }
    }

    if (data.chunks) {
      for (const chunk of data.chunks) {
        chunks.set(chunk.id, chunk);

        // Rebuild keyword index
        for (const word of tokenize(chunk.text)) {
          if (!keywords.has(word)) {
            keywords.set(word, new Set());
          }
          keywords.get(word).add(chunk.id);
        }
      }
    }

    if (data.chunkIdCounter) {
      chunkIdCounter = data.chunkIdCounter;
    }

    dirty = false;
  }

  return {
    indexFile,
    removeFile,
    search,
    searchKeywords,
    searchVector,
    getStatus,
    clear,
    exportData,
    importData,
    getFile: (path) => files.get(path),
    getChunk: (id) => chunks.get(id),
    getAllFiles: () => Array.from(files.keys()),
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  DEFAULT_CONFIG,
  MEMORY_SOURCES,
  hashText,
  chunkMarkdown,
  createMemoryIndex,
};
