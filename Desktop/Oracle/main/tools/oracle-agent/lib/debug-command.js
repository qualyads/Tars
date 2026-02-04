/**
 * Debug Command
 * Runtime configuration changes without restart
 *
 * Commands:
 * /debug show           - Show current overrides
 * /debug set key=value  - Set runtime config
 * /debug unset key      - Remove override
 * /debug reset          - Clear all overrides
 *
 * Changes are EPHEMERAL - not saved to disk!
 * Perfect for testing without breaking config.
 */

/**
 * Allowed debug keys and their validators
 */
const DEBUG_KEYS = {
  model: {
    description: 'AI model to use',
    validate: (v) => typeof v === 'string' && v.length > 0,
    examples: ['claude-sonnet-4', 'gpt-4o', 'haiku']
  },
  thinking: {
    description: 'Thinking level',
    validate: (v) => ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(v),
    examples: ['off', 'medium', 'high']
  },
  verbose: {
    description: 'Verbose mode',
    validate: (v) => ['off', 'on', 'full'].includes(v),
    examples: ['off', 'on', 'full']
  },
  temperature: {
    description: 'Model temperature',
    validate: (v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 0 && n <= 2;
    },
    transform: (v) => parseFloat(v),
    examples: ['0', '0.7', '1.0']
  },
  maxTokens: {
    description: 'Max output tokens',
    validate: (v) => {
      const n = parseInt(v);
      return !isNaN(n) && n > 0 && n <= 100000;
    },
    transform: (v) => parseInt(v),
    examples: ['1000', '4096', '8192']
  },
  provider: {
    description: 'Preferred AI provider',
    validate: (v) => ['anthropic', 'openai', 'groq', 'google', 'local'].includes(v),
    examples: ['anthropic', 'openai', 'local']
  },
  autoThinking: {
    description: 'Auto-detect thinking level',
    validate: (v) => ['true', 'false'].includes(v.toLowerCase()),
    transform: (v) => v.toLowerCase() === 'true',
    examples: ['true', 'false']
  },
  typing: {
    description: 'Typing indicators',
    validate: (v) => ['true', 'false'].includes(v.toLowerCase()),
    transform: (v) => v.toLowerCase() === 'true',
    examples: ['true', 'false']
  },
  language: {
    description: 'Response language',
    validate: (v) => ['th', 'en', 'auto'].includes(v),
    examples: ['th', 'en', 'auto']
  },
  persona: {
    description: 'AI persona',
    validate: (v) => typeof v === 'string' && v.length > 0,
    examples: ['oracle', 'assistant', 'analyst']
  }
};

/**
 * Debug Command Manager
 */
class DebugCommand {
  constructor() {
    // Per-session overrides
    this.overrides = new Map(); // sessionId -> { key: value }

    // Global overrides (apply to all sessions)
    this.globalOverrides = {};

    // Change history for debugging
    this.history = []; // { timestamp, sessionId, action, key, value }
    this.maxHistory = 100;
  }

  /**
   * Parse debug command
   * @param {string} message
   * @returns {object|null}
   */
  parseCommand(message) {
    // /debug show
    const showMatch = message.match(/^\/debug\s+show$/i);
    if (showMatch) {
      return { action: 'show' };
    }

    // /debug set key=value
    const setMatch = message.match(/^\/debug\s+set\s+(\w+)=(.+)$/i);
    if (setMatch) {
      return { action: 'set', key: setMatch[1], value: setMatch[2] };
    }

    // /debug unset key
    const unsetMatch = message.match(/^\/debug\s+unset\s+(\w+)$/i);
    if (unsetMatch) {
      return { action: 'unset', key: unsetMatch[1] };
    }

    // /debug reset
    const resetMatch = message.match(/^\/debug\s+reset$/i);
    if (resetMatch) {
      return { action: 'reset' };
    }

    // /debug keys (show available keys)
    const keysMatch = message.match(/^\/debug\s+keys$/i);
    if (keysMatch) {
      return { action: 'keys' };
    }

    // /debug help
    const helpMatch = message.match(/^\/debug(\s+help)?$/i);
    if (helpMatch) {
      return { action: 'help' };
    }

    return null;
  }

  /**
   * Handle debug command
   */
  handleCommand(sessionId, message) {
    const parsed = this.parseCommand(message);
    if (!parsed) return null;

    switch (parsed.action) {
      case 'show':
        return this._handleShow(sessionId);
      case 'set':
        return this._handleSet(sessionId, parsed.key, parsed.value);
      case 'unset':
        return this._handleUnset(sessionId, parsed.key);
      case 'reset':
        return this._handleReset(sessionId);
      case 'keys':
        return this._handleKeys();
      case 'help':
        return this._handleHelp();
      default:
        return { success: false, message: 'Unknown action' };
    }
  }

  /**
   * Show current overrides
   */
  _handleShow(sessionId) {
    const sessionOverrides = this.overrides.get(sessionId) || {};
    const merged = { ...this.globalOverrides, ...sessionOverrides };

    if (Object.keys(merged).length === 0) {
      return {
        success: true,
        message: 'No active overrides',
        overrides: {}
      };
    }

    const lines = Object.entries(merged)
      .map(([key, value]) => `  ${key} = ${JSON.stringify(value)}`)
      .join('\n');

    return {
      success: true,
      message: `Active overrides:\n${lines}`,
      overrides: merged
    };
  }

  /**
   * Set a debug value
   */
  _handleSet(sessionId, key, value) {
    // Check if key is valid
    const keyConfig = DEBUG_KEYS[key];
    if (!keyConfig) {
      return {
        success: false,
        message: `Unknown key: ${key}\nUse /debug keys to see available keys`
      };
    }

    // Validate value
    if (!keyConfig.validate(value)) {
      return {
        success: false,
        message: `Invalid value for ${key}\nExamples: ${keyConfig.examples.join(', ')}`
      };
    }

    // Transform value if needed
    const finalValue = keyConfig.transform ? keyConfig.transform(value) : value;

    // Set override
    if (!this.overrides.has(sessionId)) {
      this.overrides.set(sessionId, {});
    }
    this.overrides.get(sessionId)[key] = finalValue;

    // Record history
    this._recordHistory(sessionId, 'set', key, finalValue);

    return {
      success: true,
      message: `Set ${key} = ${JSON.stringify(finalValue)}`,
      key,
      value: finalValue
    };
  }

  /**
   * Unset a debug value
   */
  _handleUnset(sessionId, key) {
    const sessionOverrides = this.overrides.get(sessionId);
    if (!sessionOverrides || !(key in sessionOverrides)) {
      return {
        success: false,
        message: `No override for: ${key}`
      };
    }

    delete sessionOverrides[key];
    this._recordHistory(sessionId, 'unset', key, null);

    return {
      success: true,
      message: `Unset ${key}`
    };
  }

  /**
   * Reset all overrides for session
   */
  _handleReset(sessionId) {
    this.overrides.delete(sessionId);
    this._recordHistory(sessionId, 'reset', null, null);

    return {
      success: true,
      message: 'All overrides cleared'
    };
  }

  /**
   * Show available keys
   */
  _handleKeys() {
    const lines = Object.entries(DEBUG_KEYS)
      .map(([key, config]) => `  ${key}: ${config.description}\n    Examples: ${config.examples.join(', ')}`)
      .join('\n\n');

    return {
      success: true,
      message: `Available debug keys:\n\n${lines}`
    };
  }

  /**
   * Show help
   */
  _handleHelp() {
    return {
      success: true,
      message: `Debug Commands:

/debug show         - Show current overrides
/debug set key=val  - Set runtime config
/debug unset key    - Remove override
/debug reset        - Clear all overrides
/debug keys         - Show available keys

Examples:
/debug set model=gpt-4o
/debug set thinking=high
/debug set temperature=0.7

Changes are temporary and not saved to disk.`
    };
  }

  /**
   * Record history entry
   */
  _recordHistory(sessionId, action, key, value) {
    this.history.push({
      timestamp: Date.now(),
      sessionId,
      action,
      key,
      value
    });

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get effective value for a key
   * Returns override if exists, otherwise null
   */
  get(sessionId, key) {
    const sessionOverrides = this.overrides.get(sessionId) || {};
    if (key in sessionOverrides) {
      return sessionOverrides[key];
    }
    if (key in this.globalOverrides) {
      return this.globalOverrides[key];
    }
    return null;
  }

  /**
   * Get all overrides for a session
   */
  getAll(sessionId) {
    const sessionOverrides = this.overrides.get(sessionId) || {};
    return { ...this.globalOverrides, ...sessionOverrides };
  }

  /**
   * Check if a key has an override
   */
  has(sessionId, key) {
    return this.get(sessionId, key) !== null;
  }

  /**
   * Set global override (all sessions)
   */
  setGlobal(key, value) {
    const keyConfig = DEBUG_KEYS[key];
    if (!keyConfig || !keyConfig.validate(value)) {
      return false;
    }

    const finalValue = keyConfig.transform ? keyConfig.transform(value) : value;
    this.globalOverrides[key] = finalValue;
    return true;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      sessionsWithOverrides: this.overrides.size,
      globalOverrides: this.globalOverrides,
      recentHistory: this.history.slice(-10),
      availableKeys: Object.keys(DEBUG_KEYS)
    };
  }
}

// Singleton instance
const debugCommand = new DebugCommand();

export default debugCommand;
export { DebugCommand, DEBUG_KEYS };
