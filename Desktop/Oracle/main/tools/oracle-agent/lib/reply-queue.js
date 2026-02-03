/**
 * Reply Queue - Serialized Reply Dispatcher จาก OpenClaw Pattern
 *
 * Features:
 * - Serialized queue (ordered delivery)
 * - Human delay between blocks
 * - Error handling per dispatch
 * - Idle callbacks
 * - Queued counts tracking
 *
 * @module reply-queue
 */

import { getHumanDelay } from './context-builder.js';

// ============================================================
// Reply Dispatch Kinds
// ============================================================

/**
 * Types of reply dispatches
 */
export const DISPATCH_KINDS = {
  TOOL: 'tool',     // Tool result
  BLOCK: 'block',   // Intermediate block reply
  FINAL: 'final',   // Final response
};

// ============================================================
// Reply Dispatcher
// ============================================================

/**
 * Create a serialized reply dispatcher
 *
 * Pattern: Queue dispatches in order, add human delay between blocks
 *
 * @param {object} options
 * @param {Function} options.deliver - Delivery function (payload, meta) => Promise
 * @param {Function} options.onError - Error handler (error, meta) => void
 * @param {Function} options.onIdle - Called when queue is empty
 * @param {object} options.humanDelay - { minMs, maxMs, enabled }
 * @returns {object} Dispatcher API
 */
export function createReplyDispatcher(options = {}) {
  const {
    deliver,
    onError = console.error,
    onIdle = () => {},
    humanDelay = { minMs: 800, maxMs: 2500, enabled: true },
  } = options;

  if (!deliver) {
    throw new Error('deliver function is required');
  }

  // State
  let sendChain = Promise.resolve();
  let pending = 0;
  let sentFirstBlock = false;
  const queuedCounts = {
    [DISPATCH_KINDS.TOOL]: 0,
    [DISPATCH_KINDS.BLOCK]: 0,
    [DISPATCH_KINDS.FINAL]: 0,
  };

  /**
   * Sleep for specified milliseconds
   * @param {number} ms
   * @returns {Promise<void>}
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Enqueue a dispatch
   * @param {string} kind - Dispatch kind
   * @param {*} payload - Payload to deliver
   * @returns {boolean} Whether enqueued successfully
   */
  function enqueue(kind, payload) {
    queuedCounts[kind] = (queuedCounts[kind] || 0) + 1;
    pending += 1;

    // Apply human delay only after first block
    const shouldDelay = kind === DISPATCH_KINDS.BLOCK && sentFirstBlock;
    if (kind === DISPATCH_KINDS.BLOCK) {
      sentFirstBlock = true;
    }

    sendChain = sendChain
      .then(async () => {
        // Human delay between blocks
        if (shouldDelay && humanDelay.enabled) {
          const delayMs = getHumanDelay(humanDelay);
          await sleep(delayMs);
        }

        // Deliver
        await deliver(payload, { kind });
      })
      .catch((error) => {
        onError(error, { kind, payload });
      })
      .finally(() => {
        pending -= 1;
        if (pending === 0) {
          onIdle();
        }
      });

    return true;
  }

  return {
    /**
     * Send tool result
     * @param {*} payload
     * @returns {boolean}
     */
    sendToolResult(payload) {
      return enqueue(DISPATCH_KINDS.TOOL, payload);
    },

    /**
     * Send block reply (intermediate)
     * @param {*} payload
     * @returns {boolean}
     */
    sendBlockReply(payload) {
      return enqueue(DISPATCH_KINDS.BLOCK, payload);
    },

    /**
     * Send final reply
     * @param {*} payload
     * @returns {boolean}
     */
    sendFinalReply(payload) {
      return enqueue(DISPATCH_KINDS.FINAL, payload);
    },

    /**
     * Wait for all pending dispatches to complete
     * @returns {Promise<void>}
     */
    waitForIdle() {
      return sendChain;
    },

    /**
     * Get queued counts by kind
     * @returns {object}
     */
    getQueuedCounts() {
      return { ...queuedCounts };
    },

    /**
     * Check if queue is idle
     * @returns {boolean}
     */
    isIdle() {
      return pending === 0;
    },

    /**
     * Get pending count
     * @returns {number}
     */
    getPendingCount() {
      return pending;
    },

    /**
     * Reset state (for reuse)
     */
    reset() {
      sentFirstBlock = false;
      queuedCounts[DISPATCH_KINDS.TOOL] = 0;
      queuedCounts[DISPATCH_KINDS.BLOCK] = 0;
      queuedCounts[DISPATCH_KINDS.FINAL] = 0;
    },
  };
}

// ============================================================
// Dispatcher with Typing Indicator
// ============================================================

/**
 * Create dispatcher with typing indicator support
 *
 * @param {object} options
 * @param {Function} options.deliver - Delivery function
 * @param {Function} options.startTyping - Start typing indicator
 * @param {Function} options.stopTyping - Stop typing indicator
 * @param {object} options.humanDelay - Human delay config
 * @returns {object} { dispatcher, replyOptions, markDispatchIdle }
 */
export function createDispatcherWithTyping(options = {}) {
  const {
    deliver,
    startTyping = () => {},
    stopTyping = () => {},
    humanDelay,
    onError,
  } = options;

  let isTyping = false;
  let typingTimeout = null;

  // Start typing when queue has work
  function maybeStartTyping() {
    if (!isTyping) {
      isTyping = true;
      startTyping();
    }
    // Reset typing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    // Auto-stop after 30s (LINE typing indicator limit)
    typingTimeout = setTimeout(() => {
      maybeStopTyping();
    }, 30000);
  }

  function maybeStopTyping() {
    if (isTyping) {
      isTyping = false;
      stopTyping();
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
  }

  const dispatcher = createReplyDispatcher({
    deliver: async (payload, meta) => {
      maybeStartTyping();
      await deliver(payload, meta);
    },
    onError,
    onIdle: maybeStopTyping,
    humanDelay,
  });

  return {
    dispatcher,
    replyOptions: {
      onBlockReply: (payload) => dispatcher.sendBlockReply(payload),
      onToolResult: (payload) => dispatcher.sendToolResult(payload),
    },
    markDispatchIdle: maybeStopTyping,
  };
}

// ============================================================
// Chunked Delivery
// ============================================================

/**
 * Deliver message chunks with retry
 *
 * @param {object} options
 * @param {string[]} options.chunks - Text chunks to deliver
 * @param {Function} options.sendFn - Send function (text) => Promise
 * @param {number} options.maxRetries - Max retry attempts
 * @param {number} options.baseDelayMs - Base delay for backoff
 * @param {Function} options.onChunkSent - Callback after each chunk
 * @returns {Promise<object>} Result
 */
export async function deliverChunks(options = {}) {
  const {
    chunks = [],
    sendFn,
    maxRetries = 3,
    baseDelayMs = 500,
    onChunkSent = () => {},
  } = options;

  if (!sendFn) {
    throw new Error('sendFn is required');
  }

  const results = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await sendFn(chunk, { index: i, total: chunks.length });
        results.sent++;
        onChunkSent({ chunk, index: i, total: chunks.length });
        break;
      } catch (error) {
        lastError = error;
        const errorText = error.message || String(error);

        // Check if should retry (transient errors)
        const shouldRetry = /closed|reset|timed\s*out|disconnect|rate.?limit/i.test(errorText);
        const isLast = attempt >= maxRetries;

        if (!shouldRetry || isLast) {
          results.failed++;
          results.errors.push({ chunk: i, error: errorText });
          break;
        }

        // Exponential backoff
        const delayMs = baseDelayMs * attempt;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  return results;
}

// ============================================================
// Exports
// ============================================================

export default {
  DISPATCH_KINDS,
  createReplyDispatcher,
  createDispatcherWithTyping,
  deliverChunks,
};
