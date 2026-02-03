/**
 * Inbound Debounce - Based on OpenClaw Pattern
 *
 * Batch rapid messages from the same user within a time window.
 * Prevents multiple API calls when user sends messages quickly.
 *
 * Use case:
 * - User sends "hello" then "how are you" within 500ms
 * - System batches into single request: "hello\nhow are you"
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Default debounce window (ms)
  defaultDebounceMs: 500,

  // Per-provider debounce settings
  providerDebounce: {
    line: 500,
    whatsapp: 800,
    telegram: 300,
    discord: 200,
  },

  // Max messages to batch
  maxBatchSize: 10,
};

// =============================================================================
// DEBOUNCER
// =============================================================================

/**
 * Create an inbound message debouncer
 */
function createInboundDebouncer(options = {}) {
  const debounceMs = options.debounceMs ?? CONFIG.defaultDebounceMs;
  const buildKey = options.buildKey || ((item) => item.userId || item.from);
  const shouldDebounce = options.shouldDebounce || (() => true);
  const onFlush = options.onFlush;
  const onError = options.onError || console.error;

  // Buffer storage: key -> { items, timeout }
  const buffers = new Map();

  /**
   * Flush a buffer and call onFlush
   */
  async function flushBuffer(key, buffer) {
    buffers.delete(key);

    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
      buffer.timeout = null;
    }

    if (buffer.items.length === 0) return;

    try {
      await onFlush(buffer.items);
    } catch (err) {
      onError(err, buffer.items);
    }
  }

  /**
   * Flush buffer for specific key
   */
  async function flushKey(key) {
    const buffer = buffers.get(key);
    if (buffer) {
      await flushBuffer(key, buffer);
    }
  }

  /**
   * Schedule buffer flush
   */
  function scheduleFlush(key, buffer) {
    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
    }

    buffer.timeout = setTimeout(() => {
      flushBuffer(key, buffer);
    }, debounceMs);

    // Don't keep Node process alive for debounce timer
    if (buffer.timeout.unref) {
      buffer.timeout.unref();
    }
  }

  /**
   * Enqueue a message
   */
  async function enqueue(item) {
    const key = buildKey(item);
    const canDebounce = debounceMs > 0 && shouldDebounce(item);

    // If can't debounce or no key, flush immediately
    if (!canDebounce || !key) {
      if (key && buffers.has(key)) {
        await flushKey(key);
      }
      await onFlush([item]);
      return;
    }

    // Check max batch size
    const existing = buffers.get(key);
    if (existing && existing.items.length >= CONFIG.maxBatchSize) {
      await flushBuffer(key, existing);
    }

    // Add to existing buffer or create new
    if (existing) {
      existing.items.push(item);
      scheduleFlush(key, existing);
    } else {
      const buffer = { items: [item], timeout: null };
      buffers.set(key, buffer);
      scheduleFlush(key, buffer);
    }
  }

  /**
   * Flush all pending buffers
   */
  async function flushAll() {
    const promises = [];
    for (const [key, buffer] of buffers.entries()) {
      promises.push(flushBuffer(key, buffer));
    }
    await Promise.all(promises);
  }

  /**
   * Get pending count
   */
  function getPendingCount() {
    let count = 0;
    for (const buffer of buffers.values()) {
      count += buffer.items.length;
    }
    return count;
  }

  /**
   * Get status
   */
  function getStatus() {
    return {
      debounceMs,
      bufferedKeys: buffers.size,
      pendingMessages: getPendingCount(),
    };
  }

  return {
    enqueue,
    flushKey,
    flushAll,
    getStatus,
    getPendingCount,
  };
}

// =============================================================================
// MESSAGE BATCHING
// =============================================================================

/**
 * Combine batched messages into single request
 */
function combineBatchedMessages(messages) {
  if (messages.length === 0) return null;
  if (messages.length === 1) return messages[0];

  // Combine body/text
  const combinedBody = messages
    .map(m => m.body || m.text || m.message || '')
    .filter(Boolean)
    .join('\n');

  // Use first message as base, update body
  const base = { ...messages[0] };
  base.body = combinedBody;
  base.text = combinedBody;
  base.message = combinedBody;
  base.batchedCount = messages.length;
  base.batchedMessages = messages;

  return base;
}

/**
 * Get debounce ms for provider
 */
function getDebounceMs(provider) {
  if (!provider) return CONFIG.defaultDebounceMs;
  const normalized = provider.toLowerCase();
  return CONFIG.providerDebounce[normalized] ?? CONFIG.defaultDebounceMs;
}

// =============================================================================
// CONVENIENCE WRAPPER
// =============================================================================

/**
 * Create a debouncer for a message handler
 */
function createMessageDebouncer(handler, options = {}) {
  const debouncer = createInboundDebouncer({
    debounceMs: options.debounceMs ?? getDebounceMs(options.provider),
    buildKey: options.buildKey || (msg => msg.userId || msg.replyToken || msg.from),
    shouldDebounce: options.shouldDebounce,
    onFlush: async (messages) => {
      const combined = combineBatchedMessages(messages);
      if (combined) {
        await handler(combined);
      }
    },
    onError: options.onError,
  });

  return {
    /**
     * Handle incoming message (with debouncing)
     */
    handle: debouncer.enqueue,

    /**
     * Force flush pending messages
     */
    flush: debouncer.flushAll,

    /**
     * Get debouncer status
     */
    status: debouncer.getStatus,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Main debouncer
  createInboundDebouncer,
  createMessageDebouncer,

  // Utilities
  combineBatchedMessages,
  getDebounceMs,

  // Config
  CONFIG,
};

export default {
  createInboundDebouncer,
  createMessageDebouncer,
  combineBatchedMessages,
};
