/**
 * Channel Manager - Channel Lifecycle Management จาก OpenClaw Pattern
 *
 * Features:
 * - Channel start/stop per account
 * - Runtime status tracking
 * - Abort signal management
 * - Multi-channel support
 *
 * @module channel-manager
 */

// ============================================================
// Channel States
// ============================================================

/**
 * Channel connection states
 */
export const CHANNEL_STATES = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  ERROR: 'error',
  LOGGED_OUT: 'logged_out',
};

// ============================================================
// Channel Manager
// ============================================================

/**
 * Create channel manager
 * @param {object} options
 * @returns {object} Manager API
 */
export function createChannelManager(options = {}) {
  const { onChannelStart, onChannelStop, onError } = options;

  // State: channel → accountId → status
  const channels = new Map();

  // Abort controllers per channel/account
  const abortControllers = new Map();

  // Running tasks to prevent duplicate starts
  const pendingTasks = new Map();

  /**
   * Get channel key
   * @param {string} channel
   * @param {string} accountId
   * @returns {string}
   */
  function getKey(channel, accountId = 'default') {
    return `${channel}:${accountId}`;
  }

  /**
   * Get or create channel account state
   * @param {string} channel
   * @param {string} accountId
   * @returns {object}
   */
  function getAccountState(channel, accountId = 'default') {
    const key = getKey(channel, accountId);

    if (!channels.has(key)) {
      channels.set(key, {
        channel,
        accountId,
        state: CHANNEL_STATES.STOPPED,
        error: null,
        startedAt: null,
        stoppedAt: null,
        lastHeartbeat: null,
        metadata: {},
      });
    }

    return channels.get(key);
  }

  /**
   * Update channel state
   * @param {string} channel
   * @param {string} accountId
   * @param {object} updates
   */
  function updateState(channel, accountId, updates) {
    const state = getAccountState(channel, accountId);
    Object.assign(state, updates);
    return state;
  }

  /**
   * Start channel
   * @param {string} channel
   * @param {string} accountId
   * @param {object} options
   * @returns {Promise<boolean>}
   */
  async function startChannel(channel, accountId = 'default', options = {}) {
    const key = getKey(channel, accountId);
    const state = getAccountState(channel, accountId);

    // Check if already running or starting
    if (state.state === CHANNEL_STATES.RUNNING) {
      return true;
    }

    if (state.state === CHANNEL_STATES.STARTING) {
      // Wait for pending task
      const pending = pendingTasks.get(key);
      if (pending) {
        return pending;
      }
      return false;
    }

    // Create abort controller
    const abortController = new AbortController();
    abortControllers.set(key, abortController);

    // Update state
    updateState(channel, accountId, {
      state: CHANNEL_STATES.STARTING,
      error: null,
    });

    // Start task
    const task = (async () => {
      try {
        if (onChannelStart) {
          await onChannelStart({
            channel,
            accountId,
            abortSignal: abortController.signal,
            ...options,
          });
        }

        updateState(channel, accountId, {
          state: CHANNEL_STATES.RUNNING,
          startedAt: Date.now(),
          error: null,
        });

        return true;
      } catch (error) {
        updateState(channel, accountId, {
          state: CHANNEL_STATES.ERROR,
          error: error.message,
        });

        if (onError) {
          onError({ channel, accountId, error });
        }

        return false;
      } finally {
        pendingTasks.delete(key);
      }
    })();

    pendingTasks.set(key, task);
    return task;
  }

  /**
   * Stop channel
   * @param {string} channel
   * @param {string} accountId
   * @returns {Promise<boolean>}
   */
  async function stopChannel(channel, accountId = 'default') {
    const key = getKey(channel, accountId);
    const state = getAccountState(channel, accountId);

    // Check if already stopped
    if (state.state === CHANNEL_STATES.STOPPED) {
      return true;
    }

    // Abort any running operations
    const abortController = abortControllers.get(key);
    if (abortController) {
      abortController.abort();
      abortControllers.delete(key);
    }

    // Wait for pending task if any
    const pending = pendingTasks.get(key);
    if (pending) {
      try {
        await pending;
      } catch {
        // Ignore - task may have failed
      }
    }

    // Update state
    updateState(channel, accountId, {
      state: CHANNEL_STATES.STOPPING,
    });

    try {
      if (onChannelStop) {
        await onChannelStop({ channel, accountId });
      }

      updateState(channel, accountId, {
        state: CHANNEL_STATES.STOPPED,
        stoppedAt: Date.now(),
      });

      return true;
    } catch (error) {
      updateState(channel, accountId, {
        state: CHANNEL_STATES.ERROR,
        error: error.message,
      });

      if (onError) {
        onError({ channel, accountId, error });
      }

      return false;
    }
  }

  /**
   * Mark channel as logged out
   * @param {string} channel
   * @param {string} accountId
   */
  function markLoggedOut(channel, accountId = 'default') {
    updateState(channel, accountId, {
      state: CHANNEL_STATES.LOGGED_OUT,
      stoppedAt: Date.now(),
    });

    // Cleanup abort controller
    const key = getKey(channel, accountId);
    abortControllers.delete(key);
  }

  /**
   * Update heartbeat
   * @param {string} channel
   * @param {string} accountId
   */
  function heartbeat(channel, accountId = 'default') {
    updateState(channel, accountId, {
      lastHeartbeat: Date.now(),
    });
  }

  /**
   * Get runtime snapshot
   * @returns {object}
   */
  function getRuntimeSnapshot() {
    const snapshot = {};

    for (const [key, state] of channels) {
      const [channel, accountId] = key.split(':');

      if (!snapshot[channel]) {
        snapshot[channel] = {};
      }

      snapshot[channel][accountId] = {
        state: state.state,
        running: state.state === CHANNEL_STATES.RUNNING,
        connected: state.state === CHANNEL_STATES.RUNNING,
        error: state.error,
        startedAt: state.startedAt,
        stoppedAt: state.stoppedAt,
        lastHeartbeat: state.lastHeartbeat,
      };
    }

    return snapshot;
  }

  /**
   * Get channel status
   * @param {string} channel
   * @param {string} accountId
   * @returns {object}
   */
  function getChannelStatus(channel, accountId = 'default') {
    return getAccountState(channel, accountId);
  }

  /**
   * Get all running channels
   * @returns {Array}
   */
  function getRunningChannels() {
    const running = [];

    for (const [, state] of channels) {
      if (state.state === CHANNEL_STATES.RUNNING) {
        running.push({
          channel: state.channel,
          accountId: state.accountId,
          startedAt: state.startedAt,
        });
      }
    }

    return running;
  }

  /**
   * Stop all channels
   * @returns {Promise<void>}
   */
  async function stopAll() {
    const promises = [];

    for (const [, state] of channels) {
      if (state.state !== CHANNEL_STATES.STOPPED) {
        promises.push(stopChannel(state.channel, state.accountId));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Restart channel
   * @param {string} channel
   * @param {string} accountId
   * @returns {Promise<boolean>}
   */
  async function restartChannel(channel, accountId = 'default') {
    await stopChannel(channel, accountId);
    return startChannel(channel, accountId);
  }

  return {
    startChannel,
    stopChannel,
    markLoggedOut,
    heartbeat,
    getRuntimeSnapshot,
    getChannelStatus,
    getRunningChannels,
    stopAll,
    restartChannel,
    STATES: CHANNEL_STATES,
  };
}

// ============================================================
// Batch Delivery
// ============================================================

/**
 * Deliver messages in batch (sequential)
 * @param {object} options
 * @returns {Promise<object[]>}
 */
export async function deliverBatch(options = {}) {
  const {
    payloads = [],
    sendFn,
    bestEffort = false,
    onSuccess,
    onError,
    abortSignal,
  } = options;

  const results = [];

  for (let i = 0; i < payloads.length; i++) {
    // Check abort
    if (abortSignal?.aborted) {
      results.push({
        index: i,
        success: false,
        error: 'Aborted',
        payload: payloads[i],
      });
      continue;
    }

    try {
      const result = await sendFn(payloads[i], { index: i });

      results.push({
        index: i,
        success: true,
        result,
        payload: payloads[i],
      });

      if (onSuccess) {
        onSuccess(payloads[i], result, i);
      }
    } catch (error) {
      const errorResult = {
        index: i,
        success: false,
        error: error.message,
        payload: payloads[i],
      };

      results.push(errorResult);

      if (onError) {
        onError(error, payloads[i], i);
      }

      if (!bestEffort) {
        // Stop on first error
        break;
      }
    }
  }

  return results;
}

// ============================================================
// Broadcast with Backpressure
// ============================================================

/**
 * Create broadcaster for WebSocket clients
 * @param {object} options
 * @returns {object} Broadcaster API
 */
export function createBroadcaster(options = {}) {
  const {
    maxBufferedBytes = 1024 * 1024, // 1MB
    dropSlowClients = true,
  } = options;

  const clients = new Set();
  let eventSeq = 0;

  /**
   * Add client
   * @param {object} client - { socket, scopes }
   */
  function addClient(client) {
    clients.add(client);
  }

  /**
   * Remove client
   * @param {object} client
   */
  function removeClient(client) {
    clients.delete(client);
  }

  /**
   * Check if client has scope
   * @param {object} client
   * @param {string} event
   * @returns {boolean}
   */
  function hasScope(client, event) {
    if (!client.scopes || client.scopes.length === 0) {
      return true; // No scope restriction
    }

    // Check if any scope matches event prefix
    return client.scopes.some(scope =>
      event.startsWith(scope) || scope === '*'
    );
  }

  /**
   * Broadcast event to all clients
   * @param {string} event
   * @param {*} payload
   * @param {object} options
   */
  function broadcast(event, payload, opts = {}) {
    const frame = JSON.stringify({
      type: 'event',
      event,
      payload,
      seq: eventSeq++,
    });

    for (const client of clients) {
      // Check scope
      if (!hasScope(client, event)) {
        continue;
      }

      // Check backpressure
      const socket = client.socket;
      if (socket.bufferedAmount > maxBufferedBytes) {
        if (opts.dropIfSlow || dropSlowClients) {
          // Drop this message for slow client
          continue;
        } else {
          // Close slow client
          try {
            socket.close(1008, 'slow consumer');
          } catch {
            // Already closed
          }
          clients.delete(client);
          continue;
        }
      }

      // Send
      try {
        socket.send(frame);
      } catch {
        clients.delete(client);
      }
    }
  }

  /**
   * Send to specific client
   * @param {object} client
   * @param {string} event
   * @param {*} payload
   */
  function sendToClient(client, event, payload) {
    if (!clients.has(client)) return false;

    const frame = JSON.stringify({
      type: 'event',
      event,
      payload,
      seq: eventSeq++,
    });

    try {
      client.socket.send(frame);
      return true;
    } catch {
      clients.delete(client);
      return false;
    }
  }

  /**
   * Get client count
   * @returns {number}
   */
  function getClientCount() {
    return clients.size;
  }

  return {
    addClient,
    removeClient,
    broadcast,
    sendToClient,
    getClientCount,
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  CHANNEL_STATES,
  createChannelManager,
  deliverBatch,
  createBroadcaster,
};
