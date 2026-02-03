/**
 * TUI Core - Terminal User Interface จาก OpenClaw Pattern
 *
 * Features:
 * - Slash command parsing with aliases
 * - Activity status tracking
 * - Stream assembler (delta processing)
 * - Waiting animation
 * - Searchable filtering
 *
 * @module tui-core
 */

// ============================================================
// Activity Status
// ============================================================

/**
 * Activity status types
 */
export const ACTIVITY_STATUS = {
  IDLE: 'idle',
  SENDING: 'sending',
  WAITING: 'waiting',
  STREAMING: 'streaming',
  RUNNING: 'running',
  ERROR: 'error',
};

/**
 * Connection status types
 */
export const CONNECTION_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

/**
 * Create activity tracker
 * @returns {object} Tracker API
 */
export function createActivityTracker() {
  let activityStatus = ACTIVITY_STATUS.IDLE;
  let connectionStatus = CONNECTION_STATUS.DISCONNECTED;
  let lastChange = Date.now();
  const listeners = new Set();

  function setActivity(status) {
    if (status !== activityStatus) {
      activityStatus = status;
      lastChange = Date.now();
      notify();
    }
  }

  function setConnection(status) {
    if (status !== connectionStatus) {
      connectionStatus = status;
      notify();
    }
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener({ activityStatus, connectionStatus, lastChange });
      } catch {
        // Ignore listener errors
      }
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getStatus() {
    return {
      activityStatus,
      connectionStatus,
      lastChange,
      elapsed: Date.now() - lastChange,
      isIdle: activityStatus === ACTIVITY_STATUS.IDLE,
      isConnected: connectionStatus === CONNECTION_STATUS.CONNECTED,
    };
  }

  return {
    setActivity,
    setConnection,
    subscribe,
    getStatus,
    ACTIVITY: ACTIVITY_STATUS,
    CONNECTION: CONNECTION_STATUS,
  };
}

// ============================================================
// Command Parsing
// ============================================================

/**
 * Default command aliases
 */
export const DEFAULT_COMMAND_ALIASES = {
  h: 'help',
  s: 'status',
  m: 'model',
  a: 'agent',
  t: 'think',
  v: 'verbose',
  q: 'quit',
  elev: 'elevated',
};

/**
 * Parse slash command
 * @param {string} input
 * @param {object} aliases - Command aliases
 * @returns {object} { name, args, raw }
 */
export function parseCommand(input, aliases = DEFAULT_COMMAND_ALIASES) {
  const trimmed = (input || '').replace(/^\//, '').trim();

  if (!trimmed) {
    return { name: '', args: '', raw: input };
  }

  const spaceIndex = trimmed.indexOf(' ');
  let name, args;

  if (spaceIndex === -1) {
    name = trimmed;
    args = '';
  } else {
    name = trimmed.slice(0, spaceIndex);
    args = trimmed.slice(spaceIndex + 1).trim();
  }

  const normalized = name.toLowerCase();
  const resolved = aliases[normalized] || normalized;

  return {
    name: resolved,
    args,
    raw: input,
    originalName: name,
    wasAliased: resolved !== normalized,
  };
}

/**
 * Check input type
 * @param {string} input
 * @returns {string} 'command' | 'bash' | 'message'
 */
export function getInputType(input) {
  const trimmed = (input || '').trim();

  if (!trimmed) return 'message';
  if (trimmed.startsWith('!')) return 'bash';
  if (trimmed.startsWith('/')) return 'command';
  return 'message';
}

/**
 * Extract bash command
 * @param {string} input
 * @returns {string}
 */
export function extractBashCommand(input) {
  return (input || '').replace(/^!/, '').trim();
}

// ============================================================
// Stream Assembler
// ============================================================

/**
 * Create stream assembler for delta processing
 * @returns {object} Assembler API
 */
export function createStreamAssembler() {
  const runs = new Map();

  /**
   * Get or create run state
   * @param {string} runId
   * @returns {object}
   */
  function getRunState(runId) {
    if (!runs.has(runId)) {
      runs.set(runId, {
        thinkingText: '',
        contentText: '',
        displayText: '',
        lastUpdate: Date.now(),
      });
    }
    return runs.get(runId);
  }

  /**
   * Ingest delta
   * @param {string} runId
   * @param {object} delta - { thinking?, content? }
   * @returns {string|null} Display text if changed
   */
  function ingestDelta(runId, delta) {
    const state = getRunState(runId);
    let changed = false;

    if (delta.thinking && delta.thinking !== state.thinkingText) {
      state.thinkingText = delta.thinking;
      changed = true;
    }

    if (delta.content && delta.content !== state.contentText) {
      state.contentText = delta.content;
      changed = true;
    }

    if (changed) {
      state.displayText = composeDisplay(state);
      state.lastUpdate = Date.now();
      return state.displayText;
    }

    return null;
  }

  /**
   * Compose display text from state
   * @param {object} state
   * @returns {string}
   */
  function composeDisplay(state) {
    const parts = [];

    if (state.thinkingText) {
      parts.push(`<thinking>\n${state.thinkingText}\n</thinking>`);
    }

    if (state.contentText) {
      parts.push(state.contentText);
    }

    return parts.join('\n\n');
  }

  /**
   * Finalize run
   * @param {string} runId
   * @param {string} finalText - Optional final text
   * @returns {string}
   */
  function finalizeRun(runId, finalText) {
    const state = getRunState(runId);

    if (finalText) {
      state.contentText = finalText;
      state.displayText = composeDisplay(state);
    }

    return state.displayText;
  }

  /**
   * Get run state
   * @param {string} runId
   * @returns {object|undefined}
   */
  function getRun(runId) {
    return runs.get(runId);
  }

  /**
   * Clear run
   * @param {string} runId
   */
  function clearRun(runId) {
    runs.delete(runId);
  }

  /**
   * Garbage collect old runs
   * @param {number} maxAge - Max age in ms
   */
  function gc(maxAge = 5 * 60 * 1000) {
    const now = Date.now();
    for (const [runId, state] of runs) {
      if (now - state.lastUpdate > maxAge) {
        runs.delete(runId);
      }
    }
  }

  return {
    ingestDelta,
    finalizeRun,
    getRun,
    clearRun,
    gc,
  };
}

// ============================================================
// Waiting Animation
// ============================================================

/**
 * Default waiting phrases
 */
export const WAITING_PHRASES = [
  'thinking…',
  'pondering…',
  'contemplating…',
  'processing…',
  'analyzing…',
  'computing…',
  'considering…',
  'evaluating…',
  'examining…',
  'investigating…',
];

/**
 * Shimmer characters
 */
const SHIMMER_CHARS = ['░', '▒', '▓', '█', '▓', '▒'];

/**
 * Create waiting animation
 * @param {object} options
 * @returns {object} Animation API
 */
export function createWaitingAnimation(options = {}) {
  const {
    phrases = WAITING_PHRASES,
    tickMs = 120,
  } = options;

  let tick = 0;
  let phraseIndex = Math.floor(Math.random() * phrases.length);
  let startTime = Date.now();

  /**
   * Get current frame
   * @returns {object}
   */
  function getFrame() {
    const shimmerIndex = tick % SHIMMER_CHARS.length;
    const shimmer = SHIMMER_CHARS[shimmerIndex];
    const phrase = phrases[phraseIndex];
    const elapsed = formatElapsed(Date.now() - startTime);

    return {
      shimmer,
      phrase,
      elapsed,
      display: `${shimmer} ${phrase} (${elapsed})`,
    };
  }

  /**
   * Advance tick
   */
  function advance() {
    tick++;
  }

  /**
   * Reset animation
   */
  function reset() {
    tick = 0;
    phraseIndex = Math.floor(Math.random() * phrases.length);
    startTime = Date.now();
  }

  /**
   * Change phrase
   */
  function changePhrase() {
    phraseIndex = (phraseIndex + 1) % phrases.length;
  }

  return {
    getFrame,
    advance,
    reset,
    changePhrase,
    tickMs,
  };
}

/**
 * Format elapsed time
 * @param {number} ms
 * @returns {string}
 */
function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

// ============================================================
// Searchable Filtering
// ============================================================

/**
 * Filter items with 4-tier scoring
 * @param {object[]} items - Array of { label, description?, value }
 * @param {string} query
 * @returns {object[]} Sorted filtered items
 */
export function filterItems(items, query) {
  if (!query || !query.trim()) {
    return items;
  }

  const q = query.toLowerCase().trim();
  const scored = [];

  for (const item of items) {
    const label = (item.label || '').toLowerCase();
    const description = (item.description || '').toLowerCase();

    let score = 0;

    // Tier 1: Exact substring in label (highest)
    if (label.includes(q)) {
      score = 4;
      // Bonus for prefix match
      if (label.startsWith(q)) {
        score += 1;
      }
    }
    // Tier 2: Word-boundary prefix match
    else if (matchesWordPrefix(label, q)) {
      score = 3;
    }
    // Tier 3: Exact substring in description
    else if (description.includes(q)) {
      score = 2;
    }
    // Tier 4: Fuzzy match
    else if (fuzzyMatch(label, q) || fuzzyMatch(description, q)) {
      score = 1;
    }

    if (score > 0) {
      scored.push({ ...item, score });
    }
  }

  // Sort by score (desc), then by label (asc)
  return scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.label || '').localeCompare(b.label || '');
  });
}

/**
 * Check if query matches word prefix
 * @param {string} text
 * @param {string} query
 * @returns {boolean}
 */
function matchesWordPrefix(text, query) {
  const words = text.split(/[\s_-]+/);
  return words.some(word => word.startsWith(query));
}

/**
 * Simple fuzzy match (characters in order)
 * @param {string} text
 * @param {string} query
 * @returns {boolean}
 */
function fuzzyMatch(text, query) {
  let queryIndex = 0;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === query.length;
}

// ============================================================
// Input History
// ============================================================

/**
 * Create input history manager
 * @param {number} maxSize
 * @returns {object} History API
 */
export function createInputHistory(maxSize = 100) {
  const history = [];
  let position = -1;

  function add(input) {
    if (!input || !input.trim()) return;

    // Don't add duplicates
    if (history[0] === input) return;

    history.unshift(input);

    // Limit size
    if (history.length > maxSize) {
      history.pop();
    }

    // Reset position
    position = -1;
  }

  function previous(current) {
    if (history.length === 0) return current;

    if (position < history.length - 1) {
      position++;
    }

    return history[position];
  }

  function next(current) {
    if (position <= 0) {
      position = -1;
      return '';
    }

    position--;
    return history[position];
  }

  function reset() {
    position = -1;
  }

  function getAll() {
    return [...history];
  }

  return {
    add,
    previous,
    next,
    reset,
    getAll,
  };
}

// ============================================================
// Footer Builder
// ============================================================

/**
 * Build status footer
 * @param {object} info
 * @returns {string}
 */
export function buildFooter(info = {}) {
  const parts = [];

  if (info.agentId) {
    parts.push(`agent ${info.agentId}`);
  }

  if (info.sessionKey) {
    // Show shortened key
    const short = info.sessionKey.split(':').slice(-2).join(':');
    parts.push(`session ${short}`);
  }

  if (info.model) {
    parts.push(info.model);
  }

  if (info.thinkingLevel) {
    parts.push(`think ${info.thinkingLevel}`);
  }

  if (info.tokensUsed !== undefined && info.contextLimit !== undefined) {
    const percent = Math.round((info.tokensUsed / info.contextLimit) * 100);
    parts.push(`${info.tokensUsed}/${info.contextLimit} (${percent}%)`);
  }

  return parts.join(' | ');
}

// ============================================================
// Exports
// ============================================================

export default {
  // Activity
  ACTIVITY_STATUS,
  CONNECTION_STATUS,
  createActivityTracker,

  // Commands
  DEFAULT_COMMAND_ALIASES,
  parseCommand,
  getInputType,
  extractBashCommand,

  // Streaming
  createStreamAssembler,

  // Waiting
  WAITING_PHRASES,
  createWaitingAnimation,

  // Filtering
  filterItems,

  // History
  createInputHistory,

  // Footer
  buildFooter,
};
