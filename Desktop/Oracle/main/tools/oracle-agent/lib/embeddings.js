/**
 * Embeddings - Multi-Provider Embedding System จาก OpenClaw Pattern
 *
 * Features:
 * - Multi-provider support (OpenAI, Gemini, Local)
 * - Fallback chain
 * - Batch processing
 * - Caching with hash key
 * - Retry with exponential backoff
 *
 * @module embeddings
 */

import crypto from 'crypto';

// ============================================================
// Constants
// ============================================================

/**
 * Embedding providers
 */
export const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  LOCAL: 'local',
};

/**
 * Default models per provider
 */
export const DEFAULT_MODELS = {
  [PROVIDERS.OPENAI]: 'text-embedding-3-small',
  [PROVIDERS.GEMINI]: 'text-embedding-004',
};

/**
 * Batch processing settings
 */
export const BATCH_CONFIG = {
  maxTokens: 8000,
  concurrency: 4,
  retryAttempts: 3,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 8000,
  queryTimeoutMs: 60000,
  batchTimeoutMs: 120000,
};

// ============================================================
// Embedding Cache
// ============================================================

/**
 * Create embedding cache
 * @param {object} options
 * @returns {object} Cache API
 */
export function createEmbeddingCache(options = {}) {
  const { maxEntries = 10000 } = options;

  const cache = new Map();

  /**
   * Generate cache key
   * @param {string} provider
   * @param {string} model
   * @param {string} text
   * @returns {string}
   */
  function makeKey(provider, model, text) {
    const hash = crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
    return `${provider}:${model}:${hash}`;
  }

  /**
   * Get cached embedding
   * @param {string} provider
   * @param {string} model
   * @param {string} text
   * @returns {number[]|null}
   */
  function get(provider, model, text) {
    const key = makeKey(provider, model, text);
    return cache.get(key) || null;
  }

  /**
   * Set cached embedding
   * @param {string} provider
   * @param {string} model
   * @param {string} text
   * @param {number[]} embedding
   */
  function set(provider, model, text, embedding) {
    const key = makeKey(provider, model, text);

    // Evict oldest if at capacity
    if (cache.size >= maxEntries) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, embedding);
  }

  return {
    get,
    set,
    clear: () => cache.clear(),
    size: () => cache.size,
  };
}

// ============================================================
// OpenAI Embeddings
// ============================================================

/**
 * Create OpenAI embedding function
 * @param {object} options
 * @returns {Function} (text) => Promise<number[]>
 */
export function createOpenAIEmbedder(options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    model = DEFAULT_MODELS[PROVIDERS.OPENAI],
    baseUrl = 'https://api.openai.com/v1',
    cache,
  } = options;

  if (!apiKey) {
    throw new Error('OpenAI API key required');
  }

  async function getEmbedding(text) {
    // Check cache
    if (cache) {
      const cached = cache.get(PROVIDERS.OPENAI, model, text);
      if (cached) return cached;
    }

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding in response');
    }

    // Normalize
    const normalized = normalizeVector(embedding);

    // Cache
    if (cache) {
      cache.set(PROVIDERS.OPENAI, model, text, normalized);
    }

    return normalized;
  }

  async function getBatchEmbeddings(texts) {
    if (texts.length === 0) return [];

    // Check cache for all
    const results = new Array(texts.length).fill(null);
    const uncached = [];
    const uncachedIndices = [];

    if (cache) {
      for (let i = 0; i < texts.length; i++) {
        const cached = cache.get(PROVIDERS.OPENAI, model, texts[i]);
        if (cached) {
          results[i] = cached;
        } else {
          uncached.push(texts[i]);
          uncachedIndices.push(i);
        }
      }
    } else {
      uncached.push(...texts);
      uncachedIndices.push(...texts.map((_, i) => i));
    }

    if (uncached.length === 0) {
      return results;
    }

    // Batch API call
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: uncached,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI batch embedding failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Map results back
    for (let i = 0; i < data.data?.length; i++) {
      const embedding = normalizeVector(data.data[i].embedding);
      const originalIndex = uncachedIndices[i];
      results[originalIndex] = embedding;

      // Cache
      if (cache) {
        cache.set(PROVIDERS.OPENAI, model, texts[originalIndex], embedding);
      }
    }

    return results;
  }

  return {
    provider: PROVIDERS.OPENAI,
    model,
    getEmbedding,
    getBatchEmbeddings,
  };
}

// ============================================================
// Gemini Embeddings
// ============================================================

/**
 * Create Gemini embedding function
 * @param {object} options
 * @returns {Function}
 */
export function createGeminiEmbedder(options = {}) {
  const {
    apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    model = DEFAULT_MODELS[PROVIDERS.GEMINI],
    cache,
  } = options;

  if (!apiKey) {
    throw new Error('Gemini API key required');
  }

  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async function getEmbedding(text, taskType = 'RETRIEVAL_QUERY') {
    // Check cache
    if (cache) {
      const cached = cache.get(PROVIDERS.GEMINI, model, text);
      if (cached) return cached;
    }

    const response = await fetch(
      `${baseUrl}/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text }],
          },
          taskType,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini embedding failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding) {
      throw new Error('No embedding in response');
    }

    // Normalize
    const normalized = normalizeVector(embedding);

    // Cache
    if (cache) {
      cache.set(PROVIDERS.GEMINI, model, text, normalized);
    }

    return normalized;
  }

  async function getBatchEmbeddings(texts, taskType = 'RETRIEVAL_DOCUMENT') {
    // Gemini batch: one by one with concurrency
    const results = [];

    // Process in batches of 4 (concurrency)
    for (let i = 0; i < texts.length; i += BATCH_CONFIG.concurrency) {
      const batch = texts.slice(i, i + BATCH_CONFIG.concurrency);
      const batchResults = await Promise.all(
        batch.map(text => getEmbedding(text, taskType).catch(() => null))
      );
      results.push(...batchResults);
    }

    return results;
  }

  return {
    provider: PROVIDERS.GEMINI,
    model,
    getEmbedding,
    getBatchEmbeddings,
  };
}

// ============================================================
// Factory with Fallback
// ============================================================

/**
 * Create embedding provider with fallback
 * @param {object} options
 * @returns {object} Embedder API
 */
export function createEmbedder(options = {}) {
  const {
    provider = PROVIDERS.OPENAI,
    fallbackChain = [PROVIDERS.OPENAI, PROVIDERS.GEMINI],
    cache = createEmbeddingCache(),
    ...providerOptions
  } = options;

  let activeProvider = null;
  let activeEmbedder = null;
  let fallbackReason = null;

  /**
   * Try to create embedder for provider
   * @param {string} providerName
   * @returns {object|null}
   */
  function tryCreateEmbedder(providerName) {
    try {
      switch (providerName) {
        case PROVIDERS.OPENAI:
          return createOpenAIEmbedder({ cache, ...providerOptions });
        case PROVIDERS.GEMINI:
          return createGeminiEmbedder({ cache, ...providerOptions });
        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Initialize embedder with fallback
   */
  function initialize() {
    // Try primary provider first
    activeEmbedder = tryCreateEmbedder(provider);
    if (activeEmbedder) {
      activeProvider = provider;
      return;
    }

    // Try fallback chain
    for (const fallbackProvider of fallbackChain) {
      if (fallbackProvider === provider) continue;

      activeEmbedder = tryCreateEmbedder(fallbackProvider);
      if (activeEmbedder) {
        activeProvider = fallbackProvider;
        fallbackReason = `${provider} unavailable, using ${fallbackProvider}`;
        console.warn(`[EMBEDDINGS] ${fallbackReason}`);
        return;
      }
    }

    throw new Error('No embedding provider available');
  }

  // Initialize on creation
  initialize();

  /**
   * Get embedding with retry
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async function getEmbedding(text) {
    let lastError = null;

    for (let attempt = 1; attempt <= BATCH_CONFIG.retryAttempts; attempt++) {
      try {
        return await activeEmbedder.getEmbedding(text);
      } catch (error) {
        lastError = error;

        // Check if should retry
        const errorText = error.message || String(error);
        const isTransient = /timeout|rate.?limit|503|504|reset|ECONNRESET/i.test(errorText);

        if (!isTransient || attempt >= BATCH_CONFIG.retryAttempts) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(
          BATCH_CONFIG.retryBaseDelayMs * Math.pow(2, attempt - 1),
          BATCH_CONFIG.retryMaxDelayMs
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastError;
  }

  /**
   * Get batch embeddings
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async function getBatchEmbeddings(texts) {
    return activeEmbedder.getBatchEmbeddings(texts);
  }

  /**
   * Get status
   * @returns {object}
   */
  function getStatus() {
    return {
      provider: activeProvider,
      model: activeEmbedder?.model,
      fallback: fallbackReason ? { from: provider, reason: fallbackReason } : null,
      cache: cache ? { entries: cache.size() } : null,
    };
  }

  return {
    getEmbedding,
    getBatchEmbeddings,
    getStatus,
    cache,
  };
}

// ============================================================
// Utilities
// ============================================================

/**
 * Normalize vector to unit length
 * @param {number[]} vector
 * @returns {number[]}
 */
export function normalizeVector(vector) {
  if (!vector || vector.length === 0) return vector;

  let magnitude = 0;
  for (const v of vector) {
    magnitude += v * v;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) return vector;

  return vector.map(v => v / magnitude);
}

/**
 * Cosine similarity between two vectors
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
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
 * Estimate token count (rough)
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: 4 chars per token for English
  return Math.ceil(text.length / 4);
}

// ============================================================
// Exports
// ============================================================

export default {
  PROVIDERS,
  DEFAULT_MODELS,
  BATCH_CONFIG,
  createEmbeddingCache,
  createOpenAIEmbedder,
  createGeminiEmbedder,
  createEmbedder,
  normalizeVector,
  cosineSimilarity,
  estimateTokens,
};
