/**
 * Logger - Structured Logging จาก OpenClaw Pattern
 *
 * Features:
 * - Subsystem prefixes (gateway:, line:, autonomy:)
 * - Log levels (fatal, error, warn, info, debug, trace)
 * - File-based logging with rotation
 * - JSON structured format
 * - Color-coded console output
 *
 * @module logger
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================
// Constants
// ============================================================

/**
 * Log levels (lower = more severe)
 */
export const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
  silent: 99,
};

/**
 * Console colors for each level
 */
const LEVEL_COLORS = {
  fatal: '\x1b[31m', // Red
  error: '\x1b[31m', // Red
  warn: '\x1b[33m',  // Yellow
  info: '\x1b[36m',  // Cyan
  debug: '\x1b[35m', // Magenta
  trace: '\x1b[90m', // Gray
};

/**
 * Subsystem colors
 */
const SUBSYSTEM_COLORS = {
  gateway: '\x1b[36m',   // Cyan
  line: '\x1b[32m',      // Green
  autonomy: '\x1b[33m',  // Yellow
  memory: '\x1b[34m',    // Blue
  hooks: '\x1b[35m',     // Magenta
  config: '\x1b[90m',    // Gray
  default: '\x1b[37m',   // White
};

const RESET = '\x1b[0m';

// ============================================================
// Logger State
// ============================================================

let currentLevel = LOG_LEVELS.info;
let fileLogging = false;
let logFilePath = null;
let logStream = null;

// ============================================================
// Core Functions
// ============================================================

/**
 * Set log level
 * @param {string} level - Log level name
 */
export function setLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLevel = LOG_LEVELS[level];
    console.log(`[LOGGER] Level set to: ${level}`);
  } else {
    console.warn(`[LOGGER] Unknown level: ${level}`);
  }
}

/**
 * Get current log level
 * @returns {string} Current level name
 */
export function getLevel() {
  return Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === currentLevel) || 'info';
}

/**
 * Enable file logging
 * @param {string} filePath - Path to log file
 */
export function enableFileLogging(filePath) {
  if (!filePath) {
    const logDir = path.join(os.tmpdir(), 'oracle');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    filePath = path.join(logDir, `oracle-${new Date().toISOString().split('T')[0]}.log`);
  }

  logFilePath = filePath;
  fileLogging = true;

  // Create write stream (append mode)
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  console.log(`[LOGGER] File logging enabled: ${logFilePath}`);
}

/**
 * Disable file logging
 */
export function disableFileLogging() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  fileLogging = false;
  logFilePath = null;
}

/**
 * Format timestamp
 * @returns {string} ISO timestamp
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Parse subsystem from message
 * @param {string} message - Log message
 * @returns {object} { subsystem, cleanMessage }
 */
function parseSubsystem(message) {
  const match = message.match(/^(\w+):\s*(.*)$/);
  if (match) {
    return { subsystem: match[1], cleanMessage: match[2] };
  }
  return { subsystem: null, cleanMessage: message };
}

/**
 * Write log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function writeLog(level, message, meta = {}) {
  const levelNum = LOG_LEVELS[level];
  if (levelNum > currentLevel) {
    return; // Skip if below current level
  }

  const timestamp = formatTimestamp();
  const { subsystem, cleanMessage } = parseSubsystem(message);

  // Console output with colors
  const levelColor = LEVEL_COLORS[level] || '';
  const subsystemColor = SUBSYSTEM_COLORS[subsystem] || SUBSYSTEM_COLORS.default;
  const levelPad = level.toUpperCase().padEnd(5);

  let consoleMsg = `${RESET}${timestamp} `;
  consoleMsg += `${levelColor}[${levelPad}]${RESET} `;

  if (subsystem) {
    consoleMsg += `${subsystemColor}${subsystem}:${RESET} ${cleanMessage}`;
  } else {
    consoleMsg += cleanMessage;
  }

  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    consoleMsg += ` ${JSON.stringify(meta)}`;
  }

  // Write to console
  if (level === 'fatal' || level === 'error') {
    console.error(consoleMsg);
  } else if (level === 'warn') {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  // Write to file (JSON format)
  if (fileLogging && logStream) {
    const fileEntry = {
      timestamp,
      level,
      subsystem,
      message: cleanMessage,
      ...meta,
    };
    logStream.write(JSON.stringify(fileEntry) + '\n');
  }
}

// ============================================================
// Log Functions
// ============================================================

export function fatal(message, meta) {
  writeLog('fatal', message, meta);
}

export function error(message, meta) {
  writeLog('error', message, meta);
}

export function warn(message, meta) {
  writeLog('warn', message, meta);
}

export function info(message, meta) {
  writeLog('info', message, meta);
}

export function debug(message, meta) {
  writeLog('debug', message, meta);
}

export function trace(message, meta) {
  writeLog('trace', message, meta);
}

// ============================================================
// Subsystem Logger
// ============================================================

/**
 * Create a logger for a specific subsystem
 * @param {string} subsystem - Subsystem name
 * @returns {object} Logger with subsystem prefix
 */
export function createSubsystemLogger(subsystem) {
  const prefix = (msg) => `${subsystem}: ${msg}`;

  return {
    fatal: (msg, meta) => fatal(prefix(msg), meta),
    error: (msg, meta) => error(prefix(msg), meta),
    warn: (msg, meta) => warn(prefix(msg), meta),
    info: (msg, meta) => info(prefix(msg), meta),
    debug: (msg, meta) => debug(prefix(msg), meta),
    trace: (msg, meta) => trace(prefix(msg), meta),
  };
}

// Pre-created subsystem loggers
export const gatewayLog = createSubsystemLogger('gateway');
export const lineLog = createSubsystemLogger('line');
export const autonomyLog = createSubsystemLogger('autonomy');
export const memoryLog = createSubsystemLogger('memory');
export const hooksLog = createSubsystemLogger('hooks');
export const configLog = createSubsystemLogger('config');

// ============================================================
// Exports
// ============================================================

export default {
  // Levels
  LOG_LEVELS,
  setLevel,
  getLevel,

  // File logging
  enableFileLogging,
  disableFileLogging,

  // Log functions
  fatal,
  error,
  warn,
  info,
  debug,
  trace,

  // Subsystem loggers
  createSubsystemLogger,
  gatewayLog,
  lineLog,
  autonomyLog,
  memoryLog,
  hooksLog,
  configLog,
};
