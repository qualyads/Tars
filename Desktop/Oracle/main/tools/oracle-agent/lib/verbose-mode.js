/**
 * Verbose Mode
 * Show AI tool calls in real-time
 *
 * Modes:
 * - off: Hide all tool calls (default for users)
 * - on: Show tool summaries
 * - full: Show full tool input/output
 *
 * Usage:
 * /verbose off|on|full
 */

/**
 * Verbose mode levels
 */
const MODES = {
  OFF: 'off',
  ON: 'on',
  FULL: 'full'
};

/**
 * Format tool call for display
 */
const FORMATTERS = {
  // Summary format (mode: on)
  summary: (toolCall) => {
    const { name, input, output, duration, status } = toolCall;
    const statusIcon = status === 'success' ? '✓' : '✗';
    const durationStr = duration ? `${duration}ms` : '';

    return `${statusIcon} ${name} ${durationStr}`.trim();
  },

  // Full format (mode: full)
  full: (toolCall) => {
    const { name, input, output, duration, status, error } = toolCall;
    const statusIcon = status === 'success' ? '✓' : '✗';

    let result = `┌─ ${statusIcon} ${name}`;
    if (duration) result += ` (${duration}ms)`;
    result += '\n';

    if (input) {
      result += `│ Input: ${truncate(JSON.stringify(input), 200)}\n`;
    }

    if (status === 'success' && output) {
      result += `│ Output: ${truncate(JSON.stringify(output), 200)}\n`;
    }

    if (status === 'error' && error) {
      result += `│ Error: ${error}\n`;
    }

    result += '└─────────────────';
    return result;
  },

  // Compact format for chat
  compact: (toolCall) => {
    const { name, status, duration } = toolCall;
    const icon = status === 'success' ? '🔧' : '❌';
    return `${icon} ${name}${duration ? ` (${duration}ms)` : ''}`;
  }
};

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Verbose Mode Manager
 */
class VerboseMode {
  constructor() {
    // Per-session verbose settings
    this.sessions = new Map(); // sessionId -> mode
    this.defaultMode = MODES.OFF;

    // Tool call buffer for display
    this.toolCalls = new Map(); // sessionId -> toolCall[]
    this.maxBufferSize = 50;

    // Event listeners
    this.listeners = new Map(); // sessionId -> callback[]
  }

  /**
   * Set verbose mode for a session
   * @param {string} sessionId
   * @param {string} mode - off|on|full
   */
  setMode(sessionId, mode) {
    if (!Object.values(MODES).includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Use: off, on, full`);
    }
    this.sessions.set(sessionId, mode);
    console.log(`[VERBOSE] Session ${sessionId} set to: ${mode}`);
    return mode;
  }

  /**
   * Get verbose mode for a session
   */
  getMode(sessionId) {
    return this.sessions.get(sessionId) || this.defaultMode;
  }

  /**
   * Check if verbose is enabled for session
   */
  isEnabled(sessionId) {
    return this.getMode(sessionId) !== MODES.OFF;
  }

  /**
   * Record a tool call
   * @param {string} sessionId
   * @param {object} toolCall - { name, input, output, duration, status, error }
   */
  recordToolCall(sessionId, toolCall) {
    // Add timestamp
    const record = {
      ...toolCall,
      timestamp: Date.now()
    };

    // Get or create buffer
    if (!this.toolCalls.has(sessionId)) {
      this.toolCalls.set(sessionId, []);
    }
    const buffer = this.toolCalls.get(sessionId);

    // Add to buffer
    buffer.push(record);

    // Trim buffer if too large
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }

    // Notify listeners
    this._notifyListeners(sessionId, record);

    // Return formatted output if verbose is on
    const mode = this.getMode(sessionId);
    if (mode === MODES.OFF) {
      return null;
    }

    return this.formatToolCall(record, mode);
  }

  /**
   * Format a tool call based on mode
   */
  formatToolCall(toolCall, mode) {
    switch (mode) {
      case MODES.ON:
        return FORMATTERS.summary(toolCall);
      case MODES.FULL:
        return FORMATTERS.full(toolCall);
      default:
        return null;
    }
  }

  /**
   * Get recent tool calls for a session
   */
  getToolCalls(sessionId, limit = 10) {
    const buffer = this.toolCalls.get(sessionId) || [];
    return buffer.slice(-limit);
  }

  /**
   * Format all recent tool calls
   */
  formatRecentCalls(sessionId, limit = 5) {
    const mode = this.getMode(sessionId);
    if (mode === MODES.OFF) return null;

    const calls = this.getToolCalls(sessionId, limit);
    if (calls.length === 0) return 'No recent tool calls';

    return calls
      .map(call => this.formatToolCall(call, mode))
      .join('\n');
  }

  /**
   * Clear tool call buffer for session
   */
  clearBuffer(sessionId) {
    this.toolCalls.delete(sessionId);
  }

  /**
   * Add listener for tool calls
   */
  addListener(sessionId, callback) {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, []);
    }
    this.listeners.get(sessionId).push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(sessionId, callback) {
    const listeners = this.listeners.get(sessionId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners of new tool call
   */
  _notifyListeners(sessionId, toolCall) {
    const listeners = this.listeners.get(sessionId) || [];
    const mode = this.getMode(sessionId);

    if (mode === MODES.OFF) return;

    const formatted = this.formatToolCall(toolCall, mode);
    for (const callback of listeners) {
      try {
        callback(formatted, toolCall);
      } catch (err) {
        console.error('[VERBOSE] Listener error:', err.message);
      }
    }
  }

  /**
   * Parse verbose command
   * @param {string} message - e.g., "/verbose on"
   * @returns {object|null} - { mode } or null if not a verbose command
   */
  parseCommand(message) {
    const match = message.match(/^\/verbose\s*(off|on|full)?$/i);
    if (!match) return null;

    return {
      mode: match[1]?.toLowerCase() || 'on' // default to 'on' if no mode specified
    };
  }

  /**
   * Handle verbose command
   */
  handleCommand(sessionId, message) {
    const parsed = this.parseCommand(message);
    if (!parsed) return null;

    const newMode = this.setMode(sessionId, parsed.mode);

    return {
      success: true,
      mode: newMode,
      message: `Verbose mode: ${newMode}`
    };
  }

  /**
   * Get status
   */
  getStatus() {
    const sessionModes = {};
    for (const [sessionId, mode] of this.sessions) {
      sessionModes[sessionId] = mode;
    }

    return {
      defaultMode: this.defaultMode,
      activeSessions: this.sessions.size,
      sessionModes,
      totalBufferedCalls: Array.from(this.toolCalls.values())
        .reduce((sum, buf) => sum + buf.length, 0)
    };
  }

  /**
   * Set default mode
   */
  setDefaultMode(mode) {
    if (!Object.values(MODES).includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.defaultMode = mode;
    return this.defaultMode;
  }
}

// Singleton instance
const verboseMode = new VerboseMode();

export default verboseMode;
export { VerboseMode, MODES, FORMATTERS };
