/**
 * Session JSONL Logger - Structured Conversation Logging
 *
 * จาก OpenClaw Discussion: JSONL format ช่วยให้ debug ง่าย, ดู history, analytics
 *
 * Features:
 * - JSONL format (1 JSON object per line)
 * - Session-based file organization
 * - Automatic rotation
 * - Query capabilities
 *
 * @module session-jsonl
 */

import fs from 'fs';
import path from 'path';
import { createSubsystemLogger } from './logger.js';

const log = createSubsystemLogger('session-jsonl');

// ============================================================
// Constants
// ============================================================

const DEFAULT_SESSIONS_DIR = 'data/sessions';
const MAX_SESSION_SIZE_MB = 10;
const MAX_SESSION_AGE_DAYS = 30;

// ============================================================
// State
// ============================================================

let sessionsDir = DEFAULT_SESSIONS_DIR;
let initialized = false;

// Active write streams per session
const writeStreams = new Map();

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize JSONL session logging
 * @param {object} options
 * @param {string} options.dir - Sessions directory
 */
export function initSessionLogger(options = {}) {
  if (options.dir) {
    sessionsDir = options.dir;
  }

  // Ensure directory exists
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    log.info(`Created sessions directory: ${sessionsDir}`);
  }

  initialized = true;
  log.info(`Session logger initialized: ${sessionsDir}`);
}

/**
 * Get session file path
 * @param {string} sessionId - Session identifier (e.g., line:U123, telegram:456)
 * @returns {string} File path
 */
function getSessionFilePath(sessionId) {
  // Sanitize session ID for filename
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(sessionsDir, `${safeId}_${date}.jsonl`);
}

/**
 * Get or create write stream for session
 * @param {string} sessionId
 * @returns {fs.WriteStream}
 */
function getWriteStream(sessionId) {
  const filePath = getSessionFilePath(sessionId);

  // Check if we already have a stream for this file
  if (writeStreams.has(filePath)) {
    return writeStreams.get(filePath);
  }

  // Create new stream
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  writeStreams.set(filePath, stream);

  stream.on('error', (err) => {
    log.error(`Write stream error for ${sessionId}: ${err.message}`);
    writeStreams.delete(filePath);
  });

  return stream;
}

// ============================================================
// Logging Functions
// ============================================================

/**
 * Log entry types
 */
export const EntryType = {
  MESSAGE: 'message',
  SYSTEM: 'system',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  ERROR: 'error',
  METADATA: 'metadata',
};

/**
 * Log a conversation entry
 * @param {string} sessionId - Session identifier
 * @param {object} entry - Log entry
 * @param {string} entry.type - Entry type (message, system, tool_call, etc.)
 * @param {string} entry.role - Role (user, assistant, system)
 * @param {string} entry.content - Message content
 * @param {object} [entry.metadata] - Additional metadata
 */
export function logEntry(sessionId, entry) {
  if (!initialized) {
    initSessionLogger();
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    type: entry.type || EntryType.MESSAGE,
    role: entry.role,
    content: entry.content,
    ...(entry.metadata && { metadata: entry.metadata }),
  };

  const stream = getWriteStream(sessionId);
  stream.write(JSON.stringify(logEntry) + '\n');

  log.trace(`Logged entry for ${sessionId}: ${entry.type}`, { role: entry.role });
}

/**
 * Log user message
 * @param {string} sessionId
 * @param {string} content
 * @param {object} [metadata]
 */
export function logUserMessage(sessionId, content, metadata = {}) {
  logEntry(sessionId, {
    type: EntryType.MESSAGE,
    role: 'user',
    content,
    metadata,
  });
}

/**
 * Log assistant message
 * @param {string} sessionId
 * @param {string} content
 * @param {object} [metadata]
 */
export function logAssistantMessage(sessionId, content, metadata = {}) {
  logEntry(sessionId, {
    type: EntryType.MESSAGE,
    role: 'assistant',
    content,
    metadata,
  });
}

/**
 * Log system event
 * @param {string} sessionId
 * @param {string} event
 * @param {object} [data]
 */
export function logSystemEvent(sessionId, event, data = {}) {
  logEntry(sessionId, {
    type: EntryType.SYSTEM,
    role: 'system',
    content: event,
    metadata: data,
  });
}

/**
 * Log tool call
 * @param {string} sessionId
 * @param {string} toolName
 * @param {object} input
 */
export function logToolCall(sessionId, toolName, input) {
  logEntry(sessionId, {
    type: EntryType.TOOL_CALL,
    role: 'assistant',
    content: toolName,
    metadata: { input },
  });
}

/**
 * Log tool result
 * @param {string} sessionId
 * @param {string} toolName
 * @param {any} result
 */
export function logToolResult(sessionId, toolName, result) {
  logEntry(sessionId, {
    type: EntryType.TOOL_RESULT,
    role: 'tool',
    content: toolName,
    metadata: { result: typeof result === 'string' ? result : JSON.stringify(result).slice(0, 1000) },
  });
}

/**
 * Log error
 * @param {string} sessionId
 * @param {Error|string} error
 * @param {object} [context]
 */
export function logError(sessionId, error, context = {}) {
  logEntry(sessionId, {
    type: EntryType.ERROR,
    role: 'system',
    content: error instanceof Error ? error.message : error,
    metadata: {
      ...context,
      ...(error instanceof Error && { stack: error.stack }),
    },
  });
}

// ============================================================
// Query Functions
// ============================================================

/**
 * Read session log
 * @param {string} sessionId
 * @param {object} options
 * @param {string} [options.date] - Specific date (YYYY-MM-DD)
 * @param {number} [options.limit] - Max entries to return
 * @param {number} [options.offset] - Skip first N entries
 * @returns {object[]} Log entries
 */
export function readSessionLog(sessionId, options = {}) {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const date = options.date || new Date().toISOString().split('T')[0];
  const filePath = path.join(sessionsDir, `${safeId}_${date}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  let entries = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Apply offset
  if (options.offset) {
    entries = entries.slice(options.offset);
  }

  // Apply limit
  if (options.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * List all sessions
 * @param {object} options
 * @param {string} [options.date] - Filter by date
 * @returns {string[]} Session IDs
 */
export function listSessionLogs(options = {}) {
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  const files = fs.readdirSync(sessionsDir);
  const sessions = new Set();

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;

    // Extract session ID from filename (format: sessionId_date.jsonl)
    const match = file.match(/^(.+)_(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (match) {
      const [, sessionId, date] = match;

      // Filter by date if specified
      if (options.date && date !== options.date) continue;

      sessions.add(sessionId);
    }
  }

  return Array.from(sessions);
}

/**
 * Get session statistics
 * @param {string} sessionId
 * @param {string} [date]
 * @returns {object} Statistics
 */
export function getSessionStats(sessionId, date) {
  const entries = readSessionLog(sessionId, { date });

  const stats = {
    totalEntries: entries.length,
    messageCount: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    errors: 0,
    firstEntry: null,
    lastEntry: null,
  };

  for (const entry of entries) {
    if (entry.type === EntryType.MESSAGE) {
      stats.messageCount++;
      if (entry.role === 'user') stats.userMessages++;
      if (entry.role === 'assistant') stats.assistantMessages++;
    }
    if (entry.type === EntryType.TOOL_CALL) stats.toolCalls++;
    if (entry.type === EntryType.ERROR) stats.errors++;
  }

  if (entries.length > 0) {
    stats.firstEntry = entries[0].timestamp;
    stats.lastEntry = entries[entries.length - 1].timestamp;
  }

  return stats;
}

// ============================================================
// Cleanup Functions
// ============================================================

/**
 * Close all write streams
 */
export function closeAllStreams() {
  for (const [filePath, stream] of writeStreams) {
    stream.end();
    log.debug(`Closed stream: ${filePath}`);
  }
  writeStreams.clear();
}

/**
 * Cleanup old session logs
 * @param {number} [maxAgeDays=30] - Max age in days
 * @returns {number} Number of files deleted
 */
export function cleanupOldLogs(maxAgeDays = MAX_SESSION_AGE_DAYS) {
  if (!fs.existsSync(sessionsDir)) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const files = fs.readdirSync(sessionsDir);
  let deleted = 0;

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;

    const match = file.match(/_(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (match && match[1] < cutoffStr) {
      const filePath = path.join(sessionsDir, file);
      fs.unlinkSync(filePath);
      deleted++;
      log.info(`Deleted old log: ${file}`);
    }
  }

  return deleted;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Init
  initSessionLogger,

  // Constants
  EntryType,

  // Logging
  logEntry,
  logUserMessage,
  logAssistantMessage,
  logSystemEvent,
  logToolCall,
  logToolResult,
  logError,

  // Query
  readSessionLog,
  listSessionLogs,
  getSessionStats,

  // Cleanup
  closeAllStreams,
  cleanupOldLogs,
};
