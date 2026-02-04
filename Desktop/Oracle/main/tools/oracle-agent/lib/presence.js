/**
 * Presence System
 * Track online status of devices and users
 *
 * Features:
 * - Device online/offline tracking
 * - Last seen timestamps
 * - Multi-device support
 * - Activity detection
 * - Notification routing (send to active device)
 *
 * Use Cases:
 * - Know which device user is on
 * - Route notifications to active device
 * - Show "last seen" status
 * - Detect idle/away status
 */

/**
 * Presence states
 */
const PRESENCE_STATES = {
  ONLINE: 'online',
  AWAY: 'away',
  BUSY: 'busy',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown'
};

/**
 * Default timeouts (in milliseconds)
 */
const TIMEOUTS = {
  ONLINE_TO_AWAY: 5 * 60 * 1000,    // 5 minutes → away
  AWAY_TO_OFFLINE: 30 * 60 * 1000,  // 30 minutes → offline
  HEARTBEAT_INTERVAL: 30 * 1000     // 30 seconds
};

/**
 * Presence Manager
 */
class Presence {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      onlineToAwayTimeout: config.onlineToAwayTimeout || TIMEOUTS.ONLINE_TO_AWAY,
      awayToOfflineTimeout: config.awayToOfflineTimeout || TIMEOUTS.AWAY_TO_OFFLINE,
      heartbeatInterval: config.heartbeatInterval || TIMEOUTS.HEARTBEAT_INTERVAL,
      ...config
    };

    // Track presence per user -> device
    // userId -> { deviceId -> { state, lastSeen, metadata } }
    this.presence = new Map();

    // Presence change listeners
    this.listeners = [];

    // Cleanup interval
    this.cleanupInterval = null;
    if (this.config.enabled) {
      this._startCleanup();
    }
  }

  /**
   * Update presence for a user/device
   */
  update(userId, deviceId, options = {}) {
    if (!this.config.enabled) return;

    const {
      state = PRESENCE_STATES.ONLINE,
      platform = 'unknown',
      metadata = {}
    } = options;

    // Get or create user presence
    if (!this.presence.has(userId)) {
      this.presence.set(userId, new Map());
    }
    const userDevices = this.presence.get(userId);

    // Get previous state
    const previous = userDevices.get(deviceId);
    const previousState = previous?.state || PRESENCE_STATES.OFFLINE;

    // Update device presence
    const now = Date.now();
    userDevices.set(deviceId, {
      state,
      lastSeen: now,
      lastActivity: now,
      platform,
      metadata,
      updatedAt: now
    });

    // Notify listeners if state changed
    if (previousState !== state) {
      this._notifyListeners(userId, deviceId, state, previousState);
    }

    console.log(`[PRESENCE] ${userId}/${deviceId}: ${previousState} → ${state}`);
  }

  /**
   * Record activity (extends online status)
   */
  activity(userId, deviceId) {
    if (!this.config.enabled) return;

    const userDevices = this.presence.get(userId);
    const device = userDevices?.get(deviceId);

    if (device) {
      device.lastActivity = Date.now();
      if (device.state === PRESENCE_STATES.AWAY) {
        device.state = PRESENCE_STATES.ONLINE;
        this._notifyListeners(userId, deviceId, PRESENCE_STATES.ONLINE, PRESENCE_STATES.AWAY);
      }
    } else {
      // First activity, set as online
      this.update(userId, deviceId, { state: PRESENCE_STATES.ONLINE });
    }
  }

  /**
   * Set user as busy
   */
  setBusy(userId, deviceId) {
    this.update(userId, deviceId, { state: PRESENCE_STATES.BUSY });
  }

  /**
   * Set user as away
   */
  setAway(userId, deviceId) {
    this.update(userId, deviceId, { state: PRESENCE_STATES.AWAY });
  }

  /**
   * Set user as offline
   */
  setOffline(userId, deviceId) {
    if (!this.config.enabled) return;

    const userDevices = this.presence.get(userId);
    if (userDevices?.has(deviceId)) {
      const device = userDevices.get(deviceId);
      const previousState = device.state;

      device.state = PRESENCE_STATES.OFFLINE;
      device.updatedAt = Date.now();

      this._notifyListeners(userId, deviceId, PRESENCE_STATES.OFFLINE, previousState);
    }
  }

  /**
   * Get presence for a user
   */
  get(userId) {
    const userDevices = this.presence.get(userId);
    if (!userDevices) {
      return { state: PRESENCE_STATES.OFFLINE, devices: [] };
    }

    const devices = [];
    let bestState = PRESENCE_STATES.OFFLINE;

    for (const [deviceId, info] of userDevices) {
      devices.push({
        deviceId,
        ...info
      });

      // Determine best (most active) state
      if (info.state === PRESENCE_STATES.ONLINE) {
        bestState = PRESENCE_STATES.ONLINE;
      } else if (info.state === PRESENCE_STATES.BUSY && bestState !== PRESENCE_STATES.ONLINE) {
        bestState = PRESENCE_STATES.BUSY;
      } else if (info.state === PRESENCE_STATES.AWAY && bestState === PRESENCE_STATES.OFFLINE) {
        bestState = PRESENCE_STATES.AWAY;
      }
    }

    return {
      state: bestState,
      devices: devices.sort((a, b) => b.lastActivity - a.lastActivity)
    };
  }

  /**
   * Get active device for a user (most recently active)
   */
  getActiveDevice(userId) {
    const presence = this.get(userId);

    // Find online devices first
    const online = presence.devices.filter(d => d.state === PRESENCE_STATES.ONLINE);
    if (online.length > 0) {
      return online[0]; // Most recently active online device
    }

    // Then away devices
    const away = presence.devices.filter(d => d.state === PRESENCE_STATES.AWAY);
    if (away.length > 0) {
      return away[0];
    }

    // Return most recent device regardless of state
    return presence.devices[0] || null;
  }

  /**
   * Check if user is online
   */
  isOnline(userId) {
    const presence = this.get(userId);
    return presence.state === PRESENCE_STATES.ONLINE;
  }

  /**
   * Get all online users
   */
  getOnlineUsers() {
    const online = [];

    for (const [userId, devices] of this.presence) {
      for (const [deviceId, info] of devices) {
        if (info.state === PRESENCE_STATES.ONLINE) {
          online.push({
            userId,
            deviceId,
            platform: info.platform,
            lastActivity: info.lastActivity
          });
        }
      }
    }

    return online;
  }

  /**
   * Add presence change listener
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  /**
   * Notify listeners of presence change
   */
  _notifyListeners(userId, deviceId, newState, previousState) {
    for (const listener of this.listeners) {
      try {
        listener({
          userId,
          deviceId,
          state: newState,
          previousState,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[PRESENCE] Listener error:', err.message);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  _startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this._cleanup();
    }, 60000); // Run every minute
  }

  /**
   * Cleanup stale presence entries
   */
  _cleanup() {
    const now = Date.now();

    for (const [userId, devices] of this.presence) {
      for (const [deviceId, info] of devices) {
        const timeSinceActivity = now - info.lastActivity;

        if (info.state === PRESENCE_STATES.ONLINE && timeSinceActivity > this.config.onlineToAwayTimeout) {
          // Online → Away
          info.state = PRESENCE_STATES.AWAY;
          info.updatedAt = now;
          this._notifyListeners(userId, deviceId, PRESENCE_STATES.AWAY, PRESENCE_STATES.ONLINE);
          console.log(`[PRESENCE] ${userId}/${deviceId}: auto-away (inactive ${Math.round(timeSinceActivity / 1000)}s)`);
        } else if (info.state === PRESENCE_STATES.AWAY && timeSinceActivity > this.config.awayToOfflineTimeout) {
          // Away → Offline
          info.state = PRESENCE_STATES.OFFLINE;
          info.updatedAt = now;
          this._notifyListeners(userId, deviceId, PRESENCE_STATES.OFFLINE, PRESENCE_STATES.AWAY);
          console.log(`[PRESENCE] ${userId}/${deviceId}: auto-offline (inactive ${Math.round(timeSinceActivity / 1000)}s)`);
        }
      }
    }
  }

  /**
   * Get status
   */
  getStatus() {
    let totalUsers = 0;
    let totalDevices = 0;
    let onlineDevices = 0;
    let awayDevices = 0;

    for (const [userId, devices] of this.presence) {
      totalUsers++;
      for (const [deviceId, info] of devices) {
        totalDevices++;
        if (info.state === PRESENCE_STATES.ONLINE) onlineDevices++;
        if (info.state === PRESENCE_STATES.AWAY) awayDevices++;
      }
    }

    return {
      enabled: this.config.enabled,
      totalUsers,
      totalDevices,
      onlineDevices,
      awayDevices,
      offlineDevices: totalDevices - onlineDevices - awayDevices
    };
  }

  /**
   * Clear all presence data
   */
  clear() {
    this.presence.clear();
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
const presence = new Presence();

export default presence;
export { Presence, PRESENCE_STATES, TIMEOUTS };
