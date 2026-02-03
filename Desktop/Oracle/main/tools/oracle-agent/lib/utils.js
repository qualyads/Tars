/**
 * Utils - Utility Functions จาก OpenClaw Pattern
 *
 * Features:
 * - Time formatting (relative time)
 * - Boolean parsing (yes/no/true/false)
 * - Queue helpers (drop policies, summarization)
 * - Directive tags ([[audio_as_voice]], etc.)
 *
 * @module utils
 */

// ============================================================
// Time Formatting
// ============================================================

/**
 * Format relative time
 * @param {Date|number} date - Date or timestamp
 * @returns {string} Formatted time (e.g., "5m ago", "Yesterday")
 */
export function formatRelativeTime(date) {
  const now = Date.now();
  const timestamp = date instanceof Date ? date.getTime() : date;
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days === 1) {
    return 'Yesterday';
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  // More than 7 days - show date
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format duration in milliseconds
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m", "45s")
 */
export function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Format timestamp for logs
 * @param {Date|number} date
 * @returns {string} ISO-like format
 */
export function formatTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ============================================================
// Boolean Parsing
// ============================================================

/**
 * Truthy values
 */
const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on']);

/**
 * Falsy values
 */
const FALSY_VALUES = new Set(['false', '0', 'no', 'off']);

/**
 * Parse boolean from string
 * @param {*} value - Value to parse
 * @returns {boolean|undefined} Parsed boolean or undefined
 */
export function parseBoolean(value) {
  // Native boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Non-string
  if (typeof value !== 'string') {
    return undefined;
  }

  // Normalize
  const normalized = value.trim().toLowerCase();

  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }

  if (FALSY_VALUES.has(normalized)) {
    return false;
  }

  return undefined;
}

/**
 * Convert to boolean with default
 * @param {*} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
export function toBoolean(value, defaultValue = false) {
  const parsed = parseBoolean(value);
  return parsed !== undefined ? parsed : defaultValue;
}

// ============================================================
// Queue Helpers
// ============================================================

/**
 * Queue drop policies
 */
export const DROP_POLICIES = {
  NEW: 'new', // Reject new items
  OLD: 'old', // Remove oldest items
  SUMMARIZE: 'summarize', // Remove oldest + store summary
};

/**
 * Create a managed queue
 * @param {object} options
 * @param {number} options.capacity - Max items
 * @param {string} options.dropPolicy - Drop policy
 * @param {Function} options.summarize - Summarization function
 * @returns {object} Queue API
 */
export function createManagedQueue(options = {}) {
  const { capacity = 100, dropPolicy = DROP_POLICIES.OLD, summarize = defaultSummarize } = options;

  const items = [];
  let droppedCount = 0;
  const summaryLines = [];

  function enqueue(item) {
    if (items.length >= capacity) {
      switch (dropPolicy) {
        case DROP_POLICIES.NEW:
          // Reject new item
          return false;

        case DROP_POLICIES.OLD:
          // Remove oldest
          items.shift();
          droppedCount++;
          break;

        case DROP_POLICIES.SUMMARIZE:
          // Remove oldest and summarize
          const dropped = items.shift();
          droppedCount++;
          const summary = summarize(dropped);
          if (summary) {
            summaryLines.push(summary);
          }
          break;
      }
    }

    items.push(item);
    return true;
  }

  function dequeue() {
    return items.shift();
  }

  function peek() {
    return items[0];
  }

  function clear() {
    items.length = 0;
    droppedCount = 0;
    summaryLines.length = 0;
  }

  function getState() {
    return {
      items: [...items],
      count: items.length,
      droppedCount,
      summaryLines: [...summaryLines],
      capacity,
      dropPolicy,
    };
  }

  function getSummaryPrompt() {
    if (droppedCount === 0) {
      return null;
    }

    const lines = [`[Queue overflow] Dropped ${droppedCount} item(s)`];
    if (summaryLines.length > 0) {
      lines.push('Summary:');
      for (const line of summaryLines.slice(-10)) {
        // Max 10 summaries
        lines.push(`- ${line}`);
      }
    }
    return lines.join('\n');
  }

  return {
    enqueue,
    dequeue,
    peek,
    clear,
    getState,
    getSummaryPrompt,
    get length() {
      return items.length;
    },
  };
}

/**
 * Default summarize function
 * @param {*} item
 * @returns {string}
 */
function defaultSummarize(item) {
  if (typeof item === 'string') {
    return elideText(item, 160);
  }
  if (item?.text) {
    return elideText(item.text, 160);
  }
  if (item?.content) {
    return elideText(item.content, 160);
  }
  return String(item).slice(0, 160);
}

/**
 * Elide text to max length
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
export function elideText(text, maxLen = 160) {
  if (!text) return '';

  // Collapse whitespace
  const collapsed = text.replace(/\s+/g, ' ').trim();

  if (collapsed.length <= maxLen) {
    return collapsed;
  }

  return collapsed.slice(0, maxLen - 1) + '…';
}

// ============================================================
// Directive Tags
// ============================================================

/**
 * Directive tag patterns
 */
const DIRECTIVE_PATTERNS = {
  AUDIO_AS_VOICE: /\[\[audio_as_voice\]\]/gi,
  REPLY_TO_CURRENT: /\[\[reply_to_current\]\]/gi,
  REPLY_TO_ID: /\[\[reply_to:\s*([^\]]+)\]\]/gi,
};

/**
 * Process directive tags in text
 * @param {string} text
 * @returns {object} { text, audioAsVoice, replyToCurrent, replyToId }
 */
export function processDirectiveTags(text) {
  if (!text) {
    return {
      text: '',
      audioAsVoice: false,
      replyToCurrent: false,
      replyToId: null,
      hasAudioTag: false,
      hasReplyTag: false,
    };
  }

  let result = text;
  let audioAsVoice = false;
  let replyToCurrent = false;
  let replyToId = null;
  let hasAudioTag = false;
  let hasReplyTag = false;

  // Check and remove audio_as_voice
  if (DIRECTIVE_PATTERNS.AUDIO_AS_VOICE.test(result)) {
    hasAudioTag = true;
    audioAsVoice = true;
    result = result.replace(DIRECTIVE_PATTERNS.AUDIO_AS_VOICE, '');
  }

  // Check and remove reply_to_current
  if (DIRECTIVE_PATTERNS.REPLY_TO_CURRENT.test(result)) {
    hasReplyTag = true;
    replyToCurrent = true;
    result = result.replace(DIRECTIVE_PATTERNS.REPLY_TO_CURRENT, '');
  }

  // Check and extract reply_to:id
  DIRECTIVE_PATTERNS.REPLY_TO_ID.lastIndex = 0;
  const replyMatch = DIRECTIVE_PATTERNS.REPLY_TO_ID.exec(text);
  if (replyMatch) {
    hasReplyTag = true;
    replyToId = replyMatch[1].trim();
    result = result.replace(DIRECTIVE_PATTERNS.REPLY_TO_ID, '');
  }

  // Normalize whitespace
  result = result.replace(/[ \t]+/g, ' ').trim();

  return {
    text: result,
    audioAsVoice,
    replyToCurrent,
    replyToId,
    hasAudioTag,
    hasReplyTag,
  };
}

// ============================================================
// String Utilities
// ============================================================

/**
 * Truncate string with ellipsis
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 100) {
  if (!str || str.length <= maxLen) {
    return str || '';
  }
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to kebab-case
 * @param {string} str
 * @returns {string}
 */
export function toKebabCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert to camelCase
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str) {
  if (!str) return '';
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toLowerCase());
}

// ============================================================
// Object Utilities
// ============================================================

/**
 * Deep clone object
 * @param {*} obj
 * @returns {*}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  const cloned = {};
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = deepClone(value);
  }
  return cloned;
}

/**
 * Check if value is empty (null, undefined, empty string/array/object)
 * @param {*} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Time
  formatRelativeTime,
  formatDuration,
  formatTimestamp,

  // Boolean
  parseBoolean,
  toBoolean,

  // Queue
  DROP_POLICIES,
  createManagedQueue,
  elideText,

  // Directive tags
  processDirectiveTags,

  // String
  truncate,
  capitalize,
  toKebabCase,
  toCamelCase,

  // Object
  deepClone,
  isEmpty,
};
