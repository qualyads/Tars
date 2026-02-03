/**
 * Process - Process Management จาก OpenClaw Pattern
 *
 * Features:
 * - Command Queue (Pump Pattern - FIFO with concurrency)
 * - Command Lanes (Main, Cron, Subagent, Nested)
 * - Timeout Management (SIGTERM → SIGKILL)
 * - Spawn with Fallback (retry with different options)
 *
 * @module process
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================
// Command Lanes
// ============================================================

/**
 * Command lane types - แยกประเภทคำสั่งเพื่อจัดการ concurrency
 */
export const COMMAND_LANES = {
  MAIN: 'main',         // User-initiated commands
  CRON: 'cron',         // Scheduled tasks
  SUBAGENT: 'subagent', // Sub-agent tasks
  NESTED: 'nested',     // Nested/recursive commands
};

/**
 * Default concurrency per lane
 */
const DEFAULT_LANE_CONCURRENCY = {
  [COMMAND_LANES.MAIN]: 1,      // One main command at a time
  [COMMAND_LANES.CRON]: 2,      // Two cron jobs can run
  [COMMAND_LANES.SUBAGENT]: 3,  // Multiple subagents
  [COMMAND_LANES.NESTED]: 1,    // One nested at a time
};

// ============================================================
// Command Queue (Pump Pattern)
// ============================================================

/**
 * Create a command queue with per-lane concurrency
 * @param {object} options
 * @returns {object} Queue controller
 */
export function createCommandQueue(options = {}) {
  const laneConcurrency = { ...DEFAULT_LANE_CONCURRENCY, ...options.concurrency };

  // Queue per lane
  const queues = new Map();
  const running = new Map();

  for (const lane of Object.values(COMMAND_LANES)) {
    queues.set(lane, []);
    running.set(lane, 0);
  }

  /**
   * Add command to queue
   * @param {Function} fn - Async function to execute
   * @param {string} lane - Command lane
   * @returns {Promise} Resolves when command completes
   */
  function enqueue(fn, lane = COMMAND_LANES.MAIN) {
    return new Promise((resolve, reject) => {
      const queue = queues.get(lane) || queues.get(COMMAND_LANES.MAIN);
      queue.push({ fn, resolve, reject, lane });
      pump(lane);
    });
  }

  /**
   * Process queue (Pump Pattern)
   * @param {string} lane
   */
  async function pump(lane) {
    const queue = queues.get(lane);
    const currentRunning = running.get(lane);
    const maxConcurrency = laneConcurrency[lane] || 1;

    // Check if we can run more
    if (currentRunning >= maxConcurrency || queue.length === 0) {
      return;
    }

    // Get next command
    const { fn, resolve, reject } = queue.shift();
    running.set(lane, currentRunning + 1);

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      running.set(lane, running.get(lane) - 1);
      // Continue pumping
      pump(lane);
    }
  }

  /**
   * Get queue status
   */
  function getStatus() {
    const status = {};
    for (const lane of Object.values(COMMAND_LANES)) {
      status[lane] = {
        queued: queues.get(lane).length,
        running: running.get(lane),
        maxConcurrency: laneConcurrency[lane],
      };
    }
    return status;
  }

  /**
   * Clear all queues
   */
  function clear() {
    for (const queue of queues.values()) {
      // Reject all pending
      for (const { reject } of queue) {
        reject(new Error('Queue cleared'));
      }
      queue.length = 0;
    }
  }

  return {
    enqueue,
    getStatus,
    clear,
    LANES: COMMAND_LANES,
  };
}

// ============================================================
// Process Execution with Timeout
// ============================================================

/**
 * Default timeout values
 */
const DEFAULT_TIMEOUTS = {
  command: 30000,      // 30 seconds for normal commands
  longRunning: 300000, // 5 minutes for long tasks
  killGrace: 5000,     // 5 seconds grace before SIGKILL
};

/**
 * Run command with timeout
 * @param {string} command - Command to run
 * @param {object} options
 * @returns {Promise<{stdout, stderr, exitCode}>}
 */
export async function runWithTimeout(command, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUTS.command,
    killGrace = DEFAULT_TIMEOUTS.killGrace,
    cwd = process.cwd(),
    env = process.env,
    shell = true,
  } = options;

  return new Promise((resolve, reject) => {
    let killed = false;
    let killTimer = null;
    let stdout = '';
    let stderr = '';

    // Spawn process
    const child = spawn(command, [], {
      shell,
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Timeout timer
    const timeoutTimer = setTimeout(() => {
      if (!killed) {
        killed = true;
        // Send SIGTERM first
        child.kill('SIGTERM');

        // Then SIGKILL after grace period
        killTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, killGrace);
      }
    }, timeout);

    // Collect stdout
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle completion
    child.on('close', (exitCode) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);

      if (killed) {
        reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
      } else {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          killed: false,
        });
      }
    });

    // Handle error
    child.on('error', (error) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
  });
}

/**
 * Run command with exec (simpler, for short commands)
 * @param {string} command
 * @param {object} options
 * @returns {Promise<{stdout, stderr}>}
 */
export async function runExec(command, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUTS.command,
    maxBuffer = 10 * 1024 * 1024, // 10MB
    cwd = process.cwd(),
    env = process.env,
  } = options;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer,
      cwd,
      env,
    });
    return {
      stdout: stdout?.trim() || '',
      stderr: stderr?.trim() || '',
      exitCode: 0,
    };
  } catch (error) {
    // exec throws on non-zero exit
    return {
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      exitCode: error.code || 1,
      error: error.message,
    };
  }
}

// ============================================================
// Spawn with Fallback
// ============================================================

/**
 * Spawn options to try (fallback chain)
 */
const SPAWN_FALLBACKS = [
  { shell: false },                    // Direct execution
  { shell: true },                     // With shell
  { shell: '/bin/bash' },              // Explicit bash
  { shell: '/bin/sh' },                // Fallback to sh
];

/**
 * Spawn with fallback - try multiple options if spawn fails
 * @param {string} command
 * @param {string[]} args
 * @param {object} options
 * @returns {Promise<ChildProcess>}
 */
export async function spawnWithFallback(command, args = [], options = {}) {
  const baseOptions = {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: options.stdio || 'pipe',
  };

  let lastError = null;

  for (const fallbackOpts of SPAWN_FALLBACKS) {
    try {
      const child = spawn(command, args, {
        ...baseOptions,
        ...fallbackOpts,
      });

      // Check if spawn succeeded
      await new Promise((resolve, reject) => {
        child.on('spawn', resolve);
        child.on('error', reject);

        // Timeout for spawn check
        setTimeout(() => reject(new Error('Spawn timeout')), 1000);
      });

      return child;
    } catch (error) {
      lastError = error;
      // Continue to next fallback
    }
  }

  throw lastError || new Error(`Failed to spawn: ${command}`);
}

/**
 * Check if command exists
 * @param {string} command
 * @returns {Promise<boolean>}
 */
export async function commandExists(command) {
  try {
    const checkCmd = process.platform === 'win32'
      ? `where ${command}`
      : `which ${command}`;

    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Process Utilities
// ============================================================

/**
 * Kill process tree (including children)
 * @param {number} pid - Process ID
 * @param {string} signal - Signal to send
 */
export async function killProcessTree(pid, signal = 'SIGTERM') {
  if (process.platform === 'win32') {
    // Windows: use taskkill
    try {
      await execAsync(`taskkill /pid ${pid} /T /F`);
    } catch {
      // Process might already be dead
    }
  } else {
    // Unix: kill process group
    try {
      process.kill(-pid, signal);
    } catch {
      // Try direct kill if group kill fails
      try {
        process.kill(pid, signal);
      } catch {
        // Process might already be dead
      }
    }
  }
}

/**
 * Wait for process to exit
 * @param {ChildProcess} child
 * @param {number} timeout
 * @returns {Promise<{exitCode, signal}>}
 */
export function waitForExit(child, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Process exit timeout'));
    }, timeout);

    child.on('exit', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Create a process pool for reusable processes
 * @param {object} options
 * @returns {object} Pool controller
 */
export function createProcessPool(options = {}) {
  const { maxSize = 5, idleTimeout = 60000 } = options;

  const pool = [];
  const timers = new Map();

  function add(child) {
    if (pool.length >= maxSize) {
      // Pool full, kill oldest
      const oldest = pool.shift();
      cleanup(oldest);
    }

    pool.push(child);

    // Set idle timeout
    const timer = setTimeout(() => {
      remove(child);
    }, idleTimeout);
    timers.set(child, timer);
  }

  function get() {
    const child = pool.pop();
    if (child) {
      const timer = timers.get(child);
      if (timer) {
        clearTimeout(timer);
        timers.delete(child);
      }
    }
    return child;
  }

  function remove(child) {
    const index = pool.indexOf(child);
    if (index !== -1) {
      pool.splice(index, 1);
    }
    cleanup(child);
  }

  function cleanup(child) {
    const timer = timers.get(child);
    if (timer) {
      clearTimeout(timer);
      timers.delete(child);
    }
    try {
      child.kill('SIGTERM');
    } catch {
      // Already dead
    }
  }

  function clear() {
    for (const child of pool) {
      cleanup(child);
    }
    pool.length = 0;
  }

  function getSize() {
    return pool.length;
  }

  return {
    add,
    get,
    remove,
    clear,
    getSize,
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  // Lanes
  COMMAND_LANES,

  // Queue
  createCommandQueue,

  // Execution
  runWithTimeout,
  runExec,

  // Spawn
  spawnWithFallback,
  commandExists,

  // Utilities
  killProcessTree,
  waitForExit,
  createProcessPool,
};
