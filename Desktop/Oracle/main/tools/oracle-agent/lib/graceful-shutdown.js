/**
 * Graceful Shutdown - Multi-phase Shutdown Mechanism
 *
 * จาก OpenClaw Discussion: ป้องกัน data loss เวลา restart/deploy
 *
 * Features:
 * - Multi-phase shutdown (stop accepting → drain → cleanup → exit)
 * - Registered cleanup handlers
 * - Timeout protection
 * - Signal handling (SIGTERM, SIGINT)
 *
 * @module graceful-shutdown
 */

import { createSubsystemLogger } from './logger.js';

const log = createSubsystemLogger('shutdown');

// ============================================================
// Constants
// ============================================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const PHASES = ['stop', 'drain', 'cleanup', 'exit'];

// ============================================================
// State
// ============================================================

let isShuttingDown = false;
let shutdownTimeout = DEFAULT_TIMEOUT_MS;
const cleanupHandlers = new Map();

// ============================================================
// Handler Registration
// ============================================================

/**
 * Register a cleanup handler
 * @param {string} name - Handler name (for logging)
 * @param {Function} handler - Async cleanup function
 * @param {object} options
 * @param {string} [options.phase='cleanup'] - Phase to run in
 * @param {number} [options.priority=0] - Lower = runs first
 * @param {number} [options.timeout] - Individual handler timeout
 */
export function registerCleanup(name, handler, options = {}) {
  const { phase = 'cleanup', priority = 0, timeout } = options;

  if (!PHASES.includes(phase)) {
    log.warn(`Invalid phase "${phase}" for handler "${name}", using "cleanup"`);
  }

  cleanupHandlers.set(name, {
    name,
    handler,
    phase: PHASES.includes(phase) ? phase : 'cleanup',
    priority,
    timeout,
  });

  log.debug(`Registered cleanup handler: ${name} (phase: ${phase}, priority: ${priority})`);
}

/**
 * Unregister a cleanup handler
 * @param {string} name
 */
export function unregisterCleanup(name) {
  if (cleanupHandlers.delete(name)) {
    log.debug(`Unregistered cleanup handler: ${name}`);
  }
}

// ============================================================
// Shutdown Process
// ============================================================

/**
 * Check if shutdown is in progress
 * @returns {boolean}
 */
export function isShutdownInProgress() {
  return isShuttingDown;
}

/**
 * Execute graceful shutdown
 * @param {string} [reason='unknown'] - Shutdown reason
 * @param {number} [exitCode=0] - Exit code
 */
export async function shutdown(reason = 'unknown', exitCode = 0) {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  log.info(`Graceful shutdown initiated: ${reason}`);

  // Set overall timeout
  const timeoutId = setTimeout(() => {
    log.error(`Shutdown timeout (${shutdownTimeout}ms) exceeded, forcing exit`);
    process.exit(1);
  }, shutdownTimeout);

  try {
    // Execute phases in order
    for (const phase of PHASES) {
      if (phase === 'exit') continue; // Handle separately

      log.info(`Phase: ${phase}`);
      await executePhase(phase);
    }

    clearTimeout(timeoutId);
    log.info(`Shutdown complete, exiting with code ${exitCode}`);
    process.exit(exitCode);
  } catch (err) {
    clearTimeout(timeoutId);
    log.error(`Shutdown error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Execute all handlers for a phase
 * @param {string} phase
 */
async function executePhase(phase) {
  // Get handlers for this phase, sorted by priority
  const handlers = Array.from(cleanupHandlers.values())
    .filter((h) => h.phase === phase)
    .sort((a, b) => a.priority - b.priority);

  if (handlers.length === 0) {
    log.debug(`No handlers for phase: ${phase}`);
    return;
  }

  log.debug(`Executing ${handlers.length} handlers for phase: ${phase}`);

  for (const { name, handler, timeout } of handlers) {
    try {
      log.debug(`Running handler: ${name}`);

      if (timeout) {
        // Run with individual timeout
        await Promise.race([
          handler(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Handler timeout')), timeout)
          ),
        ]);
      } else {
        await handler();
      }

      log.debug(`Handler complete: ${name}`);
    } catch (err) {
      log.error(`Handler "${name}" failed: ${err.message}`);
      // Continue with other handlers
    }
  }
}

// ============================================================
// Signal Handlers
// ============================================================

/**
 * Setup signal handlers
 * @param {object} options
 * @param {number} [options.timeout] - Shutdown timeout in ms
 */
export function setupSignalHandlers(options = {}) {
  if (options.timeout) {
    shutdownTimeout = options.timeout;
  }

  // SIGTERM - Graceful shutdown (from Docker, Kubernetes, etc.)
  process.on('SIGTERM', () => {
    log.info('Received SIGTERM');
    shutdown('SIGTERM', 0);
  });

  // SIGINT - Ctrl+C
  process.on('SIGINT', () => {
    log.info('Received SIGINT');
    shutdown('SIGINT', 0);
  });

  // Uncaught exceptions
  process.on('uncaughtException', (err) => {
    log.error(`Uncaught exception: ${err.message}`);
    log.error(err.stack);
    shutdown('uncaughtException', 1);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    log.error(`Unhandled rejection: ${reason}`);
    shutdown('unhandledRejection', 1);
  });

  log.info(`Signal handlers configured (timeout: ${shutdownTimeout}ms)`);
}

// ============================================================
// Common Cleanup Handlers
// ============================================================

/**
 * Create HTTP server cleanup handler
 * @param {import('http').Server} server
 * @param {string} [name='http-server']
 */
export function registerHttpServer(server, name = 'http-server') {
  registerCleanup(
    name,
    () =>
      new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            log.warn(`Error closing ${name}: ${err.message}`);
          }
          resolve();
        });
      }),
    { phase: 'stop', priority: 0 }
  );
}

/**
 * Create database cleanup handler
 * @param {object} db - Database connection with close() method
 * @param {string} [name='database']
 */
export function registerDatabase(db, name = 'database') {
  registerCleanup(
    name,
    async () => {
      if (typeof db.close === 'function') {
        await db.close();
      }
    },
    { phase: 'cleanup', priority: 10 }
  );
}

/**
 * Create write stream cleanup handler
 * @param {import('fs').WriteStream} stream
 * @param {string} [name='write-stream']
 */
export function registerWriteStream(stream, name = 'write-stream') {
  registerCleanup(
    name,
    () =>
      new Promise((resolve) => {
        stream.end(() => resolve());
      }),
    { phase: 'drain', priority: 0 }
  );
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  PHASES,

  // Registration
  registerCleanup,
  unregisterCleanup,

  // Shutdown
  isShutdownInProgress,
  shutdown,

  // Setup
  setupSignalHandlers,

  // Common handlers
  registerHttpServer,
  registerDatabase,
  registerWriteStream,
};
