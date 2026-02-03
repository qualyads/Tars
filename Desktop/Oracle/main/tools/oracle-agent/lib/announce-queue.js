/**
 * Announce Queue - Notification Queue Management จาก OpenClaw Pattern
 *
 * Features:
 * - Drop policies: "summarize" / "old" / "new"
 * - Debouncing with configurable window
 * - Cap management (max queue size)
 * - Priority levels
 * - Batch processing
 *
 * ใช้สำหรับ:
 * - LINE notification queue
 * - Alert aggregation
 * - Message batching
 *
 * @module announce-queue
 */

// ============================================================
// Constants
// ============================================================

/**
 * Drop policies when queue is full
 */
export const DROP_POLICY = {
  /** Summarize similar items into one */
  SUMMARIZE: 'summarize',
  /** Drop oldest items first */
  OLD: 'old',
  /** Drop newest items (reject new) */
  NEW: 'new',
};

/**
 * Priority levels
 */
export const PRIORITY = {
  CRITICAL: 0,   // ไม่ drop
  HIGH: 1,       // drop last
  NORMAL: 2,     // default
  LOW: 3,        // drop first
};

/**
 * Default queue options
 */
export const DEFAULT_QUEUE_OPTIONS = {
  maxSize: 100,
  dropPolicy: DROP_POLICY.OLD,
  debounceMs: 1000,
  batchSize: 10,
  groupBy: null,  // function to group similar items
};

// ============================================================
// Announce Item
// ============================================================

/**
 * @typedef {object} AnnounceItem
 * @property {string} id - Unique item ID
 * @property {string} type - Item type for grouping
 * @property {*} payload - The actual data
 * @property {number} priority - Priority level (lower = higher priority)
 * @property {number} createdAt - Creation timestamp
 * @property {number} count - Merge count (for summarization)
 * @property {object} meta - Additional metadata
 */

/**
 * Create an announce item
 * @param {object} data - Item data
 * @returns {AnnounceItem}
 */
export function createAnnounceItem(data) {
  return {
    id: data.id || generateId(),
    type: data.type || 'default',
    payload: data.payload,
    priority: data.priority ?? PRIORITY.NORMAL,
    createdAt: Date.now(),
    count: 1,
    meta: data.meta || {},
  };
}

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Announce Queue
// ============================================================

/**
 * Create an announce queue
 * @param {object} options - Queue options
 * @returns {object} Queue API
 */
export function createAnnounceQueue(options = {}) {
  const config = { ...DEFAULT_QUEUE_OPTIONS, ...options };
  const { maxSize, dropPolicy, debounceMs, batchSize, groupBy } = config;

  /** @type {AnnounceItem[]} */
  let queue = [];

  /** @type {Map<string, number>} Debounce timers by type */
  const debounceTimers = new Map();

  /** @type {Set<Function>} Listeners */
  const listeners = new Set();

  /** @type {object} Statistics */
  const stats = {
    enqueued: 0,
    dropped: 0,
    merged: 0,
    delivered: 0,
    lastProcessed: null,
  };

  // --------------------------------------------------------
  // Core Operations
  // --------------------------------------------------------

  /**
   * Add item to queue
   * @param {object} data - Item data
   * @param {boolean} immediate - Skip debounce
   * @returns {AnnounceItem|null} Added item or null if dropped
   */
  function enqueue(data, immediate = false) {
    const item = createAnnounceItem(data);
    stats.enqueued++;

    // Try to merge with existing item of same type
    if (dropPolicy === DROP_POLICY.SUMMARIZE && groupBy) {
      const groupKey = groupBy(item);
      const existing = queue.find((q) => groupBy(q) === groupKey);

      if (existing) {
        // Merge into existing
        existing.count++;
        existing.payload = mergePayloads(existing.payload, item.payload);
        existing.meta.lastMerged = Date.now();
        stats.merged++;
        notifyListeners('merged', { existing, new: item });
        return existing;
      }
    }

    // Check queue capacity
    if (queue.length >= maxSize) {
      const dropped = applyDropPolicy(item);
      if (dropped === item) {
        stats.dropped++;
        notifyListeners('dropped', { item, reason: 'queue_full' });
        return null;
      }
    }

    // Insert by priority (lower priority value = higher priority)
    const insertIndex = queue.findIndex((q) => q.priority > item.priority);
    if (insertIndex === -1) {
      queue.push(item);
    } else {
      queue.splice(insertIndex, 0, item);
    }

    // Schedule processing
    if (immediate || debounceMs <= 0) {
      scheduleProcessing(item.type, 0);
    } else {
      scheduleProcessing(item.type, debounceMs);
    }

    notifyListeners('enqueued', { item });
    return item;
  }

  /**
   * Apply drop policy when queue is full
   * @param {AnnounceItem} newItem - New item to potentially add
   * @returns {AnnounceItem} The item that was dropped
   */
  function applyDropPolicy(newItem) {
    switch (dropPolicy) {
      case DROP_POLICY.NEW:
        // Don't add new item
        return newItem;

      case DROP_POLICY.OLD:
        // Drop lowest priority oldest item
        const oldestLowPriority = [...queue]
          .filter((q) => q.priority >= PRIORITY.NORMAL)
          .sort((a, b) => a.createdAt - b.createdAt)[0];

        if (oldestLowPriority) {
          queue = queue.filter((q) => q !== oldestLowPriority);
          stats.dropped++;
          notifyListeners('dropped', { item: oldestLowPriority, reason: 'policy_old' });
          return oldestLowPriority;
        }
        return newItem;

      case DROP_POLICY.SUMMARIZE:
        // Summarize similar items
        summarizeQueue();
        if (queue.length >= maxSize) {
          // Still full, drop oldest
          return applyDropPolicy(newItem);
        }
        return null;

      default:
        return newItem;
    }
  }

  /**
   * Summarize similar items in queue
   */
  function summarizeQueue() {
    if (!groupBy) return;

    const groups = new Map();

    for (const item of queue) {
      const key = groupBy(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }

    // Merge groups with more than one item
    for (const [key, items] of groups) {
      if (items.length > 1) {
        // Keep first item, merge others into it
        const merged = items[0];
        for (let i = 1; i < items.length; i++) {
          merged.count += items[i].count;
          merged.payload = mergePayloads(merged.payload, items[i].payload);
          queue = queue.filter((q) => q !== items[i]);
          stats.merged++;
        }
        merged.meta.summarized = true;
        notifyListeners('summarized', { item: merged, count: items.length });
      }
    }
  }

  /**
   * Merge two payloads
   * @param {*} existing - Existing payload
   * @param {*} newPayload - New payload
   * @returns {*} Merged payload
   */
  function mergePayloads(existing, newPayload) {
    // Array: concat
    if (Array.isArray(existing) && Array.isArray(newPayload)) {
      return [...existing, ...newPayload];
    }

    // Object: spread
    if (typeof existing === 'object' && typeof newPayload === 'object') {
      return { ...existing, ...newPayload };
    }

    // String: append
    if (typeof existing === 'string' && typeof newPayload === 'string') {
      return `${existing}\n${newPayload}`;
    }

    // Default: keep existing
    return existing;
  }

  // --------------------------------------------------------
  // Processing
  // --------------------------------------------------------

  /**
   * Schedule queue processing with debounce
   * @param {string} type - Item type
   * @param {number} delay - Delay in ms
   */
  function scheduleProcessing(type, delay) {
    const existingTimer = debounceTimers.get(type);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      debounceTimers.delete(type);
      notifyListeners('ready', { type });
    }, delay);

    debounceTimers.set(type, timer);
  }

  /**
   * Dequeue items for processing
   * @param {object} filter - Optional filter { type, priority, limit }
   * @returns {AnnounceItem[]} Items to process
   */
  function dequeue(filter = {}) {
    const { type, priority, limit = batchSize } = filter;

    let items = queue;

    // Filter by type
    if (type) {
      items = items.filter((q) => q.type === type);
    }

    // Filter by priority
    if (priority !== undefined) {
      items = items.filter((q) => q.priority <= priority);
    }

    // Limit
    items = items.slice(0, limit);

    // Remove from queue
    queue = queue.filter((q) => !items.includes(q));

    stats.delivered += items.length;
    stats.lastProcessed = Date.now();

    return items;
  }

  /**
   * Peek at queue without removing
   * @param {number} limit - Max items to return
   * @returns {AnnounceItem[]}
   */
  function peek(limit = batchSize) {
    return queue.slice(0, limit);
  }

  /**
   * Get all items of a specific type
   * @param {string} type - Item type
   * @returns {AnnounceItem[]}
   */
  function getByType(type) {
    return queue.filter((q) => q.type === type);
  }

  // --------------------------------------------------------
  // Queue Management
  // --------------------------------------------------------

  /**
   * Clear all items
   * @param {string} type - Optional: clear only specific type
   */
  function clear(type) {
    if (type) {
      const removed = queue.filter((q) => q.type === type).length;
      queue = queue.filter((q) => q.type !== type);
      stats.dropped += removed;
    } else {
      stats.dropped += queue.length;
      queue = [];
    }
  }

  /**
   * Remove specific item by ID
   * @param {string} id - Item ID
   * @returns {boolean} True if removed
   */
  function remove(id) {
    const index = queue.findIndex((q) => q.id === id);
    if (index !== -1) {
      queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get queue size
   * @param {string} type - Optional: count only specific type
   * @returns {number}
   */
  function size(type) {
    if (type) {
      return queue.filter((q) => q.type === type).length;
    }
    return queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  function isEmpty() {
    return queue.length === 0;
  }

  /**
   * Check if queue is full
   * @returns {boolean}
   */
  function isFull() {
    return queue.length >= maxSize;
  }

  // --------------------------------------------------------
  // Listeners
  // --------------------------------------------------------

  /**
   * Subscribe to queue events
   * @param {Function} listener - Callback (event, data)
   * @returns {Function} Unsubscribe function
   */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Notify all listeners
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  function notifyListeners(event, data) {
    for (const listener of listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('[ANNOUNCE] Listener error:', err);
      }
    }
  }

  // --------------------------------------------------------
  // Stats & Debug
  // --------------------------------------------------------

  /**
   * Get queue statistics
   * @returns {object}
   */
  function getStats() {
    return {
      ...stats,
      currentSize: queue.length,
      maxSize,
      utilization: queue.length / maxSize,
      byType: getTypeStats(),
    };
  }

  /**
   * Get stats by type
   * @returns {object}
   */
  function getTypeStats() {
    const byType = {};
    for (const item of queue) {
      if (!byType[item.type]) {
        byType[item.type] = { count: 0, merged: 0 };
      }
      byType[item.type].count++;
      byType[item.type].merged += item.count - 1;
    }
    return byType;
  }

  /**
   * Destroy queue and clear timers
   */
  function destroy() {
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();
    listeners.clear();
    queue = [];
  }

  // --------------------------------------------------------
  // Return API
  // --------------------------------------------------------

  return {
    // Core
    enqueue,
    dequeue,
    peek,
    getByType,

    // Management
    clear,
    remove,
    size,
    isEmpty,
    isFull,

    // Events
    subscribe,

    // Stats
    getStats,
    destroy,

    // Config access
    config,
  };
}

// ============================================================
// Specialized Queues
// ============================================================

/**
 * Create notification queue optimized for LINE
 * @param {object} options - Options
 * @returns {object} Queue API
 */
export function createNotificationQueue(options = {}) {
  return createAnnounceQueue({
    maxSize: 50,
    dropPolicy: DROP_POLICY.SUMMARIZE,
    debounceMs: 2000,
    batchSize: 5,
    groupBy: (item) => `${item.type}:${item.payload?.userId || 'broadcast'}`,
    ...options,
  });
}

/**
 * Create alert queue optimized for critical alerts
 * @param {object} options - Options
 * @returns {object} Queue API
 */
export function createAlertQueue(options = {}) {
  return createAnnounceQueue({
    maxSize: 200,
    dropPolicy: DROP_POLICY.OLD,
    debounceMs: 500,
    batchSize: 20,
    groupBy: (item) => item.payload?.alertType || item.type,
    ...options,
  });
}

/**
 * Create batch queue for bulk operations
 * @param {object} options - Options
 * @returns {object} Queue API
 */
export function createBatchQueue(options = {}) {
  return createAnnounceQueue({
    maxSize: 1000,
    dropPolicy: DROP_POLICY.NEW,
    debounceMs: 5000,
    batchSize: 100,
    ...options,
  });
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Create summary text from merged items
 * @param {AnnounceItem} item - Merged item
 * @returns {string}
 */
export function createSummaryText(item) {
  if (item.count === 1) {
    return String(item.payload);
  }

  const base = typeof item.payload === 'string'
    ? item.payload.split('\n')[0]
    : JSON.stringify(item.payload).slice(0, 50);

  return `${base} (+${item.count - 1} more)`;
}

/**
 * Format items for LINE message
 * @param {AnnounceItem[]} items - Items to format
 * @returns {string}
 */
export function formatForLine(items) {
  return items
    .map((item) => createSummaryText(item))
    .join('\n\n');
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  DROP_POLICY,
  PRIORITY,
  DEFAULT_QUEUE_OPTIONS,

  // Core
  createAnnounceItem,
  createAnnounceQueue,

  // Specialized
  createNotificationQueue,
  createAlertQueue,
  createBatchQueue,

  // Utilities
  createSummaryText,
  formatForLine,
};
