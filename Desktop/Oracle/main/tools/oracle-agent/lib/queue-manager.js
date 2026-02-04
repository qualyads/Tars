/**
 * Queue Manager
 * Handle concurrent messages intelligently
 *
 * Features:
 * - Message batching (collect multiple messages into one)
 * - Steer mode (latest message guides the response)
 * - Concurrency lanes (separate queues for different purposes)
 * - Priority queues
 * - Debouncing and throttling
 */

import { EventEmitter } from 'events';

/**
 * Queue modes
 */
const MODES = {
  COLLECT: 'collect',     // Combine messages into single request
  STEER: 'steer',         // Latest message guides response
  FOLLOWUP: 'followup',   // Process as follow-up to current
  INTERRUPT: 'interrupt', // Stop current, handle new
  FIFO: 'fifo'           // First in, first out (default)
};

/**
 * Priority levels
 */
const PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4
};

/**
 * Default lane configurations
 */
const DEFAULT_LANES = {
  main: {
    concurrency: 1,
    mode: MODES.STEER,
    collectWindow: 3000,  // 3 seconds
    maxBatchSize: 10
  },
  subagent: {
    concurrency: 8,
    mode: MODES.FIFO,
    collectWindow: 0,
    maxBatchSize: 1
  },
  webhook: {
    concurrency: 4,
    mode: MODES.FIFO,
    collectWindow: 0,
    maxBatchSize: 1
  },
  broadcast: {
    concurrency: 4,
    mode: MODES.FIFO,
    collectWindow: 0,
    maxBatchSize: 1
  }
};

class QueueManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      defaultLane: 'main',
      lanes: { ...DEFAULT_LANES, ...(config.lanes || {}) },
      ...config
    };

    // Queues per lane
    this.queues = new Map();

    // Active processing per lane
    this.active = new Map();

    // Collect buffers per session
    this.collectBuffers = new Map();

    // Collect timers
    this.collectTimers = new Map();

    // Stats
    this.stats = {
      received: 0,
      processed: 0,
      batched: 0,
      dropped: 0,
      byLane: {}
    };

    // Initialize lanes
    for (const laneName of Object.keys(this.config.lanes)) {
      this.queues.set(laneName, []);
      this.active.set(laneName, 0);
      this.stats.byLane[laneName] = { received: 0, processed: 0, batched: 0 };
    }
  }

  /**
   * Enqueue a message
   * @param {object} message - Message to queue
   * @param {object} options - Queue options
   * @returns {Promise<object>} Queue result
   */
  async enqueue(message, options = {}) {
    const {
      lane = this.config.defaultLane,
      sessionId = 'default',
      priority = PRIORITY.NORMAL,
      processor
    } = options;

    const laneConfig = this.config.lanes[lane];
    if (!laneConfig) {
      throw new Error(`Unknown lane: ${lane}`);
    }

    this.stats.received++;
    this.stats.byLane[lane].received++;

    const queueItem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      sessionId,
      priority,
      lane,
      processor,
      enqueuedAt: Date.now(),
      status: 'queued'
    };

    // Handle based on mode
    switch (laneConfig.mode) {
      case MODES.COLLECT:
      case MODES.STEER:
        return this._handleCollectMode(queueItem, laneConfig);

      case MODES.INTERRUPT:
        return this._handleInterruptMode(queueItem, laneConfig);

      case MODES.FIFO:
      default:
        return this._handleFIFOMode(queueItem, laneConfig);
    }
  }

  /**
   * Handle collect/steer mode - batch messages together
   */
  async _handleCollectMode(item, laneConfig) {
    const bufferKey = `${item.lane}:${item.sessionId}`;

    // Get or create buffer
    if (!this.collectBuffers.has(bufferKey)) {
      this.collectBuffers.set(bufferKey, []);
    }

    const buffer = this.collectBuffers.get(bufferKey);
    buffer.push(item);

    // Clear existing timer
    if (this.collectTimers.has(bufferKey)) {
      clearTimeout(this.collectTimers.get(bufferKey));
    }

    // Check if buffer is full
    if (buffer.length >= laneConfig.maxBatchSize) {
      return this._flushBuffer(bufferKey, laneConfig);
    }

    // Set timer to flush
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._flushBuffer(bufferKey, laneConfig).then(resolve);
      }, laneConfig.collectWindow);

      this.collectTimers.set(bufferKey, timer);
    });
  }

  /**
   * Flush collected messages buffer
   */
  async _flushBuffer(bufferKey, laneConfig) {
    const buffer = this.collectBuffers.get(bufferKey);
    if (!buffer || buffer.length === 0) {
      return { status: 'empty' };
    }

    // Clear buffer and timer
    this.collectBuffers.set(bufferKey, []);
    if (this.collectTimers.has(bufferKey)) {
      clearTimeout(this.collectTimers.get(bufferKey));
      this.collectTimers.delete(bufferKey);
    }

    const [lane, sessionId] = bufferKey.split(':');

    // Create batched item
    let batchedItem;

    if (laneConfig.mode === MODES.STEER) {
      // Steer mode: use latest message but include context
      const latest = buffer[buffer.length - 1];
      const previousMessages = buffer.slice(0, -1).map(b => b.message);

      batchedItem = {
        ...latest,
        id: `batch_${Date.now()}`,
        message: {
          current: latest.message,
          previous: previousMessages,
          count: buffer.length,
          mode: 'steer'
        },
        batchedFrom: buffer.map(b => b.id),
        isBatched: true
      };
    } else {
      // Collect mode: combine all messages
      batchedItem = {
        id: `batch_${Date.now()}`,
        lane,
        sessionId,
        message: {
          messages: buffer.map(b => b.message),
          count: buffer.length,
          mode: 'collect'
        },
        batchedFrom: buffer.map(b => b.id),
        isBatched: true,
        priority: Math.min(...buffer.map(b => b.priority)),
        processor: buffer[0].processor,
        enqueuedAt: buffer[0].enqueuedAt
      };
    }

    this.stats.batched += buffer.length - 1;
    this.stats.byLane[lane].batched += buffer.length - 1;

    // Add to queue
    const queue = this.queues.get(lane);
    queue.push(batchedItem);
    queue.sort((a, b) => a.priority - b.priority);

    // Process queue
    return this._processQueue(lane);
  }

  /**
   * Handle interrupt mode - stop current and handle new
   */
  async _handleInterruptMode(item, laneConfig) {
    // TODO: Implement interrupt signal to current processor
    // For now, just add to front of queue with high priority
    item.priority = PRIORITY.CRITICAL;

    const queue = this.queues.get(item.lane);
    queue.unshift(item);

    this.emit('interrupt', { item });

    return this._processQueue(item.lane);
  }

  /**
   * Handle FIFO mode - simple queue
   */
  async _handleFIFOMode(item, laneConfig) {
    const queue = this.queues.get(item.lane);
    queue.push(item);
    queue.sort((a, b) => a.priority - b.priority);

    return this._processQueue(item.lane);
  }

  /**
   * Process queue for a lane
   */
  async _processQueue(lane) {
    const laneConfig = this.config.lanes[lane];
    const queue = this.queues.get(lane);
    const activeCount = this.active.get(lane);

    // Check if we can process more
    if (activeCount >= laneConfig.concurrency) {
      return { status: 'queued', position: queue.length };
    }

    // Get next item
    const item = queue.shift();
    if (!item) {
      return { status: 'empty' };
    }

    // Mark as active
    this.active.set(lane, activeCount + 1);
    item.status = 'processing';
    item.startedAt = Date.now();

    this.emit('processing', { item });

    try {
      // Process the item
      let result;

      if (item.processor) {
        result = await item.processor(item.message, item);
      } else {
        // Emit for external processing
        result = await new Promise((resolve) => {
          this.emit('process', {
            item,
            resolve: (res) => resolve(res)
          });

          // Timeout after 5 minutes
          setTimeout(() => resolve({ timeout: true }), 300000);
        });
      }

      item.status = 'completed';
      item.completedAt = Date.now();
      item.result = result;

      this.stats.processed++;
      this.stats.byLane[lane].processed++;

      this.emit('completed', { item, result });

      return {
        status: 'completed',
        id: item.id,
        result,
        processingTime: item.completedAt - item.startedAt,
        wasBatched: item.isBatched,
        batchSize: item.batchedFrom?.length || 1
      };

    } catch (error) {
      item.status = 'error';
      item.error = error.message;

      this.emit('error', { item, error });

      return {
        status: 'error',
        id: item.id,
        error: error.message
      };

    } finally {
      // Mark as inactive
      this.active.set(lane, this.active.get(lane) - 1);

      // Process next in queue
      setImmediate(() => this._processQueue(lane));
    }
  }

  /**
   * Format batched message for AI
   * Converts batched messages into a single coherent prompt
   */
  formatBatchedMessage(batchedMessage) {
    if (!batchedMessage.mode) {
      return batchedMessage;
    }

    if (batchedMessage.mode === 'steer') {
      // Steer mode: focus on latest, provide context
      let formatted = '';

      if (batchedMessage.previous && batchedMessage.previous.length > 0) {
        formatted += `[User sent ${batchedMessage.count} messages. Previous messages for context:]\n`;
        batchedMessage.previous.forEach((msg, i) => {
          formatted += `${i + 1}. ${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`;
        });
        formatted += '\n[Latest message - respond to this:]\n';
      }

      formatted += typeof batchedMessage.current === 'string'
        ? batchedMessage.current
        : JSON.stringify(batchedMessage.current);

      return formatted;
    }

    if (batchedMessage.mode === 'collect') {
      // Collect mode: combine all messages
      let formatted = `[User sent ${batchedMessage.count} messages:]\n\n`;

      batchedMessage.messages.forEach((msg, i) => {
        formatted += `${i + 1}. ${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`;
      });

      formatted += '\n[Please respond to all points in a single comprehensive response.]';

      return formatted;
    }

    return batchedMessage;
  }

  /**
   * Get queue status for a lane
   */
  getLaneStatus(lane) {
    const laneConfig = this.config.lanes[lane];
    const queue = this.queues.get(lane);
    const activeCount = this.active.get(lane);

    return {
      lane,
      config: laneConfig,
      queueLength: queue?.length || 0,
      activeCount,
      availableSlots: laneConfig.concurrency - activeCount,
      stats: this.stats.byLane[lane]
    };
  }

  /**
   * Get overall status
   */
  getStatus() {
    const lanes = {};

    for (const laneName of Object.keys(this.config.lanes)) {
      lanes[laneName] = this.getLaneStatus(laneName);
    }

    return {
      lanes,
      stats: this.stats,
      modes: MODES,
      priorities: PRIORITY
    };
  }

  /**
   * Clear a lane's queue
   */
  clearLane(lane) {
    const queue = this.queues.get(lane);
    if (!queue) return 0;

    const cleared = queue.length;
    queue.length = 0;

    // Clear collect buffers for this lane
    for (const [key, buffer] of this.collectBuffers) {
      if (key.startsWith(`${lane}:`)) {
        this.stats.dropped += buffer.length;
        this.collectBuffers.delete(key);

        if (this.collectTimers.has(key)) {
          clearTimeout(this.collectTimers.get(key));
          this.collectTimers.delete(key);
        }
      }
    }

    return cleared;
  }

  /**
   * Clear all queues
   */
  clearAll() {
    let total = 0;

    for (const laneName of Object.keys(this.config.lanes)) {
      total += this.clearLane(laneName);
    }

    return total;
  }

  /**
   * Update lane configuration
   */
  updateLaneConfig(lane, config) {
    if (!this.config.lanes[lane]) {
      // Create new lane
      this.queues.set(lane, []);
      this.active.set(lane, 0);
      this.stats.byLane[lane] = { received: 0, processed: 0, batched: 0 };
    }

    this.config.lanes[lane] = { ...this.config.lanes[lane], ...config };
    return this.config.lanes[lane];
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      received: 0,
      processed: 0,
      batched: 0,
      dropped: 0,
      byLane: {}
    };

    for (const laneName of Object.keys(this.config.lanes)) {
      this.stats.byLane[laneName] = { received: 0, processed: 0, batched: 0 };
    }
  }
}

// Singleton instance
const queueManager = new QueueManager();

export default queueManager;
export { QueueManager, MODES, PRIORITY, DEFAULT_LANES };
