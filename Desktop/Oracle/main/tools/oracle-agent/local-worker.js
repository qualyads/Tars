#!/usr/bin/env node
/**
 * Oracle Local Worker
 * รันบนเครื่อง Tars เพื่อ:
 * 1. Poll งานจาก Oracle API
 * 2. Execute commands ใน terminal
 * 3. Report ผลกลับ + แจ้ง LINE
 *
 * Usage: node local-worker.js
 *
 * @version 1.0.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Oracle API URL (Railway)
  oracleUrl: process.env.ORACLE_URL || 'https://oracle-agent-production-546e.up.railway.app',

  // Poll interval (seconds)
  pollInterval: parseInt(process.env.POLL_INTERVAL) || 60,

  // Max command execution time (ms)
  commandTimeout: parseInt(process.env.COMMAND_TIMEOUT) || 300000, // 5 minutes

  // Working directory
  workDir: process.env.WORK_DIR || '/Users/tanakitchaithip/Desktop/Oracle',

  // Log file
  logFile: path.join(__dirname, 'data/local-worker.log')
};

// =============================================================================
// LOGGING
// =============================================================================

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...data };

  console.log(`[${timestamp}] [${level}] ${message}`, data);

  // Append to log file
  try {
    const dir = path.dirname(CONFIG.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(CONFIG.logFile, JSON.stringify(logEntry) + '\n');
  } catch (e) {}
}

// =============================================================================
// API HELPERS
// =============================================================================

async function fetchFromOracle(endpoint, options = {}) {
  try {
    const response = await fetch(`${CONFIG.oracleUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    return await response.json();
  } catch (err) {
    log('ERROR', `API error: ${endpoint}`, { error: err.message });
    return null;
  }
}

async function getPendingTasks() {
  const result = await fetchFromOracle('/api/autonomous/tasks');
  return result?.pending || [];
}

async function completeTask(taskId, result) {
  return await fetchFromOracle(`/api/autonomous/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ result })
  });
}

async function notifyLine(message) {
  return await fetchFromOracle('/api/gateway/notify', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

// =============================================================================
// TASK EXECUTION
// =============================================================================

/**
 * Execute a shell command
 */
async function executeCommand(command, options = {}) {
  const cwd = options.cwd || CONFIG.workDir;
  const timeout = options.timeout || CONFIG.commandTimeout;

  log('INFO', `Executing command`, { command, cwd });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    return {
      success: true,
      stdout: stdout.slice(0, 5000), // Limit output
      stderr: stderr.slice(0, 1000)
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout?.slice(0, 5000) || '',
      stderr: err.stderr?.slice(0, 1000) || ''
    };
  }
}

/**
 * Process a task based on its type
 */
async function processTask(task) {
  log('INFO', `Processing task: ${task.id}`, { title: task.title, type: task.type });

  let result = { success: false, message: 'Unknown task type' };

  try {
    switch (task.type) {
      case 'command':
        // Execute shell command
        result = await executeCommand(task.command, {
          cwd: task.cwd,
          timeout: task.timeout
        });
        break;

      case 'research':
        // Research task - use Claude Code or web search
        result = {
          success: true,
          message: 'Research tasks should be done through Claude Code session',
          suggestion: task.description
        };
        break;

      case 'code':
        // Code generation - should be done through Claude Code
        result = {
          success: true,
          message: 'Code tasks should be done through Claude Code session',
          suggestion: task.description
        };
        break;

      case 'git':
        // Git operations
        result = await executeCommand(task.command || `git ${task.gitCommand}`, {
          cwd: task.cwd || CONFIG.workDir
        });
        break;

      case 'deploy':
        // Deploy to Railway
        result = await executeCommand('railway up', {
          cwd: task.cwd || path.join(CONFIG.workDir, 'main/tools/oracle-agent'),
          timeout: 300000
        });
        break;

      default:
        // For autonomous thinking tasks, just acknowledge
        if (task.source === 'autonomous_thinking') {
          result = {
            success: true,
            message: `Acknowledged: ${task.title}`,
            action: task.action
          };
        }
    }

    // Complete the task
    await completeTask(task.id, result);

    // Notify if important
    if (task.notify !== false && result.success) {
      await notifyLine(`✅ Task completed: ${task.title}\n${result.message || result.stdout?.slice(0, 200) || ''}`);
    }

    log('INFO', `Task completed: ${task.id}`, { success: result.success });

  } catch (err) {
    log('ERROR', `Task failed: ${task.id}`, { error: err.message });
    result = { success: false, error: err.message };
    await completeTask(task.id, result);
  }

  return result;
}

// =============================================================================
// MAIN LOOP
// =============================================================================

let isRunning = false;

async function pollAndProcess() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Get pending tasks
    const tasks = await getPendingTasks();

    if (tasks.length > 0) {
      log('INFO', `Found ${tasks.length} pending tasks`);

      // Process tasks one by one
      for (const task of tasks) {
        await processTask(task);
      }
    }

  } catch (err) {
    log('ERROR', 'Poll error', { error: err.message });
  }

  isRunning = false;
}

async function main() {
  console.log('========================================');
  console.log('  Oracle Local Worker v1.0.0');
  console.log('========================================');
  console.log(`Oracle URL: ${CONFIG.oracleUrl}`);
  console.log(`Poll Interval: ${CONFIG.pollInterval}s`);
  console.log(`Work Dir: ${CONFIG.workDir}`);
  console.log('========================================');

  // Check Oracle connection
  const health = await fetchFromOracle('/health');
  if (!health) {
    console.error('❌ Cannot connect to Oracle API');
    process.exit(1);
  }
  console.log(`✅ Connected to Oracle v${health.version}`);

  // Run immediately
  await pollAndProcess();

  // Then poll on interval
  setInterval(pollAndProcess, CONFIG.pollInterval * 1000);

  // Notify startup
  await notifyLine('🤖 Local Worker started - พร้อมทำงาน terminal แล้ว');

  console.log('\n🚀 Worker running... Press Ctrl+C to stop\n');
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await notifyLine('🛑 Local Worker stopped');
  process.exit(0);
});

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
