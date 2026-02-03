/**
 * Dedupe - Deduplication Cache จาก OpenClaw Pattern
 *
 * Features:
 * - TTL-based expiration
 * - Size-limited cache
 * - Automatic pruning
 * - Simple check API
 *
 * @module dedupe
 */

// ============================================================
// Constants
// ============================================================

/**
 * Default cache options
 */
export const DEFAULT_DEDUPE_OPTIONS = {
  ttlMs: 5000,     // 5 seconds
  maxSize: 1000,   // 1000 entries
};

// ============================================================
// Main Functions
// ============================================================

/**
 * Create a deduplication cache
 * @param {object} options - Cache options
 * @returns {object} Dedupe cache API
 */
export function createDedupeCache(options = {}) {
  const { ttlMs, maxSize } = { ...DEFAULT_DEDUPE_OPTIONS, ...options };

  /**
   * Cache storage: Map<key, timestamp>
   * @type {Map<string, number>}
   */
  const cache = new Map();

  /**
   * Prune expired and excess entries
   * @param {number} now - Current timestamp
   */
  function prune(now) {
    // Remove expired entries
    for (const [key, timestamp] of cache.entries()) {
      if (now - timestamp > ttlMs) {
        cache.delete(key);
      }
    }

    // Remove oldest entries if over size limit
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp (oldest first)

      const toRemove = cache.size - maxSize;
      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Check if key is duplicate (and record it if not)
   * @param {string} key - Key to check
   * @param {number} now - Current timestamp (optional)
   * @returns {boolean} True if duplicate, false if new
   */
  function check(key, now = Date.now()) {
    // Check if exists and not expired
    if (cache.has(key)) {
      const timestamp = cache.get(key);
      if (now - timestamp <= ttlMs) {
        return true; // Duplicate
      }
      // Expired, remove it
      cache.delete(key);
    }

    // Record new entry
    cache.set(key, now);

    // Prune periodically
    if (cache.size > maxSize * 1.1) {
      prune(now);
    }

    return false; // New
  }

  /**
   * Clear all entries
   */
  function clear() {
    cache.clear();
  }

  /**
   * Get current size
   * @returns {number} Number of entries
   */
  function size() {
    return cache.size;
  }

  /**
   * Get all keys (for debugging)
   * @returns {string[]} List of keys
   */
  function keys() {
    return Array.from(cache.keys());
  }

  /**
   * Get cache stats
   * @returns {object} Stats
   */
  function stats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const timestamp of cache.values()) {
      if (now - timestamp > ttlMs) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: cache.size,
      active,
      expired,
      maxSize,
      ttlMs,
    };
  }

  return {
    check,
    clear,
    size,
    keys,
    stats,
  };
}

// ============================================================
// Specialized Caches
// ============================================================

/**
 * Create a message deduplication cache
 * For preventing duplicate message processing
 */
export function createMessageDedupeCache(options = {}) {
  return createDedupeCache({
    ttlMs: 10000,  // 10 seconds
    maxSize: 500,
    ...options,
  });
}

/**
 * Create a webhook deduplication cache
 * For preventing duplicate webhook processing
 */
export function createWebhookDedupeCache(options = {}) {
  return createDedupeCache({
    ttlMs: 60000,  // 1 minute
    maxSize: 1000,
    ...options,
  });
}

/**
 * Create a session deduplication cache
 * For preventing duplicate session starts
 */
export function createSessionDedupeCache(options = {}) {
  return createDedupeCache({
    ttlMs: 300000, // 5 minutes
    maxSize: 100,
    ...options,
  });
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Create a hash key from multiple values
 * @param {...*} values - Values to hash
 * @returns {string} Hash key
 */
export function createDedupeKey(...values) {
  return values.map((v) => {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }).join(':');
}

/**
 * Decorator to deduplicate function calls
 * @param {Function} fn - Function to wrap
 * @param {object} options - Dedupe options
 * @param {Function} keyFn - Function to create key from args
 * @returns {Function} Wrapped function
 */
export function withDedupe(fn, options = {}, keyFn = (...args) => createDedupeKey(...args)) {
  const cache = createDedupeCache(options);

  return async function (...args) {
    const key = keyFn(...args);

    if (cache.check(key)) {
      console.log(`[DEDUPE] Skipping duplicate call: ${key}`);
      return undefined; // Skip duplicate
    }

    return fn.apply(this, args);
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  // Options
  DEFAULT_DEDUPE_OPTIONS,

  // Main
  createDedupeCache,

  // Specialized
  createMessageDedupeCache,
  createWebhookDedupeCache,
  createSessionDedupeCache,

  // Utilities
  createDedupeKey,
  withDedupe,
};
